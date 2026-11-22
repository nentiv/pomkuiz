import { describe, expect, it } from "vitest";
import { APP_CONFIG } from "../src/shared/config/app-config.ts";
import type { Quiz } from "@pomkuiz/quiz-contract";
import {
  activeAttempt,
  checkQuestion,
  emptyProgress,
  finishAttempt,
  goToQuestion,
  latestFinished,
  parseProgress,
  reconcileAttempt,
  startAttempt,
  toggleChoice,
  updateActive,
  type QuizProgress,
} from "../src/features/progress/attempts.ts";
import { createProgressStore } from "../src/features/progress/progress-store.ts";
import type { KeyValueStorage } from "../src/shared/local-storage.ts";

const quiz: Quiz = {
  schemaVersion: 1,
  id: "colle",
  title: "Colle",
  updatedAt: "2026-09-21",
  questions: [
    {
      id: "q1",
      type: "single",
      prompt: "1",
      choices: [
        { id: "a", text: "A", correct: true },
        { id: "b", text: "B", correct: false },
      ],
    },
    {
      id: "q2",
      type: "multiple",
      prompt: "2",
      choices: [
        { id: "a", text: "A", correct: true },
        { id: "b", text: "B", correct: true },
        { id: "c", text: "C", correct: false },
      ],
    },
    {
      id: "q3",
      type: "single",
      prompt: "3",
      choices: [
        { id: "a", text: "A", correct: false },
        { id: "b", text: "B", correct: true },
      ],
    },
  ],
};

const T0 = "2026-11-21T10:00:00.000Z";
const T1 = "2026-11-21T10:05:00.000Z";

function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const start = (progress: QuizProgress, id: string, mode: "end" | "per-question" = "end") =>
  startAttempt(progress, quiz, { id, now: T0, mode });

describe("attempt lifecycle", () => {
  it("starts, answers, moves and finishes an attempt", () => {
    let progress = start(emptyProgress(), "one");
    progress = updateActive(progress, T1, (attempt) => toggleChoice(attempt, quiz.questions[0]!, "a"));
    progress = updateActive(progress, T1, (attempt) => goToQuestion(attempt, 1));
    progress = updateActive(progress, T1, (attempt) => toggleChoice(attempt, quiz.questions[1]!, "a"));
    progress = updateActive(progress, T1, (attempt) => toggleChoice(attempt, quiz.questions[1]!, "c"));
    progress = updateActive(progress, T1, (attempt) => toggleChoice(attempt, quiz.questions[1]!, "c"));
    const active = activeAttempt(progress);
    expect(active?.answers).toEqual({ q1: ["a"], q2: ["a"] });
    expect(active?.currentIndex).toBe(1);
    expect(active?.updatedAt).toBe(T1);

    progress = finishAttempt(progress, quiz, T1);
    expect(activeAttempt(progress)).toBeNull();
    expect(progress.attempts[0]).toMatchObject({
      status: "finished",
      finishedAt: T1,
      score: { normal: 1, max: 3, answered: 2 },
    });
  });

  it("replaces the answer of a single choice question", () => {
    let progress = start(emptyProgress(), "one");
    progress = updateActive(progress, T1, (attempt) => toggleChoice(attempt, quiz.questions[0]!, "a"));
    progress = updateActive(progress, T1, (attempt) => toggleChoice(attempt, quiz.questions[0]!, "b"));
    expect(activeAttempt(progress)?.answers.q1).toEqual(["b"]);
  });

  it("locks a question once checked in per-question mode only", () => {
    let progress = start(emptyProgress(), "one", "per-question");
    progress = updateActive(progress, T1, (attempt) => toggleChoice(attempt, quiz.questions[0]!, "b"));
    progress = updateActive(progress, T1, (attempt) => checkQuestion(attempt, "q1"));
    progress = updateActive(progress, T1, (attempt) => toggleChoice(attempt, quiz.questions[0]!, "a"));
    expect(activeAttempt(progress)?.answers.q1).toEqual(["b"]);
    expect(activeAttempt(progress)?.checked).toEqual(["q1"]);

    let endMode = start(emptyProgress(), "two", "end");
    endMode = updateActive(endMode, T1, (attempt) => checkQuestion(attempt, "q1"));
    expect(activeAttempt(endMode)?.checked).toEqual([]);
  });

  it("keeps several attempts and abandons the running one on restart", () => {
    let progress = start(emptyProgress(), "one");
    progress = updateActive(progress, T1, (attempt) => toggleChoice(attempt, quiz.questions[0]!, "a"));
    progress = finishAttempt(progress, quiz, T1);
    progress = start(progress, "two");
    progress = start(progress, "three");
    expect(progress.attempts.map((attempt) => [attempt.id, attempt.status])).toEqual([
      ["one", "finished"],
      ["two", "abandoned"],
      ["three", "in-progress"],
    ]);
    expect(latestFinished(progress)?.id).toBe("one");
  });

  it("bounds the history", () => {
    let progress = emptyProgress();
    for (let index = 0; index < APP_CONFIG.maxAttemptsPerQuiz + 5; index += 1) progress = start(progress, `a${index}`);
    expect(progress.attempts).toHaveLength(APP_CONFIG.maxAttemptsPerQuiz);
    expect(activeAttempt(progress)?.id).toBe(`a${APP_CONFIG.maxAttemptsPerQuiz + 4}`);
  });

  it("clamps navigation", () => {
    const attempt = activeAttempt(start(emptyProgress(), "one"))!;
    expect(goToQuestion(attempt, -3).currentIndex).toBe(0);
    expect(goToQuestion(attempt, 99).currentIndex).toBe(2);
  });
});

