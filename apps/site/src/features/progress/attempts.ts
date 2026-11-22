import { APP_CONFIG, CORRECTION_MODES, type CorrectionMode } from "../../shared/config/app-config.ts";
import type { Question, Quiz } from "@pomkuiz/quiz-contract";
import { scoreAttempt, type ScoreSummary } from "../results/scoring.ts";
import { createOrder, parseOrder, secureRandom, type AttemptOrder, type RandomSource } from "./attempt-order.ts";

const ATTEMPT_STATUSES = ["in-progress", "finished", "abandoned"] as const;
type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

interface Attempt {
  id: string;
  status: AttemptStatus;
  mode: CorrectionMode;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  currentIndex: number;
  answers: Record<string, string[]>;
  checked: string[];
  questionCount: number;
  score: ScoreSummary | null;
  order: AttemptOrder | null;
}

interface QuizProgress {
  version: number;
  activeAttemptId: string | null;
  attempts: Attempt[];
}

const emptyProgress = (): QuizProgress => ({
  version: APP_CONFIG.progressVersion,
  activeAttemptId: null,
  attempts: [],
});

function activeAttempt(progress: QuizProgress): Attempt | null {
  const attempt = progress.attempts.find((item) => item.id === progress.activeAttemptId);
  return attempt?.status === "in-progress" ? attempt : null;
}

function replaceAttempt(progress: QuizProgress, attempt: Attempt): QuizProgress {
  return {
    ...progress,
    attempts: progress.attempts.map((item) => (item.id === attempt.id ? attempt : item)),
  };
}

function close(progress: QuizProgress, quiz: Quiz, status: AttemptStatus, now: string): QuizProgress {
  const attempt = activeAttempt(progress);
  if (!attempt) return progress;
  const closed: Attempt = {
    ...attempt,
    status,
    finishedAt: now,
    updatedAt: now,
    score: scoreAttempt(quiz, attempt.answers),
  };
  return { ...replaceAttempt(progress, closed), activeAttemptId: null };
}

function startAttempt(
  progress: QuizProgress,
  quiz: Quiz,
  options: { id: string; now: string; mode: CorrectionMode; shuffle?: boolean; random?: RandomSource },
): QuizProgress {
  const base = close(progress, quiz, "abandoned", options.now);
  const attempt: Attempt = {
    id: options.id,
    status: "in-progress",
    mode: options.mode,
    startedAt: options.now,
    updatedAt: options.now,
    finishedAt: null,
    currentIndex: 0,
    answers: {},
    checked: [],
    questionCount: quiz.questions.length,
    score: null,
    order: options.shuffle ? createOrder(quiz, options.random ?? secureRandom) : null,
  };
  const attempts = [...base.attempts, attempt].slice(-APP_CONFIG.maxAttemptsPerQuiz);
  return { ...base, activeAttemptId: attempt.id, attempts };
}

function finishAttempt(progress: QuizProgress, quiz: Quiz, now: string): QuizProgress {
  return close(progress, quiz, "finished", now);
}

function updateActive(progress: QuizProgress, now: string, update: (attempt: Attempt) => Attempt): QuizProgress {
  const attempt = activeAttempt(progress);
  if (!attempt) return progress;
  const next = update(attempt);
  return next === attempt ? progress : replaceAttempt(progress, { ...next, updatedAt: now });
}

const isLocked = (attempt: Attempt, questionId: string) => attempt.checked.includes(questionId);

function toggleChoice(attempt: Attempt, question: Question, choiceId: string): Attempt {
  if (isLocked(attempt, question.id)) return attempt;
  if (!question.choices.some((choice) => choice.id === choiceId)) return attempt;
  const current = attempt.answers[question.id] ?? [];
  const selected =
    question.type === "single"
      ? current.includes(choiceId)
        ? []
        : [choiceId]
      : current.includes(choiceId)
        ? current.filter((id) => id !== choiceId)
        : [...current, choiceId];
  return { ...attempt, answers: { ...attempt.answers, [question.id]: selected } };
}

function checkQuestion(attempt: Attempt, questionId: string): Attempt {
  if (attempt.mode !== "per-question" || isLocked(attempt, questionId)) return attempt;
  return { ...attempt, checked: [...attempt.checked, questionId] };
}

