import { useEffect, useRef, useState } from "preact/hooks";
import { APP_CONFIG } from "../config/app-config.ts";
import { DATA_LAYOUT, quizAssetPath, quizFilePath, isSlug, type Quiz, type QuizIndex } from "@pomkuiz/quiz-contract";

const cache = new Map<string, Promise<unknown>>();

const dataUrl = (path: string) => `./${APP_CONFIG.dataDirectory}/${path}`;

const assetUrl = (quizId: string, assetPath: string) => dataUrl(quizAssetPath(quizId, assetPath));

function fetchJson<T>(path: string): Promise<T> {
  const cached = cache.get(path);
  if (cached) return cached as Promise<T>;
  const request = fetch(dataUrl(path), { credentials: "same-origin" }).then(async (response) => {
    if (!response.ok) throw new Error(String(response.status));
    return (await response.json()) as T;
  });
  request.catch(() => cache.delete(path));
  cache.set(path, request);
  return request;
}

const fetchIndex = () => fetchJson<QuizIndex>(DATA_LAYOUT.indexFile);

function fetchQuiz(quizId: string): Promise<Quiz> {
  if (!isSlug(quizId)) return Promise.reject(new Error("invalid id"));
  return fetchJson<Quiz>(quizFilePath(quizId));
}

type Loadable<T> = { state: "loading" } | { state: "error"; retry: () => void } | { state: "ready"; value: T };

function useLoadable<T>(load: () => Promise<T>, key: string): Loadable<T> {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Loadable<T>>({ state: "loading" });
  const loader = useRef(load);
  loader.current = load;
  useEffect(() => {
    let active = true;
    setResult({ state: "loading" });
    const retry = () => {
      cache.clear();
      setAttempt((value) => value + 1);
    };
    const run = async () => {
      try {
        const value = await loader.current();
        if (active) setResult({ state: "ready", value });
      } catch {
        if (active) setResult({ state: "error", retry });
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [key, attempt]);
  return result;
}

export { assetUrl, fetchIndex, fetchQuiz, useLoadable };
export type { Loadable };
