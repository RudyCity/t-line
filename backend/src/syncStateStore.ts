import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';

/** Ordered, atomic persistence; avoids blocking the server event loop with large JSON.
 * Each write must finish before its own acknowledgement/broadcast.
 */
export function createSyncStateStore(filePath: string) {
  let pending: Promise<void> = Promise.resolve();
  let lastPersisted: string | null = null;
  let sequence = 0;

  return {
    async read(): Promise<unknown | null> {
      await pending;
      try {
        return JSON.parse(await fs.readFile(filePath, 'utf8'));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
        throw error;
      }
    },
    save(state: unknown): Promise<boolean> {
      const serialized = JSON.stringify(state);
      const task = pending.then(async () => {
        if (serialized === lastPersisted) return false;
        await fs.mkdir(dirname(filePath), { recursive: true });
        const tmp = filePath + '.tmp-' + process.pid + '-' + ++sequence;
        try {
          await fs.writeFile(tmp, serialized, { encoding: 'utf8', flag: 'wx' });
          await fs.rename(tmp, filePath);
          lastPersisted = serialized;
        } catch (error) {
          await fs.unlink(tmp).catch(() => undefined);
          throw error;
        }
        return true;
      });
      // A failed write does not permanently poison future saves.
      pending = task.then(() => undefined, () => undefined);
      return task;
    }
  };
}
