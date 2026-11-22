import type { Quiz } from "./quiz-types.ts";

interface IntegrityIssue {
  path: string;
  code: "duplicate-question-id" | "duplicate-choice-id" | "id-mismatch";
}

function findIntegrityIssues(quiz: Quiz, expectedId?: string): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  if (expectedId !== undefined && quiz.id !== expectedId) issues.push({ path: "id", code: "id-mismatch" });
  const questionIds = new Set<string>();
  quiz.questions.forEach((question, questionIndex) => {
    if (questionIds.has(question.id))
      issues.push({
        path: `questions[${questionIndex}].id`,
        code: "duplicate-question-id",
      });
    questionIds.add(question.id);
    const choiceIds = new Set<string>();
    question.choices.forEach((choice, choiceIndex) => {
      if (choiceIds.has(choice.id))
        issues.push({
          path: `questions[${questionIndex}].choices[${choiceIndex}].id`,
          code: "duplicate-choice-id",
        });
      choiceIds.add(choice.id);
    });
  });
  return issues;
}

function listReferencedAssets(quiz: Quiz): string[] {
  const assets = new Set<string>();
  for (const question of quiz.questions) {
    for (const image of question.images ?? []) assets.add(image);
    for (const choice of question.choices) for (const image of choice.images ?? []) assets.add(image);
  }
  return [...assets];
}

export { findIntegrityIssues, listReferencedAssets };
