import { APP_CONFIG } from "../../shared/config/app-config.ts";
import { readJson, writeJson, type KeyValueStorage } from "../../shared/local-storage.ts";
import { parseProgress, type QuizProgress } from "./attempts.ts";

interface ProgressStore {
  load(quizId: string): QuizProgress;
  save(quizId: string, progress: QuizProgress): boolean;
}

const progressKey = (quizId: string) => `${APP_CONFIG.storage.quizKeyPrefix}${quizId}`;

function createProgressStore(storage: KeyValueStorage | null): ProgressStore {
  return {
    load: (quizId) => parseProgress(readJson(storage, progressKey(quizId))),
    save: (quizId, progress) => writeJson(storage, progressKey(quizId), progress),
  };
}

export { createProgressStore };
export type { ProgressStore };
