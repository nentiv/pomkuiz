import { APP_CONFIG, type ScoreScale } from "./config/app-config.ts";
import { parseQuizTitle } from "@pomkuiz/quiz-contract";

const pointFormat = new Intl.NumberFormat(APP_CONFIG.locale, { maximumFractionDigits: APP_CONFIG.pointDigits });
const percentFormat = new Intl.NumberFormat(APP_CONFIG.locale, {
  style: "percent",
  maximumFractionDigits: APP_CONFIG.percentDigits,
});
const shortDateFormat = new Intl.DateTimeFormat(APP_CONFIG.locale, {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});
const dateTimeFormat = new Intl.DateTimeFormat(APP_CONFIG.locale, { dateStyle: "medium", timeStyle: "short" });

const formatScore = (points: number, max: number) => `${pointFormat.format(points)}/${max}`;
const formatPercent = (points: number, max: number) => percentFormat.format(max > 0 ? points / max : 0);
const toGrade = (points: number, max: number) => (max > 0 ? (points / max) * APP_CONFIG.gradeMax : 0);
const formatGradeValue = (points: number, max: number, scale: ScoreScale) =>
  scale === "percent" ? formatPercent(points, max) : pointFormat.format(toGrade(points, max));
const formatGrade = (points: number, max: number, scale: ScoreScale) =>
  scale === "percent" ? formatPercent(points, max) : formatScore(toGrade(points, max), APP_CONFIG.gradeMax);
const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso));
const choiceLetter = (index: number) => String.fromCodePoint("A".codePointAt(0)! + index);

interface TitleParts {
  name: string;
  date: { iso: string; label: string } | null;
}

function splitTitleDate(title: string): TitleParts {
  const { name, date } = parseQuizTitle(title);
  if (!date) return { name, date: null };
  return { name, date: { iso: date, label: shortDateFormat.format(new Date(`${date}T00:00:00Z`)) } };
}

export { formatScore, formatPercent, formatGrade, formatGradeValue, formatDateTime, choiceLetter, splitTitleDate };
