import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TabData, WorkspaceInfo, getTerminalIds, SplitLayoutNode } from './useTerminals';
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
  const draggingTabIdRef = useRef<string | null>(null); // ref to avoid stale closure in drag events
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [dragOverSide, setDragOverSide] = useState<'left' | 'right' | 'top' | 'bottom' | 'center' | null>(null);

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

    // Predictive Pre-warming: trigger process query on hover for terminal tabs
    if (t.type === 'terminal' && t.focusedTerminalId) {
      wsManager.send(JSON.stringify({ type: 'prewarm', id: t.focusedTerminalId }));
    }
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
    if (e.nativeEvent) {
      e.nativeEvent.stopImmediatePropagation();
    }
    setActiveTooltip(null);
    setTabContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabId
    });
  }, []);

  useEffect(() => {
    if (tabContextMenu) {
      window.dispatchEvent(new CustomEvent('tline-hide-native-webview', { detail: { hide: true } }));
    } else {
      window.dispatchEvent(new CustomEvent('tline-hide-native-webview', { detail: { hide: false } }));
    }
  }, [tabContextMenu]);

  useEffect(() => {
    if (!tabContextMenu) return;
    const closeMenu = () => setTabContextMenu(null);
    
    const timer = setTimeout(() => {
      window.addEventListener('click', closeMenu);
      window.addEventListener('contextmenu', closeMenu);
    }, 0);

    return () => {
      clearTimeout(timer);
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
    console.log('[TabDrag] dragStart → tabId:', tabId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
    // Set both ref (instant) and state (triggers re-render for visual)
    draggingTabIdRef.current = tabId;
    setDraggingTabId(tabId);
    console.log('[TabDrag] dragStart done — ref:', draggingTabIdRef.current);
  }, []);

  const handleTabDragOver = useCallback((e: React.DragEvent, targetTab: TabData) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    // Use ref instead of state to avoid stale closure — state update is async
    // so the first dragover event fires before draggingTabId state is updated
    const currentDraggingId = draggingTabIdRef.current;
    console.log('[TabDrag] dragOver → target:', targetTab.id, '| draggingRef:', currentDraggingId);
    if (!currentDraggingId || currentDraggingId === targetTab.id) {
      console.log('[TabDrag] dragOver SKIPPED — ref null or same tab');
      return;
    }

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ratioX = x / rect.width;
    const ratioY = y / rect.height;

    const draggedTab = filteredTabs.find(t => t.id === currentDraggingId);
    const isDraggedTerminal = draggedTab?.type === 'terminal';
    const isTargetTerminal = targetTab.type === 'terminal';

    if (isDraggedTerminal && isTargetTerminal) {
      // Terminal-to-terminal: support split or reorder
      if (ratioX < 0.25) {
        setDragOverSide('left');
      } else if (ratioX > 0.75) {
        setDragOverSide('right');
      } else if (ratioY < 0.35) {
        setDragOverSide('top');
      } else if (ratioY > 0.65) {
        setDragOverSide('bottom');
      } else {
        setDragOverSide('center');
      }
    } else {
      // Non-terminal: show insertion indicator (left = insert before, right = insert after)
      setDragOverSide(ratioX <= 0.5 ? 'left' : 'right');
    }
    setDragOverTabId(targetTab.id);
  }, [filteredTabs]);

  const handleTabDragLeave = useCallback(() => {
    console.log('[TabDrag] dragLeave');
    setDragOverTabId(null);
    setDragOverSide(null);
  }, []);

  const handleTabDragEnd = useCallback(() => {
    console.log('[TabDrag] dragEnd');
    draggingTabIdRef.current = null;
    setDraggingTabId(null);
    setDragOverTabId(null);
    setDragOverSide(null);
  }, []);

  const handleTabDrop = useCallback((e: React.DragEvent, targetTabId: string) => {
    e.preventDefault();
    const dataFromTransfer = e.dataTransfer.getData('text/plain');
    const draggedId = dataFromTransfer || draggingTabIdRef.current;
    console.log('[TabDrag] drop → target:', targetTabId, '| dataTransfer:', dataFromTransfer, '| ref:', draggingTabIdRef.current, '| resolved:', draggedId);
    if (!draggedId || draggedId === targetTabId) {
      console.log('[TabDrag] drop SKIPPED — no draggedId or same tab');
      draggingTabIdRef.current = null;
      setDraggingTabId(null);
      setDragOverTabId(null);
      setDragOverSide(null);
      return;
    }

    const draggedIndex = filteredTabs.findIndex(t => t.id === draggedId);
    const targetIndex = filteredTabs.findIndex(t => t.id === targetTabId);
    console.log('[TabDrag] drop indexes → dragged:', draggedIndex, '| target:', targetIndex, '| filteredTabs count:', filteredTabs.length);
    if (draggedIndex === -1 || targetIndex === -1) {
      console.log('[TabDrag] drop SKIPPED — tab not found in filteredTabs');
      draggingTabIdRef.current = null;
      setDraggingTabId(null);
      setDragOverTabId(null);
      setDragOverSide(null);
      return;
    }

    const draggedTab = filteredTabs[draggedIndex];
    const targetTab = filteredTabs[targetIndex];

    const isDraggedTerminal = draggedTab.type === 'terminal';
    const isTargetTerminal = targetTab.type === 'terminal';

    let side = dragOverSide;
    if (!side) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const ratioX = x / rect.width;
      const ratioY = y / rect.height;
      if (isDraggedTerminal && isTargetTerminal) {
        if (ratioX < 0.25) side = 'left';
        else if (ratioX > 0.75) side = 'right';
        else if (ratioY < 0.35) side = 'top';
        else if (ratioY > 0.65) side = 'bottom';
        else side = 'center';
      } else {
        side = ratioX <= 0.5 ? 'left' : 'right';
      }
    }

    if (isDraggedTerminal && isTargetTerminal && (side === 'left' || side === 'right' || side === 'top' || side === 'bottom')) {
      // Merge two terminal tabs into a split pane
      setTabs(prevTabs => {
        const nextTabs = [...prevTabs];
        const dragTabFull = nextTabs.find(t => t.id === draggedId);
        const targetTabFull = nextTabs.find(t => t.id === targetTabId);

        if (!dragTabFull || !targetTabFull || !dragTabFull.layout || !targetTabFull.layout) return prevTabs;

        const mergedLayout: SplitLayoutNode = {
          type: 'split',
          direction: (side === 'left' || side === 'right') ? 'horizontal' : 'vertical',
          first: (side === 'left' || side === 'top') ? dragTabFull.layout : targetTabFull.layout,
          second: (side === 'left' || side === 'top') ? targetTabFull.layout : dragTabFull.layout,
          firstSize: 50,
          secondSize: 50
        };

        const filtered = nextTabs.filter(t => t.id !== draggedId);
        return filtered.map(t => {
          if (t.id === targetTabId) {
            return {
              ...t,
              layout: mergedLayout,
              focusedTerminalId: dragTabFull.focusedTerminalId || t.focusedTerminalId
            };
          }
          return t;
        });
      });
      setActiveTabId(targetTabId);
    } else {
      // Insert-style reorder: remove dragged tab, then insert before/after target
      // This is more correct than swap — handles non-adjacent moves properly
      setTabs(prevTabs => {
        const draggedFull = prevTabs.find(t => t.id === draggedTab.id);
        if (!draggedFull) return prevTabs;
        // Remove dragged from its original position
        const withoutDragged = prevTabs.filter(t => t.id !== draggedTab.id);
        // Find target in the updated array
        const targetIdx = withoutDragged.findIndex(t => t.id === targetTab.id);
        if (targetIdx === -1) return prevTabs;
        // Insert before target when drop on left/top half, after when on right/bottom half
        const insertIdx = (side === 'left' || side === 'top') ? targetIdx : targetIdx + 1;
        withoutDragged.splice(insertIdx, 0, draggedFull);
        return withoutDragged;
      });
    }

    draggingTabIdRef.current = null;
    setDraggingTabId(null);
    setDragOverTabId(null);
    setDragOverSide(null);
  }, [filteredTabs, dragOverSide, setTabs, setActiveTabId]);

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
    handleTabDragLeave,
    handleTabDragEnd,
    handleTabDrop,
    draggingTabId,
    dragOverTabId,
    dragOverSide
  };
}
