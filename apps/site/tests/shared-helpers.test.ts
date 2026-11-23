import { describe, expect, it } from "vitest";
import { parseHash } from "../src/app/hash-router.ts";
import { commandFor } from "../src/features/quiz-session/session-keyboard.ts";
import { parseSettings } from "../src/features/settings/user-settings.ts";
import { splitTitleDate } from "../src/shared/formatters.ts";

describe("routing", () => {
  it("parses hash routes and rejects unsafe identifiers", () => {
    expect(parseHash("")).toEqual({ name: "list" });
    expect(parseHash("#/")).toEqual({ name: "list" });
    expect(parseHash("#/quiz/colle-ue3")).toEqual({ name: "quiz", quizId: "colle-ue3" });
    expect(parseHash("#/quiz/colle-ue3/play")).toEqual({ name: "play", quizId: "colle-ue3" });
    expect(parseHash("#/quiz/c/results/0b9c5f9e-3d1c")).toEqual({
      name: "results",
      quizId: "c",
      attemptId: "0b9c5f9e-3d1c",
    });
    expect(parseHash("#/quiz/../secret").name).toBe("not-found");
    expect(parseHash("#/quiz/A%20B").name).toBe("not-found");
  });
});

const key = (value: string, modifiers: Partial<KeyboardEvent> = {}) =>
  commandFor({ key: value, altKey: false, ctrlKey: false, metaKey: false, ...modifiers });

describe("keyboard commands", () => {
  it("maps keys to session commands", () => {
    expect(key("ArrowLeft")).toEqual({ kind: "previous" });
    expect(key("ArrowRight")).toEqual({ kind: "next" });
    expect(key("Enter")).toEqual({ kind: "confirm" });
    expect(key("c")).toEqual({ kind: "toggle", index: 2 });
    expect(key("C")).toEqual({ kind: "toggle", index: 2 });
    expect(key("3")).toEqual({ kind: "toggle", index: 2 });
    expect(key("c", { metaKey: true })).toBeNull();
    expect(key("Tab")).toBeNull();
  });
});

describe("misc helpers", () => {
  it("validates stored settings", () => {
    expect(
      parseSettings({ correctionMode: "per-question", theme: "dark", shuffle: true, scoreScale: "percent" }),
    ).toEqual({
      correctionMode: "per-question",
      theme: "dark",
      shuffle: true,
      scoreScale: "percent",
    });
    expect(parseSettings({ correctionMode: "hack", theme: 3, shuffle: "yes", scoreScale: "sur 10" })).toEqual({
      correctionMode: "end",
      theme: "system",
      shuffle: false,
      scoreScale: "twenty",
    });
  });

  it("splits a leading ISO date from the quiz name", () => {
    expect(splitTitleDate("2026-09-21 Colle d'UE3")).toEqual({
      name: "Colle d'UE3",
      date: { iso: "2026-09-21", label: "21/09/2026" },
    });
    expect(splitTitleDate("Colle d'UE3")).toEqual({ name: "Colle d'UE3", date: null });
    expect(splitTitleDate("2026-13-45 Mauvaise date").date).toBeNull();
    expect(splitTitleDate("2026-09-21").date).toBeNull();
  });
});
