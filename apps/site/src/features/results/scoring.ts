import { APP_CONFIG } from "../../shared/config/app-config.ts";
import type { Question, Quiz } from "@pomkuiz/quiz-contract";

interface QuestionScore {
  normal: number;
  answered: boolean;
}

interface ScoreSummary {
  normal: number;
  max: number;
  answered: number;
}

function scoreQuestion(question: Question, selected: readonly string[]): QuestionScore {
  const chosen = new Set(selected.filter((id) => question.choices.some((choice) => choice.id === id)));
  const answered = chosen.size > 0;
  const correct = question.choices.filter((choice) => choice.correct);
  const exact = answered && chosen.size === correct.length && correct.every((choice) => chosen.has(choice.id));
  return { normal: exact ? 1 : 0, answered };
}

function scoreAttempt(quiz: Quiz, answers: Readonly<Record<string, readonly string[]>>): ScoreSummary {
  return quiz.questions.reduce<ScoreSummary>(
    (summary, question) => {
      const score = scoreQuestion(question, answers[question.id] ?? []);
      return {
        normal: summary.normal + score.normal,
        max: summary.max + 1,
        answered: summary.answered + (score.answered ? 1 : 0),
      };
    },
    { normal: 0, max: 0, answered: 0 },
  );
}

function percent(points: number, max: number): number {
  return max > 0 ? (points / max) * 100 : 0;
}

type ScoreLevel = "low" | "medium" | "high";

function scoreLevel(ratio: number): ScoreLevel {
  if (ratio >= APP_CONFIG.scoreLevels.highFrom) return "high";
  if (ratio >= APP_CONFIG.scoreLevels.mediumFrom) return "medium";
  return "low";
}

export { scoreQuestion, scoreAttempt, percent, scoreLevel };
export type { ScoreSummary };
