import React, { useEffect, useRef, useState, useCallback } from 'react';
import { SearchAddon } from '@xterm/addon-search';

// ── Search Bar Sub-Component ──────────────────────────────────
interface SearchBarProps {
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

export function TerminalSearchBar({ searchAddon, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const [notFound, setNotFound] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback((term: string, forward = true) => {
    if (!searchAddon || !term) {
      setResultMsg('');
      setNotFound(false);
      return;
    }
    const opts = { caseSensitive, regex, decorations: {
      matchBackground: 'rgba(168,85,247,0.3)',
      matchBorder: 'rgba(168,85,247,0.8)',
      matchOverviewRuler: '#6366f1',
      activeMatchBackground: 'rgba(168,85,247,0.6)',
      activeMatchBorder: '#818cf8',
      activeMatchColorOverviewRuler: '#818cf8',
    }};
    const found = forward
      ? searchAddon.findNext(term, opts)
      : searchAddon.findPrevious(term, opts);
    if (!found) {
      setResultMsg('No results');
      setNotFound(true);
    } else {
      setResultMsg('');
      setNotFound(false);
    }
  }, [searchAddon, caseSensitive, regex]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Enter') {
      e.preventDefault();
      doSearch(query, !e.shiftKey);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    setNotFound(false);
    if (!v) { searchAddon?.clearDecorations?.(); setResultMsg(''); }
    else doSearch(v, true);
  };

  return (
    <div className="terminal-search-bar">
      <div className="terminal-search-input-wrap">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#64748b', flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Find in terminal…"
          className={`terminal-search-input${notFound ? ' terminal-search-input-error' : ''}`}
        />
        {resultMsg && (
          <span className="terminal-search-no-result">{resultMsg}</span>
        )}
      </div>

      <div className="terminal-search-toggles">
        <button
          title="Case sensitive (Alt+C)"
          onClick={() => setCaseSensitive(v => !v)}
          className={`terminal-search-toggle${caseSensitive ? ' active' : ''}`}
        >Aa</button>
        <button
          title="Use regex (Alt+R)"
          onClick={() => setRegex(v => !v)}
          className={`terminal-search-toggle${regex ? ' active' : ''}`}
        >.*</button>
      </div>

      <div className="terminal-search-nav">
        <button title="Previous (Shift+Enter)" onClick={() => doSearch(query, false)} className="terminal-search-nav-btn">↑</button>
        <button title="Next (Enter)" onClick={() => doSearch(query, true)} className="terminal-search-nav-btn">↓</button>
      </div>

      <button title="Close (Esc)" onClick={onClose} className="terminal-search-close">×</button>
    </div>
  );
}

// ── Smart Paste Confirm ────────────────────────────────────────
interface SmartPasteProps {
  text: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SmartPasteConfirm({ text, onConfirm, onCancel }: SmartPasteProps) {
  const lines = text.split('\n');
  const preview = lines.slice(0, 3).join('\n') + (lines.length > 3 ? `\n… (+${lines.length - 3} more lines)` : '');

  return (
    <div className="smart-paste-overlay">
      <div className="smart-paste-box">
        <div className="smart-paste-header">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <span>Paste {lines.length} lines?</span>
        </div>
        <pre className="smart-paste-preview">{preview}</pre>
        <div className="smart-paste-actions">
          <button onClick={onCancel} className="smart-paste-btn-cancel">Cancel</button>
          <button onClick={onConfirm} className="smart-paste-btn-confirm">Paste</button>
        </div>
      </div>
    </div>
  );
}

// ── Terminal Status Bar ────────────────────────────────────────
interface StatusBarProps {
  shellType: string;
  wsConnected: boolean;
  cursorCol: number;
  cursorRow: number;
  onClear: () => void;
  onSearch: () => void;
  pid?: number;
}

export function TerminalStatusBar({
  shellType, wsConnected, cursorCol, cursorRow,
  onClear, onSearch, pid
}: StatusBarProps) {
  const shellLabel: Record<string, string> = {
    powershell: 'PS',
    cmd: 'CMD',
    bash: 'Bash',
    gitbash: 'Git Bash',
    wsl: 'WSL',
  };

  return (
    <div className="terminal-status-bar">
      <div className="terminal-status-left">
        <span className={`terminal-status-dot${wsConnected ? ' connected' : ''}`} />
        <span className="terminal-status-shell">{shellLabel[shellType] || shellType}</span>
        {pid && pid > 0 && (
          <span className="terminal-status-pid" title="Process ID">PID {pid}</span>
        )}
      </div>
      <div className="terminal-status-right">
        <span className="terminal-status-cursor" title="Cursor position">
          {cursorCol}:{cursorRow}
        </span>
        <div className="terminal-status-divider" />
        <button className="terminal-status-btn" title="Search (Ctrl+Shift+F)" onClick={onSearch}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
        <button className="terminal-status-btn" title="Clear terminal" onClick={onClear}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Premium Context Menu ───────────────────────────────────────
interface ContextMenuProps {
  x: number;
  y: number;
  hasSelection: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onSearch: () => void;
  onClose: () => void;
}

export function TerminalContextMenu({ x, y, hasSelection, onCopy, onPaste, onSelectAll, onClear, onSearch, onClose }: ContextMenuProps) {
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.terminal-ctx-menu') === null) {
        onClose();
      }
    };
    window.addEventListener('mousedown', close, true);
    return () => window.removeEventListener('mousedown', close, true);
  }, [onClose]);

  const items = [
    {
      label: 'Copy',
      shortcut: 'Ctrl+C',
      disabled: !hasSelection,
      onClick: onCopy,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
      )
    },
    {
      label: 'Paste',
      shortcut: 'Ctrl+V',
      disabled: false,
      onClick: onPaste,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>
        </svg>
      )
    },
    { separator: true },
    {
      label: 'Select All',
      shortcut: 'Ctrl+A',
      disabled: false,
      onClick: onSelectAll,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>
        </svg>
      )
    },
    {
      label: 'Find…',
      shortcut: 'Ctrl+⇧+F',
      disabled: false,
      onClick: onSearch,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      )
    },
    { separator: true },
    {
      label: 'Clear',
      shortcut: '',
      disabled: false,
      onClick: onClear,
      danger: true,
      icon: (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        </svg>
      )
    }
  ] as Array<{ separator?: boolean; label?: string; shortcut?: string; disabled?: boolean; danger?: boolean; onClick?: () => void; icon?: React.ReactNode }>;

  return (
    <div
      className="terminal-ctx-menu"
      style={{ position: 'fixed', top: y, left: x, zIndex: 1000 }}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={i} className="terminal-ctx-separator" />
        ) : (
          <button
            key={i}
            onClick={item.onClick}
            disabled={item.disabled}
            className={`terminal-ctx-item${item.danger ? ' danger' : ''}`}
          >
            <span className="terminal-ctx-icon">{item.icon}</span>
            <span className="terminal-ctx-label">{item.label}</span>
            {item.shortcut && (
              <span className="terminal-ctx-shortcut">{item.shortcut}</span>
            )}
          </button>
        )
      )}
    </div>
  );
}
