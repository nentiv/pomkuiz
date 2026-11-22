import { EventEmitter } from "node:events";
import { readFile } from "node:fs/promises";
import type { AppConfig } from "../../config/app-config.ts";
import { runWithConcurrency } from "../../shared/run-with-concurrency.ts";
import { AppError, pausesJob, toAppError } from "../../shared/app-error.ts";
import { readJsonIfExists, writeJsonAtomic } from "../../shared/safe-file-system.ts";
import { ignoreOutcome } from "../../shared/serial-queue.ts";
import type { ClaudeClient } from "../ocr/claude-client.ts";
import type { SegmentExtraction } from "../ocr/extraction-schema.ts";
import type { SegmentResult } from "../ocr/assemble-questions.ts";
import { parseExtraction } from "../ocr/parse-extraction.ts";
import { buildSegmentPrompt } from "../ocr/build-segment-prompt.ts";
import { extractSegment } from "../ocr/extract-segment.ts";
import { loadPlan, prepareImport, previousRows, type ImportPlan } from "../render/prepare-import.ts";
import type { AssetService } from "../review/asset-service.ts";
import { buildDraft } from "../review/build-draft.ts";
import type { DraftStore } from "../review/draft-store.ts";
import type { ImportStore } from "../upload/import-store.ts";
import { CONTRACT_LIMITS } from "@pomkuiz/quiz-contract";
import {
  ACTIVE_STATUSES,
  newJobState,
  summarizeJob,
  validateJobState,
  type JobError,
  type JobProgress,
  type JobState,
} from "./job-state.ts";

const PROGRESS_EVENT = "progress";

interface RunnerDependencies {
  config: AppConfig;
  store: ImportStore;
  drafts: DraftStore;
  assets: AssetService;
  client: ClaudeClient;
}

const describe = (error: AppError): JobError => ({ code: error.code, message: error.userMessage });

