import { useState, useEffect, useCallback } from 'react';
import { WorkspaceInfo, TabData, getTerminalIds } from './useTerminals';
import { wsManager } from '../services/websocket';

export const isPathInWorktree = (filePath: string, wtPath: string): boolean => {
  const normFile = filePath.toLowerCase().replace(/\\/g, '/');
  const normWt = wtPath.toLowerCase().replace(/\\/g, '/');
  return normFile === normWt || normFile.startsWith(normWt + '/');
};

export const getTabWorktreePath = (
  tab: TabData,
  workspace: WorkspaceInfo,
  terminalInstances: Record<string, any>
): string | null => {
  const isFile = tab.type === 'file';
  let tabPath = '';
  if (isFile) {
    tabPath = tab.filePath || '';
  } else if (tab.layout) {
    if (tab.focusedTerminalId) {
      const inst = terminalInstances[tab.focusedTerminalId];
      if (inst && inst.cwd) {
        tabPath = inst.cwd;
      }
    }
    if (!tabPath) {
      const termIds = getTerminalIds(tab.layout);
      for (const id of termIds) {
        const inst = terminalInstances[id];
        if (inst && inst.cwd) {
          tabPath = inst.cwd;
          break;
        }
      }
    }
  }

  if (!tabPath) return null;

  const wts = workspace.worktrees || [];
  const sortedWts = [...wts].sort((a, b) => b.path.length - a.path.length);
  for (const wt of sortedWts) {
    if (isPathInWorktree(tabPath, wt.path)) {
      return wt.path;
    }
  }
  return null;
};

interface WorkspaceHandlersProps {
  rawHandleRemoveWorkspace: (workspacePath: string) => Promise<boolean>;
  handleRemoveWorktree: (workspaceId: string, worktreePath: string) => Promise<void>;
  handleUpdateWorkspace: (workspacePath: string, updates: { defaultShell: string; name: string }) => Promise<boolean>;
  workspaces: WorkspaceInfo[];
  tabs: any[];
  setTabs: React.Dispatch<React.SetStateAction<any[]>>;
  terminalInstances: Record<string, any>;
  setTerminalInstances: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  workspaceActiveTab: Record<string, string>;
  setWorkspaceActiveTab: (workspaceId: string, tabId: string) => void;
  openTerminal: (title: string, cwd: string, shell?: string) => void;
  closeTerminal: (tabId: string) => void;
  setPanelWorkspace: React.Dispatch<React.SetStateAction<WorkspaceInfo | null>>;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void,
    variant?: 'primary' | 'secondary' | 'danger',
    confirmLabel?: string,
    cancelLabel?: string
  ) => void;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  panelWorkspace: WorkspaceInfo | null;
  panelWorktreePath: string | null;
  setPanelWorktreePath: (path: string | null) => void;
}

