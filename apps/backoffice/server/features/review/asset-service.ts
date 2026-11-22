import { readFile } from "node:fs/promises";
import type { AppConfig } from "../../config/app-config.ts";
import { AppError } from "../../shared/app-error.ts";
import { readJsonIfExists, writeFileAtomic, writeJsonAtomic } from "../../shared/safe-file-system.ts";
import { createId } from "../../shared/identifiers.ts";
import { compileSchema } from "../../shared/json-schema-validation.ts";
import { createSerialQueue } from "../../shared/serial-queue.ts";
import { boxArea, expand, normalizeBox, pageBounds, type Box } from "../render/page-geometry.ts";
import { openPdf, reencodeImage, type PdfHandle } from "../render/pdf-document.ts";
import { PDF_MIME_TYPE, type ImportPlan } from "../render/prepare-import.ts";
import type { ImportStore } from "../upload/import-store.ts";

const ASSET_ORIGINS = ["auto", "crop", "upload"] as const;
type AssetOrigin = (typeof ASSET_ORIGINS)[number];

interface AssetRecord {
  id: string;
  origin: AssetOrigin;
  page: number | null;
  box: Box | null;
  width: number;
  height: number;
  createdAt: string;
}

type AssetIndex = Record<string, AssetRecord>;

const validateIndex = compileSchema<AssetIndex>({
  type: "object",
  additionalProperties: {
    type: "object",
    required: ["id", "origin", "page", "box", "width", "height", "createdAt"],
    properties: {
      id: { type: "string" },
      origin: { enum: [...ASSET_ORIGINS] },
      page: { type: ["integer", "null"] },
      box: { type: ["object", "null"] },
      width: { type: "integer" },
      height: { type: "integer" },
      createdAt: { type: "string" },
    },
  },
});

function figureScale(box: Box, render: AppConfig["render"]): number {
  const area = Math.max(1, boxArea(box));
  return Math.min(render.figureScale, Math.sqrt(render.maxFigurePixels / area));
}

type AssetService = ReturnType<typeof createAssetService>;

function createAssetService(store: ImportStore, config: AppConfig) {
  const serialize = createSerialQueue();

  async function readIndex(importId: string): Promise<AssetIndex> {
    const raw = await readJsonIfExists(store.paths.assetsIndex(importId));
    return raw === null ? {} : validateIndex.assert(raw, "unexpected");
  }

  function register(importId: string, record: AssetRecord, png: Uint8Array) {
    return serialize(async () => {
      await writeFileAtomic(store.paths.asset(importId, record.id), png);
      const index = await readIndex(importId);
      index[record.id] = record;
      await writeJsonAtomic(store.paths.assetsIndex(importId), index);
      return record;
    });
  }

  function cropWith(pdf: PdfHandle, page: number, box: Box) {
    const scale = figureScale(box, config.render);
    const png = pdf.renderRegion(page, box, scale);
    return {
      png,
      width: Math.ceil(box.x1 * scale) - Math.floor(box.x0 * scale),
      height: Math.ceil(box.y1 * scale) - Math.floor(box.y0 * scale),
    };
  }

  async function openSource(importId: string): Promise<PdfHandle> {
    return openPdf(await readFile(store.paths.source(importId)), PDF_MIME_TYPE);
  }

  function cropFromPdf(
    importId: string,
    pdf: PdfHandle,
    page: number,
    box: Box,
    origin: AssetOrigin,
  ): Promise<AssetRecord> {
    const image = cropWith(pdf, page, box);
    const record: AssetRecord = {
      id: createId(),
      origin,
      page,
      box,
      width: image.width,
      height: image.height,
      createdAt: new Date().toISOString(),
    };
    return register(importId, record, image.png);
  }

  async function cropManual(importId: string, plan: ImportPlan, page: number, requested: Box): Promise<AssetRecord> {
    const planPage = plan.pages[page];
    if (!planPage) throw new AppError("invalidRequest");
    const box = expand(normalizeBox(requested), 0, pageBounds(planPage));
    if (boxArea(box) < config.render.minFigureSizePt ** 2) throw new AppError("invalidRequest");
    const pdf = await openSource(importId);
    try {
      return await cropFromPdf(importId, pdf, page, box, "crop");
    } finally {
      pdf.close();
    }
  }

  async function upload(importId: string, bytes: Uint8Array, mimeType: string): Promise<AssetRecord> {
    if (!config.upload.imageMimeTypes.includes(mimeType)) throw new AppError("unsupportedMedia");
    if (bytes.byteLength > config.upload.maxImageBytes) throw new AppError("payloadTooLarge");
    const image = reencodeImage(bytes, config.upload.maxImagePixels);
    const record: AssetRecord = {
      id: createId(),
      origin: "upload",
      page: null,
      box: null,
      width: image.width,
      height: image.height,
      createdAt: new Date().toISOString(),
    };
    return await register(importId, record, image.png);
  }

  async function assertKnown(importId: string, assetIds: readonly string[]): Promise<void> {
    const index = await readIndex(importId);
    if (assetIds.some((id) => !Object.hasOwn(index, id))) throw new AppError("invalidRequest");
  }

  return { readIndex, openSource, cropFromPdf, cropManual, upload, assertKnown };
}

export { createAssetService };
export type { AssetRecord, AssetService };
