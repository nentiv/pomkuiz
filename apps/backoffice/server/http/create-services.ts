import type { AppConfig } from "../config/app-config.ts";
import { createContractValidators } from "../features/export/contract-validators.ts";
import { createExporter } from "../features/export/quiz-exporter.ts";
import { createJobRunner } from "../features/jobs/job-runner.ts";
import { createClaudeClient, type ClaudeClient } from "../features/ocr/claude-client.ts";
import { createAssetService } from "../features/review/asset-service.ts";
import { createDraftStore } from "../features/review/draft-store.ts";
import { createImportStore } from "../features/upload/import-store.ts";
import { ensureDirectory } from "../shared/safe-file-system.ts";

async function createServices(config: AppConfig, overrides: { client?: ClaudeClient } = {}) {
  const store = createImportStore(config);
  await ensureDirectory(store.root);
  const assets = createAssetService(store, config);
  const drafts = createDraftStore(store, assets);
  const client = overrides.client ?? createClaudeClient({ config: config.ocr });
  const validators = createContractValidators();
  const jobs = createJobRunner({ config, store, drafts, assets, client });
  const exporter = createExporter({ config, store, drafts, validators });
  return { config, store, assets, drafts, client, validators, jobs, exporter };
}

type Services = Awaited<ReturnType<typeof createServices>>;

export { createServices };
export type { Services };
