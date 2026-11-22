import { Icon } from "./Icon.tsx";
import type { LucideIcon } from "./icons.ts";
import "./switch.css";

interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: LucideIcon;
}

function Switch({ label, description, checked, onChange, icon }: SwitchProps) {
  return (
    <label class="switch">
      <span class="switch-text">
        {icon && <Icon icon={icon} size="sm" class="switch-icon" />}
        <span class="switch-copy">
          <span class="switch-label">{label}</span>
          {description && <span class="switch-description">{description}</span>}
        </span>
      </span>
      <input
        class="switch-input visually-hidden"
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span class="switch-track" aria-hidden="true">
        <span class="switch-thumb" />
      </span>
    </label>
  );
}

export { Switch };
