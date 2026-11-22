import { describe, expect, it } from "vitest";
import {
  dateFromPdfMetadata,
  defaultQuizTitle,
  detectTitleDate,
} from "../../server/features/review/default-quiz-title.ts";

const IMPORTED_AT = "2026-11-22T09:30:00.000Z";
const MAX = 200;

describe("default quiz title", () => {
  it.each([
    ["Colle d'UE3 - 21 Septembre 2026.pdf", "2026-09-21 Colle d'UE3"],
    ["TD chimie 1er mars 2025.pdf", "2025-03-01 TD chimie"],
    ["QCM_biochimie 03.02.2026.pdf", "2026-02-03 QCM_biochimie"],
    ["Partiel 2026-01-15 physique.pdf", "2026-01-15 Partiel physique"],
    ["Colle 5 février 2026 – UE1.pdf", "2026-02-05 Colle UE1"],
    ["2026-09-21 Colle déjà datée.pdf", "2026-09-21 Colle déjà datée"],
  ])("dates %s", (originalName, expected) => {
    expect(defaultQuizTitle({ originalName, importedAt: IMPORTED_AT, maxCharacters: MAX })).toBe(expected);
  });

  it("falls back to the PDF creation date then to the import date", () => {
    expect(
      defaultQuizTitle({
        originalName: "Colle UE3.pdf",
        importedAt: IMPORTED_AT,
        pdfCreationDate: "D:20260921101500+02'00'",
        maxCharacters: MAX,
      }),
    ).toBe("2026-09-21 Colle UE3");
    expect(defaultQuizTitle({ originalName: "Colle UE3.pdf", importedAt: IMPORTED_AT, maxCharacters: MAX })).toMatch(
      /^2026-11-2\d Colle UE3$/,
    );
  });

  it("ignores impossible dates and unknown months", () => {
    expect(detectTitleDate("Colle 31 février 2026")).toBeNull();
    expect(detectTitleDate("Colle 12 brumaire 2026")).toBeNull();
    expect(detectTitleDate("Colle 32/01/2026")).toBeNull();
    expect(dateFromPdfMetadata("D:20261340")).toBeNull();
    expect(dateFromPdfMetadata("")).toBeNull();
  });
});
