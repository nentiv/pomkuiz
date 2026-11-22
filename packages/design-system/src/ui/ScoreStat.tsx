import type { ComponentChildren } from "preact";
import { classNames } from "./class-names.ts";
import { toneClass, type Tone } from "./tone.ts";
import "./score-stat.css";

interface ScoreStatProps {
  label: string;
  value: string;
  tone?: Tone;
  hint?: ComponentChildren;
}

function ScoreStat({ label, value, tone = "neutral", hint }: ScoreStatProps) {
  return (
    <div class={classNames("score-stat", toneClass(tone))}>
      <p class="eyebrow">{label}</p>
      <p class="score-stat-value">{value}</p>
      {hint && <div class="score-stat-hint">{hint}</div>}
    </div>
  );
}

export { ScoreStat };
