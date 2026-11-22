import { useEffect, useRef, useState } from "preact/hooks";
import { checkQuestionRules, isSlug, slugify } from "@pomkuiz/quiz-contract";
import type { ExportResult } from "../../../../server/features/export/quiz-exporter.ts";
import { countStatuses, type DraftContent } from "../../../../server/features/review/draft-types.ts";
import { UI_MESSAGES } from "../../ui-messages.ts";
import { api, ApiError, describeError } from "../../shared/api-client.ts";
import { Notice } from "../../shared/Notice.tsx";
import { Button, closeModal, openModal, Pill, Switch } from "@pomkuiz/design-system";
import { Upload } from "@pomkuiz/design-system/icons";

interface ExportDialogProps {
  importId: string;
  content: DraftContent;
  beforeExport: () => Promise<void>;
  onClose: () => void;
}

const EXISTS_CODE = "exportExists";

function ExportDialog({ importId, content, beforeExport, onClose }: ExportDialogProps) {
  const messages = UI_MESSAGES.export;
  const dialog = useRef<HTMLDialogElement>(null);
  const [force, setForce] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [needsOverwrite, setNeedsOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  useEffect(() => {
    openModal(dialog.current);
  }, []);

  const counts = countStatuses(content.questions);
  const invalidQuestions = content.questions.filter((question) => checkQuestionRules(question).length > 0).length;
  const quizId = content.meta.id || slugify(content.meta.title);
  const metaValid = content.meta.title.trim().length > 0 && isSlug(quizId);
  const blocked = counts.needs_review > 0 && !force;
  const canSubmit = !busy && metaValid && invalidQuestions === 0 && !blocked && (!needsOverwrite || overwrite);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await beforeExport();
      setResult(await api.exportDraft(importId, { force, overwrite }));
    } catch (failure) {
      if (failure instanceof ApiError && failure.code === EXISTS_CODE) setNeedsOverwrite(true);
      setError(describeError(failure));
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={dialog} class="dialog" onClose={onClose} aria-labelledby="export-title">
      <div class="dialog-body">
        <header class="dialog-header">
          <p class="eyebrow">{messages.eyebrow}</p>
          <h2 id="export-title" class="dialog-title">
            {messages.title}
          </h2>
          <p class="muted">data/quizzes/{quizId}</p>
        </header>
        <div class="export-counts">
          <Pill tone="high">
            {UI_MESSAGES.statuses.verified} {counts.verified}
          </Pill>
          <Pill>
            {UI_MESSAGES.statuses.unverified} {counts.unverified}
          </Pill>
          <Pill tone={counts.needs_review > 0 ? "low" : "neutral"}>
            {UI_MESSAGES.statuses.needs_review} {counts.needs_review}
          </Pill>
        </div>
        {!metaValid && <Notice tone="low" title={messages.invalidMeta} />}
        {invalidQuestions > 0 && <Notice tone="low" title={messages.rulesBlocking(invalidQuestions)} />}
        {counts.needs_review > 0 && (
          <Notice tone="medium" title={messages.blocked(counts.needs_review)}>
            <Switch label={messages.force} checked={force} onChange={setForce} />
          </Notice>
        )}
        {needsOverwrite && <Switch label={messages.overwrite} checked={overwrite} onChange={setOverwrite} />}
        {error && <Notice tone="low" title={error} alert />}
        {result && (
          <Notice tone="high" title={messages.success(result.quizId, result.questionCount)}>
            {result.rejectedFolders.length > 0 && (
              <p>{messages.rejected(result.rejectedFolders.map((folder) => folder.folder).join(", "))}</p>
            )}
          </Notice>
        )}
        <div class="dialog-actions">
          <Button variant="ghost" onClick={() => closeModal(dialog.current)}>
            {messages.close}
          </Button>
          <Button variant="primary" icon={Upload} iconPosition="start" disabled={!canSubmit} onClick={submit}>
            {messages.submit}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

export { ExportDialog };
