import { describe, expect, it } from "vitest";
import { computeDashboard } from "../src/features/dashboard/dashboard-stats.ts";
import { emptyProgress, type Attempt, type QuizProgress } from "../src/features/progress/attempts.ts";
import type { QuizSummary } from "@pomkuiz/quiz-contract";

const summary = (id: string): QuizSummary => ({
  id,
  title: `QCM ${id}`,
  description: "",
  questionCount: 10,
  date: "2026-11-01",
  tags: [],
});

const attempt = (fields: Partial<Attempt>): Attempt => ({
  id: fields.id ?? "a",
  status: "finished",
  mode: "end",
  startedAt: "2026-11-01T10:00:00.000Z",
  updatedAt: "2026-11-01T10:00:00.000Z",
  finishedAt: "2026-11-01T10:30:00.000Z",
  currentIndex: 0,
  answers: {},
  checked: [],
  questionCount: 10,
  score: { normal: 5, max: 10, answered: 10 },
  order: null,
  ...fields,
});

const progressWith = (attempts: Attempt[], activeAttemptId: string | null = null): QuizProgress => ({
  ...emptyProgress(),
  attempts,
  activeAttemptId,
});

describe("dashboard statistics", () => {
  it("stays hidden before any attempt", () => {
    const stats = computeDashboard([summary("a"), summary("b")], () => emptyProgress());
    expect(stats).toMatchObject({ hasActivity: false, resume: null, completed: 0, total: 2, average: null });
  });

  it("uses the last finished attempt of each quiz, not the best one", () => {
    const progress: Record<string, QuizProgress> = {
      a: progressWith([
        attempt({ id: "a1", finishedAt: "2026-11-01T10:00:00.000Z", score: { normal: 9, max: 10, answered: 10 } }),
        attempt({ id: "a2", finishedAt: "2026-11-05T10:00:00.000Z", score: { normal: 4, max: 10, answered: 10 } }),
      ]),
      b: progressWith([attempt({ id: "b1", score: { normal: 8, max: 10, answered: 10 } })]),
      c: progressWith([attempt({ id: "c1", status: "abandoned", score: { normal: 0, max: 10, answered: 0 } })]),
      d: emptyProgress(),
    };
    const stats = computeDashboard(["a", "b", "c", "d"].map(summary), (id) => progress[id] ?? emptyProgress());
    expect(stats.hasActivity).toBe(true);
    expect(stats.completed).toBe(2);
    expect(stats.total).toBe(4);
    expect(stats.average).toBeCloseTo(0.6);
  });

  it("offers to resume the most recently touched attempt", () => {
    const older = attempt({
      id: "x",
      status: "in-progress",
      finishedAt: null,
      score: null,
      updatedAt: "2026-11-02T08:00:00.000Z",
      currentIndex: 3,
    });
    const newer = attempt({
      id: "y",
      status: "in-progress",
      finishedAt: null,
      score: null,
      updatedAt: "2026-11-03T08:00:00.000Z",
      currentIndex: 7,
    });
    const progress: Record<string, QuizProgress> = { a: progressWith([older], "x"), b: progressWith([newer], "y") };
    const stats = computeDashboard(["a", "b"].map(summary), (id) => progress[id] ?? emptyProgress());
    expect(stats.resume?.quiz.id).toBe("b");
    expect(stats.resume?.attempt.currentIndex).toBe(7);
    expect(stats.average).toBeNull();
  });

  it("ignores quizzes that are no longer published", () => {
    const progress: Record<string, QuizProgress> = {
      a: progressWith([attempt({ score: { normal: 10, max: 10, answered: 10 } })]),
      removed: progressWith([attempt({ score: { normal: 0, max: 10, answered: 10 } })]),
    };
    const stats = computeDashboard([summary("a")], (id) => progress[id] ?? emptyProgress());
    expect(stats.average).toBe(1);
    expect(stats.total).toBe(1);
  });
});