describe("resume", () => {
  it("restores the attempt at the same question after a reload", () => {
    const storage = memoryStorage();
    const store = createProgressStore(storage);
    let progress = start(store.load(quiz.id), "one");
    progress = updateActive(progress, T1, (attempt) => toggleChoice(attempt, quiz.questions[0]!, "a"));
    progress = updateActive(progress, T1, (attempt) => goToQuestion(attempt, 2));
    store.save(quiz.id, progress);

    const reloaded = createProgressStore(storage).load(quiz.id);
    expect(activeAttempt(reloaded)).toMatchObject({ id: "one", currentIndex: 2, answers: { q1: ["a"] } });
  });

  it("reconciles a stored attempt with an updated quiz", () => {
    let progress = start(emptyProgress(), "one");
    progress = updateActive(progress, T1, (attempt) => ({
      ...attempt,
      currentIndex: 9,
      answers: { q1: ["a", "zz"], removed: ["a"] },
      checked: ["q1", "removed"],
    }));
    const reconciled = reconcileAttempt(activeAttempt(progress)!, quiz);
    expect(reconciled).toMatchObject({ currentIndex: 2, answers: { q1: ["a"] }, checked: ["q1"], questionCount: 3 });
  });

  it("survives corrupted or foreign storage", () => {
    const storage = memoryStorage();
    storage.setItem(`${APP_CONFIG.storage.quizKeyPrefix}colle`, "{not json");
    expect(createProgressStore(storage).load("colle")).toEqual(emptyProgress());
    expect(parseProgress({ version: 99, attempts: [] })).toEqual(emptyProgress());
    const parsed = parseProgress({
      version: APP_CONFIG.progressVersion,
      activeAttemptId: "ghost",
      attempts: [{ id: 1 }, { id: "x", status: "weird" }],
    });
    expect(parsed).toEqual(emptyProgress());
  });

  it("does not crash when storage is unavailable or full", () => {
    expect(createProgressStore(null).save("colle", emptyProgress())).toBe(false);
    const full: KeyValueStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
      removeItem: () => {},
    };
    expect(createProgressStore(full).save("colle", emptyProgress())).toBe(false);
  });
});
