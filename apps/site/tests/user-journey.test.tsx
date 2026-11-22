/** @vitest-environment jsdom */
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/app/App.tsx";
import type { Quiz, QuizIndex } from "@pomkuiz/quiz-contract";

const quiz: Quiz = {
  schemaVersion: 1,
  id: "demo",
  title: "2026-09-21 Colle de démonstration",
  updatedAt: "2026-11-21",
  questions: [
    {
      id: "q1",
      type: "single",
      prompt: "Combien vaut $x^2$ pour $x=3$ ?",
      choices: [
        { id: "a", text: "6", correct: false },
        { id: "b", text: "9", correct: true },
      ],
    },
    {
      id: "q2",
      type: "multiple",
      prompt: "Gaz nobles ?",
      choices: [
        { id: "a", text: "Hélium", correct: true },
        { id: "b", text: "Azote", correct: false },
        { id: "c", text: "Néon", correct: true },
      ],
    },
    {
      id: "q3",
      type: "single",
      prompt: "Le pH neutre",
      choices: [
        { id: "a", text: "7", correct: true, explanation: "À 25 °C" },
        { id: "b", text: "0", correct: false },
      ],
    },
  ],
};

const index: QuizIndex = {
  schemaVersion: 1,
  quizzes: [
    { id: "demo", title: quiz.title, description: "", questionCount: 3, date: quiz.updatedAt, tags: ["chimie"] },
  ],
};

const RESPONSES: Record<string, unknown> = {
  "./data/index.json": index,
  "./data/quizzes/demo/quiz.json": quiz,
};

let container: HTMLElement;

const nextTick = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const settle = () =>
  act(async () => {
    await nextTick();
    await nextTick();
  });

async function mount() {
  container = document.createElement("div");
  document.body.append(container);
  await act(() => render(<App />, container));
  await settle();
}

async function unmount() {
  await act(() => render(null, container));
  container.remove();
}

async function goTo(hash: string) {
  await act(() => {
    globalThis.location.hash = hash;
    globalThis.dispatchEvent(new HashChangeEvent("hashchange"));
  });
  await settle();
}

function button(label: RegExp): HTMLElement {
  const match = [...container.querySelectorAll<HTMLElement>("button, a")].find((element) =>
    label.test(element.textContent ?? ""),
  );
  if (!match) throw new Error(`no button ${label} in ${container.textContent}`);
  return match;
}

async function click(element: HTMLElement) {
  await act(() => {
    element.click();
  });
  await settle();
}

async function chooseOption(text: string) {
  const label = [...container.querySelectorAll<HTMLLabelElement>("label.option")].find((item) =>
    item.textContent?.includes(text),
  );
  const input = label?.querySelector("input");
  if (!input) throw new Error(`no choice ${text}`);
  await click(input);
}

