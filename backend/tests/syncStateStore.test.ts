import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createSyncStateStore } from '../src/syncStateStore';

describe('asynchronous atomic UI sync persistence', () => {
  it('serializes simultaneous updates in order and reads the latest state', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'tline-state-'));
    try {
      const file = join(dir, 'sync.json');
      const store = createSyncStateStore(file);
      expect(await store.read()).toBeNull();
      const results = await Promise.all([store.save({ tabs: [1] }), store.save({ tabs: [2] })]);
      expect(results).toEqual([true, true]);
      expect(await store.read()).toEqual({ tabs: [2] });
      expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({ tabs: [2] });
      expect(await store.save({ tabs: [2] })).toBe(false);
      const { readdir } = await import('node:fs/promises');
      expect(await readdir(dir)).toEqual(['sync.json']);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
