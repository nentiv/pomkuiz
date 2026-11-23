import type { ComponentChildren } from "preact";
import { classNames } from "./class-names.ts";
import { toneClass, type Tone } from "./tone.ts";
import "./score-stat.css";

interface ScoreStatProps {
  label: string;
  value: string;
  tone?: Tone;
  hint?: ComponentChildren;
  action?: ComponentChildren;
}

function ScoreStat({ label, value, tone = "neutral", hint, action }: ScoreStatProps) {
  return (
    <div class={classNames("score-stat", toneClass(tone))}>
      <div class="score-stat-header">
        <p class="eyebrow">{label}</p>
        {action && <div class="score-stat-action">{action}</div>}
      </div>
      <p class="score-stat-value">{value}</p>
      {hint && <div class="score-stat-hint">{hint}</div>}
    </div>
  );
}

export { ScoreStat };
