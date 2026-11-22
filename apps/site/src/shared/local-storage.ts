interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStorage(): KeyValueStorage | null {
  try {
    const storage = globalThis.localStorage;
    const probe = "__pomkuiz_probe__";
    storage.setItem(probe, probe);
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

function readJson(storage: KeyValueStorage | null, key: string): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

function writeJson(storage: KeyValueStorage | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export { browserStorage, readJson, writeJson };
export type { KeyValueStorage };
