import { CONTRACT_LIMITS } from "@pomkuiz/quiz-contract";
import { AppError } from "../../shared/app-error.ts";
import { compileSchema } from "../../shared/json-schema-validation.ts";
import { cleanMultiline, cleanSingleLine } from "../../shared/text-cleaning.ts";
import {
  EXTRACTION_SCHEMA,
  PROMPT_FIGURE_TARGET,
  type ExtractedChoice,
  type ExtractedFigure,
  type ExtractedQuestion,
  type SegmentExtraction,
} from "./extraction-schema.ts";

interface ImageSize {
  width: number;
  height: number;
}

const PARSE_LIMITS = Object.freeze({
  labelCharacters: 4,
  issueCharacters: 300,
  maxIssues: 12,
  maxQuestions: 60,
  minFigurePx: 4,
});

const LABEL_NOISE = /[^\p{L}\p{N}]/gu;
const ALPHABET = "abcdefghijklmnopqrstuvwxyz";
const LABEL_PREFIX = /^\s*([\p{L}\p{N}]{1,3})\s*[.)]\s+/u;

const validate = compileSchema<SegmentExtraction>(EXTRACTION_SCHEMA);

const richText = (value: string) => cleanMultiline(value, CONTRACT_LIMITS.richTextCharacters);

function optionalRichText(value: string | null): string | null {
  if (value === null) return null;
  const cleaned = richText(value);
  return cleaned || null;
}

const clamp = (value: number, maximum: number) => Math.min(maximum, Math.max(0, value));

function normalizeLabel(label: string, index: number): string {
  const cleaned = label.toLowerCase().replace(LABEL_NOISE, "").slice(0, PARSE_LIMITS.labelCharacters);
  return cleaned || ALPHABET[index] || String(index + 1);
}

function stripLabelPrefix(text: string, label: string): string {
  const match = LABEL_PREFIX.exec(text);
  return match?.[1]?.toLowerCase() === label ? text.slice(match[0].length) : text;
}

function cleanChoice(choice: ExtractedChoice, index: number): ExtractedChoice {
  const label = normalizeLabel(choice.label, index);
  return {
    label,
    text: richText(stripLabelPrefix(choice.text, label)),
    correct: choice.correct,
    explanation: optionalRichText(choice.explanation),
  };
}

function cleanFigure(figure: ExtractedFigure, size: ImageSize): ExtractedFigure | null {
  const left = clamp(Math.min(figure.left, figure.right), size.width);
  const right = clamp(Math.max(figure.left, figure.right), size.width);
  const top = clamp(Math.min(figure.top, figure.bottom), size.height);
  const bottom = clamp(Math.max(figure.top, figure.bottom), size.height);
  if (right - left < PARSE_LIMITS.minFigurePx || bottom - top < PARSE_LIMITS.minFigurePx) return null;
  const target = figure.target.trim().toLowerCase();
  return {
    left,
    top,
    right,
    bottom,
    target: target === PROMPT_FIGURE_TARGET ? PROMPT_FIGURE_TARGET : normalizeLabel(target, 0),
  };
}

function cleanQuestion(question: ExtractedQuestion, size: ImageSize): ExtractedQuestion {
  const top = clamp(Math.min(question.region.top, question.region.bottom), size.height);
  const bottom = clamp(Math.max(question.region.top, question.region.bottom), size.height);
  return {
    number: question.number !== null && question.number > 0 ? question.number : null,
    continuesFromPrevious: question.continuesFromPrevious,
    continuesOnNext: question.continuesOnNext,
    type: question.type,
    prompt: richText(question.prompt),
    choices: question.choices.map(cleanChoice),
    explanation: optionalRichText(question.explanation),
    correctAnswerStatement: optionalRichText(question.correctAnswerStatement),
    figures: question.figures
      .map((figure) => cleanFigure(figure, size))
      .filter((figure): figure is ExtractedFigure => figure !== null),
    region: { top, bottom },
    confidence: question.confidence,
    issues: question.issues
      .map((issue) => cleanSingleLine(issue, PARSE_LIMITS.issueCharacters))
      .filter(Boolean)
      .slice(0, PARSE_LIMITS.maxIssues),
  };
}

function parseExtraction(raw: unknown, size: ImageSize): SegmentExtraction {
  const extraction = validate.assert(raw, "claudeInvalidOutput");
  if (extraction.questions.length > PARSE_LIMITS.maxQuestions)
    throw new AppError("claudeInvalidOutput", "too many questions");
  return { questions: extraction.questions.map((question) => cleanQuestion(question, size)) };
}

export { parseExtraction };
export type { ImageSize };
