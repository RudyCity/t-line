import { describe, expect, it } from 'vitest';
import { areWorkspacesEqual, type WorkspaceSnapshot } from './workspaceEquality';

const base: WorkspaceSnapshot[] = [{
  id: 'workspace-1', name: 'Demo', path: 'D:/Projects/demo',
  isGit: true, defaultShell: 'powershell', branches: ['main'],
  worktrees: [{ path: 'D:/Projects/demo', commit: 'abc', branch: 'main',
    isMain: true, isDirty: false, dirtyCount: 0 }],
}];
const copy = (): WorkspaceSnapshot[] => JSON.parse(JSON.stringify(base));

describe('workspace polling equality', () => {
  it('reuses workspace lists with equal Git metadata', () => {
    expect(areWorkspacesEqual(base, base)).toBe(true);
    expect(areWorkspacesEqual(base, copy())).toBe(true);
  });
  it('detects changes to branch, status and user config', () => {
    const dirty = copy();
    dirty[0].worktrees[0].dirtyCount = 3;
    expect(areWorkspacesEqual(base, dirty)).toBe(false);
    const newBranch = copy();
    newBranch[0].branches?.push('feature');
    expect(areWorkspacesEqual(base, newBranch)).toBe(false);
    const renamed = copy();
    renamed[0].name = 'Renamed';
    expect(areWorkspacesEqual(base, renamed)).toBe(false);
    expect(areWorkspacesEqual(base, [])).toBe(false);
  });
});
