import { describe, expect, it } from "vitest";
import type { DraftContent } from "../../server/features/review/draft-types.ts";
import {
  applyDraftAction,
  move,
  newChoice,
  newQuestion,
  nextIndexWithStatus,
} from "../../ui/src/features/review/draft-actions.ts";

const base = (): DraftContent => ({
  meta: { id: "", title: "Colle", description: "", tags: [] },
  questions: [
    { ...newQuestion("q1", ["a", "b", "c"]), type: "single", prompt: "Un" },
    { ...newQuestion("q2", ["d", "e"]), prompt: "Deux", status: "needs_review" },
    { ...newQuestion("q3", ["f", "g"]), prompt: "Trois" },
  ],
});

describe("review editing operations", () => {
  it("edits fields without mutating the previous state", () => {
    const before = base();
    const after = applyDraftAction(before, { type: "question", key: "q1", patch: { prompt: "Soit $x$" } });
    expect(after.questions[0]?.prompt).toBe("Soit $x$");
    expect(before.questions[0]?.prompt).toBe("Un");
    expect(after.questions[1]).toBe(before.questions[1]);
  });

  it("keeps a single answer question to one correct choice", () => {
    let content = applyDraftAction(base(), {
      type: "choice",
      questionKey: "q1",
      choiceKey: "a",
      patch: { correct: true },
    });
    content = applyDraftAction(content, {
      type: "choice",
      questionKey: "q1",
      choiceKey: "c",
      patch: { correct: true },
    });
    expect(content.questions[0]?.choices.map((choice) => choice.correct)).toEqual([false, false, true]);
    content = applyDraftAction(content, {
      type: "choice",
      questionKey: "q2",
      choiceKey: "d",
      patch: { correct: true },
    });
    content = applyDraftAction(content, {
      type: "choice",
      questionKey: "q2",
      choiceKey: "e",
      patch: { correct: true },
    });
    expect(content.questions[1]?.choices.map((choice) => choice.correct)).toEqual([true, true]);
  });

  it("adds, moves and removes questions and choices", () => {
    let content = applyDraftAction(base(), { type: "add-question", afterKey: "q1", question: newQuestion("new", []) });
    expect(content.questions.map((question) => question.key)).toEqual(["q1", "new", "q2", "q3"]);
    content = applyDraftAction(content, { type: "move-question", key: "new", offset: 2 });
    expect(content.questions.map((question) => question.key)).toEqual(["q1", "q2", "q3", "new"]);
    content = applyDraftAction(content, { type: "move-question", key: "new", offset: 1 });
    expect(content.questions.at(-1)?.key).toBe("new");
    content = applyDraftAction(content, { type: "remove-question", key: "q2" });
    content = applyDraftAction(content, { type: "add-choice", questionKey: "q1", choice: newChoice("z") });
    content = applyDraftAction(content, { type: "move-choice", questionKey: "q1", choiceKey: "z", offset: -3 });
    content = applyDraftAction(content, { type: "remove-choice", questionKey: "q1", choiceKey: "b" });
    expect(content.questions.map((question) => question.key)).toEqual(["q1", "q3", "new"]);
    expect(content.questions[0]?.choices.map((choice) => choice.key)).toEqual(["z", "a", "c"]);
  });

  it("manages images on prompts and choices", () => {
    const prompt = { questionKey: "q1", choiceKey: null };
    const choice = { questionKey: "q1", choiceKey: "a" };
    let content = applyDraftAction(base(), { type: "add-image", owner: prompt, assetId: "i1" });
    content = applyDraftAction(content, { type: "add-image", owner: prompt, assetId: "i2" });
    content = applyDraftAction(content, { type: "add-image", owner: prompt, assetId: "i2" });
    content = applyDraftAction(content, { type: "move-image", owner: prompt, assetId: "i2", offset: -1 });
    content = applyDraftAction(content, { type: "replace-image", owner: prompt, previous: "i1", assetId: "i3" });
    content = applyDraftAction(content, { type: "add-image", owner: choice, assetId: "i4" });
    content = applyDraftAction(content, { type: "remove-image", owner: prompt, assetId: "i2" });
    expect(content.questions[0]?.images).toEqual(["i3"]);
    expect(content.questions[0]?.choices[0]?.images).toEqual(["i4"]);
  });

  it("finds the next question to review, wrapping around", () => {
    const { questions } = base();
    expect(nextIndexWithStatus(questions, 1, "needs_review")).toBe(1);
    expect(nextIndexWithStatus(questions, 2, "needs_review")).toBe(1);
    expect(nextIndexWithStatus(questions, 0, "verified")).toBeNull();
    expect(move([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
});
