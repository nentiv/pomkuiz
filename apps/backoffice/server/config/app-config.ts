import { join, resolve } from "node:path";
import { DATA_LAYOUT } from "@pomkuiz/quiz-contract";
import { ENV_VARIABLES, readBoolean, readInteger, readString, type Environment } from "./environment-variables.ts";
import { CLAUDE_CLI, OCR_DEFAULTS, OCR_EFFORTS } from "./ocr-settings.ts";
import { RENDER_SETTINGS } from "./render-settings.ts";
import { SERVER_DEFAULTS } from "./server-settings.ts";
import { UPLOAD_LIMITS } from "./upload-limits.ts";
import { JOB_SETTINGS, WORKSPACE_LAYOUT } from "./workspace-layout.ts";

const BACKOFFICE_ROOT = resolve(import.meta.dirname, "..", "..");
const REPOSITORY_ROOT = resolve(BACKOFFICE_ROOT, "..", "..");

const DEFAULT_DIRECTORIES = Object.freeze({
  workspace: join(BACKOFFICE_ROOT, "workspace"),
  uiDist: join(BACKOFFICE_ROOT, "dist"),
  data: join(REPOSITORY_ROOT, DATA_LAYOUT.publicDirectory),
});

function loadConfig(env: Environment = process.env) {
  const dataDirectory = resolve(readString(env, ENV_VARIABLES.dataDirectory, DEFAULT_DIRECTORIES.data));
  return Object.freeze({
    server: Object.freeze({
      ...SERVER_DEFAULTS,
      port: readInteger(
        env,
        ENV_VARIABLES.port,
        SERVER_DEFAULTS.port,
        SERVER_DEFAULTS.minimumPort,
        SERVER_DEFAULTS.maximumPort,
      ),
    }),
    paths: Object.freeze({
      dataDirectory,
      workspaceDirectory: resolve(readString(env, ENV_VARIABLES.workspaceDirectory, DEFAULT_DIRECTORIES.workspace)),
      uiDistDirectory: DEFAULT_DIRECTORIES.uiDist,
    }),
    upload: UPLOAD_LIMITS,
    render: RENDER_SETTINGS,
    ocr: Object.freeze({
      ...OCR_DEFAULTS,
      model: readString(env, ENV_VARIABLES.ocrModel, OCR_DEFAULTS.model),
      effort: readString(env, ENV_VARIABLES.ocrEffort, OCR_DEFAULTS.effort, OCR_EFFORTS),
      concurrency: readInteger(
        env,
        ENV_VARIABLES.ocrConcurrency,
        OCR_DEFAULTS.concurrency,
        1,
        OCR_DEFAULTS.maxConcurrency,
      ),
      maxAttempts: readInteger(
        env,
        ENV_VARIABLES.ocrMaxAttempts,
        OCR_DEFAULTS.maxAttempts,
        1,
        OCR_DEFAULTS.maxAttemptsCeiling,
      ),
      executableOverride: env[ENV_VARIABLES.claudePath]?.trim() || null,
      cli: CLAUDE_CLI,
    }),
    jobs: Object.freeze({
      ...JOB_SETTINGS,
      autoResumeInterrupted: readBoolean(env, ENV_VARIABLES.autoResume, JOB_SETTINGS.autoResumeInterrupted),
    }),
    workspace: WORKSPACE_LAYOUT,
  });
}

type AppConfig = ReturnType<typeof loadConfig>;

export { loadConfig };
export type { AppConfig };
