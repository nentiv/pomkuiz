import { describe, expect, it } from "vitest";
import {
  CONTRACT_LIMITS,
  checkQuestionRules,
  hasMath,
  slugify,
  toPlainText,
  tokenizeRichText,
} from "../src/quiz-contract.ts";
import { CONTRACT_SCHEMAS } from "../src/contract-schemas.ts";

describe("rich text tokenizer", () => {
  it("splits inline and display math", () => {
    expect(tokenizeRichText("Soit $x^2$ et $$\\int f$$ fin")).toEqual([
      { kind: "text", value: "Soit " },
      { kind: "math", value: "x^2", display: false },
      { kind: "text", value: " et " },
      { kind: "math", value: "\\int f", display: true },
      { kind: "text", value: " fin" },
    ]);
  });

  it("keeps escaped and lone dollars as text", () => {
    expect(tokenizeRichText("Prix : 5 \\$ et 10 $ ou 3$")).toEqual([
      { kind: "text", value: "Prix : 5 $ et 10 $ ou 3$" },
    ]);
    expect(tokenizeRichText("de 5$ à 10$")).toEqual([{ kind: "text", value: "de 5$ à 10$" }]);
  });

  it("does not let inline math cross paragraphs", () => {
    expect(hasMath("$a\n\nb$")).toBe(false);
    expect(tokenizeRichText("$\\ce{H3O+}$")).toEqual([{ kind: "math", value: "\\ce{H3O+}", display: false }]);
  });

  it("treats markup as plain text", () => {
    const tokens = tokenizeRichText("<img src=x onerror=alert(1)> $<b>$");
    expect(tokens[0]).toEqual({ kind: "text", value: "<img src=x onerror=alert(1)> " });
    expect(toPlainText("a $b$ c")).toBe("a b c");
  });
});

describe("quiz rules", () => {
  it("slugifies titles", () => {
    expect(slugify("Colle d'UE3 - 21 Septembre 2026")).toBe("colle-d-ue3-21-septembre-2026");
    expect(slugify("  Élément ---  ")).toBe("element");
  });

  it("checks question rules", () => {
    const base = {
      type: "single" as const,
      prompt: "Q",
      choices: [
        { text: "a", correct: true },
        { text: "b", correct: false },
      ],
    };
    expect(checkQuestionRules(base)).toEqual([]);
    expect(checkQuestionRules({ ...base, prompt: " ", choices: [{ text: "", correct: false }] })).toEqual([
      "empty-prompt",
      "too-few-choices",
      "empty-choice",
      "single-needs-one-correct",
    ]);
    expect(
      checkQuestionRules({
        ...base,
        type: "multiple",
        choices: base.choices.map((choice) => ({ ...choice, correct: false })),
      }),
    ).toEqual(["multiple-needs-correct"]);
  });
});

describe("contract limits", () => {
  it("match the published JSON Schema", () => {
    const schema = CONTRACT_SCHEMAS.quiz;
    expect(schema.properties.title.maxLength).toBe(CONTRACT_LIMITS.titleCharacters);
    expect(schema.properties.description.maxLength).toBe(CONTRACT_LIMITS.descriptionCharacters);
    expect(schema.properties.section.maxLength).toBe(CONTRACT_LIMITS.sectionCharacters);
    expect(CONTRACT_SCHEMAS.index.properties.quizzes.items.properties.section.maxLength).toBe(
      CONTRACT_LIMITS.sectionCharacters,
    );
    expect(schema.properties.tags.maxItems).toBe(CONTRACT_LIMITS.maxTags);
    expect(schema.properties.tags.items.maxLength).toBe(CONTRACT_LIMITS.tagCharacters);
    expect(schema.properties.questions.maxItems).toBe(CONTRACT_LIMITS.maxQuestions);
    expect(schema.$defs.slug.maxLength).toBe(CONTRACT_LIMITS.slugCharacters);
    expect(schema.$defs.richText.maxLength).toBe(CONTRACT_LIMITS.richTextCharacters);
    expect(schema.$defs.images.maxItems).toBe(CONTRACT_LIMITS.maxImages);
    expect(schema.$defs.question.properties.choices.minItems).toBe(CONTRACT_LIMITS.minChoices);
    expect(schema.$defs.question.properties.choices.maxItems).toBe(CONTRACT_LIMITS.maxChoices);
  });
});
