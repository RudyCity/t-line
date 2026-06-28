import { useState, useEffect, useCallback } from 'react';
import { wsManager } from '../services/websocket';

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

export interface TerminalInstanceData {
  id: string;
  name: string;
  initialName?: string;
  cwd: string;
  shellType: string;
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
  type: 'terminal' | 'file';
  filePath?: string;
  layout?: SplitLayoutNode;
  focusedTerminalId?: string;
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

    const newTab: TabData = {
      id: tabId,
      name: tabName,
      type: 'terminal',
      layout: { type: 'leaf', terminalId: termId },
      focusedTerminalId: termId
    };

    setTerminalInstances(prev => ({ ...prev, [termId]: newInstance }));
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    onTerminalOpen?.();
  }, [defaultShell, workspaces, onTerminalOpen]);

  const openFileTab = useCallback((filePath: string, name: string) => {
    const existing = tabs.find(t => t.type === 'file' && t.filePath === filePath);
    if (existing) {
      setActiveTabId(existing.id);
      onTerminalOpen?.();
      return;
    }

    const tabId = `file-${Date.now()}`;
    const newTab: TabData = {
      id: tabId,
      name,
      type: 'file',
      filePath
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    onTerminalOpen?.();
  }, [tabs, onTerminalOpen]);

  const closeTerminal = useCallback((tabId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    setTabs(prev => {
      const targetTab = prev.find(t => t.id === tabId);
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
        if (filtered.length > 0) {
          setActiveTabId(filtered[filtered.length - 1].id);
        } else {
          setActiveTabId('');
        }
      }
      return filtered;
    });
  }, [activeTabId]);

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
        return prevTabs.filter(t => t.id !== targetTab.id);
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
  }, [terminalInstances]);

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
      // If the incoming title matches the shell name (idle state), revert to initialName
      const isShellIdle = inst.shellType &&
        (cleanTitle.toLowerCase() === inst.shellType.toLowerCase() ||
         cleanTitle.toLowerCase() === 'powershell' && inst.shellType === 'powershell' ||
         cleanTitle.toLowerCase() === 'cmd' && inst.shellType === 'cmd' ||
         cleanTitle.toLowerCase() === 'bash' && inst.shellType === 'bash');
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
          nextTabs.push({
            id: tabId,
            name: `Terminal (${s.shellType === 'powershell' ? 'ps' : s.shellType})`,
            type: 'terminal',
            layout: { type: 'leaf', terminalId: s.id },
            focusedTerminalId: s.id
          });
        }
      });

      if (firstNewTabId) {
        setActiveTabId(firstNewTabId);
      }
      return nextTabs;
    });
  }, []);

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
    closeTerminal,
    closePane,
    splitFocusedTerminal,
    focusTerminal,
    handleTitleChange,
    importActiveSessions,
    refreshTerminal,
    refreshTriggers
  };
}
