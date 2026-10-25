import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { resolveAgentChatModeSwitch } from '../agentModeSession';

describe('desktop agent mode isolation', () => {
  it('opens another session when switching mode without modifying the old one', () => {
    expect(resolveAgentChatModeSwitch('single', 'multi')).toEqual({
      mode: 'multi', createSession: true,
    });
    expect(resolveAgentChatModeSwitch('multi', 'single').createSession).toBe(true);
    expect(resolveAgentChatModeSwitch('single', 'single').createSession).toBe(false);
  });

  it('does not terminate the shared runtime when a client switches mode', () => {
    const source = readFileSync(
      path.resolve(process.cwd(), '../backend/src/superAgentBridge.ts'), 'utf8');
    const start = source.indexOf('function ensureSuperAgentServer(');
    const end = source.indexOf('export function startSuperAgentEager(', start);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const ensureFunction = source.slice(start, end);
    expect(ensureFunction).not.toContain('taskkill /pid');
    expect(ensureFunction).not.toContain('autoSuperAgentProcess.kill(');
    expect(ensureFunction).toContain('Execution mode belongs to the /api/init session');
  });
});
