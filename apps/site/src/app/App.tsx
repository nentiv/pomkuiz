import { HomePage } from "../features/quiz-list/HomePage.tsx";
import { QuizPage } from "../features/quiz-session/QuizPage.tsx";
import { SessionPage } from "../features/quiz-session/SessionPage.tsx";
import { ResultsPage } from "../features/results/ResultsPage.tsx";
import { ThemeSwitcher } from "../features/settings/ThemeSwitcher.tsx";
import { MESSAGES } from "../shared/i18n/messages-fr.ts";
import { EmptyState } from "@pomkuiz/design-system";
import { TriangleAlert } from "@pomkuiz/design-system/icons";
import { PreferencesProvider } from "./PreferencesProvider.tsx";
import { href, useRoute, type Route } from "./hash-router.ts";
import "./app-layout.css";

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case "list":
      return <HomePage />;
    case "quiz":
      return <QuizPage key={route.quizId} quizId={route.quizId} />;
    case "play":
      return <SessionPage key={route.quizId} quizId={route.quizId} />;
    case "results":
      return (
        <ResultsPage key={`${route.quizId}-${route.attemptId}`} quizId={route.quizId} attemptId={route.attemptId} />
      );
    default:
      return <EmptyState icon={TriangleAlert} title={MESSAGES.quiz.notFound} />;
  }
}

function App() {
  const route = useRoute();
  return (
    <PreferencesProvider>
      <a class="skip-link" href="#main">
        {MESSAGES.skipToContent}
      </a>
      <header class="app-bar">
        <a class="brand" href={href.list()}>
          <span class="brand-mark" aria-hidden="true" />
          <span>{MESSAGES.appName}</span>
        </a>
        <ThemeSwitcher />
      </header>
      <main id="main" class={route.name === "play" ? "app-main app-main-focus" : "app-main"} tabIndex={-1}>
        <Page route={route} />
      </main>
    </PreferencesProvider>
  );
}

export { App };
