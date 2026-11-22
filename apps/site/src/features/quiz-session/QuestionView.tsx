import type { Ref } from "preact";
import type { Question } from "@pomkuiz/quiz-contract";
import { choiceLetter } from "../../shared/formatters.ts";
import { MESSAGES } from "../../shared/i18n/messages-fr.ts";
import { RichText, classNames, Icon, Pill } from "@pomkuiz/design-system";
import { Figures } from "../../shared/ui/Figures.tsx";
import { Check, CircleCheck, CircleX, X } from "@pomkuiz/design-system/icons";
import { scoreQuestion } from "../results/scoring.ts";
import "./question.css";

type OptionState = "idle" | "selected" | "hit" | "expected" | "wrong";

interface QuestionViewProps {
  quizId: string;
  question: Question;
  position: number;
  total: number;
  selected: readonly string[];
  reveal: boolean;
  readOnly?: boolean;
  onToggle?: (choiceId: string) => void;
  headingRef?: Ref<HTMLHeadingElement>;
}

function optionState(correct: boolean, selected: boolean, reveal: boolean): OptionState {
  if (!reveal) return selected ? "selected" : "idle";
  if (correct) return selected ? "hit" : "expected";
  return selected ? "wrong" : "idle";
}

function OptionMark({ state, letter }: { state: OptionState; letter: string }) {
  if (state === "wrong") return <Icon icon={X} size="sm" />;
  if (state === "hit" || state === "expected" || state === "selected") return <Icon icon={Check} size="sm" />;
  return <>{letter}</>;
}

function QuestionView({
  quizId,
  question,
  position,
  total,
  selected,
  reveal,
  readOnly = false,
  onToggle,
  headingRef,
}: QuestionViewProps) {
  const promptId = `prompt-${question.id}`;
  const score = reveal ? scoreQuestion(question, selected) : null;
  const label = MESSAGES.session.position(position, total);
  const inputType = question.type === "single" ? "radio" : "checkbox";
  return (
    <article class="question" aria-labelledby={`heading-${question.id}`}>
      <header class="question-head">
        <h2 id={`heading-${question.id}`} ref={headingRef} tabIndex={-1} class="eyebrow question-label">
          {label}
        </h2>
        <Pill>{question.type === "multiple" ? MESSAGES.session.multiple : MESSAGES.session.single}</Pill>
      </header>
      <RichText id={promptId} class="question-prompt" text={question.prompt} />
      <Figures quizId={quizId} images={question.images} label={label} />
      <fieldset class="options" aria-describedby={promptId}>
        <legend class="visually-hidden">{label}</legend>
        {question.choices.map((choice, index) => {
          const isSelected = selected.includes(choice.id);
          const state = optionState(choice.correct, isSelected, reveal);
          const letter = choiceLetter(index);
          return (
            <label
              key={choice.id}
              class={classNames(
                "option",
                `option-${state}`,
                inputType === "radio" && "option-round",
                (readOnly || reveal) && "option-locked",
              )}
            >
              <input
                class="visually-hidden"
                type={inputType}
                name={`question-${question.id}`}
                checked={isSelected}
                disabled={readOnly || reveal}
                onChange={() => onToggle?.(choice.id)}
              />
              <span class="option-mark" aria-hidden="true">
                <OptionMark state={state} letter={letter} />
              </span>
              <span class="option-body">
                <RichText text={choice.text} />
                <Figures quizId={quizId} images={choice.images} label={`${label}, ${letter}`} />
                {reveal && (choice.correct || isSelected) && (
                  <span class="option-tags">
                    {choice.correct && <Pill tone="high">{MESSAGES.session.expected}</Pill>}
                    {isSelected && <Pill tone={choice.correct ? "accent" : "low"}>{MESSAGES.session.selected}</Pill>}
                  </span>
                )}
                {reveal && choice.explanation && <RichText class="option-explanation" text={choice.explanation} />}
              </span>
            </label>
          );
        })}
      </fieldset>
      {score && (
        <div class={classNames("feedback", score.normal ? "tone-high" : "tone-low")} aria-live="polite">
          <p class="feedback-title">
            <Icon icon={score.normal ? CircleCheck : CircleX} />
            {score.normal ? MESSAGES.session.correct : MESSAGES.session.incorrect}
          </p>
          {question.explanation && (
            <div class="feedback-explanation">
              <p class="eyebrow">{MESSAGES.session.explanation}</p>
              <RichText text={question.explanation} />
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export { QuestionView };
