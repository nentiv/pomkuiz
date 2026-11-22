import { CONTRACT_LIMITS } from "@pomkuiz/quiz-contract";
import { ISSUE_MESSAGES } from "../../config/user-messages.ts";
import { fillTemplate } from "../../shared/text-cleaning.ts";
import type { AssembledQuestion } from "./assemble-questions.ts";
import { findInvalidFormulas } from "./validate-latex.ts";
import { statementDisagrees } from "./correct-answer-statement.ts";

function reviewAssembledQuestion(assembled: AssembledQuestion): string[] {
  const { question } = assembled;
  const issues: string[] = [];
  const correctCount = question.choices.filter((choice) => choice.correct).length;
  if (question.type === "single" && correctCount !== 1)
    issues.push(fillTemplate(ISSUE_MESSAGES.singleNeedsOneCorrect, { count: correctCount }));
  if (question.type === "multiple" && correctCount === 0) issues.push(ISSUE_MESSAGES.multipleNeedsCorrect);
  if (question.choices.length < CONTRACT_LIMITS.minChoices)
    issues.push(fillTemplate(ISSUE_MESSAGES.tooFewChoices, { minimum: CONTRACT_LIMITS.minChoices }));
  if (!question.prompt && question.figures.every((figure) => figure.target !== "prompt"))
    issues.push(ISSUE_MESSAGES.emptyPrompt);
  const labels = question.choices.map((choice) => choice.label);
  for (const label of new Set(labels.filter((candidate, index) => labels.indexOf(candidate) !== index)))
    issues.push(fillTemplate(ISSUE_MESSAGES.duplicateLabel, { label }));
  if (question.correctAnswerStatement === null) issues.push(ISSUE_MESSAGES.missingStatement);
  else if (statementDisagrees(question.choices, question.correctAnswerStatement))
    issues.push(fillTemplate(ISSUE_MESSAGES.statementMismatch, { statement: question.correctAnswerStatement }));
  if (assembled.segments.length > 1)
    issues.push(fillTemplate(ISSUE_MESSAGES.mergedAcrossSegments, { count: assembled.segments.length }));
  if (assembled.orphanContinuation) issues.push(ISSUE_MESSAGES.orphanContinuation);
  if (question.confidence === "low") issues.push(ISSUE_MESSAGES.lowConfidence);
  const texts = [
    question.prompt,
    question.explanation ?? "",
    ...question.choices.flatMap((choice) => [choice.text, choice.explanation ?? ""]),
  ];
  for (const formula of findInvalidFormulas(texts))
    issues.push(fillTemplate(ISSUE_MESSAGES.invalidFormula, { formula }));
  return issues;
}

export { reviewAssembledQuestion };