function createJobRunner({ config, store, drafts, assets, client }: RunnerDependencies) {
  const events = new EventEmitter();
  events.setMaxListeners(0);
  const active = new Map<string, { controller: AbortController; done: Promise<void> }>();

  async function readState(importId: string): Promise<JobState> {
    const raw = await readJsonIfExists(store.paths.job(importId));
    return raw === null ? newJobState(importId) : validateJobState.assert(raw, "unexpected");
  }

  function createSession(state: JobState) {
    let chain: Promise<void> = Promise.resolve();
    let lastEmit = 0;
    const persist = (force = false) => {
      state.updatedAt = new Date().toISOString();
      chain = chain.then(() => writeJsonAtomic(store.paths.job(state.importId), state));
      const now = Date.now();
      if (force || now - lastEmit >= config.jobs.progressThrottleMs) {
        lastEmit = now;
        events.emit(PROGRESS_EVENT, summarizeJob(state));
      }
      return chain;
    };
    return { persist, flush: () => chain };
  }

  async function loadResult(importId: string, index: number, plan: ImportPlan): Promise<SegmentResult> {
    const raw = await readJsonIfExists(store.paths.segmentResult(importId, index));
    const segment = plan.segments[index];
    if (raw === null || !segment) throw new AppError("unexpected", `segment ${index}`);
    const extraction = parseExtraction(raw, { width: segment.widthPx, height: segment.heightPx });
    return { segmentIndex: index, extraction };
  }

  function segmentPrompt(plan: ImportPlan, index: number): string {
    const segment = plan.segments[index];
    if (!segment) throw new AppError("unexpected");
    return buildSegmentPrompt({
      imageFile: config.ocr.imageFileName,
      width: segment.widthPx,
      height: segment.heightPx,
      textRows: segment.rows,
      previousRows: previousRows(plan, index, config.render.segment.contextRows),
      maxTextCharacters: config.ocr.textLayerMaxCharacters,
    });
  }

  async function finalize(importId: string, plan: ImportPlan, replace = false): Promise<void> {
    if (!replace && (await drafts.find(importId))) return;
    const record = await store.get(importId);
    const results = await Promise.all(plan.segments.map((segment) => loadResult(importId, segment.index, plan)));
    const pdf = await assets.openSource(importId);
    try {
      const draft = await buildDraft({
        record,
        plan,
        results,
        pdf,
        assets,
        config,
        titleCharacters: CONTRACT_LIMITS.titleCharacters,
      });
      await drafts.create(draft, replace);
    } finally {
      pdf.close();
    }
  }

  async function run(importId: string, controller: AbortController): Promise<void> {
    const { signal } = controller;
    const state = await readState(importId);
    const session = createSession(state);
    state.error = null;
    state.finishedAt = null;
    state.status = "preparing";
    await session.persist(true);
    try {
      const plan = await prepareImport(store, importId, config, signal);
      if (state.segments.length !== plan.segments.length)
        state.segments = plan.segments.map((segment) => ({
          index: segment.index,
          status: "pending",
          attempts: 0,
          error: null,
        }));
      for (const segment of state.segments)
        if (segment.status !== "done") Object.assign(segment, { status: "pending", error: null });
      state.status = "running";
      await session.persist(true);

      let pausing: AppError | null = null;
      const pending = state.segments.filter((segment) => segment.status !== "done");
      await runWithConcurrency(
        pending,
        config.ocr.concurrency,
        async (segmentState) => {
          const segment = plan.segments[segmentState.index];
          if (!segment) return;
          segmentState.status = "running";
          void session.persist();
          try {
            const image = await readFile(store.paths.segmentImage(importId, segment.index));
            const prompt = segmentPrompt(plan, segment.index);
            const extraction: SegmentExtraction = await extractSegment({
              client,
              config: config.ocr,
              image,
              size: { width: segment.widthPx, height: segment.heightPx },
              prompt,
              signal,
              onAttempt: () => {
                segmentState.attempts += 1;
                void session.persist();
              },
            });
            await writeJsonAtomic(store.paths.segmentResult(importId, segment.index), extraction);
            segmentState.status = "done";
            segmentState.error = null;
          } catch (error) {
            const failure = toAppError(error);
            segmentState.status = pausesJob(failure) ? "pending" : "failed";
            segmentState.error = describe(failure);
            if (pausesJob(failure) && !pausing) {
              pausing = failure;
              controller.abort();
            }
          }
          await session.persist(true);
        },
        signal,
      );

      if (signal.aborted) {
        for (const segment of state.segments) if (segment.status === "running") segment.status = "pending";
        state.status = "paused";
        state.error = describe(pausing ?? new AppError("cancelled"));
      } else if (state.segments.some((segment) => segment.status === "failed")) {
        state.status = "failed";
        state.error = state.segments.find((segment) => segment.error)?.error ?? describe(new AppError("claudeFailed"));
      } else {
        await finalize(importId, plan);
        state.status = "completed";
        state.finishedAt = new Date().toISOString();
      }
    } catch (error) {
      const failure = toAppError(error);
      state.status = pausesJob(failure) ? "paused" : "failed";
      state.error = describe(failure);
    }
    await session.persist(true);
    await session.flush();
  }

  function start(importId: string): Promise<void> {
    if (active.has(importId)) throw new AppError("jobRunning");
    const controller = new AbortController();
    const done = run(importId, controller)
      .catch(ignoreOutcome)
      .finally(() => active.delete(importId));
    active.set(importId, { controller, done });
    return done;
  }

  return {
    events,
    start,
    isActive: (importId: string) => active.has(importId),
    pause(importId: string) {
      active.get(importId)?.controller.abort();
    },
    async rebuildDraft(importId: string): Promise<void> {
      if (active.has(importId)) throw new AppError("jobRunning");
      const state = await readState(importId);
      const plan = await loadPlan(store, importId);
      if (state.status !== "completed" || !plan) throw new AppError("jobNotReady");
      await finalize(importId, plan, true);
    },
    async progress(importId: string): Promise<JobProgress> {
      return summarizeJob(await readState(importId));
    },
    async recoverInterrupted(importIds: readonly string[]): Promise<void> {
      for (const importId of importIds) {
        const state = await readState(importId);
        if (!ACTIVE_STATUSES.includes(state.status)) continue;
        if (config.jobs.autoResumeInterrupted) {
          void start(importId);
          continue;
        }
        for (const segment of state.segments) if (segment.status === "running") segment.status = "pending";
        state.status = "paused";
        state.error = describe(new AppError("cancelled"));
        await writeJsonAtomic(store.paths.job(importId), state);
      }
    },
    async shutdown(): Promise<void> {
      const running = [...active.values()];
      for (const job of running) job.controller.abort();
      await Promise.all(running.map((job) => job.done));
    },
  };
}

export { PROGRESS_EVENT, createJobRunner };
