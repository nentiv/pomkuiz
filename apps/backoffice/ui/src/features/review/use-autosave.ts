import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import type { DraftContent } from "../../../../server/features/review/draft-types.ts";
import { UI_CONFIG } from "../../ui-config.ts";
import { api, ApiError } from "../../shared/api-client.ts";

type SaveState = "idle" | "pending" | "saving" | "saved" | "error" | "conflict";

const CONFLICT_STATUS = 409;

function useAutosave(importId: string, content: DraftContent, initialRevision: number) {
  const [state, setState] = useState<SaveState>("idle");
  const revision = useRef(initialRevision);
  const saved = useRef(content);
  const latest = useRef(content);
  const inFlight = useRef<Promise<void> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  latest.current = content;

  const flush = useCallback((): Promise<void> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (inFlight.current) return inFlight.current;
    const saveUntilClean = async () => {
      while (latest.current !== saved.current) {
        const snapshot = latest.current;
        setState("saving");
        try {
          const response = await api.saveDraft(importId, revision.current, snapshot);
          revision.current = response.revision;
          saved.current = snapshot;
        } catch (error) {
          setState(error instanceof ApiError && error.status === CONFLICT_STATUS ? "conflict" : "error");
          return;
        }
      }
      setState("saved");
    };
    const run = saveUntilClean().finally(() => {
      inFlight.current = null;
    });
    inFlight.current = run;
    return run;
  }, [importId]);

  useEffect(() => {
    if (content === saved.current) return;
    setState((current) => (current === "conflict" ? current : "pending"));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), UI_CONFIG.autosaveDelayMs);
  }, [content, flush]);

  useEffect(() => {
    if (state !== "saved") return;
    const reset = setTimeout(() => setState("idle"), UI_CONFIG.savedBadgeMs);
    return () => clearTimeout(reset);
  }, [state]);

  useEffect(() => {
    const beforeUnload = () => {
      if (latest.current !== saved.current) void api.saveDraft(importId, revision.current, latest.current, true);
    };
    globalThis.addEventListener("beforeunload", beforeUnload);
    return () => {
      globalThis.removeEventListener("beforeunload", beforeUnload);
      void flush();
    };
  }, [importId, flush]);

  return { state, flush, isDirty: () => latest.current !== saved.current };
}

export { useAutosave };
