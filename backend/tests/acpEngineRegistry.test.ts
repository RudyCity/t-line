import { describe, expect, it } from 'vitest';
import { listAcpEngines, getAcpEngine } from '../src/acpEngineRegistry';

describe('AcpEngineRegistry - Multi-Engine Discovery', () => {
  it('lists all registered ACP engines', () => {
    const engines = listAcpEngines();
    expect(engines.length).toBeGreaterThanOrEqual(3);

    const ids = engines.map((e) => e.id);
    expect(ids).toContain('superagent');
    expect(ids).toContain('antigravity');
    expect(ids).toContain('codex');
  });

  it('retrieves Antigravity profile with large-context capability', () => {
    const antigravity = getAcpEngine('antigravity');
    expect(antigravity.name).toContain('Antigravity');
    expect(antigravity.capabilities).toContain('massive-context');
  });

  it('retrieves Codex profile with refactoring capability', () => {
    const codex = getAcpEngine('codex');
    expect(codex.name).toContain('Codex');
    expect(codex.capabilities).toContain('code-review');
  });

  it('falls back to Superagent when unknown engine is requested', () => {
    const fallback = getAcpEngine('unknown_engine_xyz');
    expect(fallback.id).toBe('superagent');
  });
});
