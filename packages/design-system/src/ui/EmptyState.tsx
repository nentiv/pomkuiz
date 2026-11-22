import type { ComponentChildren } from "preact";
import { Icon } from "./Icon.tsx";
import type { LucideIcon } from "./icons.ts";
import "./empty-state.css";

function EmptyState({ icon, title, children }: { icon: LucideIcon; title: string; children?: ComponentChildren }) {
  return (
    <div class="empty-state">
      <span class="empty-state-icon">
        <Icon icon={icon} size="lg" />
      </span>
      <p class="empty-state-title">{title}</p>
      {children}
    </div>
  );
}

export { EmptyState };
