import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  buildQuizIndex,
  findIntegrityIssues,
  listReferencedAssets,
  DATA_LAYOUT,
  hasPngSignature,
  isSlug,
  type Quiz,
  type QuizIndex,
} from "@pomkuiz/quiz-contract";
import { AppError } from "../../shared/app-error.ts";
import { ensureDirectory, resolveInside, writeJsonAtomic } from "../../shared/safe-file-system.ts";
import type { ContractValidators } from "./contract-validators.ts";

interface QuizFolderReport {
  quizzes: Quiz[];
  rejected: { folder: string; reason: string }[];
}

async function readQuizFolder(quizzesDirectory: string, folder: string, validators: ContractValidators): Promise<Quiz> {
  const directory = resolveInside(quizzesDirectory, folder);
  const raw: unknown = JSON.parse(await readFile(join(directory, DATA_LAYOUT.quizFile), "utf8"));
  const quiz = validators.quiz.assert(raw, "exportInvalid");
  const issues = findIntegrityIssues(quiz, folder);
  if (issues.length > 0)
    throw new AppError("exportInvalid", issues.map((issue) => `${issue.path} ${issue.code}`).join("; "));
  for (const asset of listReferencedAssets(quiz)) {
    const bytes = await readFile(resolveInside(directory, asset));
    if (!hasPngSignature(bytes)) throw new AppError("exportInvalid", asset);
  }
  return quiz;
}

async function scanQuizFolders(dataDirectory: string, validators: ContractValidators): Promise<QuizFolderReport> {
  const quizzesDirectory = await ensureDirectory(join(dataDirectory, DATA_LAYOUT.quizzesDirectory));
  const entries = await readdir(quizzesDirectory, { withFileTypes: true });
  const report: QuizFolderReport = { quizzes: [], rejected: [] };
  for (const entry of entries) {
    if (!entry.isDirectory() || !isSlug(entry.name)) continue;
    try {
      report.quizzes.push(await readQuizFolder(quizzesDirectory, entry.name, validators));
    } catch (error) {
      report.rejected.push({ folder: entry.name, reason: (error as Error).message });
    }
  }
  return report;
}

async function regenerateIndex(
  dataDirectory: string,
  validators: ContractValidators,
): Promise<QuizFolderReport & { index: QuizIndex }> {
  const report = await scanQuizFolders(dataDirectory, validators);
  const index = validators.index.assert(buildQuizIndex(report.quizzes), "exportInvalid");
  await writeJsonAtomic(join(dataDirectory, DATA_LAYOUT.indexFile), index);
  return { ...report, index };
}

export { regenerateIndex };
