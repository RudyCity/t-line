import { useState, useEffect } from 'react';
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

export interface TerminalTab {
  id: string;
  name: string;
  cwd?: string;
  shellType?: string;
  type?: 'terminal' | 'file';
  filePath?: string;
}

export function useTerminals(workspaces: WorkspaceInfo[], onTerminalOpen?: () => void) {
  const [terminalFontSize, setTerminalFontSize] = useState<number>(() => {
    const saved = localStorage.getItem('tline-terminal-font-size');
    return saved ? parseInt(saved, 10) : 12;
  });

  const [terminals, setTerminals] = useState<TerminalTab[]>(() => {
    try {
      const saved = localStorage.getItem('tline-terminals');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    return localStorage.getItem('tline-active-tab-id') || '';
  });

  const [defaultShell, setDefaultShell] = useState<string>('powershell');

  useEffect(() => {
    localStorage.setItem('tline-terminals', JSON.stringify(terminals));
  }, [terminals]);

  useEffect(() => {
    localStorage.setItem('tline-active-tab-id', activeTabId);
  }, [activeTabId]);

  useEffect(() => {
    localStorage.setItem('tline-terminal-font-size', terminalFontSize.toString());
  }, [terminalFontSize]);

  const handleZoomIn = () => {
    setTerminalFontSize(prev => Math.min(prev + 1, 24));
  };

  const handleZoomOut = () => {
    setTerminalFontSize(prev => Math.max(prev - 1, 8));
  };

  const openTerminal = (name: string, cwd: string, shellType?: string) => {
    const id = `term-${Date.now()}`;
    const activeShell = shellType || defaultShell;
    
    let tabName = name;
    if (name === 'Shell' && cwd) {
      const matchedWorkspace = workspaces.find(w => w.path === cwd);
      if (matchedWorkspace) {
        tabName = `Shell (${matchedWorkspace.name})`;
      }
    }

    const newTab: TerminalTab = { id, name: tabName, cwd, shellType: activeShell, type: 'terminal' };
    setTerminals(prev => [...prev, newTab]);
    setActiveTabId(id);
    onTerminalOpen?.();
  };

  const openFileTab = (filePath: string, name: string) => {
    const existing = terminals.find(t => t.type === 'file' && t.filePath === filePath);
    if (existing) {
      setActiveTabId(existing.id);
      return;
    }

    const id = `file-${Date.now()}`;
    const newTab: TerminalTab = {
      id,
      name,
      type: 'file',
      filePath
    };

    setTerminals(prev => [...prev, newTab]);
    setActiveTabId(id);
  };

  const closeTerminal = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    wsManager.unsubscribe(id);
    
    setTerminals(prev => {
      const filtered = prev.filter(t => t.id !== id);
      if (activeTabId === id) {
        if (filtered.length > 0) {
          setActiveTabId(filtered[filtered.length - 1].id);
        } else {
          setActiveTabId('');
        }
      }
      return filtered;
    });
  };

  const handleTitleChange = (id: string, title: string) => {
    if (!title || !title.trim()) return;
    setTerminals(prev =>
      prev.map(t => (t.id === id ? { ...t, name: title.trim() } : t))
    );
  };

  return {
    terminals,
    setTerminals,
    activeTabId,
    setActiveTabId,
    terminalFontSize,
    setTerminalFontSize,
    defaultShell,
    setDefaultShell,
    handleZoomIn,
    handleZoomOut,
    openTerminal,
    openFileTab,
    closeTerminal,
    handleTitleChange
  };
}
