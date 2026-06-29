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
  activeTabId,
  setActiveTabId,
  terminalInstances,
  setTerminalInstances,
  workspaces,
  panelWorkspace
}: UseTabUiHandlersProps) {
  const [activeTooltip, setActiveTooltip] = useState<TooltipData | null>(null);
  const [tabContextMenu, setTabContextMenu] = useState<TabContextMenuData | null>(null);

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
        for (const wt of w.worktrees) {
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
    handleCloseAllTabs
  };
}
