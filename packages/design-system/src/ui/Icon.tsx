import { DESIGN_SETTINGS } from "../design-settings.ts";
import { classNames } from "./class-names.ts";
import type { LucideIcon } from "./icons.ts";
import "./icon.css";

type IconSize = "sm" | "md" | "lg";

interface IconProps {
  icon: LucideIcon;
  size?: IconSize;
  label?: string;
  class?: string;
}

function Icon({ icon: Glyph, size = "md", label, class: className }: IconProps) {
  return (
    <Glyph
      class={classNames("icon", `icon-${size}`, className)}
      strokeWidth={DESIGN_SETTINGS.iconStroke}
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
      role={label ? "img" : undefined}
      focusable="false"
    />
  );
}

export { Icon };
