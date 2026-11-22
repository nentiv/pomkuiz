import { CONTRACT_LIMITS } from "./contract-limits.ts";
import type { QuestionType } from "./quiz-types.ts";

type QuestionRuleCode =
  | "empty-prompt"
  | "too-few-choices"
  | "too-many-choices"
  | "empty-choice"
  | "single-needs-one-correct"
  | "multiple-needs-correct";

interface RuleSubject {
  type: QuestionType;
  prompt: string;
  images?: readonly unknown[];
  choices: readonly { text: string; correct: boolean; images?: readonly unknown[] }[];
}

const hasContent = (text: string, images?: readonly unknown[]) => text.trim().length > 0 || (images?.length ?? 0) > 0;

function checkQuestionRules(question: RuleSubject): QuestionRuleCode[] {
  const codes: QuestionRuleCode[] = [];
  const correct = question.choices.filter((choice) => choice.correct).length;
  if (!hasContent(question.prompt, question.images)) codes.push("empty-prompt");
  if (question.choices.length < CONTRACT_LIMITS.minChoices) codes.push("too-few-choices");
  if (question.choices.length > CONTRACT_LIMITS.maxChoices) codes.push("too-many-choices");
  if (question.choices.some((choice) => !hasContent(choice.text, choice.images))) codes.push("empty-choice");
  if (question.type === "single" && correct !== 1) codes.push("single-needs-one-correct");
  if (question.type === "multiple" && correct === 0) codes.push("multiple-needs-correct");
  return codes;
}

export { checkQuestionRules };
export type { QuestionRuleCode };
