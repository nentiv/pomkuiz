import type { QuizIndex } from "@pomkuiz/quiz-contract";
import type { JobProgress } from "../../../server/features/jobs/job-state.ts";
import type { AssetRecord } from "../../../server/features/review/asset-service.ts";
import type { Draft, DraftContent, QuestionStatus } from "../../../server/features/review/draft-types.ts";
import type { ImportRecord } from "../../../server/features/upload/import-store.ts";
import type { ExportResult } from "../../../server/features/export/quiz-exporter.ts";
import { UI_CONFIG } from "../ui-config.ts";

interface ImportSummary extends ImportRecord {
  job: JobProgress;
  active: boolean;
  draft: {
    title: string;
    revision: number;
    questionCount: number;
    statuses: Record<QuestionStatus, number>;
    lastExport: { quizId: string; at: string } | null;
  } | null;
}

interface Health {
  claude: { executable: string | null; loggedIn: boolean; authMethod: string | null; subscription: string | null };
  ocr: { model: string; effort: string; concurrency: number };
  dataDirectory: string;
}

interface DraftPayload {
  import: ImportRecord;
  draft: Draft;
  pages: { index: number; width: number; height: number }[];
  assets: Record<string, AssetRecord>;
}

class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly detail: string;
  readonly data: Record<string, unknown>;

  constructor(
    status: number,
    body: { code?: string; message?: string; detail?: string; data?: Record<string, unknown> },
  ) {
    super(body.message ?? String(status));
    this.status = status;
    this.code = body.code ?? "unexpected";
    this.detail = body.detail ?? "";
    this.data = body.data ?? {};
  }
}

const NO_CONTENT = 204;
const JSON_TYPE = "application/json";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set(UI_CONFIG.csrfHeader.name, UI_CONFIG.csrfHeader.value);
  if (typeof init.body === "string") headers.set("content-type", JSON_TYPE);
  const response = await fetch(`${UI_CONFIG.apiPrefix}${path}`, { ...init, headers, credentials: "same-origin" });
  if (response.status === NO_CONTENT) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as { error?: ConstructorParameters<typeof ApiError>[1] } & T;
  if (!response.ok) throw new ApiError(response.status, body.error ?? {});
  return body;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

function upload(file: File): RequestInit {
  const form = new FormData();
  form.append("file", file, file.name);
  return { method: "POST", body: form };
}

const api = {
  health: () => request<Health>("/health"),
  imports: () => request<{ imports: ImportSummary[] }>("/imports").then((body) => body.imports),
  uploadPdf: (file: File) => request<{ import: ImportSummary }>("/imports", upload(file)).then((body) => body.import),
  removeImport: (id: string) => request<void>(`/imports/${id}`, { method: "DELETE" }),
  resume: (id: string) => request<unknown>(`/imports/${id}/resume`, json("POST", {})),
  pause: (id: string) => request<unknown>(`/imports/${id}/pause`, json("POST", {})),
  draft: (id: string) => request<DraftPayload>(`/imports/${id}/draft`),
  saveDraft: (id: string, revision: number, content: DraftContent, keepalive = false) =>
    request<{ revision: number; updatedAt: string }>(`/imports/${id}/draft`, {
      ...json("PUT", { revision, ...content }),
      keepalive,
    }),
  rebuildDraft: (id: string) => request<{ draft: Draft }>(`/imports/${id}/draft/rebuild`, json("POST", {})),
  crop: (id: string, page: number, box: { x0: number; y0: number; x1: number; y1: number }) =>
    request<{ asset: AssetRecord }>(`/imports/${id}/assets/crop`, json("POST", { page, box })).then(
      (body) => body.asset,
    ),
  uploadImage: (id: string, file: File) =>
    request<{ asset: AssetRecord }>(`/imports/${id}/assets/upload`, upload(file)).then((body) => body.asset),
  exportDraft: (id: string, options: { force: boolean; overwrite: boolean }) =>
    request<{ result: ExportResult }>(`/imports/${id}/export`, json("POST", options)).then((body) => body.result),
  quizzes: () => request<{ index: QuizIndex }>("/quizzes"),
  pageUrl: (id: string, page: number) => `${UI_CONFIG.apiPrefix}/imports/${id}/pages/${page}`,
  assetUrl: (id: string, assetId: string) => `${UI_CONFIG.apiPrefix}/imports/${id}/assets/${assetId}`,
};

function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.detail ? `${error.message} (${error.detail})` : error.message;
  return error instanceof Error ? error.message : String(error);
}

export { ApiError, api, describeError };
export type { ImportSummary, Health, DraftPayload };
