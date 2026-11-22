import { randomUUID } from "node:crypto";
import { copyFile, readFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { findIntegrityIssues, DATA_LAYOUT, hasPngSignature, checkQuestionRules, isSlug } from "@pomkuiz/quiz-contract";
import type { AppConfig } from "../../config/app-config.ts";
import { AppError } from "../../shared/app-error.ts";
import { ensureDirectory, pathExists, resolveInside, writeJsonAtomic } from "../../shared/safe-file-system.ts";
import type { DraftStore } from "../review/draft-store.ts";
import { countStatuses } from "../review/draft-types.ts";
import type { ImportStore } from "../upload/import-store.ts";
import type { ContractValidators } from "./contract-validators.ts";
import { regenerateIndex } from "./regenerate-quiz-index.ts";
import { draftToQuiz } from "./draft-to-quiz.ts";
import { createSerialQueue } from "../../shared/serial-queue.ts";

interface ExportOptions {
  force: boolean;
  overwrite: boolean;
}

interface ExportResult {
  quizId: string;
  questionCount: number;
  assetCount: number;
  indexedQuizzes: number;
  rejectedFolders: { folder: string; reason: string }[];
}

interface ExporterDependencies {
  config: AppConfig;
  store: ImportStore;
  drafts: DraftStore;
  validators: ContractValidators;
}

function createExporter({ config, store, drafts, validators }: ExporterDependencies) {
  const quizzesDirectory = join(config.paths.dataDirectory, DATA_LAYOUT.quizzesDirectory);
  const layout = config.workspace;
  const serialize = createSerialQueue();

  async function writeQuizFolder(
    importId: string,
    target: string,
    quiz: object,
    files: { assetId: string; path: string }[],
  ) {
    await ensureDirectory(quizzesDirectory);
    const staging = resolveInside(quizzesDirectory, `${layout.exportTemporaryPrefix}${randomUUID()}`);
    const previous = resolveInside(quizzesDirectory, `${layout.exportPreviousPrefix}${randomUUID()}`);
    try {
      await ensureDirectory(join(staging, DATA_LAYOUT.assetsDirectory));
      for (const file of files) {
        const source = store.paths.asset(importId, file.assetId);
        if (!hasPngSignature(await readFile(source))) throw new AppError("exportInvalid", file.path);
        await copyFile(source, resolveInside(staging, file.path));
      }
      await writeJsonAtomic(join(staging, DATA_LAYOUT.quizFile), quiz);
      const replacing = await pathExists(target);
      if (replacing) await rename(target, previous);
      try {
        await rename(staging, target);
      } catch (error) {
        if (replacing) await rename(previous, target);
        throw error;
      }
    } finally {
      await rm(staging, { recursive: true, force: true });
      await rm(previous, { recursive: true, force: true });
    }
  }

  async function exportDraft(importId: string, options: ExportOptions): Promise<ExportResult> {
    await store.get(importId);
    const draft = await drafts.load(importId);
    const needsReview = countStatuses(draft.questions).needs_review;
    if (needsReview > 0 && !options.force) throw new AppError("exportBlocked", "", { needsReview });
    const { quiz, files } = draftToQuiz(draft, new Date());
    if (!isSlug(quiz.id) || !quiz.title) throw new AppError("exportInvalid", "meta");
    const ruleViolations = draft.questions
      .map((question, index) => ({ position: index + 1, rules: checkQuestionRules(question) }))
      .filter((entry) => entry.rules.length > 0);
    if (ruleViolations.length > 0) throw new AppError("exportInvalid", "rules", { ruleViolations });
    const valid = validators.quiz.assert(quiz, "exportInvalid");
    const integrity = findIntegrityIssues(valid);
    if (integrity.length > 0) throw new AppError("exportInvalid", "integrity", { integrity });
    const target = resolveInside(quizzesDirectory, quiz.id);
    const ownTarget = draft.lastExport?.quizId === quiz.id;
    if ((await pathExists(target)) && !ownTarget && !options.overwrite)
      throw new AppError("exportExists", "", { quizId: quiz.id });
    await writeQuizFolder(importId, target, valid, files);
    const index = await regenerateIndex(config.paths.dataDirectory, validators);
    await drafts.recordExport(importId, quiz.id);
    return {
      quizId: quiz.id,
      questionCount: quiz.questions.length,
      assetCount: files.length,
      indexedQuizzes: index.index.quizzes.length,
      rejectedFolders: index.rejected,
    };
  }

  return {
    exportDraft: (importId: string, options: ExportOptions): Promise<ExportResult> =>
      serialize(() => exportDraft(importId, options)),
    regenerateIndex: () => regenerateIndex(config.paths.dataDirectory, validators),
  };
}

export { createExporter };
export type { ExportResult };
