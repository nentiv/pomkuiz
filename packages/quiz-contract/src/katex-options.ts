import type { KatexOptions } from "katex";

const KATEX_OPTIONS: Readonly<KatexOptions> = Object.freeze({
  throwOnError: false,
  trust: false,
  strict: "ignore",
  output: "htmlAndMathml",
  maxSize: 20,
  maxExpand: 1000,
  globalGroup: false,
});

export { KATEX_OPTIONS };
