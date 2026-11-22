/** @vitest-environment jsdom */
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Draft, DraftQuestion } from "../../server/features/review/draft-types.ts";
import { App } from "../src/app/App.tsx";

const IMPORT_ID = "0b9c5f9e-3d1c-4b5e-9f2a-1c2d3e4f5a6b";
const NOW = "2026-11-22T10:00:00.000Z";

const question = (key: string, number: number, status: DraftQuestion["status"]): DraftQuestion => ({
  key,
  status,
  number,
  type: "single",
  prompt: `Question numéro ${number}`,
  explanation: "",
  images: [],
  choices: [
    { key: `${key}-a`, text: "Oui", correct: true, explanation: "", images: [] },
    { key: `${key}-b`, text: "Non", correct: false, explanation: "", images: [] },
  ],
  source: { page: 0, y0: 10, y1: 200 },
  issues: status === "needs_review" ? ["Correction Moodle introuvable."] : [],
});

const draft: Draft = {
  draftVersion: 1,
  importId: IMPORT_ID,
  revision: 3,
  updatedAt: NOW,
  meta: { id: "2026-09-21-colle-ue3", title: "2026-09-21 Colle UE3", description: "", tags: [] },
  questions: [
    question("11111111-1111-4111-8111-111111111111", 1, "unverified"),
    question("22222222-2222-4222-8222-222222222222", 2, "needs_review"),
  ],
  lastExport: null,
};

const record = {
  id: IMPORT_ID,
  originalName: "Colle UE3.pdf",
  createdAt: NOW,
  pageCount: 1,
  byteSize: 10,
  sha256: "x",
};

interface RecordedRequest {
  method: string;
  path: string;
  body: unknown;
  headers: Headers;
}

let container: HTMLElement;
let requests: RecordedRequest[];
let revision: number;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function respond(method: string, path: string, body: unknown): Response {
  if (path === "/api/health")
    return json({
      claude: { executable: "/x/claude", loggedIn: true, authMethod: "claude.ai", subscription: "pro" },
      ocr: { model: "opus", effort: "medium", concurrency: 3 },
      dataDirectory: "/data",
    });
  if (path === "/api/imports")
    return json({
      imports: [
        {
          ...record,
          job: { importId: IMPORT_ID, status: "completed", total: 4, done: 4, failed: 0, running: 0, error: null },
          active: false,
          draft: {
            title: draft.meta.title,
            revision,
            questionCount: 2,
            statuses: { unverified: 1, verified: 0, needs_review: 1 },
            lastExport: null,
          },
        },
      ],
    });
  if (path === `/api/imports/${IMPORT_ID}/draft` && method === "GET")
    return json({
      import: record,
      draft: { ...draft, revision },
      pages: [{ index: 0, width: 600, height: 800 }],
      assets: {},
    });
  if (path === `/api/imports/${IMPORT_ID}/draft` && method === "PUT") {
    const update = body as { revision: number };
    if (update.revision !== revision) return json({ error: { code: "conflict", message: "conflit" } }, 409);
    revision += 1;
    return json({ revision, updatedAt: NOW });
  }
  if (path === `/api/imports/${IMPORT_ID}/export`)
    return json({
      result: { quizId: draft.meta.id, questionCount: 2, assetCount: 0, indexedQuizzes: 1, rejectedFolders: [] },
    });
  return json({ error: { code: "notFound", message: "introuvable" } }, 404);
}

class SilentEventSource {
  addEventListener(): void {}
  close(): void {}
}

class SilentResizeObserver {
  observe(): void {}
  disconnect(): void {}
}

const nextTick = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const settle = () =>
  act(async () => {
    await nextTick();
    await nextTick();
  });

async function goTo(hash: string) {
  await act(() => {
    globalThis.location.hash = hash;
    globalThis.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  await settle();
}

function control(label: RegExp): HTMLElement {
  const match = [...container.querySelectorAll<HTMLElement>("button, a")].find((element) =>
    label.test(element.textContent ?? ""),
  );
  if (!match) throw new Error(`no control ${label} in ${container.textContent}`);
  return match;
}

async function click(element: HTMLElement) {
  await act(() => {
    element.click();
  });
  await settle();
}

const listItems = () => container.querySelectorAll(".question-list .list-item");
const heading = () => container.querySelector(".editor-title")?.textContent;
const puts = () => requests.filter((request) => request.method === "PUT");

describe("backoffice : relire et exporter un import", () => {
  beforeEach(() => {
    requests = [];
    revision = draft.revision;
    globalThis.location.hash = "#/";
    vi.stubGlobal("EventSource", SilentEventSource);
    vi.stubGlobal("ResizeObserver", SilentResizeObserver);
    Element.prototype.scrollIntoView = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit = {}) => {
        const method = init.method ?? "GET";
        const body = typeof init.body === "string" ? (JSON.parse(init.body) as unknown) : null;
        requests.push({ method, path: url, body, headers: new Headers(init.headers) });
        return respond(method, url, body);
      }),
    );
    container = document.createElement("div");
    document.body.append(container);
  });

  afterEach(async () => {
    await act(() => render(null, container));
    container.remove();
    vi.unstubAllGlobals();
  });

  it("opens an import, edits a question, autosaves, verifies it and exports", async () => {
    await act(() => render(<App />, container));
    await settle();
    expect(container.textContent).toContain("Prêt · opus / medium");
    expect(container.querySelector(".import-title")?.textContent).toBe("2026-09-21 Colle UE3");

    await goTo(`#/imports/${IMPORT_ID}`);
    expect(heading()).toBe("Question 1/2");

    const prompt = container.querySelector<HTMLTextAreaElement>("textarea[id$='-prompt']")!;
    await act(() => {
      prompt.value = "Énoncé corrigé avec $x^2$";
      prompt.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await vi.waitFor(() => expect(puts()).toHaveLength(1), { timeout: 3000 });
    const saved = puts()[0]!;
    expect(saved.headers.get("x-pomkuiz-request")).toBe("1");
    expect(saved.body).toMatchObject({ revision: 3, questions: [{ prompt: "Énoncé corrigé avec $x^2$" }, {}] });

    await act(() => {
      globalThis.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", ctrlKey: true, bubbles: true }));
    });
    await settle();
    expect(heading()).toBe("Question 2/2");
    await vi.waitFor(() => expect(puts()).toHaveLength(2), { timeout: 3000 });
    expect(puts()[1]!.body).toMatchObject({
      revision: 4,
      questions: [{ status: "verified" }, { status: "needs_review" }],
    });

    await click(control(/^Exporter$/));
    const dialog = container.querySelector("dialog.dialog")!;
    const submit = [...dialog.querySelectorAll<HTMLButtonElement>("button")].find(
      (button) => button.textContent === "Exporter",
    )!;
    expect(submit.disabled).toBe(true);
    await click(dialog.querySelector<HTMLInputElement>("input[role='switch']")!);
    expect(submit.disabled).toBe(false);
    await click(submit);
    await vi.waitFor(() => expect(dialog.textContent).toContain("exporté"));
    const exported = requests.find((request) => request.path.endsWith("/export"))!;
    expect(exported.body).toEqual({ force: true, overwrite: false });
  });

  it("filters the question list by status", async () => {
    await act(() => render(<App />, container));
    await goTo(`#/imports/${IMPORT_ID}`);
    expect(listItems()).toHaveLength(2);
    await click(control(/À revoir/));
    expect(listItems()).toHaveLength(1);
    expect(listItems()[0]?.textContent).toContain("Question numéro 2");
  });
});
