import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, FileCode, Terminal as TerminalIcon, GitCompare, GitBranch } from 'lucide-react';
import { TabData, TerminalInstanceData } from '../hooks/useTerminals';

interface TabsDropdownProps {
  filteredTabs: TabData[];
  activeTabId: string | null;
  setActiveTabId: (id: string) => void;
  closeTerminal: (id: string, e?: React.MouseEvent) => void;
  terminalInstances: Record<string, TerminalInstanceData>;
  onClose: () => void;
  getTabGitBranch: (tab: TabData) => string | null | undefined;
  handleCloseOtherTabs: (tabId: string) => void;
  handleCloseAllTabs: () => void;
}

export const TabsDropdown: React.FC<TabsDropdownProps> = ({
  filteredTabs,
  activeTabId,
  setActiveTabId,
  closeTerminal,
  terminalInstances,
  onClose,
  getTabGitBranch,
  handleCloseOtherTabs,
  handleCloseAllTabs,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Auto-focus search input on mount
  useEffect(() => {
    // Small delay to ensure render is complete
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // Filter tabs based on search query
  const matchingTabs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return filteredTabs;

    return filteredTabs.filter(t => {
      const isFile = t.type === 'file';
      const isDiff = t.type === 'diff';
      const focusedInst = !isFile && !isDiff && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
      const displayName = isFile ? t.name : (focusedInst?.name || t.name);
      
      const matchName = displayName.toLowerCase().includes(query);
      const matchPath = t.filePath?.toLowerCase().includes(query) || false;
      const matchCwd = focusedInst?.cwd?.toLowerCase().includes(query) || false;
      const matchShell = focusedInst?.shellType?.toLowerCase().includes(query) || false;

      return matchName || matchPath || matchCwd || matchShell;
    });
  }, [filteredTabs, searchQuery, terminalInstances]);

  // Reset highlighted index when matching tabs change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [matchingTabs.length]);

  // Scroll highlighted item into view
  useEffect(() => {
    const highlightedTab = matchingTabs[highlightedIndex];
    if (highlightedTab && itemRefs.current[highlightedTab.id]) {
      itemRefs.current[highlightedTab.id]?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [highlightedIndex, matchingTabs]);

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (matchingTabs.length === 0) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(prev => (prev + 1) % matchingTabs.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev - 1 + matchingTabs.length) % matchingTabs.length);
        break;
      case 'Enter':
        e.preventDefault();
        const selectedTab = matchingTabs[highlightedIndex];
        if (selectedTab) {
          setActiveTabId(selectedTab.id);
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
      case 'Delete':
      case 'Backspace':
        // Only allow closing via Delete key if search query is empty to avoid conflict with typing
        if (!searchQuery && matchingTabs[highlightedIndex]) {
          e.preventDefault();
          const targetTabId = matchingTabs[highlightedIndex].id;
          closeTerminal(targetTabId);
          if (filteredTabs.length <= 1) {
            onClose();
          }
        }
        break;
      default:
        break;
    }
  };

  // Tab stats helper
  const stats = useMemo(() => {
    const terminalsCount = filteredTabs.filter(t => t.type === 'terminal').length;
    const filesCount = filteredTabs.filter(t => t.type === 'file').length;
    const diffsCount = filteredTabs.filter(t => t.type === 'diff').length;
    return { terminalsCount, filesCount, diffsCount };
  }, [filteredTabs]);

  return (
    <div className="tabs-dropdown-menu dropdown-menu" onKeyDown={handleKeyDown}>
      {/* Header */}
      <div className="tabs-dropdown-header">
        <span>Open Tabs ({filteredTabs.length})</span>
        <span style={{ fontSize: '10px', opacity: 0.8 }}>
          {stats.terminalsCount > 0 && `${stats.terminalsCount} Terminals`}
          {stats.filesCount > 0 && `${stats.terminalsCount > 0 ? ', ' : ''}${stats.filesCount} Files`}
          {stats.diffsCount > 0 && `${(stats.terminalsCount > 0 || stats.filesCount > 0) ? ', ' : ''}${stats.diffsCount} Diffs`}
        </span>
      </div>

      {/* Search Input */}
      <div className="tabs-dropdown-search-wrapper">
        <Search size={12} className="tabs-dropdown-search-icon" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search tabs by name, path..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="tabs-dropdown-search-input"
        />
        {searchQuery && (
          <button 
            className="tabs-dropdown-clear-btn" 
            onClick={() => { setSearchQuery(''); inputRef.current?.focus(); }}
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* List */}
      <div className="tabs-dropdown-list">
        {matchingTabs.length === 0 ? (
          <div className="tabs-dropdown-no-results">No matching tabs</div>
        ) : (
          matchingTabs.map((t, index) => {
            const isFile = t.type === 'file';
            const isDiff = t.type === 'diff';
            const focusedInst = !isFile && !isDiff && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
            
            // Build displayName
            let displayName = t.name;
            if (focusedInst?.name) {
              displayName = focusedInst.name;
            }

            const isActive = activeTabId === t.id;
            const isHighlighted = highlightedIndex === index;
            const branch = getTabGitBranch(t);

            // Path/Details subtitle
            let details = '';
            if (isFile && t.filePath) {
              details = t.filePath;
            } else if (isDiff) {
              details = t.commitHash === 'WORKTREE' ? 'Working Tree changes' : `Diff: ${t.commitHash?.slice(0, 7) || ''}`;
            } else if (focusedInst) {
              details = focusedInst.cwd || focusedInst.shellType || '';
            }

            return (
              <div
                key={t.id}
                ref={el => { itemRefs.current[t.id] = el; }}
                className={`tabs-dropdown-item ${isActive ? 'active' : ''} ${isHighlighted && !isActive ? 'keyboard-highlight' : ''}`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onClick={() => {
                  setActiveTabId(t.id);
                  onClose();
                }}
              >
                <div className="tabs-dropdown-item-content">
                  {/* Icon */}
                  {isFile ? (
                    <FileCode size={13} className={isActive ? 'text-purple-400' : 'text-slate-400'} />
                  ) : isDiff ? (
                    <GitCompare size={13} className={isActive ? 'text-purple-400' : 'text-slate-400'} />
                  ) : (
                    <TerminalIcon size={13} className={isActive ? 'text-purple-400' : 'text-slate-400'} />
                  )}

                  {/* Name and path details */}
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span className="tabs-dropdown-item-name">{displayName}</span>
                    {details && (
                      <span 
                        style={{ fontSize: '9px', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden', textDirection: 'rtl', textOverflow: 'ellipsis' } as any}
                        title={details}
                      >
                        {details}
                      </span>
                    )}
                  </div>

                  {/* Git branch badge */}
                  {branch && (
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '2px', 
                        fontSize: '9px', 
                        background: 'rgba(168, 85, 247, 0.1)', 
                        color: 'var(--accent-color)', 
                        padding: '1px 4px', 
                        borderRadius: '3px',
                        marginLeft: '4px',
                        flexShrink: 0
                      }}
                    >
                      <GitBranch size={8} />
                      <span>{branch}</span>
                    </div>
                  )}
                </div>

                {/* Close button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(t.id, e);
                    // Adjust focus index if the current tab is deleted
                    if (filteredTabs.length <= 1) {
                      onClose();
                    }
                  }}
                  className="tabs-dropdown-item-close"
                  title="Close Tab"
                >
                  ×
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Actions */}
      {filteredTabs.length > 1 && (
        <div className="tabs-dropdown-footer">
          <button
            onClick={() => {
              if (activeTabId) {
                handleCloseOtherTabs(activeTabId);
                onClose();
              }
            }}
            disabled={!activeTabId}
            className="tabs-dropdown-footer-btn"
            title="Close all tabs except the active one"
          >
            Close Others
          </button>
          <button
            onClick={() => {
              handleCloseAllTabs();
              onClose();
            }}
            className="tabs-dropdown-footer-btn"
            title="Close all open tabs"
          >
            Close All
          </button>
        </div>
      )}
    </div>
  );
};
