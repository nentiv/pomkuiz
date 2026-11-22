import type { ComponentChildren } from "preact";
import { classNames } from "./class-names.ts";
import { Icon } from "./Icon.tsx";
import type { LucideIcon } from "./icons.ts";
import "./button.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  children?: ComponentChildren;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: "start" | "end";
  href?: string;
  onClick?: (event: MouseEvent) => void;
  disabled?: boolean;
  label?: string;
  title?: string;
  block?: boolean;
  class?: string;
}

function Button({
  children,
  variant = "secondary",
  size = "md",
  icon,
  iconPosition = "end",
  href,
  onClick,
  disabled,
  label,
  title,
  block = false,
  class: className,
}: ButtonProps) {
  const iconOnly = children === undefined || children === null || children === false;
  const classes = classNames(
    "btn",
    `btn-${variant}`,
    `btn-${size}`,
    iconOnly && "btn-icon-only",
    block && "btn-block",
    className,
  );
  const glyph = icon ? (
    <Icon icon={icon} size={size === "lg" ? "md" : "sm"} class={iconPosition === "end" ? "btn-trailing" : undefined} />
  ) : null;
  const content = (
    <>
      {iconPosition === "start" && glyph}
      {!iconOnly && <span class="btn-label">{children}</span>}
      {iconPosition === "end" && glyph}
    </>
  );
  if (href && !disabled)
    return (
      <a class={classes} href={href} aria-label={label} title={title ?? label}>
        {content}
      </a>
    );
  return (
    <button
      type="button"
      class={classes}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={title ?? label}
    >
      {content}
    </button>
  );
}

export { Button };
