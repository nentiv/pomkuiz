import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadDataDirectory } from "../build/load-quiz-data.ts";
import { findPublishViolations } from "../build/publish-guard.ts";
import { PNG_SIGNATURE, type Quiz } from "@pomkuiz/quiz-contract";

const PNG = new Uint8Array([...PNG_SIGNATURE, 0, 0, 0, 0]);

const quiz = (id: string, fields: Partial<Quiz> = {}): Quiz => ({
  schemaVersion: 1,
  id,
  title: `Titre ${id}`,
  updatedAt: "2026-09-21",
  questions: [
    {
      id: "q1",
      type: "single",
      prompt: "Soit $x$",
      images: ["assets/q1-1.png"],
      choices: [
        { id: "a", text: "Oui", correct: true },
        { id: "b", text: "Non", correct: false },
      ],
    },
  ],
  ...fields,
});

describe("site build data loading", () => {
  let data: string;

  async function writeQuiz(folder: string, value: unknown, assets: Record<string, Uint8Array> = { "q1-1.png": PNG }) {
    const directory = join(data, "quizzes", folder);
    await mkdir(join(directory, "assets"), { recursive: true });
    await writeFile(join(directory, "quiz.json"), JSON.stringify(value));
    for (const [name, bytes] of Object.entries(assets)) await writeFile(join(directory, "assets", name), bytes);
  }

  beforeEach(async () => {
    data = await mkdtemp(join(tmpdir(), "pomkuiz-site-data-"));
  });

  afterEach(async () => {
    await rm(data, { recursive: true, force: true });
  });

  it("publishes every valid quiz folder dropped in data/quizzes", async () => {
    await writeQuiz("chimie", quiz("chimie", { updatedAt: "2026-10-01", tags: ["UE3"] }));
    await writeQuiz("bio", quiz("bio"), { "q1-1.png": PNG, "unused.png": PNG });
    await mkdir(join(data, "quizzes", ".pomkuiz-tmp-123"));
    await writeFile(join(data, "quizzes", "chimie", "notes.pdf"), "secret");
    const { index, files } = await loadDataDirectory(data);
    expect(index.quizzes.map((summary) => summary.id)).toEqual(["chimie", "bio"]);
    expect(index.quizzes[0]).toEqual({
      id: "chimie",
      title: "Titre chimie",
      description: "",
      questionCount: 1,
      date: "2026-10-01",
      tags: ["UE3"],
    });
    expect(files.map((file) => file.path).toSorted()).toEqual([
      "index.json",
      "quizzes/bio/assets/q1-1.png",
      "quizzes/bio/quiz.json",
      "quizzes/chimie/assets/q1-1.png",
      "quizzes/chimie/quiz.json",
    ]);
  });

  it("sorts by the date written in the title, then by export date", async () => {
    await writeQuiz("janvier", quiz("janvier", { title: "2026-01-05 Janvier", updatedAt: "2026-11-20" }));
    await writeQuiz("mars", quiz("mars", { title: "2026-03-01 Mars", updatedAt: "2026-10-01" }));
    await writeQuiz("sans-date", quiz("sans-date", { title: "Sans date", updatedAt: "2026-02-10" }));
    const { index } = await loadDataDirectory(data);
    expect(index.quizzes.map((summary) => [summary.id, summary.date])).toEqual([
      ["mars", "2026-03-01"],
      ["sans-date", "2026-02-10"],
      ["janvier", "2026-01-05"],
    ]);
  });

  it("works with an empty data directory", async () => {
    expect((await loadDataDirectory(data)).index).toEqual({ schemaVersion: 1, quizzes: [] });
  });

  it.each([
    ["schema violation", "bad", quiz("bad", { questions: [] })],
    ["id/folder mismatch", "folder", quiz("other")],
    ["invalid folder name", "Mon QCM", quiz("mon-qcm")],
    ["raw HTML field", "html", { ...quiz("html"), html: "<script>" }],
    [
      "two correct answers on single",
      "single",
      quiz("single", {
        questions: [
          {
            ...quiz("x").questions[0]!,
            choices: [
              { id: "a", text: "A", correct: true },
              { id: "b", text: "B", correct: true },
            ],
          },
        ],
      }),
    ],
    [
      "path traversal",
      "trav",
      quiz("trav", { questions: [{ ...quiz("x").questions[0]!, images: ["../../../etc/passwd"] }] }),
    ],
  ])("rejects %s", async (_name, folder, value) => {
    await writeQuiz(folder, value);
    await expect(loadDataDirectory(data)).rejects.toThrow("data/");
  });

  it("rejects missing or fake images", async () => {
    await writeQuiz("missing", quiz("missing"), {});
    await expect(loadDataDirectory(data)).rejects.toThrow(/image manquante/);
    await rm(join(data, "quizzes", "missing"), { recursive: true });
    await writeQuiz("fake", quiz("fake"), { "q1-1.png": new TextEncoder().encode("<svg onload=alert(1)>") });
    await expect(loadDataDirectory(data)).rejects.toThrow(/PNG invalide/);
  });
});

describe("publish guard", () => {
  it("accepts a normal build", () => {
    expect(
      findPublishViolations([
        "index.html",
        "assets/index-abc.js",
        "assets/index-abc.css",
        "assets/KaTeX_Main-Regular-xyz.woff2",
        "data/index.json",
        "data/quizzes/colle-ue3/quiz.json",
        "data/quizzes/colle-ue3/assets/q1-1.png",
      ]),
    ).toEqual([]);
  });

  it.each([
    "backoffice/server/start-backoffice.ts",
    "data/quizzes/x/source.pdf",
    "data/quizzes/x/draft.json",
    "assets/index.js.map",
    ".env",
    "workspace/imports/a/job.json",
    "data/quizzes/x/assets/../../secret.png",
    "mcq/notes.txt",
  ])("refuses %s", (file) => {
    expect(findPublishViolations([file]).length).toBeGreaterThan(0);
  });
});
