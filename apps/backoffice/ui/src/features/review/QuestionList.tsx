import { useEffect, useRef, useState } from "preact/hooks";
import { checkQuestionRules, toPlainText } from "@pomkuiz/quiz-contract";
import {
  countStatuses,
  QUESTION_STATUSES,
  type DraftQuestion,
  type QuestionStatus,
} from "../../../../server/features/review/draft-types.ts";
import { UI_CONFIG } from "../../ui-config.ts";
import { UI_MESSAGES } from "../../ui-messages.ts";
import { Button, Icon, classNames } from "@pomkuiz/design-system";
import { Plus, TriangleAlert } from "@pomkuiz/design-system/icons";

type Filter = QuestionStatus | "all";

interface QuestionListProps {
  questions: readonly DraftQuestion[];
  selected: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
}

const snippet = (question: DraftQuestion) => {
  const text = toPlainText(question.prompt).replaceAll("\n", " ").trim();
  return text.length > UI_CONFIG.snippetCharacters ? `${text.slice(0, UI_CONFIG.snippetCharacters)}…` : text || "—";
};

function QuestionList({ questions, selected, onSelect, onAdd }: QuestionListProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const counts = countStatuses(questions);
  const current = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    current.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <nav class="question-list" aria-label="Questions">
      <fieldset class="filters">
        <legend class="visually-hidden">{UI_MESSAGES.filters.label}</legend>
        <button
          type="button"
          class={classNames("filter", filter === "all" && "is-active")}
          aria-pressed={filter === "all"}
          onClick={() => setFilter("all")}
        >
          {UI_MESSAGES.filters.all}
          <span class="filter-count">{questions.length}</span>
        </button>
        {QUESTION_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            class={classNames("filter", `status-${status}`, filter === status && "is-active")}
            aria-pressed={filter === status}
            onClick={() => setFilter(status)}
          >
            <span class="status-dot" aria-hidden="true" />
            {UI_MESSAGES.statuses[status]}
            <span class="filter-count">{counts[status]}</span>
          </button>
        ))}
      </fieldset>
      <ol>
        {questions.map((question, index) => {
          if (filter !== "all" && question.status !== filter) return null;
          const invalid = checkQuestionRules(question).length > 0;
          return (
            <li key={question.key}>
              <button
                ref={index === selected ? current : undefined}
                type="button"
                class={`list-item status-${question.status}${index === selected ? " is-selected" : ""}`}
                aria-current={index === selected ? "true" : undefined}
                onClick={() => onSelect(index)}
              >
                <span class="list-index">{index + 1}</span>
                <span class="list-text">{snippet(question)}</span>
                <span class="list-status">
                  <span class="status-dot" aria-hidden="true" />
                  {UI_MESSAGES.statuses[question.status]}
                  {invalid && (
                    <Icon icon={TriangleAlert} size="sm" label={UI_MESSAGES.editor.rules} class="list-warning" />
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <Button size="sm" icon={Plus} iconPosition="start" onClick={onAdd}>
        {UI_MESSAGES.editor.addQuestion}
      </Button>
    </nav>
  );
}

export { QuestionList };
