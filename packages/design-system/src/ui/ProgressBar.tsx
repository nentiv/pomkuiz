import { classNames } from "./class-names.ts";
import { toneClass, type Tone } from "./tone.ts";
import "./progress.css";

function ProgressBar({
  value,
  max,
  label,
  tone = "accent",
}: {
  value: number;
  max: number;
  label: string;
  tone?: Tone;
}) {
  return (
    <progress
      class={classNames("bar", toneClass(tone))}
      value={Math.min(value, max)}
      max={Math.max(max, 1)}
      aria-label={label}
    />
  );
}

export { ProgressBar };
