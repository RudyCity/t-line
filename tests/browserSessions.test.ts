import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getBrowserAgentSessions } from '../backend/src/browserSessions';

describe('T-Line read-only SuperAgent browser sessions', () => {
  let dir = '';
  const initial = process.env.SUPERAGENT_CDP_SESSION_DIR;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'tline-cdp-view-'));
    process.env.SUPERAGENT_CDP_SESSION_DIR = dir;
  });
  afterEach(async () => {
    if (initial === undefined) delete process.env.SUPERAGENT_CDP_SESSION_DIR;
    else process.env.SUPERAGENT_CDP_SESSION_DIR = initial;
    await rm(dir, { recursive: true, force: true });
  });
  it('returns an empty dashboard without coordinator state', async () => {
    const result = await getBrowserAgentSessions();
    expect(result.summary.activeTabs).toBe(0);
    expect(result.summary.extensionBlocked).toBe(false);
  });
  it('projects only safe fields and counts waiting operations', async () => {
    const key = 'a'.repeat(64);
    await mkdir(join(dir, 'owners'), { recursive: true });
    await mkdir(join(dir, 'queues', key), { recursive: true });
    await writeFile(join(dir, 'owners', key + '.json'), JSON.stringify({
      key, port: 9222, targetId: 'TAB_A', agentId: 'agent-a',
      claimedAt: Date.now(), expiresAt: Date.now() + 60_000,
      tokenHash: 'SENSITIVE_HASH', sessionToken: 'SENSITIVE_TOKEN', mode: 'shared',
      members: { 'agent-b': { role: 'contributor', tokenHash: 'MEMBER_SECRET', joinedAt: Date.now() } },
      invitations: { leaked: { tokenHash: 'INVITATION_SECRET', agentId: 'agent-c', role: 'observer' } },
    }));
    await writeFile(join(dir, 'queues', key, 'waiter.json'), JSON.stringify({ pid: process.pid, at: Date.now() }));
    const result = await getBrowserAgentSessions();
    expect(result.summary).toMatchObject({ activeAgents: 2, activeTabs: 1, queued: 1, extensionBlocked: true });
    expect(result.sessions[0].targetId).toBe('TAB_A');
    expect(result.sessions[0].mode).toBe('shared');
    expect(result.sessions[0].participants).toEqual([
      { agentId: 'agent-a', role: 'owner' },
      { agentId: 'agent-b', role: 'contributor' },
    ]);
    expect(JSON.stringify(result)).not.toContain('MEMBER_SECRET');
    expect(JSON.stringify(result)).not.toContain('INVITATION_SECRET');
    expect(JSON.stringify(result)).not.toContain('SENSITIVE');
    expect(JSON.stringify(result)).not.toContain('tokenHash');
  });
});