export function useWorkspaceHandlers({
  rawHandleRemoveWorkspace,
  handleRemoveWorktree,
  handleUpdateWorkspace,
  workspaces,
  tabs,
  setTabs,
  terminalInstances,
  setTerminalInstances,
  activeTabId,
  setActiveTabId,
  setWorkspaceActiveTab,
  openTerminal,
  closeTerminal,
  setPanelWorkspace,
  showConfirm,
  setSidebarOpen,
  panelWorkspace,
  panelWorktreePath,
  setPanelWorktreePath
}: WorkspaceHandlersProps) {
  const [showEditWorkspaceModal, setShowEditWorkspaceModal] = useState<boolean>(false);
  const [editingWorkspace, setEditingWorkspace] = useState<WorkspaceInfo | null>(null);

  // Handle workspace removal and close all associated terminal and file tabs
  const handleRemoveWorkspace = useCallback((workspacePath: string) => {
    showConfirm(
      'Remove Workspace',
      'Are you sure you want to remove this workspace from tracking? (Files will not be deleted)',
      async () => {
        const success = await rawHandleRemoveWorkspace(workspacePath);
        if (success) {
          const isPathInWorkspace = (filePath: string, wsPath: string) => {
            const normFile = filePath.toLowerCase().replace(/\\/g, '/');
            const normWS = wsPath.toLowerCase().replace(/\\/g, '/');
            return normFile === normWS || normFile.startsWith(normWS + '/');
          };

          setTabs(prevTabs => {
            const tabsToClose = prevTabs.filter(tab => {
              if (tab.type === 'file' && tab.filePath) {
                return isPathInWorkspace(tab.filePath, workspacePath);
              }
              if (tab.type === 'terminal' && tab.layout) {
                const termIds = getTerminalIds(tab.layout);
                return termIds.some(id => {
                  const inst = terminalInstances[id];
                  return inst && isPathInWorkspace(inst.cwd, workspacePath);
                });
              }
              return false;
            });

            if (tabsToClose.length === 0) return prevTabs;

            const closedTermIds: string[] = [];
            tabsToClose.forEach(tab => {
              if (tab.type === 'terminal' && tab.layout) {
                const termIds = getTerminalIds(tab.layout);
                termIds.forEach(id => {
                  wsManager.unsubscribe(id);
                  closedTermIds.push(id);
                });
              }
            });

            if (closedTermIds.length > 0) {
              setTerminalInstances(prevInstances => {
                const next = { ...prevInstances };
                closedTermIds.forEach(id => delete next[id]);
                return next;
              });
            }

            const remainingTabs = prevTabs.filter(t => !tabsToClose.some(c => c.id === t.id));

            if (tabsToClose.some(c => c.id === activeTabId)) {
              if (remainingTabs.length > 0) {
                setActiveTabId(remainingTabs[remainingTabs.length - 1].id);
              } else {
                setActiveTabId('');
              }
            }

            return remainingTabs;
          });
        }
      },
      'danger',
      'Remove',
      'Cancel'
    );
  }, [rawHandleRemoveWorkspace, terminalInstances, activeTabId, setTabs, setTerminalInstances, setActiveTabId, showConfirm]);

  const handleRemoveWorktreeWrapped = useCallback((wsId: string, wtPath: string) => {
    showConfirm(
      'Remove Worktree',
      `Are you sure you want to remove the worktree at ${wtPath}? This will delete the checked-out files but keep the branch.`,
      () => {
        // Find and close any tabs / terminals pointing to this worktree to release OS locks
        const normWtPath = wtPath.toLowerCase().replace(/\\/g, '/');
        const isPathInWt = (p: string) => {
          const normP = p.toLowerCase().replace(/\\/g, '/');
          return normP === normWtPath || normP.startsWith(normWtPath + '/');
        };

        const tabsToClose = tabs.filter(t => {
          if (t.type === 'file' && t.filePath && isPathInWt(t.filePath)) {
            return true;
          }
          if (t.type === 'terminal' && t.layout) {
            const termIds = getTerminalIds(t.layout);
            return termIds.some(id => {
              const inst = terminalInstances[id];
              const cwd = inst?.cwd || '';
              return cwd && isPathInWt(cwd);
            });
          }
          return false;
        });

        if (tabsToClose.length > 0) {
          tabsToClose.forEach(t => {
            closeTerminal(t.id);
          });
        }

        // Add a slight delay before triggering backend removal to allow terminal processes to exit completely
        setTimeout(() => {
          handleRemoveWorktree(wsId, wtPath);
        }, 500);
      },
      'danger',
      'Remove',
      'Cancel'
    );
  }, [tabs, terminalInstances, closeTerminal, handleRemoveWorktree, showConfirm]);

  const handleOpenEditWorkspaceModal = useCallback((workspace: WorkspaceInfo) => {
    setEditingWorkspace(workspace);
    setShowEditWorkspaceModal(true);
  }, []);

  const handleUpdateWorkspaceSubmit = useCallback(async (updates: { defaultShell: string; name: string }) => {
    if (!editingWorkspace) return;
    const success = await handleUpdateWorkspace(editingWorkspace.path, updates);
    if (success) {
      setShowEditWorkspaceModal(false);
      setEditingWorkspace(null);
    }
  }, [editingWorkspace, handleUpdateWorkspace]);

  const getWorkspaceForTab = useCallback((tabId: string): WorkspaceInfo | null => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return null;

    if (tab.workspaceId) {
      const matched = workspaces.find(w => w.id === tab.workspaceId);
      if (matched) return matched;
    }
    
    const isPathInWorkspace = (filePath: string, w: WorkspaceInfo) => {
      const normFile = filePath.toLowerCase().replace(/\\/g, '/');
      const normWS = w.path.toLowerCase().replace(/\\/g, '/');
      if (normFile === normWS || normFile.startsWith(normWS + '/')) {
        return true;
      }
      const wts = w.worktrees || [];
      for (const wt of wts) {
        const normWt = wt.path.toLowerCase().replace(/\\/g, '/');
        if (normFile === normWt || normFile.startsWith(normWt + '/')) {
          return true;
        }
      }
      return false;
    };

    if (tab.type === 'file' && tab.filePath) {
      const matched = workspaces.find(w => isPathInWorkspace(tab.filePath!, w));
      if (matched) return matched;
    } else if (tab.type === 'terminal' && tab.layout) {
      const termIds = getTerminalIds(tab.layout);
      if (tab.focusedTerminalId) {
        const inst = terminalInstances[tab.focusedTerminalId];
        if (inst && inst.cwd) {
          const matched = workspaces.find(w => isPathInWorkspace(inst.cwd, w));
          if (matched) return matched;
        }
      }
      for (const id of termIds) {
        const inst = terminalInstances[id];
        if (inst && inst.cwd) {
          const matched = workspaces.find(w => isPathInWorkspace(inst.cwd, w));
          if (matched) return matched;
        }
      }
    }
    return null;
  }, [tabs, workspaces, terminalInstances]);

  // Update workspace's last active tab when activeTabId changes
  useEffect(() => {
    if (!activeTabId) return;
    const ws = getWorkspaceForTab(activeTabId);
    if (ws) {
      setWorkspaceActiveTab(ws.id, activeTabId);

      // Auto-update workspace selection if it differs
      if (panelWorkspace?.id !== ws.id) {
        setPanelWorkspace(ws);
        setPanelWorktreePath(null);
      } else {
        // If we are in Worktree Mode and the active tab belongs to a different worktree of the current workspace,
        // sync the selected worktree path so it's not hidden.
        if (panelWorktreePath !== null) {
          const tab = tabs.find(t => t.id === activeTabId);
          if (tab) {
            const wtPath = getTabWorktreePath(tab, ws, terminalInstances);
            if (wtPath && wtPath !== panelWorktreePath) {
              setPanelWorktreePath(wtPath);
            }
          }
        }
      }
    }
  }, [
    activeTabId,
    tabs,
    terminalInstances,
    workspaces,
    getWorkspaceForTab,
    setWorkspaceActiveTab,
    panelWorkspace,
    panelWorktreePath,
    setPanelWorkspace,
    setPanelWorktreePath
  ]);

  const handleWorkspaceClick = useCallback((workspaceId: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) return;

    // Toggle behavior: if this workspace is active and the main branch is selected, toggle it off!
    const isMainSelected = panelWorkspace?.id === ws.id && (panelWorktreePath === ws.path || panelWorktreePath === null);
    if (isMainSelected) {
      setPanelWorkspace(null);
      setPanelWorktreePath(null);
      setActiveTabId('');
      setSidebarOpen(false);
      return;
    }

    setPanelWorkspace(ws);
    setPanelWorktreePath(ws.path); // Select master/main!

    // Find any open tab that matches the main branch/workspace path
    const matchedTab = tabs.find(tab => {
      if (tab.type === 'file' && tab.filePath) {
        return isPathInWorktree(tab.filePath, ws.path);
      }
      if (tab.type === 'terminal' && tab.layout) {
        const termIds = getTerminalIds(tab.layout);
        return termIds.some(id => {
          const inst = terminalInstances[id];
          return inst && isPathInWorktree(inst.cwd, ws.path);
        });
      }
      return false;
    });

    if (matchedTab) {
      setActiveTabId(matchedTab.id);
    } else {
      openTerminal(ws.name, ws.path, ws.defaultShell);
    }
    setSidebarOpen(false);
  }, [workspaces, panelWorkspace, panelWorktreePath, tabs, terminalInstances, openTerminal, setActiveTabId, setPanelWorkspace, setPanelWorktreePath, setSidebarOpen]);

  const handleWorktreeClick = useCallback((workspaceId: string, wtPath: string) => {
    const ws = workspaces.find(w => w.id === workspaceId);
    if (!ws) return;

    // Toggle behavior: if this worktree is already active, clicking it again toggles it off!
    if (panelWorkspace?.id === ws.id && panelWorktreePath === wtPath) {
      setPanelWorkspace(null);
      setPanelWorktreePath(null);
      setActiveTabId('');
      setSidebarOpen(false);
      return;
    }

    setPanelWorkspace(ws);
    setPanelWorktreePath(wtPath); // Set active worktree path!

    const matchedTab = tabs.find(tab => {
      if (tab.type === 'terminal' && tab.layout) {
        const termIds = getTerminalIds(tab.layout);
        return termIds.some(id => {
          const inst = terminalInstances[id];
          return inst && isPathInWorktree(inst.cwd, wtPath);
        });
      }
      return false;
    });

    if (matchedTab) {
      setActiveTabId(matchedTab.id);
    } else {
      const wts = ws.worktrees || [];
      const wt = wts.find(w => w.path === wtPath);
      const name = `${ws.name} (${wt?.branch || 'worktree'})`;
      openTerminal(name, wtPath, ws.defaultShell);
    }
    setSidebarOpen(false);
  }, [workspaces, panelWorkspace, panelWorktreePath, tabs, terminalInstances, openTerminal, setActiveTabId, setPanelWorkspace, setPanelWorktreePath, setSidebarOpen]);

  return {
    editingWorkspace,
    setEditingWorkspace,
    showEditWorkspaceModal,
    setShowEditWorkspaceModal,
    handleRemoveWorkspace,
    handleRemoveWorktreeWrapped,
    handleOpenEditWorkspaceModal,
    handleUpdateWorkspaceSubmit,
    handleWorkspaceClick,
    handleWorktreeClick,
    getWorkspaceForTab
  };
}
