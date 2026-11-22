import { cp, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DATA_LAYOUT, type Quiz } from "@pomkuiz/quiz-contract";
import { createClaudeClient } from "../../server/features/ocr/claude-client.ts";
import type { Draft } from "../../server/features/review/draft-types.ts";
import { loadConfig } from "../../server/config/app-config.ts";
import { createTestContext, multipartBody, waitForJob, type TestContext } from "../support/test-context.ts";

const LIVE_PDF_VARIABLE = "POMKUIZ_LIVE_PDF";
const LIVE_OUTPUT_VARIABLE = "POMKUIZ_LIVE_OUTPUT";
const SOURCE_PDF_DIRECTORY = "mcq";
const EXAMPLE_DIRECTORY = join(
  import.meta.dirname,
  "..",
  "..",
  "..",
  "..",
  DATA_LAYOUT.publicDirectory,
  SOURCE_PDF_DIRECTORY,
);
const LIVE_TIMEOUT_MS = 30 * 60_000;

async function findPdf(): Promise<string> {
  const explicit = process.env[LIVE_PDF_VARIABLE];
  if (explicit) return explicit;
  const names = await readdir(EXAMPLE_DIRECTORY);
  const pdf = names.find((name) => name.toLowerCase().endsWith(".pdf"));
  if (!pdf) throw new Error(`Aucun PDF : définissez ${LIVE_PDF_VARIABLE}`);
  return join(EXAMPLE_DIRECTORY, pdf);
}

describe("live : PDF Moodle réel → quiz.json via claude -p", () => {
  let context: TestContext;

  beforeAll(async () => {
    const config = loadConfig();
    context = await createTestContext(
      createClaudeClient({ config: config.ocr }),
      process.env.POMKUIZ_CLAUDE_PATH ? { POMKUIZ_CLAUDE_PATH: process.env.POMKUIZ_CLAUDE_PATH } : {},
    );
  });

  afterAll(async () => {
    await context?.close();
  });

  it("extracts every question and exports a valid quiz", async () => {
    const path = await findPdf();
    const upload = multipartBody("file", path.split("/").at(-1) ?? "live.pdf", "application/pdf", await readFile(path));
    const created = await context.request({ method: "POST", url: "/api/imports", ...upload });
    expect(created.statusCode).toBe(201);
    const importId = created.json().import.id as string;
    const progress = await waitForJob(context, importId, LIVE_TIMEOUT_MS);
    expect(progress.error).toBeNull();
    expect(progress.status).toBe("completed");

    const draft = (await context.request({ method: "GET", url: `/api/imports/${importId}/draft` })).json()
      .draft as Draft;
    const exported = await context.request({
      method: "POST",
      url: `/api/imports/${importId}/export`,
      payload: { force: true },
    });
    expect(exported.json().error).toBeUndefined();
    const quizDirectory = join(
      context.config.paths.dataDirectory,
      DATA_LAYOUT.quizzesDirectory,
      exported.json().result.quizId,
    );
    const quiz = JSON.parse(await readFile(join(quizDirectory, DATA_LAYOUT.quizFile), "utf8")) as Quiz;
    expect(context.services.validators.quiz(quiz)).toBe(true);
    const output = process.env[LIVE_OUTPUT_VARIABLE];
    if (output) {
      await cp(quizDirectory, output, { recursive: true });
      await cp(context.services.store.paths.draft(importId), join(output, "draft.json"));
    }
    process.stdout.write(
      `${JSON.stringify(
        {
          questions: draft.questions.length,
          needsReview: draft.questions
            .filter((question) => question.status === "needs_review")
            .map((question) => ({ number: question.number, issues: question.issues })),
          images: quiz.questions.flatMap((question) => question.images ?? []),
          latex: quiz.questions
            .filter((question) => JSON.stringify(question).includes("$"))
            .map((question) => question.id),
        },
        null,
        2,
      )}\n`,
    );
  });
});
