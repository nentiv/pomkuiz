import { href, navigate } from "../../app/hash-router.ts";
import { usePreferences } from "../../app/PreferencesProvider.tsx";
import { CORRECTION_MODES } from "../../shared/config/app-config.ts";
import type { Quiz } from "@pomkuiz/quiz-contract";
import { fetchQuiz, useLoadable } from "../../shared/data/quiz-api.ts";
import { formatGrade, splitTitleDate } from "../../shared/formatters.ts";
import { MESSAGES } from "../../shared/i18n/messages-fr.ts";
import { createId } from "../../shared/create-id.ts";
import {
  RichText,
  Button,
  Card,
  PageHeader,
  Pill,
  ProgressBar,
  ScoreStat,
  Segmented,
  Switch,
} from "@pomkuiz/design-system";
import { ArrowRight, RotateCcw, Shuffle } from "@pomkuiz/design-system/icons";
import { LoadState } from "../../shared/ui/LoadState.tsx";
import { activeAttempt, bestFinished, latestFinished, startAttempt } from "../progress/attempts.ts";
import { useQuizProgress } from "../progress/use-quiz-progress.ts";
import { scoreLevel } from "../results/scoring.ts";
import { AttemptHistory } from "./AttemptHistory.tsx";
import "./quiz-page.css";

const MODE_OPTIONS = CORRECTION_MODES.map((mode) => ({ value: mode, label: MESSAGES.quiz.modes[mode] }));

function QuizOverview({ quiz }: { quiz: Quiz }) {
  const { settings, updateSettings } = usePreferences();
  const [progress, update] = useQuizProgress(quiz.id);
  const messages = MESSAGES.quiz;
  const active = activeAttempt(progress);
  const last = latestFinished(progress)?.score ?? null;
  const best = bestFinished(progress);
  const title = splitTitleDate(quiz.title);
  const total = quiz.questions.length;
  const answered = active ? Object.values(active.answers).filter((selected) => selected.length > 0).length : 0;

  const begin = () => {
    if (active && !globalThis.confirm(messages.restartConfirm)) return;
    update((current) =>
      startAttempt(current, quiz, {
        id: createId(),
        now: new Date().toISOString(),
        mode: settings.correctionMode,
        shuffle: settings.shuffle,
      }),
    );
    navigate(href.play(quiz.id));
  };

  return (
    <div class="page page-enter">
      <PageHeader
        titleId="quiz-title"
        back={{ href: href.list(), label: messages.back }}
        eyebrow={title.date ? <time dateTime={title.date.iso}>{title.date.label}</time> : undefined}
        title={title.name}
        actions={
          active ? (
            <>
              <Button variant="ghost" icon={RotateCcw} iconPosition="start" onClick={begin}>
                {messages.restart}
              </Button>
              <Button variant="primary" href={href.play(quiz.id)} icon={ArrowRight}>
                {messages.resume}
              </Button>
            </>
          ) : (
            <Button variant="primary" icon={ArrowRight} onClick={begin}>
              {progress.attempts.length > 0 ? messages.restart : messages.start}
            </Button>
          )
        }
        meta={
          <>
            <span>{MESSAGES.list.questions(total)}</span>
            {quiz.tags?.map((tag) => (
              <Pill key={tag}>{tag}</Pill>
            ))}
          </>
        }
      />
      {quiz.description && <RichText class="quiz-description" text={quiz.description} />}

      {last && best && (
        <div class="grid-2">
          <Card padding="md" tone={scoreLevel(last.normal / last.max)}>
            <ScoreStat
              label={messages.lastScore}
              value={formatGrade(last.normal, last.max, settings.scoreScale)}
              tone={scoreLevel(last.normal / last.max)}
            />
          </Card>
          <Card padding="md" tone={scoreLevel(best.normal / best.max)}>
            <ScoreStat
              label={messages.bestScore}
              value={formatGrade(best.normal, best.max, settings.scoreScale)}
              tone={scoreLevel(best.normal / best.max)}
            />
          </Card>
        </div>
      )}

      <Card tone="pastel" padding="md" class="launch">
        {active && (
          <div class="launch-progress">
            <div class="launch-progress-head">
              <p class="launch-position">{messages.position(active.currentIndex + 1, active.questionCount)}</p>
              <p class="muted">{messages.answered(answered, total)}</p>
            </div>
            <ProgressBar value={answered} max={total} label={messages.answered(answered, total)} />
          </div>
        )}
        <div class="launch-options">
          <Segmented
            name="correction-mode"
            legend={messages.mode}
            options={MODE_OPTIONS}
            value={settings.correctionMode}
            onChange={(correctionMode) => updateSettings({ correctionMode })}
          />
          <Switch
            label={messages.shuffle}
            description={messages.shuffleHint}
            icon={Shuffle}
            checked={settings.shuffle}
            onChange={(shuffle) => updateSettings({ shuffle })}
          />
        </div>
      </Card>

      <AttemptHistory quizId={quiz.id} attempts={progress.attempts} />
    </div>
  );
}

function QuizPage({ quizId }: { quizId: string }) {
  const quiz = useLoadable(() => fetchQuiz(quizId), quizId);
  return <LoadState value={quiz}>{(value) => <QuizOverview quiz={value} />}</LoadState>;
}

export { QuizPage };
