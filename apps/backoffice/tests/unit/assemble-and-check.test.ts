import { describe, expect, it } from "vitest";
import { reviewAssembledQuestion } from "../../server/features/ocr/question-checks.ts";
import type { ExtractedQuestion } from "../../server/features/ocr/extraction-schema.ts";
import { assembleQuestions } from "../../server/features/ocr/assemble-questions.ts";
import { choicesNamedInStatement, statementDisagrees } from "../../server/features/ocr/correct-answer-statement.ts";

const question = (fields: Partial<ExtractedQuestion>): ExtractedQuestion => ({
  number: null,
  continuesFromPrevious: false,
  continuesOnNext: false,
  type: "multiple",
  prompt: "",
  choices: [],
  explanation: null,
  correctAnswerStatement: null,
  figures: [],
  region: { top: 0, bottom: 100 },
  confidence: "high",
  issues: [],
  ...fields,
});

const choice = (label: string, text: string, correct = false) => ({ label, text, correct, explanation: null });

describe("Moodle correction matching", () => {
  it("matches LaTeX choices against a plain text statement", () => {
    const choices = [
      { text: "Une zone $\\delta+$ est susceptible de réagir avec un nucléophile", correct: true },
      { text: "Les nucléophiles aiment les charges négatives", correct: false },
      { text: "La cyclisation donne les anomères $\\alpha$ et $\\beta$", correct: true },
      { text: "Le groupement $\\ce{CH2OH}$ est en haut", correct: true },
    ];
    const statement =
      "Les réponses correctes sont : Une zone δ+ est susceptible de réagir avec un nucléophile, La cyclisation donne les anomères α et β, Le groupement CH2OH est en haut";
    expect(statementDisagrees(choices, statement)).toBe(false);
  });

  it("does not credit a choice only contained in a longer correct one", () => {
    expect(
      choicesNamedInStatement(["Valine", "Valine modifiée", "Proline"], "La réponse correcte est : Valine modifiée"),
    ).toEqual([false, true, false]);
  });

  it("detects disagreement", () => {
    expect(
      statementDisagrees(
        [
          { text: "Tyrosine", correct: true },
          { text: "Valine", correct: false },
        ],
        "La réponse correcte est : Valine",
      ),
    ).toBe(true);
  });
});

describe("assembling segments", () => {
  it("merges a question cut between choices and correction, then re-derives answers", () => {
    const assembled = assembleQuestions([
      {
        segmentIndex: 1,
        extraction: {
          questions: [
            question({
              number: 4,
              prompt: "Cochez",
              choices: [choice("a", "Alpha"), choice("b", "Beta")],
              continuesOnNext: true,
            }),
          ],
        },
      },
      {
        segmentIndex: 0,
        extraction: {
          questions: [
            question({
              number: 3,
              prompt: "Q3",
              choices: [choice("a", "Un", true), choice("b", "Deux")],
              correctAnswerStatement: "La réponse correcte est : Un",
            }),
          ],
        },
      },
      {
        segmentIndex: 2,
        extraction: {
          questions: [
            question({
              continuesFromPrevious: true,
              choices: [choice("c", "Gamma"), choice("d", "Delta")],
              correctAnswerStatement: "Les réponses correctes sont : Alpha, Delta",
            }),
            question({ number: 5, prompt: "Q5", choices: [choice("a", "X", true), choice("b", "Y")] }),
          ],
        },
      },
    ]);
    expect(assembled.map((item) => item.question.number)).toEqual([3, 4, 5]);
    const merged = assembled[1];
    expect(merged?.segments).toEqual([1, 2]);
    expect(merged?.question.choices.map((item) => [item.label, item.correct])).toEqual([
      ["a", true],
      ["b", false],
      ["c", false],
      ["d", true],
    ]);
    expect(reviewAssembledQuestion(merged!)).toEqual(["Question reconstituée sur 2 segments : vérifier la jonction."]);
    expect(reviewAssembledQuestion(assembled[2]!)).toContain(
      "Correction Moodle introuvable : bonnes réponses déduites des marques visuelles.",
    );
  });

  it("flags an orphan continuation and structural problems", () => {
    const [orphan] = assembleQuestions([
      {
        segmentIndex: 0,
        extraction: {
          questions: [
            question({
              continuesFromPrevious: true,
              type: "single",
              choices: [choice("a", "Un", true), choice("a", "Deux", true)],
              correctAnswerStatement: "La réponse correcte est : Un",
              confidence: "low",
            }),
          ],
        },
      },
    ]);
    const issues = reviewAssembledQuestion(orphan!);
    expect(issues).toEqual(
      expect.arrayContaining([
        "Réponse unique attendue, mais 2 bonne(s) réponse(s) cochée(s).",
        "Énoncé vide.",
        "Proposition « a » en double.",
        "Début de question manquant dans le segment précédent.",
        "Lecture incertaine signalée par le modèle.",
      ]),
    );
  });
});

describe("unicode compatibility", () => {
  it("matches superscripts written in Unicode or LaTeX", () => {
    expect(
      statementDisagrees(
        [
          { text: "2 carbones $sp^2$ et 7 carbones $sp^3$", correct: true },
          { text: "4 carbones $sp^2$ et 6 carbones $sp^3$", correct: false },
        ],
        "La réponse correcte est : 2 carbones sp² et 7 carbones sp³",
      ),
    ).toBe(false);
  });
});

describe("LaTeX validation", () => {
  it("accepts KaTeX and mhchem formulas and reports broken ones", async () => {
    const { findInvalidFormulas } = await import("../../server/features/ocr/validate-latex.ts");
    expect(
      findInvalidFormulas([
        "Soit $\\ce{H3O+}$ et $$\\begin{array}{l|c} a & b \\end{array}$$",
        "$3,3.10^{-3}$ $\\text{mol.L}^{-1}$ et $\\delta^+$",
      ]),
    ).toEqual([]);
    expect(findInvalidFormulas(["Cassé : $\\frac{1}{$ et $x^{2$"])).toEqual(["\\frac{1}{", "x^{2"]);
    const katex = (await import("katex")).default;
    const { KATEX_OPTIONS } = await import("@pomkuiz/quiz-contract");
    expect(katex.renderToString("\\href{javascript:alert(1)}{x}", { ...KATEX_OPTIONS })).not.toContain("<a ");
  });
});
