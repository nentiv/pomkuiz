import type { FastifyInstance } from "fastify";
import { importParams, type ImportParams } from "../../http/route-helpers.ts";
import type { Services } from "../../http/create-services.ts";
import { PROGRESS_EVENT } from "./job-runner.ts";
import type { JobProgress } from "./job-state.ts";

const SSE_HEADERS = Object.freeze({
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-store",
  connection: "keep-alive",
  "x-accel-buffering": "no",
});

function registerJobRoutes(app: FastifyInstance, services: Services): void {
  const { jobs, store, config } = services;

  app.post<{ Params: ImportParams }>(
    "/api/imports/:importId/resume",
    { schema: { params: importParams } },
    async (request, reply) => {
      await store.get(request.params.importId);
      void jobs.start(request.params.importId);
      return reply.code(202).send({ progress: await jobs.progress(request.params.importId) });
    },
  );

  app.post<{ Params: ImportParams }>(
    "/api/imports/:importId/pause",
    { schema: { params: importParams } },
    async (request, reply) => {
      await store.get(request.params.importId);
      jobs.pause(request.params.importId);
      return reply.code(202).send({});
    },
  );

  app.get("/api/events", (request, reply) => {
    for (const [name, value] of Object.entries(config.server.securityHeaders)) reply.raw.setHeader(name, value);
    reply.raw.writeHead(200, SSE_HEADERS);
    const send = (progress: JobProgress) =>
      reply.raw.write(`event: ${PROGRESS_EVENT}\ndata: ${JSON.stringify(progress)}\n\n`);
    const heartbeat = setInterval(() => reply.raw.write(":\n\n"), config.server.sseHeartbeatMs);
    jobs.events.on(PROGRESS_EVENT, send);
    request.raw.on("close", () => {
      clearInterval(heartbeat);
      jobs.events.off(PROGRESS_EVENT, send);
    });
    reply.hijack();
  });
}

export { registerJobRoutes };
