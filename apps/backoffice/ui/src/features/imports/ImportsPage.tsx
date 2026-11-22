import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { JobProgress, JobStatus } from "../../../../server/features/jobs/job-state.ts";
import { href } from "../../app/hash-router.ts";
import { UI_CONFIG } from "../../ui-config.ts";
import { UI_MESSAGES } from "../../ui-messages.ts";
import { api, describeError, type Health, type ImportSummary } from "../../shared/api-client.ts";
import { Notice } from "../../shared/Notice.tsx";
import { ArrowRight, FileText, Pause, Play, RefreshCw, Trash2, Upload } from "@pomkuiz/design-system/icons";
import {
  Button,
  Card,
  EmptyState,
  Icon,
  PageHeader,
  Pill,
  ProgressBar,
  SectionLabel,
  type Tone,
} from "@pomkuiz/design-system";

const FINAL_STATUSES = new Set(["completed", "failed", "paused"]);
const STATUS_TONES: Readonly<Record<JobStatus, Tone>> = Object.freeze({
  queued: "neutral",
  preparing: "accent",
  running: "accent",
  paused: "medium",
  failed: "low",
  completed: "high",
});

function HealthBanner({ health }: { health: Health | null }) {
  if (!health) return null;
  const messages = UI_MESSAGES.health;
  const problem = !health.claude.executable ? messages.missing : !health.claude.loggedIn ? messages.signedOut : null;
  return (
    <Notice
      tone={problem ? "low" : "high"}
      title={problem ?? messages.ready(health.ocr.model, health.ocr.effort, health.ocr.concurrency)}
    >
      <p class="muted">{messages.export(health.dataDirectory)}</p>
    </Notice>
  );
}

