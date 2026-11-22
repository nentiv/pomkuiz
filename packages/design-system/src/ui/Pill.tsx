import type { ComponentChildren } from "preact";
import { classNames } from "./class-names.ts";
import { Icon } from "./Icon.tsx";
import type { LucideIcon } from "./icons.ts";
import { toneClass, type Tone } from "./tone.ts";
import "./pill.css";

function Pill({ tone = "neutral", icon, children }: { tone?: Tone; icon?: LucideIcon; children: ComponentChildren }) {
  return (
    <span class={classNames("pill", toneClass(tone))}>
      {icon && <Icon icon={icon} size="sm" />}
      {children}
    </span>
  );
}

export { Pill };
