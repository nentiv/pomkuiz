import { ImportsPage } from "../features/imports/ImportsPage.tsx";
import { ReviewPage } from "../features/review/ReviewPage.tsx";
import { UI_MESSAGES } from "../ui-messages.ts";
import { Pill } from "@pomkuiz/design-system";
import { href, useRoute } from "./hash-router.ts";

function App() {
  const route = useRoute();
  if (route.name === "review")
    return (
      <main class="main-wide">
        <ReviewPage key={route.importId} importId={route.importId} />
      </main>
    );
  return (
    <>
      <header class="app-bar">
        <a class="brand" href={href.imports()}>
          <span class="brand-mark" aria-hidden="true" />
          <span>{UI_MESSAGES.brand}</span>
        </a>
        <Pill tone="accent">{UI_MESSAGES.backoffice}</Pill>
      </header>
      <main class="main">
        <ImportsPage />
      </main>
    </>
  );
}

export { App };
