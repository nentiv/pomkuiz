import { describe, expect, it } from "vitest";
import type { ExtractedQuestion } from "../../server/features/ocr/extraction-schema.ts";
import { parseExtraction } from "../../server/features/ocr/parse-extraction.ts";

const size = { width: 1000, height: 800 };

const question = (fields: Partial<ExtractedQuestion> = {}): ExtractedQuestion => ({
  number: 3,
  continuesFromPrevious: false,
  continuesOnNext: false,
  type: "single",
  prompt: "Énoncé",
  choices: [
    { label: "a", text: "Oui", correct: true, explanation: null },
    { label: "b", text: "Non", correct: false, explanation: null },
  ],
  explanation: null,
  correctAnswerStatement: "La réponse correcte est : Oui",
  figures: [],
  region: { top: 0, bottom: 300 },
  confidence: "high",
  issues: [],
  ...fields,
});

describe("model output validation", () => {
  it("accepts a valid extraction", () => {
    expect(parseExtraction({ questions: [question()] }, size).questions[0]?.number).toBe(3);
  });

  it.each([
    ["not an object", "text"],
    ["missing field", { questions: [{ ...question(), prompt: undefined }] }],
    ["unknown field", { questions: [{ ...question(), html: "<b>x</b>" }] }],
    ["wrong type", { questions: [question({ type: "triple" as never })] }],
    ["wrong root", { items: [] }],
  ])("rejects %s", (_name, raw) => {
    expect(() => parseExtraction(raw, size)).toThrowError(expect.objectContaining({ code: "claudeInvalidOutput" }));
  });

  it("sanitizes text and keeps markup inert", () => {
    const parsed = parseExtraction(
      {
        questions: [
          question({
            prompt: "  Soit​ $x^2$\r\n\r\n\r\n<script>alert(1)</script>\u0007  ",
            choices: [
              { label: "A.", text: "a. Première‮", correct: true, explanation: "  " },
              { label: "", text: "Deuxième", correct: false, explanation: "Note" },
            ],
          }),
        ],
      },
      size,
    ).questions[0];
    expect(parsed?.prompt).toBe("Soit $x^2$\n\n<script>alert(1)</script>");
    expect(parsed?.choices.map((choice) => [choice.label, choice.text, choice.explanation])).toEqual([
      ["a", "Première", null],
      ["b", "Deuxième", "Note"],
    ]);
  });

  it("clamps coordinates and drops degenerate figures", () => {
    const parsed = parseExtraction(
      {
        questions: [
          question({
            region: { top: 900, bottom: -20 },
            figures: [
              { left: 900, top: 700, right: 1200, bottom: 100, target: "Prompt" },
              { left: 10, top: 10, right: 11, bottom: 11, target: "a" },
              { left: 10, top: 10, right: 60, bottom: 60, target: "B)" },
            ],
          }),
        ],
      },
      size,
    ).questions[0];
    expect(parsed?.region).toEqual({ top: 0, bottom: 800 });
    expect(parsed?.figures).toEqual([
      { left: 900, top: 100, right: 1000, bottom: 700, target: "prompt" },
      { left: 10, top: 10, right: 60, bottom: 60, target: "b" },
    ]);
  });
});
