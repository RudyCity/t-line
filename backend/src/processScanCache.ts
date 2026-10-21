/**
 * Share a short-lived process-tree scan among windows and PTYs pointing at the
 * same PID. In-flight probes are shared; failures never poison future scans.
 */
export function createProcessScanCache<T>(scan: (pid: number) => Promise<T>, ttlMs = 3000) {
  const entries = new Map<number, { until: number; task: Promise<T> }>();
  return (pid: number): Promise<T> => {
    const existing = entries.get(pid);
    if (existing && existing.until > Date.now()) return existing.task;
    if (entries.size >= 512) {
      for (const [key, item] of entries) if (item.until <= Date.now()) entries.delete(key);
      if (entries.size >= 512) entries.delete(entries.keys().next().value!);
    }
    const task = scan(pid).catch(error => {
      if (entries.get(pid)?.task === task) entries.delete(pid);
      throw error;
    });
    entries.set(pid, { task, until: Date.now() + ttlMs });
    return task;
  };
}
