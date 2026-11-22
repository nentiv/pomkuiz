import { isSlug, slugify } from "@pomkuiz/quiz-contract";
import type { DraftMeta } from "../../../../server/features/review/draft-types.ts";
import { UI_CONFIG } from "../../ui-config.ts";
import { UI_MESSAGES } from "../../ui-messages.ts";
import type { DraftAction } from "./draft-actions.ts";

function MetaPanel({ meta, dispatch }: { meta: DraftMeta; dispatch: (action: DraftAction) => void }) {
  const messages = UI_MESSAGES.meta;
  const patch = (value: Partial<DraftMeta>) => dispatch({ type: "meta", patch: value });
  const idValid = meta.id === "" || isSlug(meta.id);
  return (
    <details class="meta-panel">
      <summary>
        <strong>{meta.title || "—"}</strong> <span class="muted">{meta.id || slugify(meta.title)}</span>
      </summary>
      <div class="meta-grid">
        <label class="field">
          <span>{messages.title}</span>
          <input value={meta.title} onInput={(event) => patch({ title: event.currentTarget.value })} />
        </label>
        <label class="field">
          <span>
            {messages.id} <span class="muted">· {messages.idHint}</span>
          </span>
          <input
            value={meta.id}
            placeholder={slugify(meta.title)}
            aria-invalid={!idValid}
            onInput={(event) => patch({ id: event.currentTarget.value.toLowerCase() })}
          />
        </label>
        <label class="field wide">
          <span>{messages.description}</span>
          <textarea
            rows={2}
            value={meta.description}
            onInput={(event) => patch({ description: event.currentTarget.value })}
          />
        </label>
        <label class="field wide">
          <span>{messages.tags}</span>
          <input
            value={meta.tags.join(`${UI_CONFIG.tagSeparator} `)}
            onChange={(event) =>
              patch({
                tags: [
                  ...new Set(
                    event.currentTarget.value
                      .split(UI_CONFIG.tagSeparator)
                      .map((tag) => tag.trim())
                      .filter(Boolean),
                  ),
                ],
              })
            }
          />
        </label>
      </div>
    </details>
  );
}

export { MetaPanel };
