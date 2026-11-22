import type { Question } from "@pomkuiz/quiz-contract";
import { MESSAGES } from "../../shared/i18n/messages-fr.ts";
import { classNames } from "@pomkuiz/design-system";
import { isLocked, type Attempt } from "../progress/attempts.ts";
import { scoreQuestion } from "../results/scoring.ts";

function stateOf(attempt: Attempt, question: Question): string | null {
  const selected = attempt.answers[question.id] ?? [];
  if (isLocked(attempt, question.id)) return scoreQuestion(question, selected).normal ? "nav-correct" : "nav-wrong";
  return selected.length > 0 ? "nav-answered" : null;
}

interface QuestionNavigatorProps {
  questions: readonly Question[];
  attempt: Attempt;
  onSelect: (index: number) => void;
}

function QuestionNavigator({ questions, attempt, onSelect }: QuestionNavigatorProps) {
  const legend = MESSAGES.session.legend;
  return (
    <nav aria-label={MESSAGES.session.navigator} class="navigator">
      <ol class="navigator-grid">
        {questions.map((question, index) => (
          <li key={question.id}>
            <button
              type="button"
              class={classNames("nav-cell", stateOf(attempt, question))}
              aria-current={index === attempt.currentIndex ? "step" : undefined}
              aria-label={MESSAGES.session.goTo(index + 1)}
              onClick={() => onSelect(index)}
            >
              {index + 1}
            </button>
          </li>
        ))}
      </ol>
      <ul class="navigator-legend" aria-hidden="true">
        <li>
          <span class="nav-swatch swatch-answered" />
          {legend.answered}
        </li>
        {attempt.mode === "per-question" && (
          <>
            <li>
              <span class="nav-swatch swatch-correct" />
              {legend.correct}
            </li>
            <li>
              <span class="nav-swatch swatch-wrong" />
              {legend.wrong}
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}

export { QuestionNavigator };
