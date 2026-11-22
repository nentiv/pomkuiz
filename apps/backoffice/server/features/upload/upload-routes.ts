import type { FastifyInstance } from "fastify";
import { AppError } from "../../shared/app-error.ts";
import { importParams, pageParams, sendPng, type ImportParams } from "../../http/route-helpers.ts";
import type { Services } from "../../http/create-services.ts";
import { countStatuses } from "../review/draft-types.ts";
import type { ImportRecord } from "./import-store.ts";
import { displayName, validatePdfUpload } from "./validate-pdf-upload.ts";

async function summarize(services: Services, record: ImportRecord) {
  const [job, draft] = await Promise.all([
    services.jobs.progress(record.id),
    services.drafts.find(record.id).catch(() => null),
  ]);
  return {
    ...record,
    job,
    active: services.jobs.isActive(record.id),
    draft: draft
      ? {
          title: draft.meta.title,
          revision: draft.revision,
          questionCount: draft.questions.length,
          statuses: countStatuses(draft.questions),
          lastExport: draft.lastExport,
        }
      : null,
  };
}

function registerUploadRoutes(app: FastifyInstance, services: Services): void {
  const { config, store, jobs } = services;

  app.post("/api/imports", async (request, reply) => {
    const file = await request.file({
      limits: {
        fileSize: config.upload.maxPdfBytes,
        files: config.upload.multipartFiles,
        fields: config.upload.multipartFields,
        fieldSize: config.upload.multipartFieldBytes,
      },
    });
    if (!file) throw new AppError("invalidRequest");
    const bytes = new Uint8Array(await file.toBuffer());
    const fileName = displayName(file.filename, config.upload.originalNameCharacters);
    const pageCount = validatePdfUpload({ bytes, mimeType: file.mimetype, fileName }, config.upload);
    const record = await store.create({ bytes, originalName: fileName, pageCount });
    void jobs.start(record.id);
    return reply.code(201).send({ import: await summarize(services, record) });
  });

  app.get("/api/imports", async () => {
    const records = await store.list();
    return { imports: await Promise.all(records.map((record) => summarize(services, record))) };
  });

  app.get<{ Params: ImportParams }>(
    "/api/imports/:importId",
    { schema: { params: importParams } },
    async (request) => ({
      import: await summarize(services, await store.get(request.params.importId)),
    }),
  );

  app.delete<{ Params: ImportParams }>(
    "/api/imports/:importId",
    { schema: { params: importParams } },
    async (request, reply) => {
      if (jobs.isActive(request.params.importId)) throw new AppError("jobRunning");
      await store.remove(request.params.importId);
      return reply.code(204).send();
    },
  );

  app.get<{ Params: ImportParams & { page: number } }>(
    "/api/imports/:importId/pages/:page",
    { schema: { params: pageParams } },
    (request, reply) => sendPng(reply, store.paths.page(request.params.importId, request.params.page)),
  );
}

export { registerUploadRoutes };
