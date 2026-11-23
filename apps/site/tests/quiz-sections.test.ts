import { describe, expect, it } from "vitest";
import type { QuizSummary } from "@pomkuiz/quiz-contract";
import { groupBySection } from "../src/features/quiz-list/quiz-sections.ts";

const OTHER = "Autres QCM";

const summary = (id: string, section?: string): QuizSummary => ({
  id,
  title: id,
  description: "",
  questionCount: 1,
  date: "2026-09-13",
  tags: [],
  ...(section ? { section } : {}),
});

const titles = (quizzes: QuizSummary[]) => groupBySection(quizzes, OTHER).map((section) => section.title);
const ids = (quizzes: QuizSummary[]) =>
  groupBySection(quizzes, OTHER).map((section) => section.quizzes.map((quiz) => quiz.id));

describe("quiz sections", () => {
  it("keeps a single untitled list when no quiz has a section", () => {
    expect(groupBySection([summary("a"), summary("b")], OTHER)).toEqual([
      { title: null, quizzes: [summary("a"), summary("b")] },
    ]);
  });

  it("sorts sections alphabetically, keeps quiz order and puts the rest last", () => {
    const quizzes = [
      summary("colle"),
      summary("substance", "QCM 26/27"),
      summary("glucides", "QCM 26/27"),
      summary("seance-1", "Les Blédarginines"),
    ];
    expect(titles(quizzes)).toEqual(["Les Blédarginines", "QCM 26/27", OTHER]);
    expect(ids(quizzes)).toEqual([["seance-1"], ["substance", "glucides"], ["colle"]]);
  });

  it("omits the fallback section when every quiz is classified", () => {
    expect(titles([summary("b", "Biochimie"), summary("a", "anatomie")])).toEqual(["anatomie", "Biochimie"]);
  });
});
