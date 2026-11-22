const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const INVISIBLE_CHARACTERS = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;
const LINE_ENDINGS = /\r\n?/g;
const TRAILING_SPACES = /[ \t]+\n/g;
const EXTRA_BLANK_LINES = /\n{3,}/g;
const INNER_SPACE_RUNS = / {2,}/g;
const TEMPLATE_FIELD = /\{(\w+)\}/g;
const LINE_BREAK = "\n";
const PARAGRAPH_BREAK = "\n\n";

function cleanMultiline(value: string, maxCharacters: number): string {
  return value
    .normalize("NFC")
    .replace(LINE_ENDINGS, LINE_BREAK)
    .replace(CONTROL_CHARACTERS, "")
    .replace(INVISIBLE_CHARACTERS, "")
    .replace(INNER_SPACE_RUNS, " ")
    .replace(TRAILING_SPACES, LINE_BREAK)
    .replace(EXTRA_BLANK_LINES, PARAGRAPH_BREAK)
    .trim()
    .slice(0, maxCharacters);
}

function cleanSingleLine(value: string, maxCharacters: number): string {
  return cleanMultiline(value, Number.POSITIVE_INFINITY)
    .replaceAll(LINE_BREAK, " ")
    .replace(INNER_SPACE_RUNS, " ")
    .trim()
    .slice(0, maxCharacters);
}

function fillTemplate(template: string, values: Readonly<Record<string, string | number>>): string {
  return template.replace(TEMPLATE_FIELD, (match, key: string) =>
    Object.hasOwn(values, key) ? String(values[key]) : match,
  );
}

export { cleanMultiline, cleanSingleLine, fillTemplate };
