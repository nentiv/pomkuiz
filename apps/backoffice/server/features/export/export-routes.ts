import type { FastifyInstance } from "fastify";
import { importParams, type ImportParams } from "../../http/route-helpers.ts";
import type { Services } from "../../http/create-services.ts";

const exportBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    force: { type: "boolean", default: false },
    overwrite: { type: "boolean", default: false },
  },
} as const;

function registerExportRoutes(app: FastifyInstance, services: Services): void {
  const { exporter } = services;

  app.post<{ Params: ImportParams; Body: { force: boolean; overwrite: boolean } }>(
    "/api/imports/:importId/export",
    { schema: { params: importParams, body: exportBody } },
    async (request) => ({ result: await exporter.exportDraft(request.params.importId, request.body) }),
  );

  app.get("/api/quizzes", async () => {
    const report = await exporter.regenerateIndex();
    return { index: report.index, rejected: report.rejected };
  });
}

export { registerExportRoutes };
