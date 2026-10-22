/**
 * T-Line read-only view of SuperAgent's local browser coordinator.
 * No browser control, no owner token/hash serialization, and no writes.
 */
import { readdir, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = () => process.env.SUPERAGENT_CDP_SESSION_DIR || join(homedir(), '.superagent-r', 'cdp-sessions');
const MAX_ENTRY_BYTES = 16_384;
const MAX_ENTRIES = 256;
type Session = { key: string; agentId: string; targetId: string; port: number; expiresAt: number; claimedAt: number };
const hashFile = /^[a-f0-9]{64}\.json$/;
async function jsonEntry(path: string): Promise<Record<string, unknown> | null> {
  try {
    const size = await stat(path);
    if (!size.isFile() || size.size > MAX_ENTRY_BYTES) return null;
    const value = JSON.parse(await readFile(path, 'utf8'));
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch { return null; }
}
export async function getBrowserAgentSessions(): Promise<{
  ok: boolean; sessions: Session[]; queues: Array<{ resourceKey: string; waiting: number; oldestWaitMs: number; locked: boolean }>;
  summary: { activeAgents: number; activeTabs: number; queued: number; extensionBlocked: boolean };
}> {
  const now = Date.now();
  const sessions: Session[] = [];
  try {
    const names = (await readdir(join(root(), 'owners'))).filter(x => hashFile.test(x)).slice(0, MAX_ENTRIES);
    for (const name of names) {
      const row = await jsonEntry(join(root(), 'owners', name));
      if (!row || row.key !== name.slice(0, -5) || !Number.isFinite(row.expiresAt) ||
          Number(row.expiresAt) <= now || typeof row.agentId !== 'string' ||
          typeof row.targetId !== 'string' || !Number.isSafeInteger(row.port)) continue;
      // Explicit projection. tokenHash, sessionToken, generation, URLs, cookies and titles are NEVER returned.
      sessions.push({
        key: row.key, agentId: row.agentId, targetId: row.targetId,
        port: Number(row.port), expiresAt: Number(row.expiresAt), claimedAt: Number(row.claimedAt) || now,
      });
    }
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }
  const queues: Array<{ resourceKey: string; waiting: number; oldestWaitMs: number; locked: boolean }> = [];
  try {
    const names = (await readdir(join(root(), 'queues'))).filter(x => /^[a-f0-9]{64}$/.test(x)).slice(0, MAX_ENTRIES);
    for (const key of names) {
      let waiting = 0;
      let oldest = now;
      for (const item of (await readdir(join(root(), 'queues', key))).filter(x => /^[\w-]+\.json$/.test(x)).slice(0, MAX_ENTRIES)) {
        const row = await jsonEntry(join(root(), 'queues', key, item));
        if (row && typeof row.at === 'number' && now - row.at <= 120_000) {
          waiting += 1;
          oldest = Math.min(oldest, row.at);
        }
      }
      const locked = await stat(join(root(), 'locks', key + '.lock')).then(s => s.isDirectory()).catch(() => false);
      if (waiting || locked) queues.push({ resourceKey: key, waiting, oldestWaitMs: waiting ? Math.max(0, now - oldest) : 0, locked });
    }
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  }
  return {
    ok: true,
    sessions,
    queues,
    summary: {
      activeAgents: new Set(sessions.map(s => s.agentId)).size,
      activeTabs: sessions.length,
      queued: queues.reduce((sum, q) => sum + q.waiting, 0),
      extensionBlocked: sessions.length > 0,
    },
  };
}
