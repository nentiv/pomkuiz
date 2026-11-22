import { useCallback, useEffect, useMemo, useReducer, useState } from "preact/hooks";
import type { DraftContent } from "../../../../server/features/review/draft-types.ts";
import { href } from "../../app/hash-router.ts";
import { SHORTCUTS } from "../../ui-config.ts";
import { UI_MESSAGES } from "../../ui-messages.ts";
import { api, describeError, type DraftPayload } from "../../shared/api-client.ts";
import { Notice } from "../../shared/Notice.tsx";
import { ArrowLeft, FileText, Upload } from "@pomkuiz/design-system/icons";
import { Button, EmptyState } from "@pomkuiz/design-system";
import { ExportDialog } from "../export/ExportDialog.tsx";
import {
  applyDraftAction,
  newQuestion,
  nextIndexWithStatus,
  type DraftAction,
  type ImageOwner,
} from "./draft-actions.ts";
import { MetaPanel } from "./MetaPanel.tsx";
import { QuestionEditor } from "./QuestionEditor.tsx";
import { QuestionList } from "./QuestionList.tsx";
import { SourcePane, type CropBox } from "./SourcePane.tsx";
import { useAutosave } from "./use-autosave.ts";

const NEW_QUESTION_CHOICES = 4;
const createKey = () => crypto.randomUUID();

interface CropTarget {
  owner: ImageOwner;
  replace: string | null;
}

function Workspace({ payload }: { payload: DraftPayload }) {
  const importId = payload.import.id;
  const [content, dispatch] = useReducer(
    (state: DraftContent, action: DraftAction) => applyDraftAction(state, action),
    { meta: payload.draft.meta, questions: payload.draft.questions },
  );
  const [selected, setSelected] = useState(0);
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useAutosave(importId, content, payload.draft.revision);
  const total = content.questions.length;
  const index = Math.min(selected, Math.max(0, total - 1));
  const question = content.questions[index];

  const go = useCallback(
    (target: number) => setSelected(Math.min(Math.max(0, target), Math.max(0, total - 1))),
    [total],
  );

  const addQuestion = useCallback(
    (afterKey: string | null) => {
      const created = newQuestion(createKey(), Array.from({ length: NEW_QUESTION_CHOICES }, createKey));
      dispatch({ type: "add-question", afterKey, question: created });
      setSelected(afterKey === null ? total : index + 1);
    },
    [index, total],
  );

  const run = useCallback(async (task: () => Promise<void>) => {
    setError(null);
    try {
      await task();
    } catch (failure) {
      setError(describeError(failure));
    }
  }, []);

  const attach = useCallback((target: CropTarget, assetId: string) => {
    if (target.replace) dispatch({ type: "replace-image", owner: target.owner, previous: target.replace, assetId });
    else dispatch({ type: "add-image", owner: target.owner, assetId });
  }, []);

  const requests = useMemo(
    () => ({
      requestCrop: (owner: ImageOwner, replace: string | null) => setCropTarget({ owner, replace }),
      upload: (owner: ImageOwner, file: File, replace: string | null) =>
        void run(async () => attach({ owner, replace }, (await api.uploadImage(importId, file)).id)),
    }),
    [importId, run, attach],
  );

  const onCrop = useCallback(
    (page: number, box: CropBox) => {
      const target = cropTarget;
      setCropTarget(null);
      if (target) void run(async () => attach(target, (await api.crop(importId, page, box)).id));
    },
    [cropTarget, importId, run, attach],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const primary = event.metaKey || event.ctrlKey;
      if (primary && event.code === SHORTCUTS.saveCode) {
        event.preventDefault();
        void save.flush();
        return;
      }
      if (!question) return;
      if (primary && event.key === SHORTCUTS.verifyKey) {
        event.preventDefault();
        dispatch({ type: "status", key: question.key, status: "verified" });
        go(index + 1);
        return;
      }
      if (!event.altKey) return;
      const actions: Record<string, () => void> = {
        [SHORTCUTS.nextCode]: () => go(index + 1),
        [SHORTCUTS.previousCode]: () => go(index - 1),
        [SHORTCUTS.needsReviewCode]: () => dispatch({ type: "status", key: question.key, status: "needs_review" }),
        [SHORTCUTS.unverifiedCode]: () => dispatch({ type: "status", key: question.key, status: "unverified" }),
        [SHORTCUTS.nextToReviewCode]: () => {
          const next = nextIndexWithStatus(content.questions, index, "needs_review");
          if (next !== null) go(next);
        },
      };
      const action = actions[event.code];
      if (!action) return;
      event.preventDefault();
      action();
    };
    globalThis.addEventListener("keydown", onKey);
    return () => globalThis.removeEventListener("keydown", onKey);
  }, [question, index, go, save, content.questions]);

  return (
    <div class="review">
      <header class="review-bar">
        <Button variant="ghost" size="sm" href={href.imports()} icon={ArrowLeft} iconPosition="start">
          {UI_MESSAGES.back}
        </Button>
        <MetaPanel meta={content.meta} dispatch={dispatch} />
        <output class={`save-state save-${save.state}`}>{UI_MESSAGES.save[save.state]}</output>
        <Button variant="primary" icon={Upload} iconPosition="start" onClick={() => setExporting(true)}>
          {UI_MESSAGES.export.open}
        </Button>
      </header>
      {error && (
        <div class="review-error">
          <Notice tone="low" title={error} alert />
        </div>
      )}
      <div class="review-grid">
        <QuestionList
          questions={content.questions}
          selected={index}
          onSelect={go}
          onAdd={() => addQuestion(content.questions.at(-1)?.key ?? null)}
        />
        <SourcePane
          importId={importId}
          pages={payload.pages}
          source={question?.source ?? null}
          cropping={cropTarget !== null}
          onCrop={onCrop}
          onCancelCrop={() => setCropTarget(null)}
        />
        <div class="editor-pane">
          {question ? (
            <QuestionEditor
              key={question.key}
              importId={importId}
              question={question}
              position={index + 1}
              total={total}
              dispatch={dispatch}
              requests={requests}
              createKey={createKey}
              onAddAfter={() => addQuestion(question.key)}
              onRemove={() => {
                if (globalThis.confirm(UI_MESSAGES.editor.confirmRemoveQuestion))
                  dispatch({ type: "remove-question", key: question.key });
              }}
            />
          ) : (
            <EmptyState icon={FileText} title={UI_MESSAGES.editor.empty} />
          )}
          <p class="muted shortcuts">{UI_MESSAGES.shortcuts}</p>
        </div>
      </div>
      {exporting && (
        <ExportDialog
          importId={importId}
          content={content}
          beforeExport={save.flush}
          onClose={() => setExporting(false)}
        />
      )}
    </div>
  );
}

function ReviewPage({ importId }: { importId: string }) {
  const [payload, setPayload] = useState<DraftPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api
      .draft(importId)
      .then(setPayload)
      .catch((failure: unknown) => setError(describeError(failure)));
  }, [importId]);
  if (error)
    return (
      <div class="main">
        <Notice tone="low" title={error} alert />
      </div>
    );
  if (!payload) return <p class="main muted">{UI_MESSAGES.loading}</p>;
  return <Workspace payload={payload} />;
}

export { ReviewPage };