function goToQuestion(attempt: Attempt, index: number): Attempt {
  const clamped = Math.min(Math.max(0, index), Math.max(0, attempt.questionCount - 1));
  return clamped === attempt.currentIndex ? attempt : { ...attempt, currentIndex: clamped };
}

function reconcileAttempt(attempt: Attempt, quiz: Quiz): Attempt {
  const questions = new Map(quiz.questions.map((question) => [question.id, question]));
  const answers = Object.fromEntries(
    Object.entries(attempt.answers)
      .filter(([questionId]) => questions.has(questionId))
      .map(([questionId, selected]) => {
        const choices = new Set(questions.get(questionId)?.choices.map((choice) => choice.id));
        return [questionId, selected.filter((choiceId) => choices.has(choiceId))];
      }),
  );
  return {
    ...attempt,
    answers,
    checked: attempt.checked.filter((questionId) => questions.has(questionId)),
    questionCount: quiz.questions.length,
    currentIndex: Math.min(attempt.currentIndex, Math.max(0, quiz.questions.length - 1)),
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

function parseScore(value: unknown): ScoreSummary | null {
  if (!isRecord(value)) return null;
  const { normal, max, answered } = value;
  return isNumber(normal) && isNumber(max) && isNumber(answered) ? { normal, max, answered } : null;
}

function parseAttempt(value: unknown): Attempt | null {
  if (!isRecord(value)) return null;
  const {
    id,
    status,
    mode,
    startedAt,
    updatedAt,
    finishedAt,
    currentIndex,
    answers,
    checked,
    questionCount,
    score,
    order,
  } = value;
  if (typeof id !== "string" || typeof startedAt !== "string" || typeof updatedAt !== "string") return null;
  if (!ATTEMPT_STATUSES.includes(status as AttemptStatus)) return null;
  if (!CORRECTION_MODES.includes(mode as CorrectionMode)) return null;
  if (!isNumber(currentIndex) || !isNumber(questionCount) || !isStringArray(checked) || !isRecord(answers)) return null;
  if (finishedAt !== null && typeof finishedAt !== "string") return null;
  const parsedAnswers: Record<string, string[]> = {};
  for (const [questionId, selected] of Object.entries(answers))
    if (isStringArray(selected)) parsedAnswers[questionId] = selected;
  return {
    id,
    status: status as AttemptStatus,
    mode: mode as CorrectionMode,
    startedAt,
    updatedAt,
    finishedAt,
    currentIndex,
    answers: parsedAnswers,
    checked,
    questionCount,
    score: parseScore(score),
    order: parseOrder(order),
  };
}

function parseProgress(raw: unknown): QuizProgress {
  if (!isRecord(raw) || raw.version !== APP_CONFIG.progressVersion || !Array.isArray(raw.attempts))
    return emptyProgress();
  const attempts = raw.attempts.map(parseAttempt).filter((attempt): attempt is Attempt => attempt !== null);
  const activeAttemptId =
    typeof raw.activeAttemptId === "string" && attempts.some((attempt) => attempt.id === raw.activeAttemptId)
      ? raw.activeAttemptId
      : null;
  return { version: APP_CONFIG.progressVersion, activeAttemptId, attempts };
}

function latestFinished(progress: QuizProgress): Attempt | null {
  return progress.attempts
    .filter((attempt) => attempt.status === "finished" && attempt.score && attempt.score.max > 0)
    .reduce<Attempt | null>(
      (latest, attempt) => (!latest || (attempt.finishedAt ?? "") > (latest.finishedAt ?? "") ? attempt : latest),
      null,
    );
}

function bestFinished(progress: QuizProgress): ScoreSummary | null {
  return progress.attempts
    .filter((attempt) => attempt.status === "finished" && attempt.score && attempt.score.max > 0)
    .map((attempt) => attempt.score as ScoreSummary)
    .reduce<ScoreSummary | null>(
      (best, score) => (!best || score.normal / score.max > best.normal / best.max ? score : best),
      null,
    );
}

export {
  emptyProgress,
  activeAttempt,
  startAttempt,
  finishAttempt,
  updateActive,
  isLocked,
  toggleChoice,
  checkQuestion,
  goToQuestion,
  reconcileAttempt,
  parseProgress,
  latestFinished,
  bestFinished,
};
export type { Attempt, QuizProgress };
