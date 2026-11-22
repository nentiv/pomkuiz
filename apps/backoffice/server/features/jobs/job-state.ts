import { compileSchema } from "../../shared/json-schema-validation.ts";

const JOB_STATUSES = ["queued", "preparing", "running", "paused", "failed", "completed"] as const;
type JobStatus = (typeof JOB_STATUSES)[number];

const SEGMENT_STATUSES = ["pending", "running", "done", "failed"] as const;
type SegmentStatus = (typeof SEGMENT_STATUSES)[number];

const ACTIVE_STATUSES: readonly JobStatus[] = ["queued", "preparing", "running"];

interface JobError {
  code: string;
  message: string;
}

interface SegmentState {
  index: number;
  status: SegmentStatus;
  attempts: number;
  error: JobError | null;
}

interface JobState {
  importId: string;
  status: JobStatus;
  segments: SegmentState[];
  error: JobError | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

interface JobProgress {
  importId: string;
  status: JobStatus;
  total: number;
  done: number;
  failed: number;
  running: number;
  error: JobError | null;
}

const errorSchema = {
  anyOf: [
    { type: "null" },
    {
      type: "object",
      required: ["code", "message"],
      properties: { code: { type: "string" }, message: { type: "string" } },
    },
  ],
};

const validateJobState = compileSchema<JobState>({
  type: "object",
  required: ["importId", "status", "segments", "error", "createdAt", "updatedAt", "finishedAt"],
  properties: {
    importId: { type: "string" },
    status: { enum: [...JOB_STATUSES] },
    segments: {
      type: "array",
      items: {
        type: "object",
        required: ["index", "status", "attempts", "error"],
        properties: {
          index: { type: "integer" },
          status: { enum: [...SEGMENT_STATUSES] },
          attempts: { type: "integer" },
          error: errorSchema,
        },
      },
    },
    error: errorSchema,
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
    finishedAt: { type: ["string", "null"] },
  },
});

function newJobState(importId: string): JobState {
  const now = new Date().toISOString();
  return { importId, status: "queued", segments: [], error: null, createdAt: now, updatedAt: now, finishedAt: null };
}

function summarizeJob(state: JobState): JobProgress {
  const count = (status: SegmentStatus) => state.segments.filter((segment) => segment.status === status).length;
  return {
    importId: state.importId,
    status: state.status,
    total: state.segments.length,
    done: count("done"),
    failed: count("failed"),
    running: count("running"),
    error: state.error,
  };
}

export { ACTIVE_STATUSES, validateJobState, newJobState, summarizeJob };
export type { JobStatus, JobError, JobState, JobProgress };
