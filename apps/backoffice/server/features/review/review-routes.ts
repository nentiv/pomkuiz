import type { FastifyInstance } from "fastify";
import { AppError } from "../../shared/app-error.ts";
import { assetParams, importParams, sendPng, type ImportParams } from "../../http/route-helpers.ts";
import type { Services } from "../../http/create-services.ts";
import { loadPlan } from "../render/prepare-import.ts";

const cropBody = {
  type: "object",
  additionalProperties: false,
  required: ["page", "box"],
  properties: {
    page: { type: "integer", minimum: 0 },
    box: {
      type: "object",
      additionalProperties: false,
      required: ["x0", "y0", "x1", "y1"],
      properties: {
        x0: { type: "number" },
        y0: { type: "number" },
        x1: { type: "number" },
        y1: { type: "number" },
      },
    },
  },
} as const;

interface CropBody {
  page: number;
  box: { x0: number; y0: number; x1: number; y1: number };
}

function registerReviewRoutes(app: FastifyInstance, services: Services): void {
  const { store, drafts, assets, jobs, config } = services;

  app.get<{ Params: ImportParams }>(
    "/api/imports/:importId/draft",
    { schema: { params: importParams } },
    async (request) => {
      const { importId } = request.params;
      const [record, draft, plan, assetIndex] = await Promise.all([
        store.get(importId),
        drafts.load(importId),
        loadPlan(store, importId),
        assets.readIndex(importId),
      ]);
      return {
        import: record,
        draft,
        pages: (plan?.pages ?? []).map(({ index, width, height }) => ({ index, width, height })),
        assets: assetIndex,
      };
    },
  );

  app.put<{ Params: ImportParams }>(
    "/api/imports/:importId/draft",
    { schema: { params: importParams } },
    async (request) => {
      const draft = await drafts.update(request.params.importId, request.body);
      return { revision: draft.revision, updatedAt: draft.updatedAt };
    },
  );

  app.post<{ Params: ImportParams }>(
    "/api/imports/:importId/draft/rebuild",
    { schema: { params: importParams } },
    async (request) => {
      await jobs.rebuildDraft(request.params.importId);
      return { draft: await drafts.load(request.params.importId) };
    },
  );

  app.get<{ Params: ImportParams & { assetId: string } }>(
    "/api/imports/:importId/assets/:assetId",
    { schema: { params: assetParams } },
    (request, reply) => sendPng(reply, store.paths.asset(request.params.importId, request.params.assetId)),
  );

  app.post<{ Params: ImportParams; Body: CropBody }>(
    "/api/imports/:importId/assets/crop",
    { schema: { params: importParams, body: cropBody } },
    async (request) => {
      const plan = await loadPlan(store, request.params.importId);
      if (!plan) throw new AppError("jobNotReady");
      return { asset: await assets.cropManual(request.params.importId, plan, request.body.page, request.body.box) };
    },
  );

  app.post<{ Params: ImportParams }>(
    "/api/imports/:importId/assets/upload",
    { schema: { params: importParams } },
    async (request) => {
      await store.get(request.params.importId);
      const file = await request.file({
        limits: {
          fileSize: config.upload.maxImageBytes,
          files: config.upload.multipartFiles,
          fields: config.upload.multipartFields,
          fieldSize: config.upload.multipartFieldBytes,
        },
      });
      if (!file) throw new AppError("invalidRequest");
      const bytes = new Uint8Array(await file.toBuffer());
      return { asset: await assets.upload(request.params.importId, bytes, file.mimetype) };
    },
  );
}

export { registerReviewRoutes };
