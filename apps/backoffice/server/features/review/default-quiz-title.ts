import { basename, extname } from "node:path";
import { formatQuizTitle, isCalendarDate, parseQuizTitle } from "@pomkuiz/quiz-contract";
import { TITLE_DATES } from "../../config/title-dates.ts";
import { calendarDate, localDate } from "../../shared/local-date.ts";
import { cleanSingleLine } from "../../shared/text-cleaning.ts";

interface DetectedDate {
  iso: string;
  text: string;
}

const DIACRITICS = /\p{Diacritic}/gu;

const monthNumber = (word: string): number | undefined =>
  TITLE_DATES.months[word.normalize("NFD").replace(DIACRITICS, "").toLowerCase()];

function validDate(year: number, month: number | undefined, day: number, text: string): DetectedDate | null {
  if (!month) return null;
  const iso = calendarDate(year, month, day);
  return isCalendarDate(iso) ? { iso, text } : null;
}

function detectTitleDate(value: string): DetectedDate | null {
  const iso = TITLE_DATES.isoPattern.exec(value);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]), Number(iso[3]), iso[0]);
  const textual = TITLE_DATES.textualPattern.exec(value);
  if (textual) return validDate(Number(textual[3]), monthNumber(textual[2] ?? ""), Number(textual[1]), textual[0]);
  const numeric = TITLE_DATES.numericPattern.exec(value);
  if (numeric) return validDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]), numeric[0]);
  return null;
}

function dateFromPdfMetadata(raw: string | undefined): string | null {
  const match = raw ? TITLE_DATES.pdfDatePattern.exec(raw) : null;
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
  return isCalendarDate(iso) ? iso : null;
}

function cleanName(value: string): string {
  return value
    .replace(TITLE_DATES.innerSeparators, " ")
    .replace(TITLE_DATES.spaceRuns, " ")
    .replace(TITLE_DATES.edgeSeparators, "");
}

interface TitleSource {
  originalName: string;
  importedAt: string;
  pdfCreationDate?: string;
  maxCharacters: number;
}

function defaultQuizTitle({ originalName, importedAt, pdfCreationDate, maxCharacters }: TitleSource): string {
  const base = cleanSingleLine(basename(originalName, extname(originalName)), maxCharacters);
  const existing = parseQuizTitle(base);
  if (existing.date) return base;
  const detected = detectTitleDate(base);
  const name = cleanName(detected ? base.replace(detected.text, " ") : base) || base;
  const date = detected?.iso ?? dateFromPdfMetadata(pdfCreationDate) ?? localDate(new Date(importedAt));
  return cleanSingleLine(formatQuizTitle(date, name), maxCharacters);
}

export { dateFromPdfMetadata, defaultQuizTitle, detectTitleDate };
