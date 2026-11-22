import { ERROR_MESSAGES } from "../config/user-messages.ts";

type ErrorCode = keyof typeof ERROR_MESSAGES;

const HTTP_STATUS: Readonly<Record<ErrorCode, number>> = Object.freeze({
  invalidRequest: 400,
  notFound: 404,
  conflict: 409,
  forbidden: 403,
  payloadTooLarge: 413,
  unsupportedMedia: 415,
  invalidPdf: 422,
  encryptedPdf: 422,
  tooManyPages: 422,
  invalidImage: 422,
  claudeMissing: 503,
  claudeSignedOut: 503,
  claudeRateLimited: 429,
  claudeTimeout: 504,
  claudeFailed: 502,
  claudeInvalidOutput: 502,
  cancelled: 499,
  jobRunning: 409,
  jobNotReady: 409,
  exportBlocked: 409,
  exportExists: 409,
  exportInvalid: 422,
  unexpected: 500,
});

const RETRYABLE: ReadonlySet<ErrorCode> = new Set(["claudeTimeout", "claudeFailed", "claudeInvalidOutput"]);

const PAUSING: ReadonlySet<ErrorCode> = new Set(["claudeRateLimited", "claudeSignedOut", "claudeMissing", "cancelled"]);

class AppError extends Error {
  readonly code: ErrorCode;
  readonly detail: string;
  readonly data: Readonly<Record<string, unknown>>;

  constructor(code: ErrorCode, detail = "", data: Record<string, unknown> = {}) {
    super(detail || ERROR_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.detail = detail;
    this.data = data;
  }

  get status(): number {
    return HTTP_STATUS[this.code];
  }

  get userMessage(): string {
    return ERROR_MESSAGES[this.code];
  }
}

function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError("unexpected", error instanceof Error ? error.message : String(error));
}

function isRetryable(error: AppError): boolean {
  return RETRYABLE.has(error.code);
}

function pausesJob(error: AppError): boolean {
  return PAUSING.has(error.code);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new AppError("cancelled");
}

export { AppError, toAppError, isRetryable, pausesJob, throwIfAborted };
export type { ErrorCode };
