import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppConfig } from "../../config/app-config.ts";
import { AppError, isRetryable, toAppError } from "../../shared/app-error.ts";
import type { ClaudeClient } from "./claude-client.ts";
import { EXTRACTION_SCHEMA, type SegmentExtraction } from "./extraction-schema.ts";
import { parseExtraction, type ImageSize } from "./parse-extraction.ts";
import { buildRetryPrompt } from "./build-segment-prompt.ts";

interface SegmentOcrRequest {
  client: ClaudeClient;
  config: AppConfig["ocr"];
  image: Uint8Array;
  size: ImageSize;
  prompt: string;
  signal?: AbortSignal;
  onAttempt?: (attempt: number, previousError: AppError | null) => void;
}

async function extractSegment(request: SegmentOcrRequest): Promise<SegmentExtraction> {
  const { config } = request;
  const workspace = await mkdtemp(join(tmpdir(), config.workspacePrefix));
  try {
    await writeFile(join(workspace, config.imageFileName), request.image);
    let previousError: AppError | null = null;
    for (let attempt = 1; attempt <= config.maxAttempts; attempt += 1) {
      request.onAttempt?.(attempt, previousError);
      const prompt = previousError
        ? buildRetryPrompt(request.prompt, previousError.detail || previousError.userMessage)
        : request.prompt;
      try {
        const raw = await request.client.requestStructured({
          prompt,
          schema: EXTRACTION_SCHEMA,
          workspace,
          signal: request.signal,
        });
        return parseExtraction(raw, request.size);
      } catch (error) {
        const failure = toAppError(error);
        if (!isRetryable(failure) || attempt === config.maxAttempts) throw failure;
        previousError = failure;
      }
    }
    throw previousError ?? new AppError("claudeFailed");
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

export { extractSegment };
