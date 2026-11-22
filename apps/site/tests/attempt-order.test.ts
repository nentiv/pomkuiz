import { describe, expect, it } from "vitest";
import { applyOrder, createOrder, parseOrder, shuffled } from "../src/features/progress/attempt-order.ts";
import { emptyProgress, parseProgress, startAttempt } from "../src/features/progress/attempts.ts";
import type { Quiz } from "@pomkuiz/quiz-contract";

const quiz: Quiz = {
  schemaVersion: 1,
  id: "q",
  title: "Q",
  updatedAt: "2026-01-01",
  questions: ["q1", "q2", "q3", "q4"].map((id) => ({
    id,
    type: "single" as const,
    prompt: id,
    choices: ["a", "b", "c"].map((choice, index) => ({ id: choice, text: `${id}${choice}`, correct: index === 0 })),
  })),
};

function sequence(values: number[]): () => number {
  let cursor = 0;
  return () => values[cursor++ % values.length] ?? 0;
}

describe("shuffling", () => {
  it("returns a permutation without mutating the input", () => {
    const items = [1, 2, 3, 4, 5];
    const result = shuffled(items, sequence([0.1, 0.9, 0.5, 0.3]));
    expect(result.toSorted()).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5]);
  });

  it("orders questions and choices of an attempt", () => {
    const order = createOrder(quiz, sequence([0, 0, 0, 0]));
    expect(order.questions.toSorted()).toEqual(["q1", "q2", "q3", "q4"]);
    const arranged = applyOrder(quiz.questions, order);
    expect(arranged.map((question) => question.id)).toEqual(order.questions);
    expect(arranged[0]?.choices.map((choice) => choice.id)).toEqual(order.choices[arranged[0]!.id]);
  });

  it("keeps the original order without shuffle and tolerates quiz changes", () => {
    expect(applyOrder(quiz.questions, null).map((question) => question.id)).toEqual(["q1", "q2", "q3", "q4"]);
    const order = { questions: ["q3", "removed", "q1"], choices: { q3: ["c", "a"] } };
    const arranged = applyOrder(quiz.questions, order);
    expect(arranged.map((question) => question.id)).toEqual(["q3", "q1", "q2", "q4"]);
    expect(arranged[0]?.choices.map((choice) => choice.id)).toEqual(["c", "a", "b"]);
  });

  it("stores the order with the attempt and parses it back", () => {
    const progress = startAttempt(emptyProgress(), quiz, {
      id: "x",
      now: "2026-01-01T00:00:00Z",
      mode: "end",
      shuffle: true,
      random: sequence([0.7, 0.2]),
    });
    const order = progress.attempts[0]?.order;
    expect(order).not.toBeNull();
    expect(parseProgress(JSON.parse(JSON.stringify(progress))).attempts[0]?.order).toEqual(order);
    const plain = startAttempt(emptyProgress(), quiz, { id: "y", now: "2026-01-01T00:00:00Z", mode: "end" });
    expect(plain.attempts[0]?.order).toBeNull();
    expect(parseOrder({ questions: "nope" })).toBeNull();
  });
});
