import type { QuizSummary } from "@pomkuiz/quiz-contract";
import { activeAttempt, latestFinished, type Attempt, type QuizProgress } from "../progress/attempts.ts";

interface DashboardStats {
  hasActivity: boolean;
  resume: { quiz: QuizSummary; attempt: Attempt } | null;
  completed: number;
  total: number;
  average: number | null;
}

const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

function computeDashboard(
  quizzes: readonly QuizSummary[],
  progressOf: (quizId: string) => QuizProgress,
): DashboardStats {
  const entries = quizzes.map((quiz) => ({ quiz, progress: progressOf(quiz.id) }));
  const results: number[] = [];
  let resume: DashboardStats["resume"] = null;

  for (const { quiz, progress } of entries) {
    const active = activeAttempt(progress);
    if (active && (!resume || active.updatedAt > resume.attempt.updatedAt)) resume = { quiz, attempt: active };
    const latest = latestFinished(progress);
    if (latest?.score) results.push(latest.score.normal / latest.score.max);
  }

  return {
    hasActivity: entries.some(({ progress }) => progress.attempts.length > 0),
    resume,
    completed: results.length,
    total: quizzes.length,
    average: results.length > 0 ? mean(results) : null,
  };
}

export { computeDashboard };
export type { DashboardStats };
