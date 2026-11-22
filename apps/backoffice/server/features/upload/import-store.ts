import { createHash } from "node:crypto";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig } from "../../config/app-config.ts";
import { AppError } from "../../shared/app-error.ts";
import {
  ensureDirectory,
  readJsonIfExists,
  resolveInside,
  writeFileAtomic,
  writeJsonAtomic,
} from "../../shared/safe-file-system.ts";
import { assertId, createId, isId } from "../../shared/identifiers.ts";
import { compileSchema } from "../../shared/json-schema-validation.ts";

const numbered = (index: number, extension: string) => `${index}${extension}`;

interface ImportRecord {
  id: string;
  originalName: string;
  createdAt: string;
  pageCount: number;
  byteSize: number;
  sha256: string;
}

const validateRecord = compileSchema<ImportRecord>({
  type: "object",
  additionalProperties: false,
  required: ["id", "originalName", "createdAt", "pageCount", "byteSize", "sha256"],
  properties: {
    id: { type: "string" },
    originalName: { type: "string" },
    createdAt: { type: "string" },
    pageCount: { type: "integer", minimum: 1 },
    byteSize: { type: "integer", minimum: 1 },
    sha256: { type: "string" },
  },
});

type ImportStore = ReturnType<typeof createImportStore>;

function createImportStore(config: AppConfig) {
  const layout = config.workspace;
  const root = join(config.paths.workspaceDirectory, layout.importsDirectory);
  const directory = (id: string) => resolveInside(root, assertId(id));
  const file = (id: string, ...parts: string[]) => resolveInside(directory(id), ...parts);

  const paths = {
    directory,
    record: (id: string) => file(id, layout.importFile),
    source: (id: string) => file(id, layout.sourceFile),
    plan: (id: string) => file(id, layout.planFile),
    job: (id: string) => file(id, layout.jobFile),
    draft: (id: string) => file(id, layout.draftFile),
    page: (id: string, page: number) => file(id, layout.pagesDirectory, numbered(page, layout.pngExtension)),
    segmentImage: (id: string, segment: number) =>
      file(id, layout.segmentsDirectory, numbered(segment, layout.pngExtension)),
    segmentResult: (id: string, segment: number) =>
      file(id, layout.segmentsDirectory, numbered(segment, layout.jsonExtension)),
    assetsIndex: (id: string) => file(id, layout.assetsIndexFile),
    asset: (id: string, assetId: string) =>
      file(id, layout.assetsDirectory, `${assertId(assetId)}${layout.pngExtension}`),
  };

  async function get(id: string): Promise<ImportRecord> {
    const record = await readJsonIfExists(paths.record(id));
    if (record === null) throw new AppError("notFound");
    return validateRecord.assert(record, "unexpected");
  }

  return {
    root,
    paths,
    get,
    async create(input: { bytes: Uint8Array; originalName: string; pageCount: number }) {
      const id = createId();
      await ensureDirectory(directory(id));
      await writeFileAtomic(paths.source(id), input.bytes);
      const record: ImportRecord = {
        id,
        originalName: input.originalName,
        createdAt: new Date().toISOString(),
        pageCount: input.pageCount,
        byteSize: input.bytes.byteLength,
        sha256: createHash("sha256").update(input.bytes).digest("hex"),
      };
      await writeJsonAtomic(paths.record(id), record);
      return record;
    },
    async list(): Promise<ImportRecord[]> {
      await ensureDirectory(root);
      const entries = await readdir(root, { withFileTypes: true });
      const records = await Promise.all(
        entries
          .filter((entry) => entry.isDirectory() && isId(entry.name))
          .map((entry) => get(entry.name).catch(() => null)),
      );
      return records
        .filter((record): record is ImportRecord => record !== null)
        .toSorted((first, second) => second.createdAt.localeCompare(first.createdAt));
    },
    async remove(id: string) {
      await get(id);
      await rm(directory(id), { recursive: true, force: true });
    },
  };
}

export { createImportStore };
export type { ImportRecord, ImportStore };
