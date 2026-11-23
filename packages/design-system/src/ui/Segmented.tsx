import { classNames } from "./class-names.ts";
import { Icon } from "./Icon.tsx";
import type { LucideIcon } from "./icons.ts";
import "./segmented.css";

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

interface SegmentedProps<T extends string> {
  name: string;
  legend: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  iconOnly?: boolean;
  hideLegend?: boolean;
  size?: "sm" | "md";
  class?: string;
}

function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
  iconOnly = false,
  hideLegend = false,
  size = "md",
  class: className,
}: SegmentedProps<T>) {
  return (
    <fieldset
      class={classNames("segmented", iconOnly && "segmented-icons", size === "sm" && "segmented-sm", className)}
    >
      <legend class={hideLegend ? "visually-hidden" : "segmented-legend"}>{legend}</legend>
      <div class="segmented-track">
        {options.map((option) => (
          <label key={option.value} class="segmented-option" title={iconOnly ? option.label : undefined}>
            <input
              class="visually-hidden"
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.icon && <Icon icon={option.icon} size="sm" />}
            <span class={iconOnly ? "visually-hidden" : undefined}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export { Segmented };
