import { useState, useEffect, useCallback } from 'react';

export interface WorktreeInfo {
  path: string;
  commit: string;
  branch?: string;
  isMain: boolean;
  isDirty?: boolean;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  isGit: boolean;
  worktrees: WorktreeInfo[];
  defaultShell?: string;
}

export function useWorkspaces(isAuthenticated: boolean, token: string | null) {
  const [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [showWorkspaceModal, setShowWorkspaceModal] = useState<boolean>(false);
  const [newWorkspacePath, setNewWorkspacePath] = useState<string>('');
  const [newWorkspaceShell, setNewWorkspaceShell] = useState<string>('powershell');
  const [showFolderExplorer, setShowFolderExplorer] = useState<boolean>(false);
  const [explorerPath, setExplorerPath] = useState<string>('');
  const [explorerDirs, setExplorerDirs] = useState<{name: string, path: string}[]>([]);
  const [explorerParent, setExplorerParent] = useState<string | null>(null);

  const [showWorktreeModal, setShowWorktreeModal] = useState<boolean>(false);
  const [selectedRepoPath, setSelectedRepoPath] = useState<string>('');
  const [newWorktreePath, setNewWorktreePath] = useState<string>('');
  const [newWorktreeBranch, setNewWorktreeBranch] = useState<string>('');
  const [isNewBranch, setIsNewBranch] = useState<boolean>(false);
  const [repoBranches, setRepoBranches] = useState<string[]>([]);
  const [gitLoading, setGitLoading] = useState<boolean>(false);

  const fetchWorkspaces = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/workspaces', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setWorkspaces(data);
      }
    } catch (e) {
      console.error('Failed to fetch workspaces:', e);
    }
  }, [token]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchWorkspaces();
    }
  }, [isAuthenticated, fetchWorkspaces]);

  const fetchDirectoryList = async (targetPath = '') => {
    try {
      const res = await fetch(`/api/fs/list?path=${encodeURIComponent(targetPath)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setExplorerPath(data.currentPath);
        setExplorerParent(data.parentPath);
        setExplorerDirs(data.directories);
      } else {
        alert(data.error);
      }
    } catch (e) {
      console.error('Failed to list directories:', e);
    }
  };

  const handleFolderBrowse = async () => {
    if ((window as any).electron) {
      try {
        const selected = await (window as any).electron.selectDirectory();
        if (selected) {
          setNewWorkspacePath(selected);
        }
      } catch (e) {
        console.error('Electron folder selection failed, falling back to Web Explorer:', e);
        setShowFolderExplorer(true);
        fetchDirectoryList(newWorkspacePath || explorerPath);
      }
    } else {
      setShowFolderExplorer(true);
      fetchDirectoryList(newWorkspacePath || explorerPath);
    }
  };

  const handleAddWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspacePath) return;

    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path: newWorkspacePath, defaultShell: newWorkspaceShell })
      });
      const data = await res.json();
      if (data.success) {
        setShowWorkspaceModal(false);
        setNewWorkspacePath('');
        setNewWorkspaceShell('powershell');
        setShowFolderExplorer(false);
        fetchWorkspaces();
      } else {
        alert(data.error || 'Failed to add workspace.');
      }
    } catch (e) {
      alert('Error occurred adding workspace.');
    }
  };

  const handleRemoveWorkspace = async (workspacePath: string): Promise<boolean> => {
    if (!confirm('Are you sure you want to remove this workspace from tracking? (Files will not be deleted)')) return false;

    try {
      const res = await fetch('/api/workspaces', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path: workspacePath })
      });
      const data = await res.json();
      if (data.success) {
        fetchWorkspaces();
        return true;
      }
    } catch (e) {
      console.error('Error removing workspace:', e);
    }
    return false;
  };

  const handleOpenWorktreeModal = async (workspace: WorkspaceInfo) => {
    setSelectedRepoPath(workspace.path);
    const parentDir = workspace.path.substring(0, workspace.path.lastIndexOf(window.navigator.userAgent.includes('Windows') ? '\\' : '/'));
    const worktreeBaseDir = `${parentDir}/${workspace.name}-worktrees`;
    setNewWorktreePath(`${worktreeBaseDir}/new-worktree`);
    setNewWorktreeBranch('');
    setIsNewBranch(false);
    setShowWorktreeModal(true);
    setGitLoading(true);

    try {
      const id = workspace.id;
      const res = await fetch(`/api/workspaces/${id}/branches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const branches = await res.json();
      setRepoBranches(branches);
    } catch (e) {
      console.error('Failed to get repo branches:', e);
    } finally {
      setGitLoading(false);
    }
  };

  const handleAddWorktree = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorktreePath || !newWorktreeBranch) return;

    setGitLoading(true);
    try {
      const res = await fetch('/api/worktrees/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          repoPath: selectedRepoPath,
          worktreePath: newWorktreePath,
          branchName: newWorktreeBranch,
          newBranch: isNewBranch
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowWorktreeModal(false);
        fetchWorkspaces();
      } else {
        alert(data.output || 'Failed to create worktree.');
      }
    } catch (e) {
      alert('Error occurred adding worktree.');
    } finally {
      setGitLoading(false);
    }
  };

  const handleRemoveWorktree = async (repoPath: string, worktreePath: string) => {
    if (!confirm(`Are you sure you want to remove the worktree at ${worktreePath}? This will delete the checked-out files but keep the branch.`)) return;

    setGitLoading(true);
    try {
      const res = await fetch('/api/worktrees/remove', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ repoPath, worktreePath, force: true })
      });
      const data = await res.json();
      if (data.success) {
        fetchWorkspaces();
      } else {
        alert(data.output || 'Failed to remove worktree.');
      }
    } catch (e) {
      console.error('Error removing worktree:', e);
    } finally {
      setGitLoading(false);
    }
  };

  return {
    workspaces,
    fetchWorkspaces,
    showWorkspaceModal,
    setShowWorkspaceModal,
    newWorkspacePath,
    setNewWorkspacePath,
    newWorkspaceShell,
    setNewWorkspaceShell,
    showFolderExplorer,
    setShowFolderExplorer,
    explorerPath,
    explorerDirs,
    explorerParent,
    fetchDirectoryList,
    handleFolderBrowse,
    handleAddWorkspace,
    handleRemoveWorkspace,
    showWorktreeModal,
    setShowWorktreeModal,
    newWorktreePath,
    setNewWorktreePath,
    newWorktreeBranch,
    setNewWorktreeBranch,
    isNewBranch,
    setIsNewBranch,
    repoBranches,
    gitLoading,
    handleOpenWorktreeModal,
    handleAddWorktree,
    handleRemoveWorktree
  };
}
