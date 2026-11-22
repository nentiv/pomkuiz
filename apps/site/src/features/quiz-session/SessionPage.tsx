import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { href, navigate } from "../../app/hash-router.ts";
import type { Quiz } from "@pomkuiz/quiz-contract";
import { fetchQuiz, useLoadable } from "../../shared/data/quiz-api.ts";
import { splitTitleDate } from "../../shared/formatters.ts";
import { MESSAGES } from "../../shared/i18n/messages-fr.ts";
import { BottomSheet, Button, Card, EmptyState, ProgressBar } from "@pomkuiz/design-system";
import { ArrowLeft, ArrowRight, Check, Flag, LayoutGrid, Play } from "@pomkuiz/design-system/icons";
import { LoadState } from "../../shared/ui/LoadState.tsx";
import {
  activeAttempt,
  checkQuestion,
  finishAttempt,
  goToQuestion,
  isLocked,
  reconcileAttempt,
  toggleChoice,
  updateActive,
  type Attempt,
} from "../progress/attempts.ts";
import { applyOrder } from "../progress/attempt-order.ts";
import { useQuizProgress } from "../progress/use-quiz-progress.ts";
import { commandFor, isTypingTarget } from "./session-keyboard.ts";
import { QuestionNavigator } from "./QuestionNavigator.tsx";
import { QuestionView } from "./QuestionView.tsx";
import "./session.css";

const now = () => new Date().toISOString();

function SessionView({ quiz }: { quiz: Quiz }) {
  const [progress, update] = useQuizProgress(quiz.id);
  const attempt = activeAttempt(progress);
  const questions = useMemo(() => applyOrder(quiz.questions, attempt?.order ?? null), [quiz, attempt?.order]);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const messages = MESSAGES.session;

  const change = useCallback(
    (transform: (current: Attempt) => Attempt) => update((current) => updateActive(current, now(), transform)),
    [update],
  );

  useEffect(() => {
    change((current) => {
      const reconciled = reconcileAttempt(current, quiz);
      return JSON.stringify(reconciled) === JSON.stringify(current) ? current : reconciled;
    });
  }, [quiz, change]);

  const index = attempt?.currentIndex ?? 0;
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [index]);

  const question = questions[index];
  const total = questions.length;
  const locked = attempt && question ? isLocked(attempt, question.id) : false;
  const isLast = index >= total - 1;
  const selected = attempt && question ? (attempt.answers[question.id] ?? []) : [];

  const go = useCallback((target: number) => change((current) => goToQuestion(current, target)), [change]);

  const finish = useCallback(() => {
    if (!attempt) return;
    const unanswered = quiz.questions.filter((item) => (attempt.answers[item.id] ?? []).length === 0).length;
    if (unanswered > 0 && !globalThis.confirm(messages.finishConfirm(unanswered))) return;
    const attemptId = attempt.id;
    setSheetOpen(false);
    update((current) => finishAttempt(current, quiz, now()));
    navigate(href.results(quiz.id, attemptId));
  }, [attempt, quiz, update, messages]);

  const toggle = useCallback(
    (choiceId: string) => question && change((current) => toggleChoice(current, question, choiceId)),
    [change, question],
  );

  const confirm = useCallback(() => {
    if (!attempt || !question) return;
    if (attempt.mode === "per-question" && !locked) change((current) => checkQuestion(current, question.id));
    else if (isLast) finish();
    else go(index + 1);
  }, [attempt, question, locked, isLast, finish, go, index, change]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (sheetOpen || isTypingTarget(event.target)) return;
      const command = commandFor(event);
      if (!command || !question) return;
      if (command.kind === "toggle") {
        const choice = question.choices[command.index];
        if (!choice) return;
        toggle(choice.id);
      } else if (command.kind === "previous") go(index - 1);
      else if (command.kind === "next") go(index + 1);
      else if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return;
      else confirm();
      event.preventDefault();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [question, toggle, go, confirm, index, sheetOpen]);

  if (!attempt || !question)
    return (
      <EmptyState icon={Play} title={messages.noAttempt}>
        <Button variant="secondary" href={href.quiz(quiz.id)} icon={ArrowLeft} iconPosition="start">
          {MESSAGES.back}
        </Button>
      </EmptyState>
    );

  const answered = quiz.questions.filter((item) => (attempt.answers[item.id] ?? []).length > 0).length;
  const mustCheck = attempt.mode === "per-question" && !locked;
  const primary = mustCheck
    ? { label: messages.check, icon: Check, disabled: selected.length === 0 }
    : isLast
      ? { label: messages.finish, icon: Flag, disabled: false }
      : { label: messages.next, icon: ArrowRight, disabled: false };
  const name = splitTitleDate(quiz.title).name;

  return (
    <section class="session page-enter" aria-label={name}>
      <div class="session-top">
        <Button variant="ghost" size="sm" href={href.quiz(quiz.id)} icon={ArrowLeft} label={messages.quit} />
        <div class="session-progress">
          <p class="session-title">{name}</p>
          <ProgressBar value={answered} max={total} label={messages.progress(answered, total)} />
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={LayoutGrid}
          iconPosition="start"
          title={messages.openNavigator}
          onClick={() => setSheetOpen(true)}
        >
          {messages.counter(index + 1, total)}
        </Button>
      </div>

      <Card padding="lg" class="question-card">
        <QuestionView
          quizId={quiz.id}
          question={question}
          position={index + 1}
          total={total}
          selected={selected}
          reveal={locked}
          onToggle={toggle}
          headingRef={heading}
        />
      </Card>

      <div class="session-actions">
        <Button
          variant="secondary"
          icon={ArrowLeft}
          label={messages.previous}
          onClick={() => go(index - 1)}
          disabled={index === 0}
        />
        <Button
          variant="primary"
          size="lg"
          icon={primary.icon}
          onClick={confirm}
          disabled={primary.disabled}
          class="session-primary"
        >
          {primary.label}
        </Button>
        {mustCheck && !isLast && (
          <Button variant="secondary" icon={ArrowRight} label={messages.nextQuestion} onClick={() => go(index + 1)} />
        )}
      </div>
      <p class="session-shortcuts">{messages.shortcuts}</p>

      <BottomSheet open={sheetOpen} title={messages.navigator} onClose={() => setSheetOpen(false)}>
        <QuestionNavigator
          questions={questions}
          attempt={attempt}
          onSelect={(target) => {
            go(target);
            setSheetOpen(false);
          }}
        />
        <Button variant="primary" block icon={Flag} iconPosition="start" onClick={finish}>
          {messages.finish}
        </Button>
      </BottomSheet>
    </section>
  );
}

function SessionPage({ quizId }: { quizId: string }) {
  const quiz = useLoadable(() => fetchQuiz(quizId), quizId);
  return <LoadState value={quiz}>{(value) => <SessionView quiz={value} />}</LoadState>;
}

export { SessionPage };
