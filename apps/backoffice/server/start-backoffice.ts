import { loadConfig } from "./config/app-config.ts";
import { buildApp } from "./http/build-http-app.ts";
import { assertLoopbackHost } from "./http/http-security.ts";
import { createServices } from "./http/create-services.ts";

const STOP_SIGNALS = ["SIGINT", "SIGTERM"] as const;

const config = loadConfig();
assertLoopbackHost(config.server.host, config.server.loopbackHosts);
const services = await createServices(config);
await services.jobs.recoverInterrupted((await services.store.list()).map((record) => record.id));
const app = await buildApp(services);
await app.listen({ host: config.server.host, port: config.server.port });

const status = await services.client.status();
process.stdout.write(
  [
    `POMKUIZ backoffice : http://${config.server.host}:${config.server.port}`,
    `claude : ${status.executable ?? "introuvable"} (${status.loggedIn ? `connecté, ${status.authMethod}` : "non connecté"})`,
    `OCR : ${config.ocr.model} / ${config.ocr.effort} / ${config.ocr.concurrency} en parallèle`,
    `Export : ${config.paths.dataDirectory}`,
    "",
  ].join("\n"),
);

let stopping = false;
for (const signal of STOP_SIGNALS)
  process.once(signal, async () => {
    if (stopping) return;
    stopping = true;
    await services.jobs.shutdown();
    await app.close();
    process.exit(0);
  });
