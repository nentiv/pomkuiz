import type { QuestionType } from "@pomkuiz/quiz-contract";

const QUESTION_STATUSES = ["unverified", "verified", "needs_review"] as const;
type QuestionStatus = (typeof QUESTION_STATUSES)[number];

const DRAFT_LIMITS = Object.freeze({
  issueCharacters: 600,
  maxIssues: 20,
});

interface DraftChoice {
  key: string;
  text: string;
  correct: boolean;
  explanation: string;
  images: string[];
}

interface SourceLocation {
  page: number;
  y0: number;
  y1: number;
}

interface DraftQuestion {
  key: string;
  status: QuestionStatus;
  number: number | null;
  type: QuestionType;
  prompt: string;
  explanation: string;
  images: string[];
  choices: DraftChoice[];
  source: SourceLocation | null;
  issues: string[];
}

interface DraftMeta {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

interface DraftContent {
  meta: DraftMeta;
  questions: DraftQuestion[];
}

interface Draft extends DraftContent {
  draftVersion: 1;
  importId: string;
  revision: number;
  updatedAt: string;
  lastExport: { quizId: string; at: string } | null;
}

function countStatuses(questions: readonly DraftQuestion[]): Record<QuestionStatus, number> {
  const counts = Object.fromEntries(QUESTION_STATUSES.map((status) => [status, 0])) as Record<QuestionStatus, number>;
  for (const question of questions) counts[question.status] += 1;
  return counts;
}

function listDraftAssets(content: DraftContent): string[] {
  return [
    ...new Set(
      content.questions.flatMap((question) => [
        ...question.images,
        ...question.choices.flatMap((choice) => choice.images),
      ]),
    ),
  ];
}

export { QUESTION_STATUSES, DRAFT_LIMITS, countStatuses, listDraftAssets };
export type { QuestionStatus, DraftChoice, SourceLocation, DraftQuestion, DraftMeta, DraftContent, Draft };
