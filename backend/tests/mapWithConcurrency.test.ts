import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '../src/mapWithConcurrency';

describe('bounded parallel Git probes', () => {
  it('keeps original ordering while capping in-flight processes', async () => {
    let active = 0;
    let maxActive = 0;
    const results = await mapWithConcurrency([0, 1, 2, 3, 4, 5, 6], 2, async item => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, item % 2 ? 2 : 8));
      active--;
      return item * 10;
    });
    expect(results).toEqual([0, 10, 20, 30, 40, 50, 60]);
    expect(maxActive).toBeLessThanOrEqual(2);
    expect(maxActive).toBeGreaterThan(1);
  });
  it('returns empty data for no workspaces', async () => {
    expect(await mapWithConcurrency([], 4, async (x: number) => x)).toEqual([]);
  });
  it('propagates Git failure rather than returning a partial success', async () => {
    await expect(mapWithConcurrency([0, 1], 2, async n => {
      if (n === 1) throw new Error('Git not available');
      return n;
    })).rejects.toThrow('Git not available');
  });
});
