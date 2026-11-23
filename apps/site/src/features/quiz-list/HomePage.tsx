import { useMemo } from "preact/hooks";
import { usePreferences } from "../../app/PreferencesProvider.tsx";
import type { QuizSummary } from "@pomkuiz/quiz-contract";
import { fetchIndex, useLoadable } from "../../shared/data/quiz-api.ts";
import { MESSAGES } from "../../shared/i18n/messages-fr.ts";
import { EmptyState, PageHeader, RevealListItem, SectionLabel } from "@pomkuiz/design-system";
import { Sparkles } from "@pomkuiz/design-system/icons";
import { LoadState } from "../../shared/ui/LoadState.tsx";
import { Dashboard } from "../dashboard/Dashboard.tsx";
import { computeDashboard } from "../dashboard/dashboard-stats.ts";
import { groupBySection } from "./quiz-sections.ts";
import { QuizRow } from "./QuizRow.tsx";

function Home({ quizzes }: { quizzes: QuizSummary[] }) {
  const { progress } = usePreferences();
  const stats = useMemo(() => computeDashboard(quizzes, progress.load), [quizzes, progress]);
  const sections = useMemo(() => groupBySection(quizzes, MESSAGES.home.otherSection), [quizzes]);
  const questionCount = quizzes.reduce((total, quiz) => total + quiz.questionCount, 0);
  return (
    <div class="page page-enter">
      <PageHeader
        titleId="home-title"
        eyebrow={MESSAGES.home.eyebrow}
        title={MESSAGES.home.title}
        meta={quizzes.length > 0 ? MESSAGES.home.summary(quizzes.length, questionCount) : undefined}
      />
      <Dashboard stats={stats} />
      <section aria-label={MESSAGES.home.label}>
        {quizzes.length === 0 ? (
          <EmptyState icon={Sparkles} title={MESSAGES.home.empty}>
            <p>{MESSAGES.home.emptyHint}</p>
          </EmptyState>
        ) : (
          <div class="quiz-sections">
            {sections.map((section, sectionIndex) => {
              const titleId = `quiz-section-${sectionIndex}`;
              return (
                <section
                  key={section.title ?? titleId}
                  class="quiz-section"
                  aria-labelledby={section.title ? titleId : undefined}
                >
                  {section.title && <SectionLabel id={titleId}>{section.title}</SectionLabel>}
                  <ul class="quiz-rows">
                    {section.quizzes.map((quiz, index) => (
                      <RevealListItem key={quiz.id} index={index}>
                        <QuizRow quiz={quiz} progress={progress.load(quiz.id)} />
                      </RevealListItem>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function HomePage() {
  const index = useLoadable(fetchIndex, "index");
  return <LoadState value={index}>{(data) => <Home quizzes={data.quizzes} />}</LoadState>;
}

export { HomePage };
