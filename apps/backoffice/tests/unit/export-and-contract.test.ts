import { describe, expect, it } from "vitest";
import { createContractValidators } from "../../server/features/export/contract-validators.ts";
import { draftToQuiz } from "../../server/features/export/draft-to-quiz.ts";
import { localDate } from "../../server/shared/local-date.ts";
import type { DraftContent, DraftQuestion } from "../../server/features/review/draft-types.ts";
import { resolveInside } from "../../server/shared/safe-file-system.ts";

const ASSET = "0b9c5f9e-3d1c-4b5e-9f2a-1c2d3e4f5a6b";

const question = (fields: Partial<DraftQuestion> = {}): DraftQuestion => ({
  key: "6f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f",
  status: "verified",
  number: 1,
  type: "single",
  prompt: "Soit $x$",
  explanation: "",
  images: [],
  choices: [
    { key: "1f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f", text: "Oui", correct: true, explanation: " ", images: [] },
    { key: "2f1c2d3e-4b5a-4c7d-8e9f-0a1b2c3d4e5f", text: "Non", correct: false, explanation: "Car.", images: [ASSET] },
  ],
  source: null,
  issues: [],
  ...fields,
});

const content = (questions: DraftQuestion[]): DraftContent => ({
  meta: { id: "", title: "Colle d'UE3 – Septembre", description: "", tags: [" chimie ", "chimie", ""] },
  questions,
});

describe("draft → quiz conversion", () => {
  it("produces a contract-valid quiz with server generated names", () => {
    const validators = createContractValidators();
    const { quiz, files } = draftToQuiz(
      content([question({ images: [ASSET] }), question({ type: "multiple" })]),
      new Date(2026, 8, 21),
    );
    expect(validators.quiz(quiz)).toBe(true);
    expect(quiz.id).toBe("colle-d-ue3-septembre");
    expect(quiz.updatedAt).toBe("2026-09-21");
    expect(quiz.tags).toEqual(["chimie"]);
    expect(quiz.questions[0]).toEqual({
      id: "q1",
      type: "single",
      prompt: "Soit $x$",
      images: ["assets/q1-1.png"],
      choices: [
        { id: "a", text: "Oui", correct: true },
        { id: "b", text: "Non", correct: false, images: ["assets/q1-b-1.png"], explanation: "Car." },
      ],
    });
    expect(files.map((file) => file.path)).toEqual(["assets/q1-b-1.png", "assets/q1-1.png", "assets/q2-b-1.png"]);
  });

  it("is rejected by the schema when rules are broken", () => {
    const validators = createContractValidators();
    const broken = draftToQuiz(
      content([question({ choices: question().choices.map((item) => ({ ...item, correct: true })) })]),
      new Date(),
    );
    expect(validators.quiz(broken.quiz)).toBe(false);
    const noCorrect = draftToQuiz(
      content([
        question({ type: "multiple", choices: question().choices.map((item) => ({ ...item, correct: false })) }),
      ]),
      new Date(),
    );
    expect(validators.quiz(noCorrect.quiz)).toBe(false);
    const traversal = { ...broken.quiz, questions: [{ ...broken.quiz.questions[0]!, images: ["../../secret.png"] }] };
    expect(validators.quiz(traversal)).toBe(false);
  });

  it("formats local dates", () => {
    expect(localDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("path safety", () => {
  it("refuses paths escaping their base directory", () => {
    expect(resolveInside("/data/quizzes", "abc", "quiz.json")).toBe("/data/quizzes/abc/quiz.json");
    for (const attempt of ["../x", "a/../../x", "/etc/passwd", "a/../../../etc"])
      expect(() => resolveInside("/data/quizzes", attempt)).toThrowError(
        expect.objectContaining({ code: "forbidden" }),
      );
  });
});
