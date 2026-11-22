import {
  type Confidence,
  type ExtractedChoice,
  type ExtractedFigure,
  type ExtractedQuestion,
  type SegmentExtraction,
  CONFIDENCE_LEVELS,
} from "./extraction-schema.ts";
import { correctFlagsFromStatement } from "./correct-answer-statement.ts";

interface SegmentResult {
  segmentIndex: number;
  extraction: SegmentExtraction;
}

interface LocatedFigure {
  segmentIndex: number;
  figure: ExtractedFigure;
}

interface AssembledQuestion {
  question: ExtractedQuestion;
  segments: number[];
  regions: { segmentIndex: number; top: number; bottom: number }[];
  figures: LocatedFigure[];
  orphanContinuation: boolean;
}

const TEXT_JOINER = "\n";

function joinText(first: string, second: string): string {
  if (!second || first.includes(second)) return first;
  if (!first || second.includes(first)) return second;
  return `${first}${TEXT_JOINER}${second}`;
}

function joinOptional(first: string | null, second: string | null): string | null {
  if (first === null) return second;
  if (second === null) return first;
  return joinText(first, second);
}

function lowerConfidence(first: Confidence, second: Confidence): Confidence {
  return CONFIDENCE_LEVELS[Math.max(CONFIDENCE_LEVELS.indexOf(first), CONFIDENCE_LEVELS.indexOf(second))] as Confidence;
}

function mergeChoices(target: ExtractedChoice[], fragment: readonly ExtractedChoice[]): ExtractedChoice[] {
  const merged = target.map((choice) => ({ ...choice }));
  for (const choice of fragment) {
    const existing = merged.find((candidate) => candidate.label === choice.label);
    if (!existing) {
      merged.push({ ...choice });
      continue;
    }
    existing.text = joinText(existing.text, choice.text);
    existing.correct ||= choice.correct;
    existing.explanation = joinOptional(existing.explanation, choice.explanation);
  }
  return merged;
}

function mergeQuestion(target: ExtractedQuestion, fragment: ExtractedQuestion): ExtractedQuestion {
  return {
    ...target,
    number: target.number ?? fragment.number,
    continuesOnNext: fragment.continuesOnNext,
    prompt: joinText(target.prompt, fragment.prompt),
    choices: mergeChoices(target.choices, fragment.choices),
    explanation: joinOptional(target.explanation, fragment.explanation),
    correctAnswerStatement: joinOptional(target.correctAnswerStatement, fragment.correctAnswerStatement),
    figures: [...target.figures, ...fragment.figures],
    confidence: lowerConfidence(target.confidence, fragment.confidence),
    issues: [...new Set([...target.issues, ...fragment.issues])],
  };
}

function belongsToPrevious(
  previous: AssembledQuestion | undefined,
  question: ExtractedQuestion,
  isFirstInSegment: boolean,
): boolean {
  if (!previous) return false;
  const sameNumber = question.number !== null && question.number === previous.question.number;
  if (sameNumber) return true;
  if (!isFirstInSegment || !question.continuesFromPrevious) return false;
  return previous.question.continuesOnNext || question.number === null;
}

function resolveMergedCorrectness(assembled: AssembledQuestion): void {
  const { question } = assembled;
  if (assembled.segments.length < 2 || question.correctAnswerStatement === null) return;
  const flags = correctFlagsFromStatement(question.choices, question.correctAnswerStatement);
  if (!flags) return;
  question.choices = question.choices.map((choice, index) => ({ ...choice, correct: flags[index] ?? choice.correct }));
}

function assembleQuestions(results: readonly SegmentResult[]): AssembledQuestion[] {
  const assembled: AssembledQuestion[] = [];
  const ordered = results.toSorted((first, second) => first.segmentIndex - second.segmentIndex);
  for (const { segmentIndex, extraction } of ordered) {
    extraction.questions.forEach((question, index) => {
      const located = question.figures.map((figure) => ({ segmentIndex, figure }));
      const region = { segmentIndex, ...question.region };
      const previous = assembled.at(-1);
      if (previous && belongsToPrevious(previous, question, index === 0)) {
        previous.question = mergeQuestion(previous.question, question);
        if (!previous.segments.includes(segmentIndex)) previous.segments.push(segmentIndex);
        previous.regions.push(region);
        previous.figures.push(...located);
        return;
      }
      assembled.push({
        question: { ...question, choices: question.choices.map((choice) => ({ ...choice })) },
        segments: [segmentIndex],
        regions: [region],
        figures: located,
        orphanContinuation: index === 0 && question.continuesFromPrevious,
      });
    });
  }
  for (const item of assembled) resolveMergedCorrectness(item);
  return assembled;
}

export { assembleQuestions };
export type { SegmentResult, AssembledQuestion };
