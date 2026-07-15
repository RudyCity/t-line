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
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [dragOverSide, setDragOverSide] = useState<'left' | 'right' | 'top' | 'bottom' | 'center' | null>(null);

  // Mouse-based drag refs (HTML5 DnD API is broken in WebView2/Tauri on Windows—
  // dragstart fires but dragover/drop never fire because Windows intercepts the native
  // drag gesture. We bypass it entirely with mouse events + elementsFromPoint).
  const draggingTabIdRef = useRef<string | null>(null);
  const mouseStartRef = useRef<{ tabId: string; x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const wasDragRef = useRef(false);          // suppress click after a completed drag
  const dragOverTabIdRef = useRef<string | null>(null);
  const dragOverSideRef = useRef<'left' | 'right' | 'top' | 'bottom' | 'center' | null>(null);
  const filteredTabsRef = useRef<TabData[]>(filteredTabs);
  filteredTabsRef.current = filteredTabs;   // always current without adding to dep arrays

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
    // Suppress click that fires right after a drag completes
    if (wasDragRef.current) {
      wasDragRef.current = false;
      return;
    }
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

  // ---------------------------------------------------------------------------
  // Mouse-based tab drag (replaces broken HTML5 DnD in WebView2/Tauri Windows)
  // ---------------------------------------------------------------------------

  const handleTabMouseDown = useCallback((e: React.MouseEvent, tabId: string) => {
    if (e.button !== 0) return;
    // Don't initiate drag from the close × button
    if ((e.target as HTMLElement).closest('.tab-close')) return;
    mouseStartRef.current  = { tabId, x: e.clientX, y: e.clientY };
    isDraggingRef.current  = false;
    wasDragRef.current     = false;
  }, []);

  useEffect(() => {
    const DRAG_THRESHOLD = 5; // px before drag is recognised

    /**
     * Walk elements under cursor and return the first .tab that isn't the dragged one.
     * Returns side based on both tab types:
     *  - terminal dragged over terminal: left/right/top/bottom/center (for split/reorder)
     *  - terminal dragged over grid: 'center' (add to grid)
     *  - anything else: left/right (for reorder)
     */
    const findTabUnder = (x: number, y: number, excludeId: string) => {
      const allTabs = filteredTabsRef.current;
      const draggedTab = allTabs.find(t => t.id === excludeId);
      const isDraggedTerminal = draggedTab?.type === 'terminal';

      for (const el of document.elementsFromPoint(x, y)) {
        const htmlEl = el as HTMLElement;
        const tabEl = htmlEl.closest('.tab') as HTMLElement | null;
        if (tabEl) {
          const tabId = tabEl.getAttribute('data-tab-id');
          if (tabId && tabId !== excludeId) {
            const targetTab = allTabs.find(t => t.id === tabId);
            const rect = tabEl.getBoundingClientRect();
            const ratioX = (x - rect.left) / rect.width;
            const ratioY = (y - rect.top)  / rect.height;

            let side: 'left' | 'right' | 'top' | 'bottom' | 'center';

            if (isDraggedTerminal && targetTab?.type === 'terminal') {
              // Rich 5-zone detection for terminal→terminal (split or reorder)
              if      (ratioX < 0.25)  side = 'left';
              else if (ratioX > 0.75)  side = 'right';
              else if (ratioY < 0.35)  side = 'top';
              else if (ratioY > 0.65)  side = 'bottom';
              else                     side = 'center';
            } else if (isDraggedTerminal && targetTab?.type === 'grid') {
              // Terminal dragged onto a grid tab → add to that grid
              side = 'center';
            } else {
              // Default: insertion left or right
              side = ratioX <= 0.5 ? 'left' : 'right';
            }

            return { tabId, side, targetType: targetTab?.type };
          }
        }
      }
      return null;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseStartRef.current) return;
      const dx = Math.abs(e.clientX - mouseStartRef.current.x);
      const dy = Math.abs(e.clientY - mouseStartRef.current.y);

      if (!isDraggingRef.current) {
        if (dx <= DRAG_THRESHOLD && dy <= DRAG_THRESHOLD) return;
        // Threshold exceeded — kick off drag
        isDraggingRef.current       = true;
        draggingTabIdRef.current    = mouseStartRef.current.tabId;
        setDraggingTabId(mouseStartRef.current.tabId);
        document.body.style.cursor     = 'grabbing';
        document.body.style.userSelect = 'none';
        console.log('[TabDrag-mouse] drag started →', mouseStartRef.current.tabId);
      }

      const hit = findTabUnder(e.clientX, e.clientY, mouseStartRef.current.tabId);
      if (hit) {
        console.log('[TabDrag-mouse] over →', hit.tabId, hit.side);
        dragOverTabIdRef.current = hit.tabId;
        dragOverSideRef.current  = hit.side;
        setDragOverTabId(hit.tabId);
        setDragOverSide(hit.side);
      } else {
        dragOverTabIdRef.current = null;
        dragOverSideRef.current  = null;
        setDragOverTabId(null);
        setDragOverSide(null);
      }
    };

    const cleanup = () => {
      draggingTabIdRef.current = null;
      dragOverTabIdRef.current = null;
      dragOverSideRef.current  = null;
      mouseStartRef.current    = null;
      isDraggingRef.current    = false;
      setDraggingTabId(null);
      setDragOverTabId(null);
      setDragOverSide(null);
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };

    const onMouseUp = () => {
      if (!mouseStartRef.current) return;

      if (isDraggingRef.current) {
        wasDragRef.current = true; // suppress the upcoming onClick
        const draggedId  = mouseStartRef.current.tabId;
        const targetId   = dragOverTabIdRef.current;
        const side       = dragOverSideRef.current || 'right';
        console.log('[TabDrag-mouse] drop → dragged:', draggedId, 'target:', targetId, 'side:', side);

        if (targetId && draggedId !== targetId) {
          const tabs = filteredTabsRef.current;
          const draggedIdx = tabs.findIndex(t => t.id === draggedId);
          const targetIdx  = tabs.findIndex(t => t.id === targetId);
          console.log('[TabDrag-mouse] indexes → dragged:', draggedIdx, 'target:', targetIdx, 'side:', side);

          if (draggedIdx !== -1 && targetIdx !== -1) {
            const draggedTab = tabs[draggedIdx];
            const targetTab  = tabs[targetIdx];
            const isDraggedTerminal = draggedTab.type === 'terminal';
            const isTargetTerminal  = targetTab.type  === 'terminal';
            const isTargetGrid      = targetTab.type  === 'grid';

            if (isDraggedTerminal && isTargetTerminal &&
                (side === 'left' || side === 'right' || side === 'top' || side === 'bottom')) {
              // ── Mode 1: terminal → terminal edge → create split pane ──────────
              console.log('[TabDrag-mouse] creating split pane');
              setTabs(prevTabs => {
                const dragFull   = prevTabs.find(t => t.id === draggedTab.id);
                const targetFull = prevTabs.find(t => t.id === targetTab.id);
                if (!dragFull?.layout || !targetFull?.layout) return prevTabs;

                const mergedLayout: SplitLayoutNode = {
                  type: 'split',
                  direction: (side === 'left' || side === 'right') ? 'horizontal' : 'vertical',
                  first:  (side === 'left'  || side === 'top')    ? dragFull.layout  : targetFull.layout,
                  second: (side === 'left'  || side === 'top')    ? targetFull.layout : dragFull.layout,
                  firstSize: 50,
                  secondSize: 50
                };

                return prevTabs
                  .filter(t => t.id !== draggedTab.id)
                  .map(t => t.id !== targetTab.id ? t : {
                    ...t,
                    layout: mergedLayout,
                    focusedTerminalId: dragFull.focusedTerminalId || t.focusedTerminalId
                  });
              });
              setActiveTabId(targetId);

            } else if (isDraggedTerminal && isTargetGrid) {
              // ── Mode 2: terminal → grid tab → add terminal IDs to grid ───────
              console.log('[TabDrag-mouse] adding terminal to grid tab');
              setTabs(prevTabs => {
                const dragFull = prevTabs.find(t => t.id === draggedTab.id);
                if (!dragFull?.layout) return prevTabs;
                // Collect all terminal leaf IDs from the dragged tab
                const termIds = getTerminalIds(dragFull.layout);
                return prevTabs
                  .filter(t => t.id !== draggedTab.id)
                  .map(t => t.id !== targetTab.id ? t : {
                    ...t,
                    gridTerminalIds: [...(t.gridTerminalIds || []), ...termIds]
                  });
              });
              setActiveTabId(targetId);

            } else {
              // ── Mode 3: insert-before/after reorder ───────────────────────────
              console.log('[TabDrag-mouse] reordering tab');
              setTabs(prevTabs => {
                const full    = prevTabs.find(t => t.id === draggedTab.id);
                if (!full) return prevTabs;
                const without = prevTabs.filter(t => t.id !== draggedTab.id);
                const tIdx    = without.findIndex(t => t.id === targetId);
                if (tIdx === -1) return prevTabs;
                without.splice(side === 'left' || side === 'top' ? tIdx : tIdx + 1, 0, full);
                return without;
              });
            }
          }
        }
      }

      cleanup();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingRef.current) {
        console.log('[TabDrag-mouse] drag cancelled (Escape)');
        wasDragRef.current = false;
        cleanup();
      }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup',   onMouseUp);
    document.addEventListener('keydown',   onKeyDown);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup',   onMouseUp);
      document.removeEventListener('keydown',   onKeyDown);
    };
  }, [setTabs]); // setTabs is stable; filteredTabs read via ref

  // ---------------------------------------------------------------------------
  // Keep legacy moveTab for context-menu "Move Tab Left/Right" actions
  // ---------------------------------------------------------------------------

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
    handleTabMouseDown,
    handleCloseOtherTabs,
    handleCloseAllTabs,
    moveTab,
    draggingTabId,
    dragOverTabId,
    dragOverSide
  };
}
