import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { clearWorkspaceCache, getWorkspaceInfo } from '../src/gitManager';

let directory: string;
beforeAll(() => {
  directory = fs.mkdtempSync(path.join(os.tmpdir(), 'tline-git-cache-'));
  execFileSync('git', ['init', '-q', directory]);
});
afterAll(() => {
  clearWorkspaceCache();
  if (directory) fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
});

describe('workspace metadata in-flight cache', () => {
  it('deduplicates parallel Git probes and serves cached metadata', async () => {
    clearWorkspaceCache();
    const workspace = { path: directory, name: 'Demo', defaultShell: 'powershell' };
    const first = getWorkspaceInfo(workspace);
    const duplicate = getWorkspaceInfo(workspace);
    expect(duplicate).toBe(first);
    const info = await first;
    expect(info.name).toBe('Demo');
    expect(info.isGit).toBe(true);
    const cached = await getWorkspaceInfo(workspace);
    expect(cached).toBe(info);
  });
  it('clears cached status on invalidation and respects display-name changes', async () => {
    clearWorkspaceCache();
    const ws = { path: directory, name: 'Before' };
    const first = await getWorkspaceInfo(ws);
    const changed = await getWorkspaceInfo({ ...ws, name: 'After' });
    expect(changed.name).toBe('After');
    expect(changed).not.toBe(first);
    clearWorkspaceCache();
    const second = await getWorkspaceInfo(ws);
    expect(second).not.toBe(first);
    expect(second.path).toBe(first.path);
  });
});
