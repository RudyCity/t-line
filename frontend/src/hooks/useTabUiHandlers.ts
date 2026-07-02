import React, { useState, useEffect, useCallback } from 'react';
import { TabData, WorkspaceInfo, getTerminalIds } from './useTerminals';
import { wsManager } from '../services/websocket';

export interface TooltipData {
  id: string;
  x: number;
  y: number;
  title: string;
  branch?: string;
  path: string;
}

export interface TabContextMenuData {
  x: number;
  y: number;
  tabId: string;
}

interface UseTabUiHandlersProps {
  tabs: TabData[];
  setTabs: React.Dispatch<React.SetStateAction<TabData[]>>;
  filteredTabs: TabData[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  terminalInstances: Record<string, any>;
  setTerminalInstances: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  workspaces: WorkspaceInfo[];
  panelWorkspace: WorkspaceInfo | null;
}

export function useTabUiHandlers({
  tabs,
  setTabs,
  filteredTabs,
  activeTabId,
  setActiveTabId,
  terminalInstances,
  setTerminalInstances,
  workspaces,
  panelWorkspace
}: UseTabUiHandlersProps) {
  const [activeTooltip, setActiveTooltip] = useState<TooltipData | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<TabContextMenuData | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);

  const getTabGitBranch = useCallback((t: any): string | null => {
    const isFile = t.type === 'file';
    const focusedInst = !isFile && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
    const path = isFile ? (t.filePath || '') : (focusedInst?.cwd || t.cwd || '');
    if (!path) return null;

    const normPath = path.toLowerCase().replace(/\\/g, '/');

    const isUnder = (parent: string, child: string) => {
      const normParent = parent.toLowerCase().replace(/\\/g, '/');
      return child === normParent || child.startsWith(normParent + '/');
    };

    for (const w of workspaces) {
      if (w.isGit) {
        const wts = w.worktrees || [];
        const sortedWts = [...wts].sort((a, b) => b.path.length - a.path.length);
        for (const wt of sortedWts) {
          if (isUnder(wt.path, normPath)) {
            return wt.branch || 'detached';
          }
        }
      }
    }
    return null;
  }, [terminalInstances, workspaces]);

  const handleTabMouseEnter = useCallback((e: React.MouseEvent<HTMLDivElement>, t: any) => {
    if (tabContextMenu) return;
    const isFile = t.type === 'file';
    const focusedInst = !isFile && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
    const shellType = focusedInst?.shellType || '';
    const displayName = isFile ? t.name : (focusedInst?.name || t.name);
    const path = isFile ? (t.filePath || '') : (focusedInst?.cwd || t.cwd || '');
    const branch = getTabGitBranch(t);
    const rect = e.currentTarget.getBoundingClientRect();
    setActiveTooltip({
      id: t.id,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 8,
      title: isFile ? `File: ${displayName}` : `Terminal: ${displayName}${shellType ? ` (${shellType})` : ''}`,
      branch: branch || undefined,
      path
    });
  }, [tabContextMenu, terminalInstances, getTabGitBranch]);

  const handleTabMouseLeave = useCallback(() => {
    setActiveTooltip(null);
  }, []);

  const handleTabClick = useCallback((t: TabData) => {
    setActiveTabId(t.id);
    setActiveTooltip(null);
  }, [setActiveTabId]);

