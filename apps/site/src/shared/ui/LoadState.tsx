import type { ComponentChildren } from "preact";
import type { Loadable } from "../data/quiz-api.ts";
import { MESSAGES } from "../i18n/messages-fr.ts";
import { Button, EmptyState } from "@pomkuiz/design-system";
import { RefreshCw, TriangleAlert } from "@pomkuiz/design-system/icons";
import "./load-state.css";

function LoadState<T>({ value, children }: { value: Loadable<T>; children: (ready: T) => ComponentChildren }) {
  if (value.state === "loading")
    return (
      <output class="loading">
        <span class="loading-dot" aria-hidden="true" />
        <span>{MESSAGES.loading}</span>
      </output>
    );
  if (value.state === "error")
    return (
      <EmptyState icon={TriangleAlert} title={MESSAGES.loadError}>
        <Button variant="secondary" icon={RefreshCw} iconPosition="start" onClick={value.retry}>
          {MESSAGES.retry}
        </Button>
      </EmptyState>
    );
  return <>{children(value.value)}</>;
}

export { LoadState };
