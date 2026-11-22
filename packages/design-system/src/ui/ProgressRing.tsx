import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import { DESIGN_SETTINGS } from "../design-settings.ts";
import { classNames } from "./class-names.ts";
import { toneClass, type Tone } from "./tone.ts";
import "./progress.css";

interface ProgressRingProps {
  value: number;
  max: number;
  label: string;
  tone?: Tone;
  size?: "md" | "lg";
  children?: ComponentChildren;
}

const CENTER = DESIGN_SETTINGS.ringViewBox / 2;
const CIRCUMFERENCE = 2 * Math.PI * DESIGN_SETTINGS.ringRadius;

const progressRatio = (value: number, max: number): number => (max > 0 ? Math.min(1, Math.max(0, value / max)) : 0);

function ProgressRing({ value, max, label, tone = "accent", size = "md", children }: ProgressRingProps) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  const ratio = drawn ? progressRatio(value, max) : 0;
  return (
    <div class={classNames("ring", `ring-${size}`, toneClass(tone))}>
      <span class="visually-hidden">{label}</span>
      <svg viewBox={`0 0 ${DESIGN_SETTINGS.ringViewBox} ${DESIGN_SETTINGS.ringViewBox}`} aria-hidden="true">
        <circle class="ring-track" cx={CENTER} cy={CENTER} r={DESIGN_SETTINGS.ringRadius} />
        <circle
          class="ring-value"
          cx={CENTER}
          cy={CENTER}
          r={DESIGN_SETTINGS.ringRadius}
          style={{ strokeDasharray: `${CIRCUMFERENCE}`, strokeDashoffset: `${CIRCUMFERENCE * (1 - ratio)}` }}
        />
      </svg>
      {children && (
        <div class="ring-center" aria-hidden="true">
          {children}
        </div>
      )}
    </div>
  );
}

export { ProgressRing };
