import type { QuizSummary } from "@pomkuiz/quiz-contract";
import { APP_CONFIG } from "../../shared/config/app-config.ts";

interface QuizSection {
  title: string | null;
  quizzes: QuizSummary[];
}

const sectionCollator = new Intl.Collator(APP_CONFIG.locale, { sensitivity: "base", numeric: true });

function groupBySection(quizzes: readonly QuizSummary[], otherTitle: string): QuizSection[] {
  const sections = new Map<string, QuizSummary[]>();
  const others: QuizSummary[] = [];
  for (const quiz of quizzes) {
    if (!quiz.section) {
      others.push(quiz);
      continue;
    }
    const group = sections.get(quiz.section);
    if (group) group.push(quiz);
    else sections.set(quiz.section, [quiz]);
  }
  if (sections.size === 0) return [{ title: null, quizzes: others }];
  const named = [...sections]
    .toSorted(([first], [second]) => sectionCollator.compare(first, second))
    .map(([title, grouped]) => ({ title, quizzes: grouped }));
  return others.length > 0 ? [...named, { title: otherTitle, quizzes: others }] : named;
}

export { groupBySection };
export type { QuizSection };
