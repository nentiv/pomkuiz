import { parseQuizTitle } from "./quiz-title.ts";
import { INDEX_SCHEMA_VERSION, type Quiz, type QuizIndex, type QuizSummary } from "./quiz-types.ts";

function summarizeQuiz(quiz: Quiz): QuizSummary {
  return {
    id: quiz.id,
    title: quiz.title,
    description: quiz.description ?? "",
    questionCount: quiz.questions.length,
    date: parseQuizTitle(quiz.title).date ?? quiz.updatedAt,
    ...(quiz.section ? { section: quiz.section } : {}),
    tags: quiz.tags ?? [],
  };
}

function compareSummaries(first: QuizSummary, second: QuizSummary): number {
  if (first.date !== second.date) return first.date < second.date ? 1 : -1;
  return first.title.localeCompare(second.title);
}

function buildQuizIndex(quizzes: readonly Quiz[]): QuizIndex {
  return {
    schemaVersion: INDEX_SCHEMA_VERSION,
    quizzes: quizzes.map(summarizeQuiz).toSorted(compareSummaries),
  };
}

export { buildQuizIndex };