async function press(key: string) {
  await act(() => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
  await settle();
}

const heading = () => container.querySelector(".question-label")?.textContent;
const prompt = () => container.querySelector(".question-prompt")?.textContent;
const storedProgress = () => JSON.parse(localStorage.getItem("pomkuiz.v1.quiz.demo") ?? "{}");

describe("site : passer un QCM, le quitter et le reprendre", () => {
  beforeEach(() => {
    localStorage.clear();
    globalThis.location.hash = "#/";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const body = RESPONSES[url];
        return body ? new Response(JSON.stringify(body), { status: 200 }) : new Response("", { status: 404 });
      }),
    );
    vi.spyOn(globalThis, "confirm").mockReturnValue(true);
  });

  afterEach(async () => {
    await unmount();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("lists quizzes, resumes at the same question and keeps several attempts", async () => {
    await mount();
    expect(container.querySelector(".page-title")?.textContent).toBe("Prêt à réviser ?");
    expect(container.querySelector(".quiz-row-title")?.textContent).toBe("Colle de démonstration");
    expect(container.querySelector(".quiz-row-meta")?.textContent).toContain("3 questions");
    expect(container.querySelector(".quiz-row-date")?.textContent).toBe("21/09/2026");
    expect(container.querySelector(".quiz-row-date")?.getAttribute("datetime")).toBe("2026-09-21");
    expect(container.querySelector(".dashboard")).toBeNull();

    await goTo("#/quiz/demo");
    await click(button(/^Commencer/));
    expect(globalThis.location.hash).toBe("#/quiz/demo/play");
    await settle();
    expect(heading()).toBe("Question 1 sur 3");
    await vi.waitFor(() => expect(container.querySelector(".katex")).not.toBeNull());

    await chooseOption("9");
    await press("ArrowRight");
    expect(heading()).toBe("Question 2 sur 3");
    await press("a");
    await press("c");

    await unmount();
    await mount();
    await goTo("#/quiz/demo");
    expect(button(/Reprendre/).getAttribute("href")).toBe("#/quiz/demo/play");
    expect(container.querySelector(".launch-position")?.textContent).toBe("Question 2 sur 3");
    await goTo("#/quiz/demo/play");
    expect(heading()).toBe("Question 2 sur 3");
    const checked = [...container.querySelectorAll<HTMLInputElement>("label.option input")].map(
      (input) => input.checked,
    );
    expect(checked).toEqual([true, false, true]);

    await press("ArrowRight");
    await chooseOption("0");
    await click(button(/^Terminer$/));
    expect(globalThis.location.hash).toMatch(/^#\/quiz\/demo\/results\//);
    expect(container.querySelector(".results-percent")?.textContent).toMatch(/^67\s%$/);
    expect(container.textContent).toContain("2/3");
    expect(container.textContent).toContain("À 25 °C");
    expect(container.querySelectorAll(".review-item")).toHaveLength(3);
    await click(container.querySelector<HTMLInputElement>("input[name='review-filter'][value='mistakes']")!);
    expect(container.querySelectorAll(".review-item")).toHaveLength(1);
    expect(container.querySelector(".review-item .question-prompt")?.textContent).toBe("Le pH neutre");

    await goTo("#/");
    const dashboard = container.querySelector(".dashboard");
    expect(dashboard?.textContent).toContain("QCM terminés1 / 1");
    expect(dashboard?.textContent).toMatch(/Note moyenne67\s%/);
    const row = container.querySelector(".quiz-row.tone-medium");
    expect(row?.textContent).toContain("Colle de démonstration");
    expect(
      [...row!.querySelectorAll(".quiz-row-aside .pill")].map((pill) => pill.textContent?.replace(/\s/g, " ")),
    ).toEqual(["Meilleure 67 %", "Dernière 67 %"]);
    expect(container.querySelector(".resume-card")).toBeNull();

    await goTo("#/quiz/demo");
    expect(container.textContent).toMatch(/Dernière note\s*67\s%/);
    await click(button(/Nouvelle tentative/));
    await goTo("#/");
    const resume = container.querySelector<HTMLAnchorElement>(".resume-card");
    expect(resume?.getAttribute("href")).toBe("#/quiz/demo/play");
    expect(resume?.textContent).toContain("Question 1 sur 3");
    await goTo("#/quiz/demo");
    const rows = container.querySelectorAll(".attempt-row");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("En cours");
    expect(rows[1]?.querySelector(".pill")?.textContent).toMatch(/^67\s%$/);
  });

  it("shuffles questions and choices and keeps the same order when resuming", async () => {
    await mount();
    await goTo("#/quiz/demo");
    await click(container.querySelector<HTMLInputElement>("input[role='switch']")!);
    expect(localStorage.getItem("pomkuiz.v1.settings")).toContain('"shuffle":true');
    await click(button(/^Commencer/));
    const order = storedProgress().attempts[0].order as { questions: string[]; choices: Record<string, string[]> };
    expect(order.questions.toSorted()).toEqual(["q1", "q2", "q3"]);
    const firstQuestion = quiz.questions.find((question) => question.id === order.questions[0])!;
    expect(prompt()).toBe(firstQuestion.prompt.includes("$") ? prompt() : firstQuestion.prompt);
    const displayedChoices = [...container.querySelectorAll("label.option .option-body")].map(
      (element) => element.textContent,
    );
    const expectedChoices = order.choices[firstQuestion.id]!.map(
      (id) => firstQuestion.choices.find((choice) => choice.id === id)!.text,
    );
    expect(displayedChoices).toEqual(expectedChoices);

    await press("ArrowRight");
    const secondPrompt = prompt();
    await unmount();
    await mount();
    await goTo("#/quiz/demo/play");
    expect(prompt()).toBe(secondPrompt);
    expect(storedProgress().attempts[0].order).toEqual(order);
    await goTo("#/quiz/demo");
    expect(container.querySelector(".attempt-shuffled")).not.toBeNull();
  });

  it("switches theme with icon buttons and remembers it", async () => {
    await mount();
    const options = [...container.querySelectorAll<HTMLLabelElement>(".app-bar .segmented-option")];
    expect(options.map((option) => option.title)).toEqual(["Clair", "Système", "Sombre"]);
    expect(options.every((option) => option.querySelector("svg"))).toBe(true);
    await click(options[2]!.querySelector("input")!);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await click(options[1]!.querySelector("input")!);
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(localStorage.getItem("pomkuiz.v1.settings")).toContain('"theme":"system"');
  });

  it("corrects each question immediately in per-question mode", async () => {
    await mount();
    await goTo("#/quiz/demo");
    const perQuestion = [...container.querySelectorAll<HTMLInputElement>("input[name='correction-mode']")].find(
      (input) => input.value === "per-question",
    );
    await click(perQuestion!);
    await click(button(/^Commencer/));
    expect((button(/^Valider$/) as HTMLButtonElement).disabled).toBe(true);
    await chooseOption("6");
    await click(button(/^Valider$/));
    expect(container.querySelector(".feedback")?.textContent).toContain("Réponse incorrecte");
    expect(container.querySelector(".nav-cell.nav-wrong")?.textContent).toBe("1");
    const inputs = [...container.querySelectorAll<HTMLInputElement>("label.option input")];
    expect(inputs.every((input) => input.disabled)).toBe(true);
    expect(container.querySelector(".option-wrong")?.textContent).toContain("6");
    expect(container.querySelector(".option-expected")?.textContent).toContain("9");
  });
});
