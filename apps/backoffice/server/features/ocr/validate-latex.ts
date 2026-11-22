import { renderToString } from "katex";
import "katex/contrib/mhchem";
import { KATEX_OPTIONS, tokenizeRichText } from "@pomkuiz/quiz-contract";

function findInvalidFormulas(texts: readonly string[]): string[] {
  const invalid: string[] = [];
  for (const text of texts)
    for (const token of tokenizeRichText(text)) {
      if (token.kind !== "math") continue;
      try {
        renderToString(token.value, { ...KATEX_OPTIONS, throwOnError: true, displayMode: token.display });
      } catch {
        invalid.push(token.value);
      }
    }
  return invalid;
}

export { findInvalidFormulas };
