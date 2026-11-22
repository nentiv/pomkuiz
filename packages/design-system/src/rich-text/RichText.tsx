import { useLayoutEffect, useMemo, useRef } from "preact/hooks";
import { KATEX_OPTIONS, tokenizeRichText } from "@pomkuiz/quiz-contract";
import { loadKatex } from "./katex-loader.ts";

interface MathFormulaProps {
  source: string;
  display: boolean;
}

function MathFormula({ source, display }: MathFormulaProps) {
  const host = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const element = host.current;
    if (!element) return;
    element.textContent = source;
    let active = true;
    const draw = async () => {
      try {
        const katex = await loadKatex();
        if (active) katex.render(source, element, { ...KATEX_OPTIONS, displayMode: display });
      } catch {
        if (active) element.textContent = source;
      }
    };
    void draw();
    return () => {
      active = false;
    };
  }, [source, display]);
  return <span ref={host} class={display ? "math math-display" : "math math-inline"} />;
}

interface RichTextProps {
  text: string;
  class?: string;
  id?: string;
}

function RichText({ text, class: className, id }: RichTextProps) {
  const tokens = useMemo(() => tokenizeRichText(text), [text]);
  const classes = ["rich-text", className].filter(Boolean).join(" ");
  const occurrences = new Map<string, number>();
  const content = tokens.map((token) => {
    if (token.kind === "text") return token.value;
    const occurrence = (occurrences.get(token.value) ?? 0) + 1;
    occurrences.set(token.value, occurrence);
    return (
      <MathFormula
        key={`${token.display ? "display" : "inline"}-${occurrence}-${token.value}`}
        source={token.value}
        display={token.display}
      />
    );
  });
  return (
    <div id={id} class={classes}>
      {content}
    </div>
  );
}

export { RichText };
