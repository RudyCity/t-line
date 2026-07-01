import { useState, useEffect, useCallback } from 'react';
import { wsManager } from '../services/websocket';

export interface WorktreeInfo {
  path: string;
  commit: string;
  branch?: string;
  isMain: boolean;
  isDirty?: boolean;
  dirtyCount?: number;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  isGit: boolean;
  worktrees: WorktreeInfo[];
  defaultShell?: string;
}

export interface ActiveProcessSummary {
  pid: number;
  ppid: number;
  name: string;
  commandLine: string;
  isClaude: boolean;
  isGemini: boolean;
  isCursor: boolean;
  isSuperagent: boolean;
}

export interface TerminalInstanceData {
  id: string;
  name: string;
  initialName?: string;
  cwd: string;
  shellType: string;
  activeProcesses?: ActiveProcessSummary[];
}

export type SplitLayoutNode =
  | {
      type: 'leaf';
      terminalId: string;
    }
  | {
      type: 'split';
      direction: 'horizontal' | 'vertical';
      first: SplitLayoutNode;
      second: SplitLayoutNode;
    };

export interface TabData {
  id: string;
  name: string;
  type: 'terminal' | 'file' | 'diff';
  filePath?: string;
  // For 'diff' type tabs
  commitHash?: string; // 'WORKTREE' for working-tree diffs
  worktreePath?: string; // for working-tree diff scoping
  layout?: SplitLayoutNode;
  focusedTerminalId?: string;
  workspaceId?: string;
}

/** Maps workspaceId → last active tabId for that workspace */
export type WorkspaceActiveTabMap = Record<string, string>;

// ── Helper functions for Tree operations ───────────────────

export function getTerminalIds(node: SplitLayoutNode): string[] {
  if (node.type === 'leaf') return [node.terminalId];
  return [...getTerminalIds(node.first), ...getTerminalIds(node.second)];
}

export function splitLeaf(
  node: SplitLayoutNode,
  targetId: string,
  direction: 'horizontal' | 'vertical',
  newId: string
): SplitLayoutNode {
  if (node.type === 'leaf') {
    if (node.terminalId === targetId) {
      return {
        type: 'split',
        direction,
        first: { type: 'leaf', terminalId: targetId },
        second: { type: 'leaf', terminalId: newId }
      };
    }
    return node;
  }
  return {
    ...node,
    first: splitLeaf(node.first, targetId, direction, newId),
    second: splitLeaf(node.second, targetId, direction, newId)
  };
}

export function removeLeaf(node: SplitLayoutNode, targetId: string): SplitLayoutNode | null {
  if (node.type === 'leaf') {
    if (node.terminalId === targetId) return null;
    return node;
  }
  if (node.first.type === 'leaf' && node.first.terminalId === targetId) {
    return node.second;
  }
  if (node.second.type === 'leaf' && node.second.terminalId === targetId) {
    return node.first;
  }
  const newFirst = removeLeaf(node.first, targetId);
  const newSecond = removeLeaf(node.second, targetId);
  if (newFirst === null) return newSecond;
  if (newSecond === null) return newFirst;
  return {
    ...node,
    first: newFirst,
    second: newSecond
  };
}

// ── Hook Implementation ────────────────────────────────────

