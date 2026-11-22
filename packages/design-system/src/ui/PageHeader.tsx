import type { ComponentChildren } from "preact";
import { Icon } from "./Icon.tsx";
import { ArrowLeft } from "./icons.ts";
import "./page-header.css";

interface PageHeaderProps {
  titleId: string;
  title: ComponentChildren;
  eyebrow?: ComponentChildren;
  meta?: ComponentChildren;
  back?: { href: string; label: string };
  actions?: ComponentChildren;
}

function PageHeader({ titleId, title, eyebrow, meta, back, actions }: PageHeaderProps) {
  return (
    <header class="page-header">
      {back && (
        <a class="page-back" href={back.href}>
          <Icon icon={ArrowLeft} size="sm" />
          <span>{back.label}</span>
        </a>
      )}
      {eyebrow && <p class="eyebrow">{eyebrow}</p>}
      <div class="page-title-row">
        <h1 id={titleId} class="page-title">
          {title}
        </h1>
        {actions && <div class="page-actions">{actions}</div>}
      </div>
      {meta && <div class="page-meta">{meta}</div>}
    </header>
  );
}

export { PageHeader };
