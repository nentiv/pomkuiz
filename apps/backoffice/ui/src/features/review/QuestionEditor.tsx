import { checkQuestionRules } from "@pomkuiz/quiz-contract";
import {
  QUESTION_STATUSES,
  type DraftChoice,
  type DraftQuestion,
  type QuestionStatus,
} from "../../../../server/features/review/draft-types.ts";
import { UI_MESSAGES } from "../../ui-messages.ts";
import { Notice } from "../../shared/Notice.tsx";
import { Button, Pill, Segmented, classNames } from "@pomkuiz/design-system";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "@pomkuiz/design-system/icons";
import { newChoice, type DraftAction } from "./draft-actions.ts";
import { RichField } from "./RichField.tsx";
import { ImageStrip, type ImageRequests } from "./ImageStrip.tsx";

const letter = (index: number) => String.fromCodePoint("a".codePointAt(0)! + index);

const STATUS_OPTIONS = QUESTION_STATUSES.map((status) => ({ value: status, label: UI_MESSAGES.statuses[status] }));
const TYPE_OPTIONS = [
  { value: "single", label: UI_MESSAGES.editor.single },
  { value: "multiple", label: UI_MESSAGES.editor.multiple },
] as const;

interface QuestionEditorProps {
  importId: string;
  question: DraftQuestion;
  position: number;
  total: number;
  dispatch: (action: DraftAction) => void;
  requests: ImageRequests;
  createKey: () => string;
  onAddAfter: () => void;
  onRemove: () => void;
}

function QuestionEditor(props: QuestionEditorProps) {
  const { importId, question, position, total, dispatch, requests, createKey } = props;
  const messages = UI_MESSAGES.editor;
  const rules = checkQuestionRules(question);
  const update = (patch: Partial<Omit<DraftQuestion, "key" | "choices">>) =>
    dispatch({ type: "question", key: question.key, patch });
  const field = (name: string) => `${question.key}-${name}`;

  return (
    <article class="editor" aria-label={messages.question(position, total)}>
      <header class="editor-header">
        <div class="editor-heading">
          <h2 class="editor-title">{messages.question(position, total)}</h2>
          {question.number !== null && <Pill>{messages.sourceNumber(question.number)}</Pill>}
        </div>
        <Segmented
          name={field("status")}
          legend={messages.status}
          hideLegend
          options={STATUS_OPTIONS}
          value={question.status}
          onChange={(status: QuestionStatus) => dispatch({ type: "status", key: question.key, status })}
          class={`status-switch status-${question.status}`}
        />
      </header>

      {question.issues.length > 0 && (
        <Notice tone="medium" title={messages.issues}>
          <ul class="notice-list">
            {question.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </Notice>
      )}
      {rules.length > 0 && (
        <Notice tone="low" title={messages.rules}>
          <ul class="notice-list">
            {rules.map((rule) => (
              <li key={rule}>{UI_MESSAGES.rules[rule]}</li>
            ))}
          </ul>
        </Notice>
      )}

      <Segmented
        name={field("type")}
        legend={messages.type}
        options={TYPE_OPTIONS}
        value={question.type}
        onChange={(type) => update({ type })}
      />

      <RichField
        id={field("prompt")}
        label={messages.prompt}
        value={question.prompt}
        onInput={(prompt) => update({ prompt })}
        minRows={3}
      />
      <ImageStrip
        importId={importId}
        owner={{ questionKey: question.key, choiceKey: null }}
        images={question.images}
        dispatch={dispatch}
        requests={requests}
      />

      <p class="eyebrow">{messages.choices}</p>
      <ol class="choice-editors">
        {question.choices.map((choice, index) => {
          const owner = { questionKey: question.key, choiceKey: choice.key };
          const choicePatch = (patch: Partial<Omit<DraftChoice, "key">>) =>
            dispatch({ type: "choice", questionKey: question.key, choiceKey: choice.key, patch });
          return (
            <li key={choice.key} class={classNames("choice-editor", choice.correct && "is-correct")}>
              <div class="choice-editor-head">
                <label class="correct-toggle">
                  <input
                    type="checkbox"
                    checked={choice.correct}
                    onChange={(event) => choicePatch({ correct: event.currentTarget.checked })}
                  />
                  <span class="choice-letter">{letter(index).toUpperCase()}</span>
                  <span>{messages.correct}</span>
                </label>
                <div class="row-actions">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={ChevronUp}
                    label={messages.moveUp}
                    disabled={index === 0}
                    onClick={() =>
                      dispatch({ type: "move-choice", questionKey: question.key, choiceKey: choice.key, offset: -1 })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={ChevronDown}
                    label={messages.moveDown}
                    disabled={index === question.choices.length - 1}
                    onClick={() =>
                      dispatch({ type: "move-choice", questionKey: question.key, choiceKey: choice.key, offset: 1 })
                    }
                  />
                  <Button
                    variant="danger"
                    size="sm"
                    icon={Trash2}
                    label={messages.remove}
                    onClick={() =>
                      dispatch({ type: "remove-choice", questionKey: question.key, choiceKey: choice.key })
                    }
                  />
                </div>
              </div>
              <RichField
                id={field(`choice-${choice.key}`)}
                label={messages.choice(letter(index))}
                value={choice.text}
                onInput={(text) => choicePatch({ text })}
                minRows={1}
              />
              <RichField
                id={field(`comment-${choice.key}`)}
                label={messages.choiceExplanation}
                value={choice.explanation}
                onInput={(explanation) => choicePatch({ explanation })}
                minRows={1}
              />
              <ImageStrip
                importId={importId}
                owner={owner}
                images={choice.images}
                dispatch={dispatch}
                requests={requests}
              />
            </li>
          );
        })}
      </ol>
      <Button
        size="sm"
        icon={Plus}
        iconPosition="start"
        onClick={() => dispatch({ type: "add-choice", questionKey: question.key, choice: newChoice(createKey()) })}
      >
        {messages.addChoice}
      </Button>

      <RichField
        id={field("explanation")}
        label={messages.explanation}
        value={question.explanation}
        onInput={(explanation) => update({ explanation })}
      />

      <footer class="editor-footer">
        <div class="row-actions">
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronUp}
            iconPosition="start"
            disabled={position === 1}
            onClick={() => dispatch({ type: "move-question", key: question.key, offset: -1 })}
          >
            {messages.moveUp}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={ChevronDown}
            iconPosition="start"
            disabled={position === total}
            onClick={() => dispatch({ type: "move-question", key: question.key, offset: 1 })}
          >
            {messages.moveDown}
          </Button>
          <Button size="sm" icon={Plus} iconPosition="start" onClick={props.onAddAfter}>
            {messages.addQuestion}
          </Button>
        </div>
        <Button variant="danger" size="sm" icon={Trash2} iconPosition="start" onClick={props.onRemove}>
          {messages.removeQuestion}
        </Button>
      </footer>
    </article>
  );
}

export { QuestionEditor };
