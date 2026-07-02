import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  LayoutGrid, Plus, ExternalLink, ChevronDown, Folder, 
  Terminal as TerminalIcon, Search, EyeOff, Check
} from 'lucide-react';
import { TabData, TerminalInstanceData, WorkspaceInfo, ActiveProcessSummary } from '../hooks/useTerminals';
import { TerminalInstance } from './TerminalInstance';

interface TerminalGridTabProps {
  tab: TabData;
  tabs: TabData[];
  setTabs: React.Dispatch<React.SetStateAction<TabData[]>>;
  workspaces: WorkspaceInfo[];
  terminalInstances: Record<string, TerminalInstanceData>;
  wsConnected: boolean;
  terminalFontSize: number;
  handleTitleChange: (id: string, title: string) => void;
  handleActiveProcessesChange?: (id: string, processes: ActiveProcessSummary[]) => void;
  focusTerminal: (id: string) => void;
  setActiveTabId: (id: string) => void;
  themeBackground?: string;
  themeForeground?: string;
  accentColor?: string;
  fontFamily?: string;
  fontWeight?: string;
  refreshTriggers?: Record<string, number>;
}

export function TerminalGridTab({
  tab,
  tabs,
  setTabs,
  workspaces,
  terminalInstances,
  wsConnected,
  terminalFontSize,
  handleTitleChange,
  handleActiveProcessesChange,
  focusTerminal,
  setActiveTabId,
  themeBackground,
  themeForeground,
  accentColor = '#a855f7',
  fontFamily,
  fontWeight,
  refreshTriggers
}: TerminalGridTabProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [focusedTermId, setFocusedTermId] = useState<string | null>(null);
  const configRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showConfig) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (configRef.current && !configRef.current.contains(e.target as Node)) {
        setShowConfig(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showConfig]);

  // Find all active terminal IDs across all workspace tabs
  const allActiveTerminalIds = useMemo(() => {
    const ids: string[] = [];
    tabs.forEach(t => {
      if (t.type === 'terminal' && t.layout) {
        // Recursive helper to traverse split layout tree
        const collect = (node: any) => {
          if (!node) return;
          if (node.type === 'leaf') {
            ids.push(node.terminalId);
          } else if (node.type === 'split') {
            collect(node.first);
            collect(node.second);
          }
        };
        collect(t.layout);
      }
    });
    return Array.from(new Set(ids));
  }, [tabs]);

  // Map terminal instances that are active
  const activeTerminals = useMemo(() => {
    return allActiveTerminalIds
      .map(id => terminalInstances[id])
      .filter((inst): inst is TerminalInstanceData => !!inst);
  }, [allActiveTerminalIds, terminalInstances]);

  // Get selected terminal IDs for this grid tab
  const selectedTerminalIds = useMemo(() => {
    return tab.gridTerminalIds || [];
  }, [tab.gridTerminalIds]);

  // Update selected terminals in tabs state
  const toggleTerminalSelection = (termId: string) => {
    setTabs(prevTabs =>
      prevTabs.map(t => {
        if (t.id === tab.id) {
          const currentIds = t.gridTerminalIds || [];
          const nextIds = currentIds.includes(termId)
            ? currentIds.filter(id => id !== termId)
            : [...currentIds, termId];
          return { ...t, gridTerminalIds: nextIds };
        }
        return t;
      })
    );
  };

  // Helper to associate terminal to a workspace
  const getWorkspaceForPath = (path: string): WorkspaceInfo | undefined => {
    if (!path) return undefined;
    const normPath = path.toLowerCase().replace(/\\/g, '/');
    for (const ws of workspaces) {
      const normWsPath = ws.path.toLowerCase().replace(/\\/g, '/');
      if (normPath === normWsPath || normPath.startsWith(normWsPath + '/')) {
        return ws;
      }
      if (ws.worktrees) {
        for (const wt of ws.worktrees) {
          const normWtPath = wt.path.toLowerCase().replace(/\\/g, '/');
          if (normPath === normWtPath || normPath.startsWith(normWtPath + '/')) {
            return ws;
          }
        }
      }
    }
    return undefined;
  };

  // Group active terminals by workspace
  const terminalsByWorkspace = useMemo(() => {
    const groups: Record<string, { ws: WorkspaceInfo | { name: string; id: string; path: string }; terms: TerminalInstanceData[] }> = {};
    
    // Add known workspaces first
    workspaces.forEach(ws => {
      groups[ws.id] = { ws, terms: [] };
    });
    
    // Unassigned / External group
    const UNASSIGNED_ID = 'unassigned';
    groups[UNASSIGNED_ID] = { 
      ws: { name: 'External / Other', id: UNASSIGNED_ID, path: '' }, 
      terms: [] 
    };

    activeTerminals.forEach(term => {
      const ws = getWorkspaceForPath(term.cwd);
      const targetGroup = ws ? groups[ws.id] : groups[UNASSIGNED_ID];
      if (targetGroup) {
        targetGroup.terms.push(term);
      }
    });

    // Remove empty groups (except when we want to display all workspaces)
    return Object.fromEntries(
      Object.entries(groups).filter(([_, group]) => group.terms.length > 0)
    );
  }, [activeTerminals, workspaces]);

  // Filtered active terminals based on search query
  const filteredWorkspaces = useMemo(() => {
    if (!searchQuery) return terminalsByWorkspace;
    
    const query = searchQuery.toLowerCase();
    const result: typeof terminalsByWorkspace = {};

    Object.entries(terminalsByWorkspace).forEach(([wsId, group]) => {
      const matchedTerms = group.terms.filter(
        t => t.name.toLowerCase().includes(query) || 
             t.cwd.toLowerCase().includes(query) || 
             t.shellType.toLowerCase().includes(query)
      );
      if (matchedTerms.length > 0 || group.ws.name.toLowerCase().includes(query)) {
        result[wsId] = {
          ws: group.ws,
          terms: matchedTerms.length > 0 ? matchedTerms : group.terms
        };
      }
    });

    return result;
  }, [terminalsByWorkspace, searchQuery]);

  // Go to full terminal tab view
  const handleFocusFullTab = (termId: string) => {
    // Find tab containing this terminal
    const targetTab = tabs.find(t => {
      if (t.type === 'terminal' && t.layout) {
        const checkNode = (node: any): boolean => {
          if (!node) return false;
          if (node.type === 'leaf') return node.terminalId === termId;
          return checkNode(node.first) || checkNode(node.second);
        };
        return checkNode(t.layout);
      }
      return false;
    });

    if (targetTab) {
      // Focus terminal inside tab
      focusTerminal(termId);
      setActiveTabId(targetTab.id);
    }
  };

  // Pre-select focused terminal in grid when component mounts or selection changes
  useEffect(() => {
    if (selectedTerminalIds.length > 0) {
      if (!focusedTermId || !selectedTerminalIds.includes(focusedTermId)) {
        setFocusedTermId(selectedTerminalIds[0]);
      }
    } else {
      setFocusedTermId(null);
    }
  }, [selectedTerminalIds, focusedTermId]);

  return (
    <div className="grid-tab-container">
      <style>{`
        .grid-tab-container {
          display: flex;
          flex-direction: column;
          width: 100%;
          height: 100%;
          overflow: hidden;
          background: var(--bg-main);
          position: relative;
          color: var(--text-main);
        }
        .grid-tab-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          border-bottom: 1px solid var(--border-color);
          background: rgba(0, 0, 0, 0.15);
          backdrop-filter: blur(8px);
          z-index: 10;
          flex-shrink: 0;
        }
        .grid-header-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .grid-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .grid-title-text {
          font-size: 0.85rem;
          font-weight: 700;
          background: linear-gradient(135deg, var(--color-primary) 30%, #a855f7 90%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .grid-count-badge {
          background: rgba(168, 85, 247, 0.15);
          color: var(--color-primary);
          font-size: 0.65rem;
          font-weight: 600;
          padding: 1px 6px;
          border-radius: 4px;
          border: 1px solid rgba(168, 85, 247, 0.25);
        }
        .grid-subtitle {
          font-size: 0.7rem;
          color: var(--text-muted);
        }
        .grid-header-right {
          position: relative;
        }
        .grid-config-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: var(--surface-overlay);
          color: var(--text-main);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .grid-config-btn:hover {
          background: var(--surface-overlay-hover);
          border-color: var(--color-primary);
          box-shadow: 0 0 8px rgba(168, 85, 247, 0.15);
        }
        .grid-config-dropdown {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          width: 320px;
          max-height: 400px;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.35);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 100;
          animation: slideDownDropdown 0.15s ease-out;
        }
        @keyframes slideDownDropdown {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .dropdown-search-wrapper {
          padding: 10px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(0, 0, 0, 0.1);
        }
        .dropdown-search-input {
          flex: 1;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text-main);
          font-size: 0.72rem;
          padding: 2px 4px;
        }
        .dropdown-list {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }
        .dropdown-ws-group {
          margin-bottom: 10px;
        }
        .dropdown-ws-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .dropdown-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px 6px 26px;
          cursor: pointer;
          transition: background 0.1s;
        }
        .dropdown-item:hover {
          background: var(--bg-card-hover);
        }
        .dropdown-item-left {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
          flex: 1;
        }
        .custom-checkbox {
          width: 14px;
          height: 14px;
          border-radius: 3px;
          border: 1.5px solid var(--text-dark);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.1s;
        }
        .custom-checkbox.checked {
          background: var(--color-primary);
          border-color: var(--color-primary);
        }
        .custom-checkbox-tick {
          color: #fff;
        }
        .dropdown-term-name {
          font-size: 0.72rem;
          font-weight: 500;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dropdown-term-shell {
          font-size: 0.6rem;
          color: var(--text-muted);
          font-family: monospace;
          background: rgba(255, 255, 255, 0.05);
          padding: 1px 4px;
          border-radius: 3px;
        }
        .grid-tab-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        .terminal-grid-layout {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
          gap: 16px;
          align-content: start;
          width: 100%;
        }
        @media (max-width: 600px) {
          .terminal-grid-layout {
            grid-template-columns: 1fr;
          }
        }
        .grid-terminal-card {
          border: 1px solid var(--border-color);
          border-radius: 8px;
          background: var(--bg-card);
          display: flex;
          flex-direction: column;
          height: 290px;
          overflow: hidden;
          transition: all 0.2s ease;
          position: relative;
        }
        .grid-terminal-card.focused {
          border-color: var(--color-primary);
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.18);
        }
        .grid-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 12px;
          border-bottom: 1px solid var(--border-color);
          background: rgba(0, 0, 0, 0.1);
          flex-shrink: 0;
          cursor: pointer;
        }
        .grid-card-title-area {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow: hidden;
          flex: 1;
        }
        .grid-card-title {
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .grid-badge {
          font-size: 0.6rem;
          font-weight: 500;
          padding: 1px 5px;
          border-radius: 4px;
          white-space: nowrap;
        }
        .grid-badge-workspace {
          background: rgba(168, 85, 247, 0.12);
          color: var(--color-primary);
          border: 1px solid rgba(168, 85, 247, 0.2);
        }
        .grid-badge-shell {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
          font-family: monospace;
        }
        .grid-card-actions {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: 8px;
          flex-shrink: 0;
        }
        .grid-action-btn {
          background: transparent;
          border: none;
          color: var(--text-dark);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.12s;
        }
        .grid-action-btn:hover {
          color: var(--text-main);
          background: rgba(255, 255, 255, 0.08);
        }
        .grid-action-btn-danger:hover {
          color: #ef4444;
          background: rgba(239, 68, 68, 0.1);
        }
        .grid-card-body {
          flex: 1;
          position: relative;
          background: #000;
          overflow: hidden;
        }
        .grid-card-body :global(.terminal-container) {
          border: none !important;
        }
        .grid-card-footer {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 12px;
          background: rgba(0, 0, 0, 0.18);
          border-top: 1px solid rgba(255, 255, 255, 0.02);
          font-size: 0.62rem;
          color: var(--text-muted);
          overflow-x: auto;
          scrollbar-width: none;
          flex-shrink: 0;
        }
        .grid-card-footer::-webkit-scrollbar {
          display: none;
        }
        .process-badge {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
          padding: 0 4px;
          border-radius: 3px;
          font-size: 0.58rem;
        }
        .process-badge-special {
          background: rgba(168, 85, 247, 0.12);
          color: var(--color-primary);
          border: 1px solid rgba(168, 85, 247, 0.2);
          padding: 0 4px;
          border-radius: 3px;
          font-size: 0.58rem;
        }
        .grid-empty-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          text-align: center;
          max-width: 500px;
          margin: 40px auto 0 auto;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }
        .grid-empty-icon-glow {
          position: relative;
          width: 54px;
          height: 54px;
          border-radius: 50%;
          background: rgba(168, 85, 247, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          margin-bottom: 16px;
        }
        .grid-empty-icon-glow::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 1.5px dashed var(--color-primary);
          opacity: 0.4;
          animation: rotateGlow 15s linear infinite;
        }
        @keyframes rotateGlow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .grid-empty-title {
          font-size: 0.82rem;
          font-weight: 700;
          color: var(--text-main);
          margin-bottom: 6px;
        }
        .grid-empty-text {
          font-size: 0.7rem;
          color: var(--text-muted);
          margin-bottom: 20px;
          line-height: 1.4;
        }
        .empty-suggestions {
          width: 100%;
          border-top: 1px solid var(--border-color);
          margin-top: 10px;
          padding-top: 16px;
          text-align: left;
        }
        .suggestions-title {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }
        .suggestion-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 6px 10px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          margin-bottom: 6px;
          cursor: pointer;
          transition: all 0.12s;
        }
        .suggestion-item:hover {
          background: rgba(168, 85, 247, 0.05);
          border-color: var(--color-primary);
        }
        .suggestion-details {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow: hidden;
          flex: 1;
        }
        .suggestion-name {
          font-size: 0.7rem;
          font-weight: 600;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .suggestion-ws {
          font-size: 0.62rem;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>

      {/* Header Area */}
      <div className="grid-tab-header">
        <div className="grid-header-left">
          <div className="grid-title-row">
            <span className="grid-title-text">Terminal Grid Monitor</span>
            <span className="grid-count-badge">
              {selectedTerminalIds.length} / {activeTerminals.length} Running
            </span>
          </div>
          <span className="grid-subtitle">
            Monitor and interact with terminal instances across workspaces in real time.
          </span>
        </div>

        <div className="grid-header-right" ref={configRef}>
          <button 
            className="grid-config-btn"
            onClick={() => setShowConfig(!showConfig)}
            title="Configure terminals shown in grid"
          >
            <LayoutGrid size={13} />
            <span>Select Terminals</span>
            <ChevronDown size={11} style={{ transform: showConfig ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.15s' }} />
          </button>

          {showConfig && (
            <div className="grid-config-dropdown">
              <div className="dropdown-search-wrapper">
                <Search size={12} style={{ color: 'var(--text-muted)' }} />
                <input 
                  type="text" 
                  className="dropdown-search-input"
                  placeholder="Search terminals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="dropdown-list">
                {Object.keys(filteredWorkspaces).length === 0 ? (
                  <div style={{ padding: '20px 10px', textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    No running terminals found matching query.
                  </div>
                ) : (
                  Object.entries(filteredWorkspaces).map(([wsId, group]) => (
                    <div key={wsId} className="dropdown-ws-group">
                      <div className="dropdown-ws-header">
                        <Folder size={10} style={{ color: 'var(--color-primary)', marginRight: '4px' }} />
                        <span>{group.ws.name}</span>
                      </div>
                      {group.terms.map(t => {
                        const isChecked = selectedTerminalIds.includes(t.id);
                        return (
                          <div 
                            key={t.id} 
                            className="dropdown-item"
                            onClick={() => toggleTerminalSelection(t.id)}
                          >
                            <div className="dropdown-item-left">
                              <div className={`custom-checkbox ${isChecked ? 'checked' : ''}`}>
                                {isChecked && <Check size={10} className="custom-checkbox-tick" strokeWidth={3} />}
                              </div>
                              <span className="dropdown-term-name" title={t.name}>{t.name}</span>
                            </div>
                            <span className="dropdown-term-shell">{t.shellType}</span>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Grid Content */}
      <div className="grid-tab-content">
        {selectedTerminalIds.length === 0 ? (
          <div className="grid-empty-container">
            <div className="grid-empty-icon-glow">
              <LayoutGrid size={24} />
            </div>
            <h3 className="grid-empty-title">Grid Monitor is Empty</h3>
            <p className="grid-empty-text">
              Configure this monitor by checking active terminals from the dropdown above, or select from the running list below to start.
            </p>

            {activeTerminals.length > 0 && (
              <div className="empty-suggestions">
                <div className="suggestions-title">Currently Running Terminals</div>
                {activeTerminals.map(t => {
                  const ws = getWorkspaceForPath(t.cwd);
                  return (
                    <div 
                      key={t.id}
                      className="suggestion-item"
                      onClick={() => toggleTerminalSelection(t.id)}
                    >
                      <div className="suggestion-details">
                        <TerminalIcon size={12} style={{ color: 'var(--text-muted)' }} />
                        <span className="suggestion-name" title={t.name}>{t.name}</span>
                        <span className="suggestion-ws">({ws?.name || 'External'})</span>
                      </div>
                      <Plus size={12} style={{ color: 'var(--color-primary)' }} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="terminal-grid-layout">
            {selectedTerminalIds.map(termId => {
              const term = terminalInstances[termId];
              if (!term) return null;

              const isFocused = focusedTermId === termId;
              const ws = getWorkspaceForPath(term.cwd);
              const pids = term.activeProcesses || [];

              return (
                <div 
                  key={termId}
                  className={`grid-terminal-card ${isFocused ? 'focused' : ''}`}
                  onClick={() => setFocusedTermId(termId)}
                >
                  {/* Card Header */}
                  <div className="grid-card-header" onClick={() => setFocusedTermId(termId)}>
                    <div className="grid-card-title-area">
                      <span className="grid-card-title" title={term.name}>{term.name}</span>
                      {ws && (
                        <span className="grid-badge grid-badge-workspace" title={ws.path}>
                          {ws.name}
                        </span>
                      )}
                      <span className="grid-badge grid-badge-shell">{term.shellType}</span>
                    </div>

                    <div className="grid-card-actions">
                      <button 
                        className="grid-action-btn"
                        onClick={(e) => { e.stopPropagation(); handleFocusFullTab(termId); }}
                        title="Go to full terminal tab"
                      >
                        <ExternalLink size={12} />
                      </button>
                      <button 
                        className="grid-action-btn grid-action-btn-danger"
                        onClick={(e) => { e.stopPropagation(); toggleTerminalSelection(termId); }}
                        title="Remove from grid"
                      >
                        <EyeOff size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Card Body (Interactive Terminal) */}
                  <div className="grid-card-body">
                    <TerminalInstance
                      tab={term as any}
                      active={!!(wsConnected && isFocused)}
                      wsConnected={wsConnected}
                      fontSize={terminalFontSize - 1} // slightly smaller font for grid cards
                      onTitleChange={(title) => handleTitleChange(term.id, title)}
                      onActiveProcessesChange={(processes) => handleActiveProcessesChange?.(term.id, processes)}
                      onFocus={() => setFocusedTermId(term.id)}
                      refreshTrigger={refreshTriggers?.[term.id] || 0}
                      isFocusedPane={isFocused}
                      fontFamily={fontFamily}
                      fontWeight={fontWeight}
                      accentColor={accentColor}
                      themeBackground={themeBackground}
                      themeForeground={themeForeground}
                    />
                  </div>

                  {/* Card Footer (Running processes summary) */}
                  <div className="grid-card-footer">
                    <span>Processes:</span>
                    {pids.length === 0 ? (
                      <span style={{ fontStyle: 'italic', opacity: 0.6 }}>idle</span>
                    ) : (
                      pids.map(p => {
                        const isAiAgent = p.isClaude || p.isGemini || p.isSuperagent;
                        return (
                          <span 
                            key={p.pid} 
                            className={`process-badge ${isAiAgent ? 'process-badge-special' : ''}`}
                            title={`${p.name} (PID: ${p.pid}) - ${p.commandLine}`}
                          >
                            {p.name}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
