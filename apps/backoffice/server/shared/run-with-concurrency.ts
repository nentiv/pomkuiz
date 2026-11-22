async function runWithConcurrency<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  let cursor = 0;
  const next = async (): Promise<void> => {
    while (cursor < items.length) {
      if (signal?.aborted) return;
      const item = items[cursor] as T;
      cursor += 1;
      await worker(item);
    }
  };
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, next);
  await Promise.all(lanes);
}

export { runWithConcurrency };
