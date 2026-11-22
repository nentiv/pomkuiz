import { useEffect, useState } from "preact/hooks";
import { ID_PATTERN } from "../../../server/config/workspace-layout.ts";

type Route = { name: "imports" } | { name: "review"; importId: string };

const REVIEW_PREFIX = "#/imports/";

function parseRoute(hash: string): Route {
  if (hash.startsWith(REVIEW_PREFIX)) {
    const importId = hash.slice(REVIEW_PREFIX.length);
    if (ID_PATTERN.test(importId)) return { name: "review", importId };
  }
  return { name: "imports" };
}

const href = {
  imports: () => "#/",
  review: (importId: string) => `${REVIEW_PREFIX}${importId}`,
};

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(globalThis.location.hash));
  useEffect(() => {
    const update = () => setRoute(parseRoute(globalThis.location.hash));
    globalThis.addEventListener("hashchange", update);
    return () => globalThis.removeEventListener("hashchange", update);
  }, []);
  return route;
}

export { href, useRoute };