function UploadZone({ onUploaded, onError }: { onUploaded: () => void; onError: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const zone = useRef<HTMLElement>(null);
  const send = useCallback(
    async (files: FileList | null | undefined) => {
      const file = files?.[0];
      if (!file) return;
      setBusy(true);
      try {
        await api.uploadPdf(file);
        onUploaded();
      } catch (failure) {
        onError(describeError(failure));
      } finally {
        setBusy(false);
      }
    },
    [onUploaded, onError],
  );

  useEffect(() => {
    const element = zone.current;
    if (!element) return;
    const enter = (event: DragEvent) => {
      event.preventDefault();
      setOver(true);
    };
    const leave = () => setOver(false);
    const drop = (event: DragEvent) => {
      event.preventDefault();
      setOver(false);
      void send(event.dataTransfer?.files);
    };
    element.addEventListener("dragover", enter);
    element.addEventListener("dragleave", leave);
    element.addEventListener("drop", drop);
    return () => {
      element.removeEventListener("dragover", enter);
      element.removeEventListener("dragleave", leave);
      element.removeEventListener("drop", drop);
    };
  }, [send]);

  return (
    <section ref={zone} class={over ? "dropzone is-over" : "dropzone"} aria-label={UI_MESSAGES.upload.title}>
      <Card tone="pastel" padding="lg" class="dropzone-card">
        <span class="dropzone-icon">
          <Icon icon={Upload} size="lg" />
        </span>
        <div class="dropzone-text">
          <h2 class="dropzone-title">{UI_MESSAGES.upload.title}</h2>
          <p class="muted">{UI_MESSAGES.upload.hint}</p>
        </div>
        <Button
          variant="primary"
          size="lg"
          icon={Upload}
          iconPosition="start"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {busy ? UI_MESSAGES.upload.uploading : UI_MESSAGES.upload.choose}
        </Button>
        <input
          ref={input}
          class="visually-hidden"
          type="file"
          accept={UI_CONFIG.acceptedPdf}
          tabIndex={-1}
          onChange={(event) => {
            void send(event.currentTarget.files);
            event.currentTarget.value = "";
          }}
        />
      </Card>
    </section>
  );
}

function ImportCard({
  item,
  refresh,
  onError,
}: {
  item: ImportSummary;
  refresh: () => void;
  onError: (message: string) => void;
}) {
  const messages = UI_MESSAGES.imports;
  const { job, draft } = item;
  const act = (task: () => Promise<unknown>, confirmation?: string) => async () => {
    if (confirmation && !globalThis.confirm(confirmation)) return;
    try {
      await task();
      refresh();
    } catch (failure) {
      onError(describeError(failure));
    }
  };
  const resumable = !item.active && (job.status === "paused" || job.status === "failed" || job.status === "queued");
  const title = draft?.title ?? item.originalName;
  return (
    <Card as="li" padding="md" class="import-card">
      <div class="import-head">
        <span class="import-icon">
          <Icon icon={FileText} />
        </span>
        <div class="import-text">
          <h3 class="import-title">{title}</h3>
          <p class="import-meta">
            {item.originalName} · {messages.pages(item.pageCount)} · {new Date(item.createdAt).toLocaleString()}
          </p>
        </div>
        <Pill tone={STATUS_TONES[job.status]}>{messages.status[job.status]}</Pill>
      </div>
      {job.total > 0 && job.status !== "completed" && (
        <div class="import-progress">
          <ProgressBar value={job.done} max={job.total} label={messages.progress(job.done, job.total)} />
          <span class="muted">{messages.progress(job.done, job.total)}</span>
        </div>
      )}
      {job.error && job.status !== "completed" && <Notice tone="low" title={job.error.message} />}
      {draft && (
        <div class="import-stats">
          <Pill>{messages.questions(draft.questionCount)}</Pill>
          <Pill tone="high">
            {UI_MESSAGES.statuses.verified} {draft.statuses.verified}
          </Pill>
          {draft.statuses.needs_review > 0 && (
            <Pill tone="low">
              {UI_MESSAGES.statuses.needs_review} {draft.statuses.needs_review}
            </Pill>
          )}
          {draft.lastExport && <Pill tone="accent">{messages.exported(draft.lastExport.quizId)}</Pill>}
        </div>
      )}
      <div class="import-actions">
        {draft && (
          <Button
            variant="primary"
            size="sm"
            href={href.review(item.id)}
            icon={ArrowRight}
            label={messages.open(title)}
          >
            {messages.review}
          </Button>
        )}
        {resumable && (
          <Button size="sm" icon={Play} iconPosition="start" onClick={act(() => api.resume(item.id))}>
            {messages.resume}
          </Button>
        )}
        {item.active && (
          <Button size="sm" icon={Pause} iconPosition="start" onClick={act(() => api.pause(item.id))}>
            {messages.pause}
          </Button>
        )}
        {draft && job.status === "completed" && (
          <Button
            variant="ghost"
            size="sm"
            icon={RefreshCw}
            iconPosition="start"
            onClick={act(() => api.rebuildDraft(item.id), UI_MESSAGES.confirmRebuild)}
          >
            {messages.rebuild}
          </Button>
        )}
        {!item.active && (
          <Button
            variant="danger"
            size="sm"
            icon={Trash2}
            iconPosition="start"
            onClick={act(() => api.removeImport(item.id), UI_MESSAGES.confirmDelete)}
          >
            {messages.remove}
          </Button>
        )}
      </div>
    </Card>
  );
}

function ImportsPage() {
  const [imports, setImports] = useState<ImportSummary[] | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api
      .imports()
      .then(setImports)
      .catch((failure: unknown) => setError(describeError(failure)));
  }, []);

  useEffect(() => {
    refresh();
    api
      .health()
      .then(setHealth)
      .catch(() => setHealth(null));
    const events = new EventSource(UI_CONFIG.eventsPath);
    events.addEventListener(UI_CONFIG.progressEvent, (event) => {
      const progress = JSON.parse((event as MessageEvent<string>).data) as JobProgress;
      setImports(
        (current) =>
          current?.map((item) =>
            item.id === progress.importId
              ? { ...item, job: progress, active: !FINAL_STATUSES.has(progress.status) }
              : item,
          ) ?? current,
      );
      if (FINAL_STATUSES.has(progress.status)) refresh();
    });
    return () => events.close();
  }, [refresh]);

  return (
    <div class="page page-enter">
      <PageHeader titleId="imports-title" eyebrow={UI_MESSAGES.imports.eyebrow} title={UI_MESSAGES.imports.title} />
      <HealthBanner health={health} />
      {error && <Notice tone="low" title={error} alert />}
      <UploadZone onUploaded={refresh} onError={setError} />
      <section class="stack" aria-labelledby="imports-list">
        <SectionLabel id="imports-list">{UI_MESSAGES.imports.list}</SectionLabel>
        {imports === null ? (
          <p class="muted">{UI_MESSAGES.loading}</p>
        ) : imports.length === 0 ? (
          <EmptyState icon={FileText} title={UI_MESSAGES.imports.empty} />
        ) : (
          <ul class="import-list">
            {imports.map((item) => (
              <ImportCard key={item.id} item={item} refresh={refresh} onError={setError} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export { ImportsPage };
