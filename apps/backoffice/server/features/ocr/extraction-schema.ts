import { QUESTION_TYPES, type QuestionType } from "@pomkuiz/quiz-contract";

const CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;
type Confidence = (typeof CONFIDENCE_LEVELS)[number];

const PROMPT_FIGURE_TARGET = "prompt";

interface ExtractedChoice {
  label: string;
  text: string;
  correct: boolean;
  explanation: string | null;
}

interface ExtractedFigure {
  left: number;
  top: number;
  right: number;
  bottom: number;
  target: string;
}

interface ExtractedQuestion {
  number: number | null;
  continuesFromPrevious: boolean;
  continuesOnNext: boolean;
  type: QuestionType;
  prompt: string;
  choices: ExtractedChoice[];
  explanation: string | null;
  correctAnswerStatement: string | null;
  figures: ExtractedFigure[];
  region: { top: number; bottom: number };
  confidence: Confidence;
  issues: string[];
}

interface SegmentExtraction {
  questions: ExtractedQuestion[];
}

const nullableString = { type: ["string", "null"] };
const pixel = { type: "number" };

const EXTRACTION_SCHEMA = Object.freeze({
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "number",
          "continuesFromPrevious",
          "continuesOnNext",
          "type",
          "prompt",
          "choices",
          "explanation",
          "correctAnswerStatement",
          "figures",
          "region",
          "confidence",
          "issues",
        ],
        properties: {
          number: { type: ["integer", "null"] },
          continuesFromPrevious: { type: "boolean" },
          continuesOnNext: { type: "boolean" },
          type: { type: "string", enum: [...QUESTION_TYPES] },
          prompt: { type: "string" },
          choices: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["label", "text", "correct", "explanation"],
              properties: {
                label: { type: "string" },
                text: { type: "string" },
                correct: { type: "boolean" },
                explanation: nullableString,
              },
            },
          },
          explanation: nullableString,
          correctAnswerStatement: nullableString,
          figures: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["left", "top", "right", "bottom", "target"],
              properties: {
                left: pixel,
                top: pixel,
                right: pixel,
                bottom: pixel,
                target: { type: "string" },
              },
            },
          },
          region: {
            type: "object",
            additionalProperties: false,
            required: ["top", "bottom"],
            properties: { top: pixel, bottom: pixel },
          },
          confidence: { type: "string", enum: [...CONFIDENCE_LEVELS] },
          issues: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
});

export { CONFIDENCE_LEVELS, PROMPT_FIGURE_TARGET, EXTRACTION_SCHEMA };
export type { Confidence, ExtractedChoice, ExtractedFigure, ExtractedQuestion, SegmentExtraction };
