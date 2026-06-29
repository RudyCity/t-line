import { useState, useEffect, useCallback } from 'react';
import { GitFileStatus } from '../components/FilePanel';
import { WorkspaceInfo } from './useTerminals';

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
        setChangedFiles(data);
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
