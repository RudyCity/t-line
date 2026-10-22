/**
 * T-Line read-only view of SuperAgent's local browser coordinator.
 * No browser control, no owner token/hash serialization, and no writes.
 */
import { readdir, readFile, stat, open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = () => process.env.SUPERAGENT_CDP_SESSION_DIR || join(homedir(), '.superagent-r', 'cdp-sessions');
const MAX_ENTRY_BYTES = 16_384;
const MAX_ENTRIES = 256;
type Participant = { agentId: string; role: 'owner' | 'observer' | 'contributor' };
type Session = { key: string; agentId: string; targetId: string; port: number; expiresAt: number; claimedAt: number;
  mode: 'isolated' | 'shared'; revision: number; participants: Participant[] };
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
  recentEvents: Array<{ time: string; event: string; actor: string; key: string }>;
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
      // Explicit allowlist projection: NEVER return per-member token hashes or invitations.
      const mode = row.mode === 'shared' ? 'shared' : 'isolated';
      const participants: Participant[] = [{ agentId: row.agentId, role: 'owner' }];
      if (mode === 'shared' && row.members && typeof row.members === 'object' && !Array.isArray(row.members)) {
        for (const [agentId, member] of Object.entries(row.members).slice(0, 12)) {
          if (!/^[a-zA-Z0-9][a-zA-Z0-9_.:@-]{0,95}$/.test(agentId) || !member || typeof member !== 'object') continue;
          const metadata = member as Record<string, unknown>;
          if (typeof metadata.expiresAt === 'number' && metadata.expiresAt <= now) continue;
          const role = metadata.role;
          if (role === 'observer' || role === 'contributor') participants.push({ agentId, role });
        }
      }
      sessions.push({
        key: row.key, agentId: row.agentId, targetId: row.targetId,
        port: Number(row.port), expiresAt: Number(row.expiresAt), claimedAt: Number(row.claimedAt) || now,
        mode, revision: Number.isSafeInteger(row.revision) && Number(row.revision) >= 0 ? Number(row.revision) : 0, participants,
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
  // Bounded tail of append-only audit events; never return untrusted raw event fields.
  const recentEvents: Array<{ time: string; event: string; actor: string; key: string }> = [];
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(join(root(), 'events.jsonl'), 'r');
    const size = (await handle.stat()).size;
    const bytes = Math.min(65536, size);
    const chunk = Buffer.allocUnsafe(bytes);
    await handle.read(chunk, 0, bytes, size - bytes);
    const lines = chunk.toString('utf8').split('\n').slice(bytes === size ? 0 : 1);
    for (const line of lines.slice(-120)) {
      try {
        const event = JSON.parse(line);
        if (typeof event.time !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(event.time) ||
            typeof event.event !== 'string' || !/^[a-z_]{2,36}$/.test(event.event) ||
            typeof event.actor !== 'string' || !/^[a-zA-Z0-9_.:@-]{1,96}$/.test(event.actor) ||
            typeof event.key !== 'string' || !/^[a-f0-9]{16}$/.test(event.key)) continue;
        recentEvents.push({ time: event.time, event: event.event, actor: event.actor, key: event.key });
      } catch { /* a partial final line is normal */ }
    }
  } catch (err: any) {
    if (err?.code !== 'ENOENT') throw err;
  } finally { await handle?.close(); }
  return {
    ok: true,
    sessions,
    queues, recentEvents: recentEvents.slice(-25).reverse(),
    summary: {
      activeAgents: new Set(sessions.flatMap(s => s.participants.map(p => p.agentId))).size,
      activeTabs: sessions.length,
      queued: queues.reduce((sum, q) => sum + q.waiting, 0),
      extensionBlocked: sessions.length > 0,
    },
  };
}
