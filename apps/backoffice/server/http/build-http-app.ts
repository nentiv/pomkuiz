import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import { registerExportRoutes } from "../features/export/export-routes.ts";
import { registerJobRoutes } from "../features/jobs/job-routes.ts";
import { registerReviewRoutes } from "../features/review/review-routes.ts";
import { registerUploadRoutes } from "../features/upload/upload-routes.ts";
import { AppError } from "../shared/app-error.ts";
import { pathExists } from "../shared/safe-file-system.ts";
import { registerSecurity } from "./http-security.ts";
import type { Services } from "./create-services.ts";

const FASTIFY_ERROR_CODES = Object.freeze({
  fileTooLarge: "FST_REQ_FILE_TOO_LARGE",
  partsLimit: "FST_PARTS_LIMIT",
  filesLimit: "FST_FILES_LIMIT",
  bodyTooLarge: "FST_ERR_CTP_BODY_TOO_LARGE",
  notMultipart: "FST_INVALID_MULTIPART_CONTENT_TYPE",
});

const CLIENT_ERROR_MIN = 400;
const SERVER_ERROR_MIN = 500;

function toHttpError(error: FastifyError | Error): AppError {
  if (error instanceof AppError) return error;
  const fastifyError = error as FastifyError;
  if (fastifyError.validation) return new AppError("invalidRequest", error.message);
  switch (fastifyError.code) {
    case FASTIFY_ERROR_CODES.fileTooLarge:
    case FASTIFY_ERROR_CODES.bodyTooLarge:
      return new AppError("payloadTooLarge");
    case FASTIFY_ERROR_CODES.partsLimit:
    case FASTIFY_ERROR_CODES.filesLimit:
    case FASTIFY_ERROR_CODES.notMultipart:
      return new AppError("invalidRequest", error.message);
    default: {
      const status = fastifyError.statusCode ?? SERVER_ERROR_MIN;
      return new AppError(
        status >= CLIENT_ERROR_MIN && status < SERVER_ERROR_MIN ? "invalidRequest" : "unexpected",
        error.message,
      );
    }
  }
}

async function buildApp(services: Services, port = services.config.server.port): Promise<FastifyInstance> {
  const { config } = services;
  const app = Fastify({
    logger: false,
    bodyLimit: config.server.jsonBodyLimitBytes,
    trustProxy: false,
  });

  registerSecurity(app, config.server, port);
  await app.register(multipart, { throwFileSizeLimit: true });

  app.setErrorHandler((error, _request, reply) => {
    const failure = toHttpError(error instanceof Error ? error : new Error(String(error)));
    return reply.code(failure.status).send({
      error: { code: failure.code, message: failure.userMessage, detail: failure.detail, data: failure.data },
    });
  });

  app.get("/api/health", async () => ({
    claude: await services.client.status(),
    ocr: { model: config.ocr.model, effort: config.ocr.effort, concurrency: config.ocr.concurrency },
    dataDirectory: config.paths.dataDirectory,
  }));

  registerUploadRoutes(app, services);
  registerJobRoutes(app, services);
  registerReviewRoutes(app, services);
  registerExportRoutes(app, services);

  const hasUi = await pathExists(config.paths.uiDistDirectory);
  if (hasUi) await app.register(fastifyStatic, { root: config.paths.uiDistDirectory, wildcard: false });

  app.setNotFoundHandler((request, reply) => {
    if (request.method === "GET" && hasUi && !request.url.startsWith(config.server.apiPrefix))
      return reply.sendFile("index.html");
    return reply
      .code(404)
      .send({ error: { code: "notFound", message: new AppError("notFound").userMessage, data: {} } });
  });

  return app;
}

export { buildApp };
