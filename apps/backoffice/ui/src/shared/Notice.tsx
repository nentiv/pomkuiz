import type { ComponentChildren } from "preact";
import { CircleCheck, TriangleAlert, type LucideIcon } from "@pomkuiz/design-system/icons";
import { Icon, classNames, type Tone } from "@pomkuiz/design-system";

const DEFAULT_ICONS: Partial<Record<Tone, LucideIcon>> = {
  high: CircleCheck,
  low: TriangleAlert,
  medium: TriangleAlert,
};

interface NoticeProps {
  tone: Tone;
  title?: string;
  children?: ComponentChildren;
  alert?: boolean;
}

function Notice({ tone, title, children, alert = false }: NoticeProps) {
  const glyph = DEFAULT_ICONS[tone];
  return (
    <div class={classNames("notice", `tone-${tone}`)} role={alert ? "alert" : undefined}>
      {glyph && <Icon icon={glyph} size="sm" class="notice-icon" />}
      <div class="notice-body">
        {title && <p class="notice-title">{title}</p>}
        {children}
      </div>
    </div>
  );
}

export { Notice };