  const handleTabContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveTooltip(null);
    setTabContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabId
    });
  }, []);

  useEffect(() => {
    if (!tabContextMenu) return;
    const closeMenu = () => setTabContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
    };
  }, [tabContextMenu]);

  useEffect(() => {
    if (activeTooltip && !tabs.some(t => t.id === activeTooltip.id)) {
      setActiveTooltip(null);
    }
  }, [tabs, activeTooltip]);

  const handleCloseOtherTabs = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      const remainingTabs = prevTabs.filter(t => t.id === tabId || t.workspaceId !== panelWorkspace?.id);
      const closedTabs = prevTabs.filter(t => t.id !== tabId && t.workspaceId === panelWorkspace?.id);
      const closedTermIds: string[] = [];
      closedTabs.forEach(t => {
        if (t.type === 'terminal' && t.layout) {
          const termIds = getTerminalIds(t.layout);
          termIds.forEach(id => {
            wsManager.unsubscribe(id);
            closedTermIds.push(id);
          });
        }
      });

      if (closedTermIds.length > 0) {
        setTerminalInstances(prev => {
          const next = { ...prev };
          closedTermIds.forEach(id => delete next[id]);
          return next;
        });
      }

      if (!remainingTabs.some(t => t.id === activeTabId)) {
        setActiveTabId(tabId);
      }

      return remainingTabs;
    });
  }, [panelWorkspace, activeTabId, setTabs, setActiveTabId, setTerminalInstances]);

  const handleCloseAllTabs = useCallback(() => {
    setTabs(prevTabs => {
      const remainingTabs = prevTabs.filter(t => t.workspaceId !== panelWorkspace?.id);
      const closedTabs = prevTabs.filter(t => t.workspaceId === panelWorkspace?.id);
      const closedTermIds: string[] = [];
      closedTabs.forEach(t => {
        if (t.type === 'terminal' && t.layout) {
          const termIds = getTerminalIds(t.layout);
          termIds.forEach(id => {
            wsManager.unsubscribe(id);
            closedTermIds.push(id);
          });
        }
      });

      if (closedTermIds.length > 0) {
        setTerminalInstances(prev => {
          const next = { ...prev };
          closedTermIds.forEach(id => delete next[id]);
          return next;
        });
      }

      setActiveTabId('');
      return remainingTabs;
    });
  }, [panelWorkspace, setTabs, setActiveTabId, setTerminalInstances]);

  const moveTab = useCallback((tabId: string, direction: 'left' | 'right') => {
    const currentIndex = filteredTabs.findIndex(t => t.id === tabId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= filteredTabs.length) return;

    const currentTab = filteredTabs[currentIndex];
    const targetTab = filteredTabs[targetIndex];

    setTabs(prevTabs => {
      const nextTabs = [...prevTabs];
      const gIndex1 = nextTabs.findIndex(t => t.id === currentTab.id);
      const gIndex2 = nextTabs.findIndex(t => t.id === targetTab.id);
      if (gIndex1 !== -1 && gIndex2 !== -1) {
        nextTabs[gIndex1] = targetTab;
        nextTabs[gIndex2] = currentTab;
      }
      return nextTabs;
    });
  }, [filteredTabs, setTabs]);

  const handleTabDragStart = useCallback((e: React.DragEvent, tabId: string) => {
    e.dataTransfer.setData('text/plain', tabId);
    setDraggingTabId(tabId);
    if (e.currentTarget) {
      (e.currentTarget as HTMLElement).classList.add('dragging');
    }
  }, []);

  const handleTabDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleTabDragEnd = useCallback((e: React.DragEvent) => {
    setDraggingTabId(null);
    if (e.currentTarget) {
      (e.currentTarget as HTMLElement).classList.remove('dragging');
    }
  }, []);

  const handleTabDrop = useCallback((e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain') || draggingTabId;
    if (!draggedId || draggedId === targetTabId) return;

    const draggedIndex = filteredTabs.findIndex(t => t.id === draggedId);
    const targetIndex = filteredTabs.findIndex(t => t.id === targetTabId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    const draggedTab = filteredTabs[draggedIndex];
    const targetTab = filteredTabs[targetIndex];

    setTabs(prevTabs => {
      const nextTabs = [...prevTabs];
      const gIndexDrag = nextTabs.findIndex(t => t.id === draggedTab.id);
      const gIndexTarget = nextTabs.findIndex(t => t.id === targetTab.id);
      if (gIndexDrag !== -1 && gIndexTarget !== -1) {
        nextTabs[gIndexDrag] = targetTab;
        nextTabs[gIndexTarget] = draggedTab;
      }
      return nextTabs;
    });
    setDraggingTabId(null);
  }, [filteredTabs, draggingTabId, setTabs]);

  return {
    activeTooltip,
    setActiveTooltip,
    tabContextMenu,
    setTabContextMenu,
    getTabGitBranch,
    handleTabMouseEnter,
    handleTabMouseLeave,
    handleTabClick,
    handleTabContextMenu,
    handleCloseOtherTabs,
    handleCloseAllTabs,
    moveTab,
    handleTabDragStart,
    handleTabDragOver,
    handleTabDragEnd,
    handleTabDrop,
    draggingTabId
  };
}
