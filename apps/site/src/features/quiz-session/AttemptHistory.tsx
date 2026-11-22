import { href } from "../../app/hash-router.ts";
import { formatDateTime, formatPercent } from "../../shared/formatters.ts";
import { MESSAGES } from "../../shared/i18n/messages-fr.ts";
import { Card, Icon, Pill, RevealListItem, SectionLabel } from "@pomkuiz/design-system";
import { ArrowRight, Shuffle } from "@pomkuiz/design-system/icons";
import type { Attempt } from "../progress/attempts.ts";
import { scoreLevel } from "../results/scoring.ts";

function AttemptOutcome({ attempt }: { attempt: Attempt }) {
  const messages = MESSAGES.quiz;
  if (attempt.status === "in-progress") return <Pill tone="accent">{messages.statuses["in-progress"]}</Pill>;
  if (attempt.status === "abandoned" || !attempt.score) return <Pill>{messages.statuses[attempt.status]}</Pill>;
  return (
    <Pill tone={scoreLevel(attempt.score.normal / attempt.score.max)}>
      {formatPercent(attempt.score.normal, attempt.score.max)}
    </Pill>
  );
}

function AttemptContent({ attempt }: { attempt: Attempt }) {
  return (
    <>
      <span class="attempt-when">
        <time dateTime={attempt.startedAt}>{formatDateTime(attempt.startedAt)}</time>
        <span class="attempt-mode">
          {MESSAGES.quiz.modes[attempt.mode]}
          {attempt.order && (
            <span class="attempt-shuffled" title={MESSAGES.quiz.shuffled}>
              <Icon icon={Shuffle} size="sm" label={MESSAGES.quiz.shuffled} />
            </span>
          )}
        </span>
      </span>
      <span class="attempt-outcome">
        <AttemptOutcome attempt={attempt} />
        {attempt.status !== "in-progress" && <Icon icon={ArrowRight} size="sm" class="attempt-arrow" />}
      </span>
    </>
  );
}

function AttemptHistory({ quizId, attempts }: { quizId: string; attempts: readonly Attempt[] }) {
  if (attempts.length === 0) return null;
  return (
    <section class="stack" aria-labelledby="history-title">
      <SectionLabel id="history-title">{MESSAGES.quiz.history}</SectionLabel>
      <ul class="attempt-list">
        {attempts.toReversed().map((attempt, index) => (
          <RevealListItem key={attempt.id} index={index}>
            {attempt.status === "in-progress" ? (
              <Card padding="sm" class="attempt-row">
                <AttemptContent attempt={attempt} />
              </Card>
            ) : (
              <Card as="a" href={href.results(quizId, attempt.id)} padding="sm" interactive class="attempt-row">
                <AttemptContent attempt={attempt} />
              </Card>
            )}
          </RevealListItem>
        ))}
      </ul>
    </section>
  );
}

export { AttemptHistory };
