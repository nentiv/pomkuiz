import { toPlainText } from "@pomkuiz/quiz-contract";
import { LATEX_SYMBOLS } from "../../config/latex-symbols.ts";

const COMPARISON = Object.freeze({
  diacritics: /\p{Diacritic}/gu,
  latexCommands: /\\([a-zA-Z]+)/g,
  nonWord: /[^\p{L}\p{N}]+/gu,
  minimumCharacters: 3,
  padding: " ",
});

function comparableText(value: string): string {
  return toPlainText(value)
    .normalize("NFKD")
    .replace(COMPARISON.diacritics, "")
    .replace(COMPARISON.latexCommands, (_match, name: string) =>
      Object.hasOwn(LATEX_SYMBOLS, name) ? (LATEX_SYMBOLS[name] ?? " ") : " ",
    )
    .toLowerCase()
    .replace(COMPARISON.nonWord, " ")
    .trim();
}

function choicesNamedInStatement(choiceTexts: readonly string[], statement: string): (boolean | null)[] {
  let reference = `${COMPARISON.padding}${comparableText(statement)}${COMPARISON.padding}`;
  const keys = choiceTexts.map((text) => comparableText(text));
  const named: (boolean | null)[] = keys.map((key) => (key.length < COMPARISON.minimumCharacters ? null : false));
  const byLength = keys
    .map((key, index) => ({ key, index }))
    .filter(({ key }) => key.length >= COMPARISON.minimumCharacters)
    .toSorted((first, second) => second.key.length - first.key.length);
  for (const { key, index } of byLength) {
    const needle = `${COMPARISON.padding}${key}${COMPARISON.padding}`;
    if (!reference.includes(needle)) continue;
    named[index] = true;
    reference = reference.replaceAll(needle, COMPARISON.padding.repeat(2));
  }
  return named;
}

function statementDisagrees(choices: readonly { text: string; correct: boolean }[], statement: string): boolean {
  const named = choicesNamedInStatement(
    choices.map((choice) => choice.text),
    statement,
  );
  return choices.some((choice, index) => {
    const mention = named[index];
    return mention !== null && mention !== undefined && mention !== choice.correct;
  });
}

function correctFlagsFromStatement(
  choices: readonly { text: string; correct: boolean }[],
  statement: string,
): boolean[] | null {
  const named = choicesNamedInStatement(
    choices.map((choice) => choice.text),
    statement,
  );
  if (!named.some((mention) => mention === true)) return null;
  return choices.map((choice, index) => named[index] ?? choice.correct);
}

export { choicesNamedInStatement, statementDisagrees, correctFlagsFromStatement };
