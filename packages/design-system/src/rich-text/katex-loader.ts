import type katex from "katex";

type KatexRenderer = typeof katex;

let pending: Promise<KatexRenderer> | null = null;

function loadKatex(): Promise<KatexRenderer> {
  pending ??= Promise.all([import("katex"), import("katex/dist/katex.min.css")]).then(async ([module]) => {
    await import("katex/contrib/mhchem");
    return module.default;
  });
  return pending;
}

export { loadKatex };
