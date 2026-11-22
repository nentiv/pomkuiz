import type { ComponentChildren } from "preact";
import "./section-label.css";

interface SectionLabelProps {
  id?: string;
  children: ComponentChildren;
  action?: ComponentChildren;
}

function SectionLabel({ id, children, action }: SectionLabelProps) {
  return (
    <div class="section-label-row">
      <h2 id={id} class="section-label">
        {children}
      </h2>
      {action}
    </div>
  );
}

export { SectionLabel };
