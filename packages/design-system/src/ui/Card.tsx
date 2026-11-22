import type { ComponentChildren } from "preact";
import { classNames } from "./class-names.ts";
import { toneClass, type Tone } from "./tone.ts";
import "./card.css";

type CardTone = "glass" | "pastel" | Exclude<Tone, "neutral">;
type CardTag = "div" | "li" | "a";

interface CardProps {
  as?: CardTag;
  href?: string;
  tone?: CardTone;
  padding?: "sm" | "md" | "lg";
  interactive?: boolean;
  class?: string;
  children: ComponentChildren;
}

function Card({
  as = "div",
  href,
  tone = "glass",
  padding = "md",
  interactive = false,
  class: className,
  children,
}: CardProps) {
  const Tag = as as "div";
  const tinted = tone !== "glass" && tone !== "pastel";
  const classes = classNames(
    "card",
    `card-${tinted ? "tinted" : tone}`,
    tinted && toneClass(tone),
    `card-pad-${padding}`,
    interactive && "card-interactive",
    className,
  );
  return (
    <Tag class={classes} {...(as === "a" ? { href } : {})}>
      {children}
    </Tag>
  );
}

export { Card };
