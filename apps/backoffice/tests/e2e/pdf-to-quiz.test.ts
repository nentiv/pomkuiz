import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DATA_LAYOUT, hasPngSignature, type Quiz, type QuizIndex } from "@pomkuiz/quiz-contract";
import type { Draft } from "../../server/features/review/draft-types.ts";
import { createTestContext, multipartBody, waitForJob, type TestContext } from "../support/test-context.ts";
import { createFakeOcrClient } from "../support/fake-ocr-client.ts";
import { buildSamplePdf, SAMPLE_QUESTIONS } from "../support/fixture-pdf.ts";

describe("PDF Moodle → quiz.json", () => {
  let context: TestContext;
  const client = createFakeOcrClient({ failFirst: 1 });

  beforeEach(async () => {
    context = await createTestContext(client, { POMKUIZ_OCR_CONCURRENCY: "2" });
  });

  afterEach(async () => {
    await context.close();
  });

  it("imports, extracts, reviews and exports a valid quiz", async () => {
    const upload = multipartBody("file", "Colle test.pdf", "application/pdf", buildSamplePdf());
    const created = await context.request({ method: "POST", url: "/api/imports", ...upload });
    expect(created.statusCode).toBe(201);
    const importId = created.json().import.id as string;

    const progress = await waitForJob(context, importId);
    expect(progress.status).toBe("completed");
    expect(progress.done).toBe(progress.total);
    expect(progress.total).toBeGreaterThanOrEqual(2);

    const loaded = await context.request({ method: "GET", url: `/api/imports/${importId}/draft` });
    expect(loaded.statusCode).toBe(200);
    const draft = loaded.json().draft as Draft;
    expect(draft.meta.title).toMatch(/^\d{4}-\d{2}-\d{2} Colle test$/);
    const expectedId = `${draft.meta.title.slice(0, 10)}-colle-test`;
    expect(draft.questions.map((question) => question.number)).toEqual(
      SAMPLE_QUESTIONS.map((question) => question.number),
    );

    const figureQuestion = draft.questions[1];
    expect(figureQuestion?.images).toHaveLength(1);
    expect(figureQuestion?.type).toBe("multiple");
    expect(figureQuestion?.choices.map((choice) => choice.correct)).toEqual([true, false, true, false]);

    const splitQuestion = draft.questions[3];
    expect(splitQuestion?.choices).toHaveLength(4);
    expect(splitQuestion?.status).toBe("needs_review");

    const blocked = await context.request({ method: "POST", url: `/api/imports/${importId}/export`, payload: {} });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error.code).toBe("exportBlocked");

    const reviewed = {
      revision: draft.revision,
      meta: { ...draft.meta, tags: ["chimie", "UE3"], description: "Colle de test" },
      questions: draft.questions.map((question) => ({ ...question, status: "verified" })),
    };
    const saved = await context.request({ method: "PUT", url: `/api/imports/${importId}/draft`, payload: reviewed });
    expect(saved.statusCode).toBe(200);
    const stale = await context.request({ method: "PUT", url: `/api/imports/${importId}/draft`, payload: reviewed });
    expect(stale.statusCode).toBe(409);

    const exported = await context.request({ method: "POST", url: `/api/imports/${importId}/export`, payload: {} });
    expect(exported.json().error).toBeUndefined();
    expect(exported.statusCode).toBe(200);
    const result = exported.json().result;
    expect(result.quizId).toBe(expectedId);

    const quizDirectory = join(context.config.paths.dataDirectory, DATA_LAYOUT.quizzesDirectory, result.quizId);
    const quiz = JSON.parse(await readFile(join(quizDirectory, DATA_LAYOUT.quizFile), "utf8")) as Quiz;
    expect(context.services.validators.quiz(quiz)).toBe(true);
    expect(quiz.questions).toHaveLength(SAMPLE_QUESTIONS.length);
    expect(quiz.questions[1]?.images).toEqual(["assets/q2-1.png"]);
    expect(hasPngSignature(await readFile(join(quizDirectory, "assets", "q2-1.png")))).toBe(true);

    const index = JSON.parse(
      await readFile(join(context.config.paths.dataDirectory, DATA_LAYOUT.indexFile), "utf8"),
    ) as QuizIndex;
    expect(context.services.validators.index(index)).toBe(true);
    expect(index.quizzes).toEqual([
      expect.objectContaining({ id: expectedId, questionCount: SAMPLE_QUESTIONS.length, tags: ["chimie", "UE3"] }),
    ]);

    const again = await context.request({ method: "POST", url: `/api/imports/${importId}/export`, payload: {} });
    expect(again.statusCode).toBe(200);
  });
});
