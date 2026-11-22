import { describe, expect, it } from "vitest";
import type { Question, Quiz } from "@pomkuiz/quiz-contract";
import { percent, scoreAttempt, scoreLevel, scoreQuestion } from "../src/features/results/scoring.ts";

const multiple: Question = {
  id: "q1",
  type: "multiple",
  prompt: "Cochez",
  choices: [
    { id: "a", text: "A", correct: true },
    { id: "b", text: "B", correct: true },
    { id: "c", text: "C", correct: false },
    { id: "d", text: "D", correct: false },
    { id: "e", text: "E", correct: false },
  ],
};

const single: Question = {
  id: "q2",
  type: "single",
  prompt: "Une seule",
  choices: [
    { id: "a", text: "A", correct: false },
    { id: "b", text: "B", correct: true },
  ],
};

describe("normal scoring (all or nothing)", () => {
  it("gives 1 only for the exact set", () => {
    expect(scoreQuestion(multiple, ["a", "b"]).normal).toBe(1);
    expect(scoreQuestion(multiple, ["b", "a"]).normal).toBe(1);
    expect(scoreQuestion(multiple, ["a"]).normal).toBe(0);
    expect(scoreQuestion(multiple, ["a", "b", "c"]).normal).toBe(0);
    expect(scoreQuestion(single, ["b"]).normal).toBe(1);
    expect(scoreQuestion(single, ["a"]).normal).toBe(0);
  });

  it("treats no answer as 0 and unanswered", () => {
    expect(scoreQuestion(multiple, [])).toEqual({ normal: 0, answered: false });
  });

  it("ignores unknown choice ids", () => {
    expect(scoreQuestion(single, ["b", "zz"]).normal).toBe(1);
  });
});

describe("attempt totals", () => {
  it("sums both scores", () => {
    const quiz: Quiz = {
      schemaVersion: 1,
      id: "t",
      title: "T",
      updatedAt: "2026-01-01",
      questions: [multiple, single],
    };
    expect(scoreAttempt(quiz, { q1: ["a"], q2: ["b"] })).toEqual({ normal: 1, max: 2, answered: 2 });
    expect(percent(1.5, 2)).toBe(75);
    expect(percent(0, 0)).toBe(0);
  });
});

describe("score colour levels", () => {
  it("maps the last score to red, orange or green", () => {
    expect([0, 0.49, 0.5, 0.74, 0.75, 1].map(scoreLevel)).toEqual(["low", "low", "medium", "medium", "high", "high"]);
  });
});
