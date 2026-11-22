import { AppError } from "../../shared/app-error.ts";
import { readJsonIfExists, writeJsonAtomic } from "../../shared/safe-file-system.ts";
import { createKeyedSerialQueue } from "../../shared/serial-queue.ts";
import type { ImportStore } from "../upload/import-store.ts";
import type { AssetService } from "./asset-service.ts";
import { listDraftAssets, type Draft } from "./draft-types.ts";
import { validateDraft, validateDraftUpdate } from "./draft-validation.ts";

type DraftStore = ReturnType<typeof createDraftStore>;

function createDraftStore(store: ImportStore, assets: AssetService) {
  const exclusive = createKeyedSerialQueue();

  async function find(importId: string): Promise<Draft | null> {
    const raw = await readJsonIfExists(store.paths.draft(importId));
    return raw === null ? null : validateDraft.assert(raw, "unexpected");
  }

  async function load(importId: string): Promise<Draft> {
    const draft = await find(importId);
    if (!draft) throw new AppError("jobNotReady");
    return draft;
  }

  return {
    find,
    load,
    create(draft: Draft, replace = false) {
      return exclusive(draft.importId, async () => {
        const current = await find(draft.importId);
        if (current && !replace) return current;
        if (current) draft.revision = current.revision + 1;
        await writeJsonAtomic(store.paths.draft(draft.importId), validateDraft.assert(draft, "unexpected"));
        return draft;
      });
    },
    update(importId: string, body: unknown) {
      return exclusive(importId, async () => {
        const update = validateDraftUpdate.assert(body);
        const current = await load(importId);
        if (update.revision !== current.revision) throw new AppError("conflict", "", { revision: current.revision });
        await assets.assertKnown(importId, listDraftAssets(update));
        const next: Draft = {
          ...current,
          meta: update.meta,
          questions: update.questions,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
        };
        await writeJsonAtomic(store.paths.draft(importId), next);
        return next;
      });
    },
    recordExport(importId: string, quizId: string) {
      return exclusive(importId, async () => {
        const current = await load(importId);
        const next: Draft = {
          ...current,
          revision: current.revision + 1,
          updatedAt: new Date().toISOString(),
          lastExport: { quizId, at: new Date().toISOString() },
        };
        await writeJsonAtomic(store.paths.draft(importId), next);
        return next;
      });
    },
  };
}

export { createDraftStore };
export type { DraftStore };
