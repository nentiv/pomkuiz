import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from "fastify";
import { loadConfig, type AppConfig } from "../../server/config/app-config.ts";
import type { ClaudeClient } from "../../server/features/ocr/claude-client.ts";
import { buildApp } from "../../server/http/build-http-app.ts";
import { createServices, type Services } from "../../server/http/create-services.ts";

interface TestContext {
  root: string;
  config: AppConfig;
  services: Services;
  app: FastifyInstance;
  request(options: InjectOptions): Promise<LightMyRequestResponse>;
  close(): Promise<void>;
}

async function createTestContext(client: ClaudeClient, env: Record<string, string> = {}): Promise<TestContext> {
  const root = await mkdtemp(join(tmpdir(), "pomkuiz-test-"));
  const dataDirectory = join(root, "data");
  const config = loadConfig({
    POMKUIZ_DATA_DIR: dataDirectory,
    POMKUIZ_WORKSPACE_DIR: join(root, "workspace"),
    ...env,
  });
  const services = await createServices(config, { client });
  const app = await buildApp(services);
  const host = `${config.server.host}:${config.server.port}`;
  const csrf = config.server.csrfHeader;
  return {
    root,
    config,
    services,
    app,
    request(options) {
      return app.inject({
        ...options,
        headers: { host, [csrf.name]: csrf.value, ...options.headers },
      });
    },
    async close() {
      await services.jobs.shutdown();
      await app.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}

function multipartBody(field: string, fileName: string, mimeType: string, bytes: Uint8Array) {
  const boundary = `----pomkuiz${Date.now()}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${fileName}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return {
    payload: Buffer.concat([head, Buffer.from(bytes), tail]),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}` },
  };
}

async function waitForJob(context: TestContext, importId: string, timeoutMs = 30_000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const progress = await context.services.jobs.progress(importId);
    if (!context.services.jobs.isActive(importId) && progress.status !== "queued") return progress;
    await new Promise((resolve) => {
      setTimeout(resolve, 25);
    });
  }
  throw new Error(`job ${importId} did not finish`);
}

export { createTestContext, multipartBody, waitForJob };
export type { TestContext };
