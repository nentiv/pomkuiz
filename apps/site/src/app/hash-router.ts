import { useEffect, useState } from "preact/hooks";

type Route =
  | { name: "list" }
  | { name: "quiz"; quizId: string }
  | { name: "play"; quizId: string }
  | { name: "results"; quizId: string; attemptId: string }
  | { name: "not-found" };

const HASH_PREFIX = "#/";
const SEGMENT = "([a-z0-9-]+)";
const PATTERNS: readonly { pattern: RegExp; build: (match: RegExpExecArray) => Route }[] = [
  { pattern: /^$/, build: () => ({ name: "list" }) },
  { pattern: new RegExp(`^quiz/${SEGMENT}$`), build: (match) => ({ name: "quiz", quizId: match[1] ?? "" }) },
  { pattern: new RegExp(`^quiz/${SEGMENT}/play$`), build: (match) => ({ name: "play", quizId: match[1] ?? "" }) },
  {
    pattern: new RegExp(`^quiz/${SEGMENT}/results/${SEGMENT}$`),
    build: (match) => ({ name: "results", quizId: match[1] ?? "", attemptId: match[2] ?? "" }),
  },
];

function parseHash(hash: string): Route {
  const path = hash.startsWith(HASH_PREFIX) ? hash.slice(HASH_PREFIX.length) : hash.replace(/^#/, "");
  for (const { pattern, build } of PATTERNS) {
    const match = pattern.exec(path);
    if (match) return build(match);
  }
  return { name: "not-found" };
}

const href = {
  list: () => HASH_PREFIX,
  quiz: (quizId: string) => `${HASH_PREFIX}quiz/${quizId}`,
  play: (quizId: string) => `${HASH_PREFIX}quiz/${quizId}/play`,
  results: (quizId: string, attemptId: string) => `${HASH_PREFIX}quiz/${quizId}/results/${attemptId}`,
};

function navigate(target: string): void {
  if (globalThis.location.hash !== target) globalThis.location.hash = target;
}

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(globalThis.location.hash));
  useEffect(() => {
    const update = () => setRoute(parseHash(globalThis.location.hash));
    globalThis.addEventListener("hashchange", update);
    return () => globalThis.removeEventListener("hashchange", update);
  }, []);
  return route;
}

export { parseHash, href, navigate, useRoute };
export type { Route };