export function useTerminals(workspaces: WorkspaceInfo[], onTerminalOpen?: () => void) {
  const [terminalFontSize, setTerminalFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('tline-terminal-font-size');
    return saved ? parseInt(saved, 10) : 12;
  });

  const [refreshTriggers, setRefreshTriggers] = useState<Record<string, number>>({});

  const [tabs, setTabs] = useState<TabData[]>(() => {
    try {
      const savedTabs = localStorage.getItem('tline-tabs-v2');
      if (savedTabs) return JSON.parse(savedTabs);

      // Migration: load old tline-terminals
      const oldSaved = localStorage.getItem('tline-terminals');
      if (oldSaved) {
        const oldTabs: any[] = JSON.parse(oldSaved);
        return oldTabs.map(t => {
          if (t.type === 'file') {
            return { id: t.id, name: t.name, type: 'file', filePath: t.filePath };
          } else {
            return {
              id: t.id,
              name: t.name,
              type: 'terminal',
              layout: { type: 'leaf', terminalId: t.id },
              focusedTerminalId: t.id
            };
          }
        });
      }
      return [];
    } catch {
      return [];
    }
  });

  const [terminalInstances, setTerminalInstances] = useState<Record<string, TerminalInstanceData>>(() => {
    try {
      const savedInstances = localStorage.getItem('tline-terminal-instances-v2');
      if (savedInstances) return JSON.parse(savedInstances);

      // Migration from old terminals
      const oldSaved = localStorage.getItem('tline-terminals');
      if (oldSaved) {
        const oldTabs: any[] = JSON.parse(oldSaved);
        const instances: Record<string, TerminalInstanceData> = {};
        oldTabs.forEach(t => {
          if (t.type !== 'file') {
            instances[t.id] = {
              id: t.id,
              name: t.name,
              initialName: t.name,
              cwd: t.cwd || '',
              shellType: t.shellType || 'powershell'
            };
          }
        });
        return instances;
      }
      return {};
    } catch {
      return {};
    }
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return localStorage.getItem('tline-active-tab-id') || '';
  });

  const [defaultShell, setDefaultShell] = useState<string>('powershell');

  const [workspaceActiveTab, setWorkspaceActiveTabState] = useState<WorkspaceActiveTabMap>(() => {
    try {
      const saved = localStorage.getItem('tline-workspace-active-tab');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const setWorkspaceActiveTab = useCallback((wsId: string, tabId: string) => {
    setWorkspaceActiveTabState(prev => {
      const next = { ...prev, [wsId]: tabId };
      localStorage.setItem('tline-workspace-active-tab', JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    localStorage.setItem('tline-tabs-v2', JSON.stringify(tabs));
  }, [tabs]);

  useEffect(() => {
    localStorage.setItem('tline-terminal-instances-v2', JSON.stringify(terminalInstances));
  }, [terminalInstances]);

  useEffect(() => {
    localStorage.setItem('tline-active-tab-id', activeTabId);
  }, [activeTabId]);

  useEffect(() => {
    localStorage.setItem('tline-terminal-font-size', terminalFontSize.toString());
  }, [terminalFontSize]);

  const handleZoomIn = useCallback(() => {
    setTerminalFontSize(prev => Math.min(prev + 1, 24));
  }, []);

  const handleZoomOut = useCallback(() => {
    setTerminalFontSize(prev => Math.max(prev - 1, 8));
  }, []);

  const findWorkspaceIdForPath = useCallback((path: string): string | undefined => {
    if (!path) return undefined;
    const normPath = path.toLowerCase().replace(/\\/g, '/');
    for (const ws of workspaces) {
      const normWsPath = ws.path.toLowerCase().replace(/\\/g, '/');
      if (normPath === normWsPath || normPath.startsWith(normWsPath + '/')) {
        return ws.id;
      }
      if (ws.worktrees) {
        for (const wt of ws.worktrees) {
          const normWtPath = wt.path.toLowerCase().replace(/\\/g, '/');
          if (normPath === normWtPath || normPath.startsWith(normWtPath + '/')) {
            return ws.id;
          }
        }
      }
    }
    return undefined;
  }, [workspaces]);

  // Automatically resolve/heal workspaceId for tabs when workspaces are loaded
  useEffect(() => {
    if (workspaces.length === 0 || tabs.length === 0) return;

    let changed = false;
    const updatedTabs = tabs.map(tab => {
      if (tab.workspaceId) {
        const exists = workspaces.some(w => w.id === tab.workspaceId);
        if (exists) return tab;
      }

      let targetPath = '';
      if (tab.type === 'file' && tab.filePath) {
        targetPath = tab.filePath;
      } else if (tab.type === 'terminal' && tab.layout) {
        const termIds = getTerminalIds(tab.layout);
        for (const id of termIds) {
          const inst = terminalInstances[id];
          if (inst && inst.cwd) {
            targetPath = inst.cwd;
            break;
          }
        }
      }

      if (targetPath) {
        const wsId = findWorkspaceIdForPath(targetPath);
        if (wsId && wsId !== tab.workspaceId) {
          changed = true;
          return { ...tab, workspaceId: wsId };
        }
      }
      return tab;
    });

    if (changed) {
      setTabs(updatedTabs);
    }
  }, [workspaces, tabs, terminalInstances, findWorkspaceIdForPath]);

  const openTerminal = useCallback((name: string, cwd: string, shellType?: string) => {
    const tabId = `tab-${Date.now()}`;
    const termId = `term-${Date.now()}`;
    const activeShell = shellType || defaultShell;
    
    let tabName = name;
    if (name === 'Shell' && cwd) {
      const matchedWorkspace = workspaces.find(w => w.path === cwd);
      if (matchedWorkspace) {
        tabName = `Shell (${matchedWorkspace.name})`;
      }
    }

    const newInstance: TerminalInstanceData = {
      id: termId,
      name: tabName,
      initialName: tabName,
      cwd,
      shellType: activeShell
    };

    const wsId = findWorkspaceIdForPath(cwd);

    const newTab: TabData = {
      id: tabId,
      name: tabName,
      type: 'terminal',
      layout: { type: 'leaf', terminalId: termId },
      focusedTerminalId: termId,
      workspaceId: wsId
    };

    setTerminalInstances(prev => ({ ...prev, [termId]: newInstance }));
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    onTerminalOpen?.();
  }, [defaultShell, workspaces, onTerminalOpen, findWorkspaceIdForPath]);

  const openFileTab = useCallback((filePath: string, name: string) => {
    const existing = tabs.find(t => t.type === 'file' && t.filePath === filePath);
    if (existing) {
      setActiveTabId(existing.id);
      onTerminalOpen?.();
      return;
    }

    const tabId = `file-${Date.now()}`;
    const wsId = findWorkspaceIdForPath(filePath);

    const newTab: TabData = {
      id: tabId,
      name,
      type: 'file',
      filePath,
      workspaceId: wsId
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    onTerminalOpen?.();
  }, [tabs, onTerminalOpen, findWorkspaceIdForPath]);

  const openDiffTab = useCallback((commitHash: string, filePath: string, workspaceId: string, worktreePath?: string) => {
    const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
    const isWorkingTree = commitHash === 'WORKTREE';
    const tabName = isWorkingTree
      ? `\u0394 ${fileName} (changes)`
      : `\u0394 ${fileName} (${commitHash.slice(0, 7)})`;

    // Reuse existing tab for same commit+file (or same working-tree+file)
    const existing = tabs.find(
      t => t.type === 'diff' &&
           t.commitHash === commitHash &&
           t.filePath === filePath &&
           t.worktreePath === (worktreePath ?? undefined)
    );
    if (existing) {
      setActiveTabId(existing.id);
      onTerminalOpen?.();
      return;
    }

    const tabId = `diff-${Date.now()}`;
    const newTab: TabData = {
      id: tabId,
      name: tabName,
      type: 'diff',
      filePath,
      commitHash,
      worktreePath: worktreePath ?? undefined,
      workspaceId
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    onTerminalOpen?.();
  }, [tabs, onTerminalOpen]);

  const closeTerminal = useCallback((tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setTabs(prev => {
      const targetTab = prev.find(t => t.id === tabId);
      const targetWorkspaceId = targetTab ? targetTab.workspaceId : undefined;

      if (targetTab) {
        if (targetTab.type === 'terminal' && targetTab.layout) {
          const termIds = getTerminalIds(targetTab.layout);
          termIds.forEach(id => {
            wsManager.unsubscribe(id);
          });
          setTerminalInstances(prevInstances => {
            const next = { ...prevInstances };
            termIds.forEach(id => delete next[id]);
            return next;
          });
        }
      }

      const filtered = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId) {
        const sameWorkspaceTabs = filtered.filter(t => t.workspaceId === targetWorkspaceId);
        if (sameWorkspaceTabs.length > 0) {
          // Find the index of the closed tab in the original list to select a smart next tab
          const originalWorkspaceTabs = prev.filter(t => t.workspaceId === targetWorkspaceId);
          const closedIdx = originalWorkspaceTabs.findIndex(t => t.id === tabId);
          if (closedIdx !== -1 && originalWorkspaceTabs.length > 1) {
            const nextActiveIdx = closedIdx < originalWorkspaceTabs.length - 1 ? closedIdx : closedIdx - 1;
            const nextTab = sameWorkspaceTabs[nextActiveIdx];
            if (nextTab) {
              setActiveTabId(nextTab.id);
            } else {
              setActiveTabId(sameWorkspaceTabs[sameWorkspaceTabs.length - 1].id);
            }
          } else {
            setActiveTabId(sameWorkspaceTabs[sameWorkspaceTabs.length - 1].id);
          }
        } else {
          setActiveTabId('');
        }
      }
      return filtered;
    });
  }, [activeTabId, setActiveTabId]);

  const closePane = useCallback((terminalId: string) => {
    setTabs(prevTabs => {
      const targetTab = prevTabs.find(t => {
        if (t.type === 'terminal' && t.layout) {
          return getTerminalIds(t.layout).includes(terminalId);
        }
        return false;
      });

      if (!targetTab) return prevTabs;

      wsManager.unsubscribe(terminalId);
      setTerminalInstances(prev => {
        const next = { ...prev };
        delete next[terminalId];
        return next;
      });

      if (targetTab.layout?.type === 'leaf') {
        // If it's the only pane in the tab, close the entire tab
        const filtered = prevTabs.filter(t => t.id !== targetTab.id);
        if (activeTabId === targetTab.id) {
          const sameWorkspaceTabs = filtered.filter(t => t.workspaceId === targetTab.workspaceId);
          if (sameWorkspaceTabs.length > 0) {
            setActiveTabId(sameWorkspaceTabs[sameWorkspaceTabs.length - 1].id);
          } else {
            setActiveTabId('');
          }
        }
        return filtered;
      }

      // If it's part of a split layout, remove the leaf node
      const nextLayout = removeLeaf(targetTab.layout!, terminalId);
      const remainingIds = nextLayout ? getTerminalIds(nextLayout) : [];
      const nextFocused = remainingIds[0] || '';

      const updatedTabs = prevTabs.map(t => {
        if (t.id === targetTab.id) {
          // Also sync tab title to the newly focused terminal pane
          const focusedInst = terminalInstances[nextFocused];
          return {
            ...t,
            layout: nextLayout || undefined,
            focusedTerminalId: nextFocused,
            name: focusedInst ? focusedInst.name : t.name
          };
        }
        return t;
      });

      return updatedTabs;
    });
  }, [activeTabId, setActiveTabId, terminalInstances]);

  const splitFocusedTerminal = useCallback((direction: 'horizontal' | 'vertical') => {
    setTabs(prevTabs => {
      const activeTab = prevTabs.find(t => t.id === activeTabId);
      if (!activeTab || activeTab.type !== 'terminal' || !activeTab.focusedTerminalId) return prevTabs;

      const focusedId = activeTab.focusedTerminalId;
      const focusedInstance = terminalInstances[focusedId];
      if (!focusedInstance) return prevTabs;

      const newTermId = `term-${Date.now()}`;
      const newInstance: TerminalInstanceData = {
        id: newTermId,
        name: focusedInstance.initialName || focusedInstance.name,
        initialName: focusedInstance.initialName || focusedInstance.name,
        cwd: focusedInstance.cwd,
        shellType: focusedInstance.shellType
      };

      setTerminalInstances(prev => ({ ...prev, [newTermId]: newInstance }));
      
      return prevTabs.map(t => {
        if (t.id === activeTabId && t.layout) {
          const nextLayout = splitLeaf(t.layout, focusedId, direction, newTermId);
          return {
            ...t,
            layout: nextLayout,
            focusedTerminalId: newTermId
          };
        }
        return t;
      });
    });
  }, [activeTabId, terminalInstances]);

  const focusTerminal = useCallback((terminalId: string) => {
    setTabs(prev =>
      prev.map(t => {
        if (t.type === 'terminal' && t.layout) {
          const termIds = getTerminalIds(t.layout);
          if (termIds.includes(terminalId)) {
            setActiveTabId(t.id);
            // Sync tab name with focused terminal pane name
            const inst = terminalInstances[terminalId];
            return {
              ...t,
              focusedTerminalId: terminalId,
              name: inst ? inst.name : t.name
            };
          }
        }
        return t;
      })
    );
  }, [terminalInstances]);

  const handleTitleChange = useCallback((id: string, title: string) => {
    if (!title || !title.trim()) return;
    const cleanTitle = title.trim();
    setTerminalInstances(prev => {
      if (!prev[id]) return prev;
      const inst = prev[id];
      // Check if title is a directory path or executable path (startup/idle noise)
      const isPathOrExe = cleanTitle.includes('\\') ||
        cleanTitle.includes('/') ||
        /^[a-zA-Z]:/.test(cleanTitle) ||
        cleanTitle.toLowerCase().includes('.exe') ||
        cleanTitle.toLowerCase() === 'select powershell' ||
        cleanTitle.toLowerCase() === 'select cmd' ||
        cleanTitle.toLowerCase() === 'select administrator: cmd' ||
        cleanTitle.toLowerCase() === 'administrator: cmd' ||
        cleanTitle.toLowerCase() === 'windows powershell' ||
        cleanTitle.toLowerCase() === 'xterm-color' ||
        cleanTitle.toLowerCase() === 'xterm-256color' ||
        cleanTitle.toLowerCase() === 'xterm';

      // If the incoming title matches the shell name or is path/exe noise, revert to initialName
      const isShellIdle = isPathOrExe || (inst.shellType &&
        (cleanTitle.toLowerCase() === inst.shellType.toLowerCase() ||
         cleanTitle.toLowerCase() === 'powershell' && inst.shellType === 'powershell' ||
         cleanTitle.toLowerCase() === 'cmd' && inst.shellType === 'cmd' ||
         cleanTitle.toLowerCase() === 'bash' && inst.shellType === 'bash'));
      const resolvedName = isShellIdle ? (inst.initialName || inst.name) : cleanTitle;
      return {
        ...prev,
        [id]: { ...inst, name: resolvedName }
      };
    });
    setTabs(prev =>
      prev.map(t => {
        if (t.type === 'terminal' && t.focusedTerminalId === id) {
          // Tab name is derived live from terminalInstances, no need to update here
          return t;
        }
        return t;
      })
    );
  }, []);

  const handleActiveProcessesChange = useCallback((id: string, processes: ActiveProcessSummary[]) => {
    setTerminalInstances(prev => {
      if (!prev[id]) return prev;
      return {
        ...prev,
        [id]: {
          ...prev[id],
          activeProcesses: processes
        }
      };
    });
  }, []);

  const importActiveSessions = useCallback((sessions: Array<{ id: string; shellType: string; cwd: string }>) => {
    setTerminalInstances(prev => {
      const next = { ...prev };
      sessions.forEach(s => {
        if (!next[s.id]) {
          next[s.id] = {
            id: s.id,
            name: `Terminal (${s.shellType === 'powershell' ? 'ps' : s.shellType})`,
            initialName: `Terminal (${s.shellType === 'powershell' ? 'ps' : s.shellType})`,
            cwd: s.cwd,
            shellType: s.shellType
          };
        }
      });
      return next;
    });

    setTabs(prev => {
      const nextTabs = [...prev];
      let firstNewTabId = '';
      sessions.forEach(s => {
        const exists = prev.some(t => {
          if (t.type === 'terminal' && t.layout) {
            return getTerminalIds(t.layout).includes(s.id);
          }
          return false;
        });

        if (!exists) {
          const tabId = `tab-${Date.now()}-${s.id}`;
          if (!firstNewTabId) firstNewTabId = tabId;
          const wsId = findWorkspaceIdForPath(s.cwd);
          nextTabs.push({
            id: tabId,
            name: `Terminal (${s.shellType === 'powershell' ? 'ps' : s.shellType})`,
            type: 'terminal',
            layout: { type: 'leaf', terminalId: s.id },
            focusedTerminalId: s.id,
            workspaceId: wsId
          });
        }
      });

      if (firstNewTabId) {
        setActiveTabId(firstNewTabId);
      }
      return nextTabs;
    });
  }, [findWorkspaceIdForPath]);

  const refreshTerminal = useCallback((terminalId: string) => {
    if (!terminalId) return;
    setRefreshTriggers(prev => ({
      ...prev,
      [terminalId]: (prev[terminalId] || 0) + 1
    }));
  }, []);

  return {
    tabs,
    setTabs,
    terminalInstances,
    setTerminalInstances,
    activeTabId,
    setActiveTabId,
    workspaceActiveTab,
    setWorkspaceActiveTab,
    terminalFontSize,
    setTerminalFontSize,
    defaultShell,
    setDefaultShell,
    handleZoomIn,
    handleZoomOut,
    openTerminal,
    openFileTab,
    openDiffTab,
    closeTerminal,
    closePane,
    splitFocusedTerminal,
    focusTerminal,
    handleTitleChange,
    handleActiveProcessesChange,
    importActiveSessions,
    refreshTerminal,
    refreshTriggers
  };
}
