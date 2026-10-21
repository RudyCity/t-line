export interface WorkspaceSnapshot {
  id: string;
  name: string;
  path: string;
  isGit: boolean;
  defaultShell?: string;
  branches?: string[];
  worktrees: {
    path: string;
    commit: string;
    branch?: string;
    isMain: boolean;
    isDirty?: boolean;
    dirtyCount?: number;
  }[];
}

/** Cheap structural equality for often-polled project metadata. Keep existing React refs
 * when Git reported no actual changes, so expensive terminal panes do not rerender. */
export function areWorkspacesEqual(a: WorkspaceSnapshot[], b: WorkspaceSnapshot[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (left.id !== right.id || left.name !== right.name ||
        left.path !== right.path || left.isGit !== right.isGit ||
        left.defaultShell !== right.defaultShell) return false;

    const la = left.branches || [];
    const ra = right.branches || [];
    if (la.length !== ra.length || la.some((branch, j) => branch !== ra[j])) return false;

    const lw = left.worktrees || [];
    const rw = right.worktrees || [];
    if (lw.length !== rw.length) return false;
    for (let j = 0; j < lw.length; j++) {
      const l = lw[j], r = rw[j];
      if (l.path !== r.path || l.commit !== r.commit || l.branch !== r.branch ||
          l.isMain !== r.isMain || l.isDirty !== r.isDirty ||
          l.dirtyCount !== r.dirtyCount) return false;
    }
  }
  return true;
}
