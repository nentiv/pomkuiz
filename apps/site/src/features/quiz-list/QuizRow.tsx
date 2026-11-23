import { href } from "../../app/hash-router.ts";
import { usePreferences } from "../../app/PreferencesProvider.tsx";
import type { QuizSummary } from "@pomkuiz/quiz-contract";
import { formatGrade, splitTitleDate } from "../../shared/formatters.ts";
import { MESSAGES } from "../../shared/i18n/messages-fr.ts";
import { Card, Icon, Pill } from "@pomkuiz/design-system";
import { ArrowRight, Play } from "@pomkuiz/design-system/icons";
import { activeAttempt, bestFinished, latestFinished, type QuizProgress } from "../progress/attempts.ts";
import { scoreLevel } from "../results/scoring.ts";
import "./quiz-list.css";

function QuizRow({ quiz, progress }: { quiz: QuizSummary; progress: QuizProgress }) {
  const { scoreScale } = usePreferences().settings;
  const active = activeAttempt(progress);
  const last = latestFinished(progress)?.score ?? null;
  const best = bestFinished(progress);
  const level = last ? scoreLevel(last.normal / last.max) : null;
  const { name, date } = splitTitleDate(quiz.title);
  return (
    <Card as="a" href={href.quiz(quiz.id)} tone={level ?? "glass"} padding="md" interactive class="quiz-row">
      <h2 class="quiz-row-title">{name}</h2>
      <div class="quiz-row-body">
        <div class="quiz-row-meta">
          {date && (
            <time class="quiz-row-date" dateTime={date.iso}>
              {date.label}
            </time>
          )}
          <span class="quiz-row-count">{MESSAGES.list.questions(quiz.questionCount)}</span>
          {quiz.tags.map((tag) => (
            <Pill key={tag}>{tag}</Pill>
          ))}
        </div>
        <div class="quiz-row-aside">
          {active && (
            <Pill tone="accent" icon={Play}>
              {MESSAGES.list.inProgress(active.currentIndex + 1, active.questionCount)}
            </Pill>
          )}
          {best && <Pill>{MESSAGES.list.best(formatGrade(best.normal, best.max, scoreScale))}</Pill>}
          {last && level && (
            <Pill tone={level}>{MESSAGES.list.last(formatGrade(last.normal, last.max, scoreScale))}</Pill>
          )}
          <Icon icon={ArrowRight} size="sm" class="quiz-row-arrow" />
        </div>
      </div>
    </Card>
  );
}

export { QuizRow };
