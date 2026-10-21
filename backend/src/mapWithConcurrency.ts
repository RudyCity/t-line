/** Keeps expensive Git status/worktree probes below the process-spawn saturation point. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  map: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(items.length, Math.max(1, Math.floor(concurrency) || 1)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await map(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
