type RichTextToken = { kind: "text"; value: string } | { kind: "math"; value: string; display: boolean };

const DOLLAR = "$";
const DISPLAY_DELIMITER = "$$";
const BACKSLASH = "\\";
const PARAGRAPH_BREAK = /\n\s*\n/;
const WHITESPACE = /\s/;
const DIGIT = /\d/;

function isEscaped(source: string, index: number): boolean {
  let backslashes = 0;
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === BACKSLASH; cursor -= 1) backslashes += 1;
  return backslashes % 2 === 1;
}

function findClosing(source: string, delimiter: string, from: number): number {
  let index = source.indexOf(delimiter, from);
  while (index !== -1 && isEscaped(source, index)) index = source.indexOf(delimiter, index + 1);
  return index;
}

function findInlineClosing(source: string, from: number): number {
  let index = findClosing(source, DOLLAR, from);
  while (index !== -1) {
    const before = source[index - 1] ?? "";
    const after = source[index + 1] ?? "";
    if (after === DOLLAR) return -1;
    if (!WHITESPACE.test(before) && !DIGIT.test(after)) return index;
    index = findClosing(source, DOLLAR, index + 1);
  }
  return -1;
}

function pushText(tokens: RichTextToken[], value: string): void {
  if (!value) return;
  const last = tokens.at(-1);
  if (last?.kind === "text") last.value += value;
  else tokens.push({ kind: "text", value });
}

function readDisplayMath(source: string, start: number) {
  const end = findClosing(source, DISPLAY_DELIMITER, start + DISPLAY_DELIMITER.length);
  if (end === -1) return null;
  const value = source.slice(start + DISPLAY_DELIMITER.length, end).trim();
  if (!value) return null;
  return { value, next: end + DISPLAY_DELIMITER.length };
}

function readInlineMath(source: string, start: number) {
  const first = source[start + 1] ?? "";
  if (!first || WHITESPACE.test(first)) return null;
  const end = findInlineClosing(source, start + 1);
  if (end === -1) return null;
  const value = source.slice(start + 1, end);
  if (PARAGRAPH_BREAK.test(value)) return null;
  return { value, next: end + 1 };
}

function tokenizeRichText(source: string): RichTextToken[] {
  const tokens: RichTextToken[] = [];
  let index = 0;
  while (index < source.length) {
    const character = source[index] ?? "";
    if (character === BACKSLASH && source[index + 1] === DOLLAR) {
      pushText(tokens, DOLLAR);
      index += 2;
      continue;
    }
    if (character !== DOLLAR) {
      pushText(tokens, character);
      index += 1;
      continue;
    }
    const isDisplay = source.startsWith(DISPLAY_DELIMITER, index);
    const math = isDisplay ? readDisplayMath(source, index) : readInlineMath(source, index);
    if (!math) {
      pushText(tokens, isDisplay ? DISPLAY_DELIMITER : DOLLAR);
      index += isDisplay ? DISPLAY_DELIMITER.length : 1;
      continue;
    }
    tokens.push({ kind: "math", value: math.value, display: isDisplay });
    index = math.next;
  }
  return tokens;
}

function toPlainText(source: string): string {
  return tokenizeRichText(source)
    .map((token) => token.value)
    .join("");
}

function hasMath(source: string): boolean {
  return tokenizeRichText(source).some((token) => token.kind === "math");
}

export { tokenizeRichText, toPlainText, hasMath };
