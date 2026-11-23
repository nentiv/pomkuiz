const QUIZ_SCHEMA_VERSION = 1;
const INDEX_SCHEMA_VERSION = 1;

const QUESTION_TYPES = ["single", "multiple"] as const;
type QuestionType = (typeof QUESTION_TYPES)[number];

interface Choice {
  id: string;
  text: string;
  correct: boolean;
  images?: string[];
  explanation?: string;
}

interface Question {
  id: string;
  type: QuestionType;
  prompt: string;
  images?: string[];
  choices: Choice[];
  explanation?: string;
}

interface Quiz {
  schemaVersion: typeof QUIZ_SCHEMA_VERSION;
  id: string;
  title: string;
  description?: string;
  section?: string;
  tags?: string[];
  updatedAt: string;
  questions: Question[];
}

interface QuizSummary {
  id: string;
  title: string;
  description: string;
  questionCount: number;
  date: string;
  section?: string;
  tags: string[];
}

interface QuizIndex {
  schemaVersion: typeof INDEX_SCHEMA_VERSION;
  quizzes: QuizSummary[];
}

export { QUIZ_SCHEMA_VERSION, INDEX_SCHEMA_VERSION, QUESTION_TYPES };
export type { QuestionType, Choice, Question, Quiz, QuizSummary, QuizIndex };
