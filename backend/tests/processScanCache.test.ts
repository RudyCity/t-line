import { describe, expect, it } from 'vitest';
import { createProcessScanCache } from '../src/processScanCache';

describe('shared PTY process scans', () => {
  it('deduplicates simultaneous and recent same-PID checks', async () => {
    let count = 0;
    const scan = createProcessScanCache(async pid => { count++; return { pid }; });
    const first = scan(123);
    expect(scan(123)).toBe(first);
    expect(await Promise.all([first, scan(123)])).toEqual([{ pid:123 },{pid:123}]);
    expect(count).toBe(1);
    expect(await scan(321)).toEqual({pid:321});
    expect(count).toBe(2);
  });
  it('retries failed scans instead of retaining rejected promise', async () => {
    let count = 0;
    const scan = createProcessScanCache(async () => {
      if (++count === 1) throw new Error('PID ended');
      return count;
    });
    await expect(scan(1)).rejects.toThrow();
    expect(await scan(1)).toBe(2);
  });
});
