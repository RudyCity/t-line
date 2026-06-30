import { useState, useEffect, useCallback } from 'react';
import { GitFileStatus } from '../components/FilePanel';
import { WorkspaceInfo } from './useTerminals';

function areStatusListsEqual(a: GitFileStatus[], b: GitFileStatus[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, idx) => {
    const other = b[idx];
    return item.path === other.path &&
           item.status === other.status &&
           item.staged === other.staged &&
           item.unstaged === other.unstaged;
  });
}

export function useGitStatus(panelWorkspace: WorkspaceInfo | null, panelWorktreePath: string | null) {
  const [changedFiles, setChangedFiles] = useState<GitFileStatus[]>([]);
  const [gitStatusLoading, setGitStatusLoading] = useState<boolean>(false);

  const fetchGitStatus = useCallback(async (showLoading = false) => {
    if (!panelWorkspace || !panelWorkspace.isGit) {
      setChangedFiles([]);
      return;
    }
    if (showLoading) setGitStatusLoading(true);
    try {
      const token = localStorage.getItem('token');
      const queryParam = panelWorktreePath ? `?worktreePath=${encodeURIComponent(panelWorktreePath)}` : '';
      const res = await fetch(`/api/workspaces/${panelWorkspace.id}/git/status${queryParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setChangedFiles(prev => {
          if (areStatusListsEqual(prev, data)) {
            return prev;
          }
          return data;
        });
      }
    } catch (e) {
      console.error('Error fetching git status:', e);
    } finally {
      if (showLoading) setGitStatusLoading(false);
    }
  }, [panelWorkspace, panelWorktreePath]);

  useEffect(() => {
    fetchGitStatus(true);
  }, [panelWorkspace, panelWorktreePath, fetchGitStatus]);

  useEffect(() => {
    if (!panelWorkspace || !panelWorkspace.isGit) return;
    const interval = setInterval(() => {
      fetchGitStatus(false);
    }, 5000);
    return () => clearInterval(interval);
  }, [panelWorkspace, panelWorktreePath, fetchGitStatus]);

  return {
    changedFiles,
    gitStatusLoading,
    fetchGitStatus
  };
}
