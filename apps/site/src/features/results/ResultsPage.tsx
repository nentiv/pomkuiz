import { useState } from "preact/hooks";
import { href, navigate } from "../../app/hash-router.ts";
import { usePreferences } from "../../app/PreferencesProvider.tsx";
import { APP_CONFIG } from "../../shared/config/app-config.ts";
import type { Quiz } from "@pomkuiz/quiz-contract";
import { fetchQuiz, useLoadable } from "../../shared/data/quiz-api.ts";
import { formatGrade, formatGradeValue, formatScore, splitTitleDate } from "../../shared/formatters.ts";
import { MESSAGES } from "../../shared/i18n/messages-fr.ts";
import { createId } from "../../shared/create-id.ts";
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Pill,
  ProgressRing,
  RevealListItem,
  SectionLabel,
  Segmented,
} from "@pomkuiz/design-system";
import { ArrowRight, Trophy, TriangleAlert } from "@pomkuiz/design-system/icons";
import { LoadState } from "../../shared/ui/LoadState.tsx";
import { reconcileAttempt, startAttempt } from "../progress/attempts.ts";
import { applyOrder } from "../progress/attempt-order.ts";
import { useQuizProgress } from "../progress/use-quiz-progress.ts";
import { QuestionView } from "../quiz-session/QuestionView.tsx";
import { scoreAttempt, scoreLevel, scoreQuestion } from "./scoring.ts";
import "./results.css";

type ReviewFilter = "all" | "mistakes";

function ResultsView({ quiz, attemptId }: { quiz: Quiz; attemptId: string }) {
  const { settings } = usePreferences();
  const [progress, update] = useQuizProgress(quiz.id);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const stored = progress.attempts.find((attempt) => attempt.id === attemptId);
  const attempt = stored && stored.status !== "in-progress" ? reconcileAttempt(stored, quiz) : null;
  if (!attempt) return <EmptyState icon={TriangleAlert} title={MESSAGES.results.notFound} />;
  const reviewed = applyOrder(quiz.questions, attempt.order).map((question, index) => {
    const selected = attempt.answers[question.id] ?? [];
    return { question, index, selected, score: scoreQuestion(question, selected) };
  });

  const messages = MESSAGES.results;
  const summary = scoreAttempt(quiz, attempt.answers);
  const level = scoreLevel(summary.max > 0 ? summary.normal / summary.max : 0);
  const grade = formatGrade(summary.normal, summary.max, settings.scoreScale);
  const mistakes = reviewed.filter((item) => item.score.normal === 0);
  const visible = filter === "all" ? reviewed : mistakes;
  const name = splitTitleDate(quiz.title).name;

  const restart = () => {
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
        titleId="results-title"
        back={{ href: href.quiz(quiz.id), label: name }}
        eyebrow={name}
        title={messages.title}
        meta={messages.answered(summary.answered, summary.max)}
      />
      <Card tone="pastel" padding="lg" class="results-hero">
        <ProgressRing value={summary.normal} max={summary.max} tone={level} size="lg" label={messages.ring(grade)}>
          <span class="results-percent">{formatGradeValue(summary.normal, summary.max, settings.scoreScale)}</span>
          {settings.scoreScale === "twenty" && <span class="results-score">{messages.outOf(APP_CONFIG.gradeMax)}</span>}
          <span class="results-score">{formatScore(summary.normal, summary.max)}</span>
        </ProgressRing>
        <div class="results-summary">
          <p class="eyebrow">{messages.score}</p>
          <p class="muted">{messages.hint}</p>
          <div class="actions">
            <Button variant="primary" size="lg" icon={ArrowRight} onClick={restart}>
              {MESSAGES.quiz.restart}
            </Button>
            <Button variant="ghost" href={href.quiz(quiz.id)}>
              {MESSAGES.back}
            </Button>
          </div>
        </div>
      </Card>

      <section class="stack" aria-labelledby="review-title">
        <SectionLabel
          id="review-title"
          action={
            <Segmented
              name="review-filter"
              legend={messages.filter}
              hideLegend
              options={[
                { value: "all", label: messages.filters.all(reviewed.length) },
                { value: "mistakes", label: messages.filters.mistakes(mistakes.length) },
              ]}
              value={filter}
              onChange={setFilter}
            />
          }
        >
          {messages.review}
        </SectionLabel>
        {visible.length === 0 ? (
          <EmptyState icon={Trophy} title={messages.noMistakes} />
        ) : (
          <ol class="review-list">
            {visible.map((item, order) => (
              <RevealListItem key={item.question.id} index={Math.min(order, 6)}>
                <Card padding="lg" class="review-item">
                  <Pill tone={item.score.answered ? (item.score.normal ? "high" : "low") : "neutral"}>
                    {item.score.answered ? messages.points(item.score.normal) : messages.unanswered}
                  </Pill>
                  <QuestionView
                    quizId={quiz.id}
                    question={item.question}
                    position={item.index + 1}
                    total={reviewed.length}
                    selected={item.selected}
                    reveal
                    readOnly
                  />
                </Card>
              </RevealListItem>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function ResultsPage({ quizId, attemptId }: { quizId: string; attemptId: string }) {
  const quiz = useLoadable(() => fetchQuiz(quizId), quizId);
  return <LoadState value={quiz}>{(value) => <ResultsView quiz={value} attemptId={attemptId} />}</LoadState>;
}

export { ResultsPage };
