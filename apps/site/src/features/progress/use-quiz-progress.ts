import { useCallback, useEffect, useState } from "preact/hooks";
import { usePreferences } from "../../app/PreferencesProvider.tsx";
import type { QuizProgress } from "./attempts.ts";

function useQuizProgress(quizId: string) {
  const { progress: store } = usePreferences();
  const [progress, setProgress] = useState<QuizProgress>(() => store.load(quizId));

  useEffect(() => {
    setProgress(store.load(quizId));
    const reload = (event: StorageEvent) => {
      if (event.key?.endsWith(quizId)) setProgress(store.load(quizId));
    };
    globalThis.addEventListener("storage", reload);
    return () => globalThis.removeEventListener("storage", reload);
  }, [store, quizId]);

  const update = useCallback(
    (change: (current: QuizProgress) => QuizProgress) => {
      setProgress((current) => {
        const next = change(current);
        if (next !== current) store.save(quizId, next);
        return next;
      });
    },
    [store, quizId],
  );

  return [progress, update] as const;
}

export { useQuizProgress };
