import { href } from "../../app/hash-router.ts";
import { formatPercent, splitTitleDate } from "../../shared/formatters.ts";
import { MESSAGES } from "../../shared/i18n/messages-fr.ts";
import { Card, Icon, ProgressBar, ProgressRing, ScoreStat } from "@pomkuiz/design-system";
import { ArrowRight } from "@pomkuiz/design-system/icons";
import { scoreLevel } from "../results/scoring.ts";
import type { DashboardStats } from "./dashboard-stats.ts";
import "./dashboard.css";

const RATIO_MAX = 1;

function ResumeCard({ resume }: { resume: NonNullable<DashboardStats["resume"]> }) {
  const messages = MESSAGES.dashboard;
  const { attempt, quiz } = resume;
  const answered = Object.values(attempt.answers).filter((selected) => selected.length > 0).length;
  return (
    <Card as="a" href={href.play(quiz.id)} tone="pastel" padding="md" interactive class="resume-card">
      <ProgressRing
        value={answered}
        max={attempt.questionCount}
        tone="accent"
        label={messages.resumeProgress(answered, attempt.questionCount)}
      >
        <span class="resume-ring-value">{formatPercent(answered, attempt.questionCount)}</span>
      </ProgressRing>
      <div class="resume-text">
        <p class="eyebrow">{messages.resume}</p>
        <p class="resume-title">{splitTitleDate(quiz.title).name}</p>
        <p class="muted">{messages.resumePosition(attempt.currentIndex + 1, attempt.questionCount)}</p>
      </div>
      <span class="resume-go" aria-hidden="true">
        <Icon icon={ArrowRight} />
      </span>
    </Card>
  );
}

function Dashboard({ stats }: { stats: DashboardStats }) {
  if (!stats.hasActivity) return null;
  const messages = MESSAGES.dashboard;
  const averageLevel = stats.average !== null ? scoreLevel(stats.average) : null;
  return (
    <section class="dashboard" aria-label={messages.label}>
      {stats.resume && <ResumeCard resume={stats.resume} />}
      <div class="grid-2">
        <Card padding="md" class="widget">
          <ScoreStat
            label={messages.completed}
            value={messages.completedValue(stats.completed, stats.total)}
            tone="accent"
          />
          <ProgressBar value={stats.completed} max={stats.total} label={messages.completed} />
        </Card>
        <Card padding="md" tone={averageLevel ?? "glass"} class="widget">
          <ScoreStat
            label={messages.average}
            value={stats.average !== null ? formatPercent(stats.average, RATIO_MAX) : messages.none}
            tone={averageLevel ?? "neutral"}
            hint={messages.averageHint}
          />
        </Card>
      </div>
    </section>
  );
}

export { Dashboard };
