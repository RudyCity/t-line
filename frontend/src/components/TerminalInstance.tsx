import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { CanvasAddon } from '@xterm/addon-canvas';
import { ImageAddon } from '@xterm/addon-image';
import { wsManager } from '../services/websocket';
import { ActiveProcessSummary } from '../hooks/useTerminals';

// Helper to detect if a background color is light/bright
function isLightColor(color: string | undefined): boolean {
  if (!color) return false;
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
    } else if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
    }
  }
  return false;
}


interface TerminalTab {
  id: string;
  name: string;
  cwd: string;
  shellType: string;
}

interface TerminalInstanceProps {
  tab: TerminalTab;
  active: boolean;
  wsConnected: boolean;
  fontSize: number;
  onTitleChange?: (title: string) => void;
  onActiveProcessesChange?: (processes: ActiveProcessSummary[]) => void;
  onFocus?: () => void;
  refreshTrigger?: number;
  isFocusedPane?: boolean;
  pid?: number;
  fontFamily?: string;
  fontWeight?: string;
  accentColor?: string;
  themeBackground?: string;
  themeForeground?: string;
}

// ── Search Bar Sub-Component ──────────────────────────────────
interface SearchBarProps {
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

function TerminalSearchBar({ searchAddon, onClose }: SearchBarProps) {
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

function SmartPasteConfirm({ text, onConfirm, onCancel }: SmartPasteProps) {
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

function TerminalStatusBar({
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

function TerminalContextMenu({ x, y, hasSelection, onCopy, onPaste, onSelectAll, onClear, onSearch, onClose }: ContextMenuProps) {
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

// ── Main Terminal Instance ─────────────────────────────────────
export function TerminalInstance({
  tab, active, wsConnected, fontSize,
  onTitleChange, onActiveProcessesChange, onFocus, refreshTrigger,
  isFocusedPane = false, pid,
  fontFamily, fontWeight, accentColor, themeBackground, themeForeground
}: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const onTitleChangeRef = useRef(onTitleChange);
  const onActiveProcessesChangeRef = useRef(onActiveProcessesChange);
  const onFocusRef = useRef(onFocus);

  const [showSearch, setShowSearch] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [cursorPos, setCursorPos] = useState({ col: 1, row: 1 });
  const [smartPasteText, setSmartPasteText] = useState<string | null>(null);
  const [localPid, setLocalPid] = useState<number | undefined>(pid);

  useEffect(() => {
    setLocalPid(pid);
  }, [pid]);


  // ── RAF write-batch queue ──────────────────────────────────
  const writeQueueRef = useRef<string[]>([]);
  const rafHandleRef = useRef<number | null>(null);

  const scheduleWrite = useCallback((data: string) => {
    writeQueueRef.current.push(data);
    if (rafHandleRef.current === null) {
      rafHandleRef.current = requestAnimationFrame(() => {
        rafHandleRef.current = null;
        const term = terminalRef.current;
        if (!term || writeQueueRef.current.length === 0) {
          writeQueueRef.current = [];
          return;
        }
        const combined = writeQueueRef.current.join('');
        writeQueueRef.current = [];
        term.write(combined);
      });
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    const interval = setInterval(() => {
      if (terminalRef.current) {
        setHasSelection(terminalRef.current.hasSelection());
      }
    }, 400);
    return () => clearInterval(interval);
  }, [active]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (terminalRef.current) {
      setHasSelection(terminalRef.current.hasSelection());
    }
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCopy = () => {
    if (terminalRef.current) {
      const selected = terminalRef.current.getSelection();
      if (selected) navigator.clipboard.writeText(selected);
    }
    setContextMenu(null);
  };

  const lastPasteTimeRef = useRef<number>(0);
  const lastPasteTextRef = useRef<string>('');

  const performPaste = useCallback((text: string) => {
    const now = Date.now();
    if (now - lastPasteTimeRef.current < 300 && text === lastPasteTextRef.current) {
      return;
    }
    lastPasteTimeRef.current = now;
    lastPasteTextRef.current = text;

    const lines = text.split('\n');
    if (lines.length >= 3) {
      setSmartPasteText(text);
    } else {
      wsManager.send(JSON.stringify({ type: 'data', id: tab.id, data: text }));
    }
  }, [tab.id]);

  const performPasteRef = useRef(performPaste);
  useEffect(() => {
    performPasteRef.current = performPaste;
  }, [performPaste]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && terminalRef.current) {
        performPaste(text);
      }
    } catch (err) {
      console.error('Failed to paste:', err);
    }
    setContextMenu(null);
  };

  const confirmSmartPaste = useCallback(() => {
    if (smartPasteText && terminalRef.current) {
      wsManager.send(JSON.stringify({ type: 'data', id: tab.id, data: smartPasteText }));
    }
    setSmartPasteText(null);
  }, [smartPasteText, tab.id]);

  const handleSelectAll = () => {
    if (terminalRef.current) {
      terminalRef.current.selectAll();
      setHasSelection(true);
    }
    setContextMenu(null);
  };

  const handleClear = useCallback(() => {
    if (terminalRef.current) terminalRef.current.clear();
    setContextMenu(null);
  }, []);

  const handleSearchOpen = useCallback(() => {
    setShowSearch(true);
    setContextMenu(null);
  }, []);

  const actualFontSize = window.innerWidth <= 768 ? 8 : fontSize;

  const debouncedFit = useCallback(
    (() => {
      let timeouts: NodeJS.Timeout[] = [];
      return () => {
        try {
          if (containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
            fitAddonRef.current?.fit();
          }
        } catch (e) {}

        timeouts.forEach(clearTimeout);
        timeouts = [];

        const intervals = [50, 150, 300, 500];
        intervals.forEach(ms => {
          const tid = setTimeout(() => {
            try {
              if (containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
                fitAddonRef.current?.fit();
              }
            } catch (e) {
              console.error('Interval fit failed:', e);
            }
          }, ms);
          timeouts.push(tid);
        });
      };
    })(),
    []
  );

  useEffect(() => { onTitleChangeRef.current = onTitleChange; }, [onTitleChange]);
  useEffect(() => { onActiveProcessesChangeRef.current = onActiveProcessesChange; }, [onActiveProcessesChange]);
  useEffect(() => { onFocusRef.current = onFocus; }, [onFocus]);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    searchAddonRef.current?.clearDecorations?.();
    terminalRef.current?.focus();
  }, []);

  // ── Terminal Initialization ────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: actualFontSize,
      fontFamily: fontFamily || 'JetBrains Mono, Fira Code, Courier New, monospace',
      fontWeight: (fontWeight || 'normal') as any,
      fontWeightBold: 'bold',
      lineHeight: 1.2,
      letterSpacing: 0,
      scrollback: 3000,
      scrollOnUserInput: true,
      fastScrollModifier: 'shift',
      fastScrollSensitivity: 5,
      smoothScrollDuration: 0,
      allowProposedApi: true,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      overviewRulerWidth: 10,
      theme: {
        background: themeBackground || '#000000',
        foreground: themeForeground || '#f8fafc',
        cursor: accentColor || '#6366f1',
        cursorAccent: themeBackground || '#000000',
        selectionBackground: isLightColor(themeBackground)
          ? (accentColor ? `color-mix(in srgb, ${accentColor} 40%, #000000)` : '#334155')
          : (accentColor ? `color-mix(in srgb, ${accentColor} 30%, transparent)` : 'rgba(99, 102, 241, 0.3)'),
        selectionForeground: '#ffffff',
        selectionInactiveBackground: isLightColor(themeBackground)
          ? (accentColor ? `color-mix(in srgb, ${accentColor} 20%, #000000)` : '#475569')
          : (accentColor ? `color-mix(in srgb, ${accentColor} 15%, transparent)` : 'rgba(99, 102, 241, 0.15)'),
        black: isLightColor(themeBackground) ? '#0f172a' : '#4a5568',
        red: '#ef4444',
        green: isLightColor(themeBackground) ? '#15803d' : '#10b981',
        yellow: isLightColor(themeBackground) ? '#b45309' : '#f59e0b',
        blue: isLightColor(themeBackground) ? '#1d4ed8' : '#3b82f6',
        magenta: isLightColor(themeBackground) ? '#7e22ce' : '#6366f1',
        cyan: isLightColor(themeBackground) ? '#0369a1' : '#06b6d4',
        white: isLightColor(themeBackground) ? '#0f172a' : '#cbd5e1',
        brightBlack: isLightColor(themeBackground) ? '#475569' : '#718096',
        brightRed: '#f87171',
        brightGreen: isLightColor(themeBackground) ? '#166534' : '#34d399',
        brightYellow: isLightColor(themeBackground) ? '#d97706' : '#fbbf24',
        brightBlue: isLightColor(themeBackground) ? '#1e40af' : '#60a5fa',
        brightMagenta: isLightColor(themeBackground) ? '#6b21a8' : '#818cf8',
        brightCyan: isLightColor(themeBackground) ? '#075985' : '#22d3ee',
        brightWhite: isLightColor(themeBackground) ? '#0f172a' : '#f1f5f9',
      }
    });

    // ── Addons ─────────────────────────────────────────────
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    const unicode11Addon = new Unicode11Addon();
    term.loadAddon(unicode11Addon);
    term.unicode.activeVersion = '11';

    const webLinksAddon = new WebLinksAddon((_, uri) => {
      window.open(uri, '_blank', 'noopener,noreferrer');
    });
    term.loadAddon(webLinksAddon);

    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;

    // Image protocol addon (sixel / iTerm2 inline images)
    const imageAddon = new ImageAddon();
    term.loadAddon(imageAddon);

    term.open(containerRef.current);

    // ── Canvas GPU renderer (load after open) ────────────
    try {
      const canvasAddon = new CanvasAddon();
      term.loadAddon(canvasAddon);
    } catch (e) {
      console.warn('Canvas renderer not available, using default DOM renderer:', e);
    }

    const handlePasteEvent = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const text = e.clipboardData?.getData('text');
      if (text) {
        performPasteRef.current(text);
      }
    };

    if (term.textarea) {
      term.textarea.setAttribute('inputmode', 'none');
      term.textarea.addEventListener('paste', handlePasteEvent);
    }

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.attachCustomKeyEventHandler((e) => {
      if (e.type === 'keydown') {
        const key = e.key.toLowerCase();
        // Ctrl+C (Copy) when there is selected text
        if (e.ctrlKey && key === 'c') {
          if (term.hasSelection()) {
            const selected = term.getSelection();
            if (selected) {
              navigator.clipboard.writeText(selected);
            }
            return false;
          }
        }
        // Ctrl+V / Cmd+V (Paste shortcut)
        // Yield control to browser native handler to trigger 'paste' event on textarea
        const isPasteShortcut = (e.ctrlKey && key === 'v') || (e.metaKey && key === 'v');
        if (isPasteShortcut) {
          return false;
        }
      }
      return true;
    });

    // ── Cursor position tracking ───────────────────────────
    term.onCursorMove(() => {
      const buf = term.buffer.active;
      setCursorPos({ col: buf.cursorX + 1, row: buf.cursorY + 1 });
    });

    // ── WebSocket subscriptions ────────────────────────────
    wsManager.subscribe(tab.id, (payload) => {
      if (payload.type === 'data') {
        scheduleWrite(payload.data);
      } else if (payload.type === 'replay') {
        scheduleWrite(payload.data);
      } else if (payload.type === 'title') {
        onTitleChangeRef.current?.(payload.title);
      } else if (payload.type === 'activeProcesses') {
        onActiveProcessesChangeRef.current?.(payload.processes);
      } else if (payload.type === 'pid') {
        setLocalPid(payload.pid);
      } else if (payload.type === 'exit') {
        term.write('\r\n\r\n[Process Exited]\r\n');
      } else if (payload.type === 're-attached') {
        window.dispatchEvent(new CustomEvent('tline-toast', {
          detail: { message: 'Session Re-attached' }
        }));
      }
    });

    term.onTitleChange((title) => {
      onTitleChangeRef.current?.(title);
    });

    term.onData((data) => {
      wsManager.send(JSON.stringify({ type: 'data', id: tab.id, data }));
    });

    term.onResize(({ cols, rows }) => {
      wsManager.send(JSON.stringify({ type: 'resize', id: tab.id, cols, rows }));
    });

    debouncedFit();

    // ── Window and Container resize ────────────────────────
    const handleResize = () => { debouncedFit(); };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => { handleResize(); });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // ── Focus triggers ─────────────────────────────────────
    const handleFocusTrigger = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('input') || target.closest('button') || target.closest('select') || target.closest('a')) {
        return;
      }
      if (terminalRef.current) {
        terminalRef.current.focus();
        if (terminalRef.current.textarea) {
          terminalRef.current.textarea.focus();
        }
        onFocusRef.current?.();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('click', handleFocusTrigger, true);
      container.addEventListener('touchend', handleFocusTrigger, true);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (container) {
        container.removeEventListener('click', handleFocusTrigger, true);
        container.removeEventListener('touchend', handleFocusTrigger, true);
      }
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
        rafHandleRef.current = null;
        writeQueueRef.current = [];
      }
      if (term.textarea) {
        term.textarea.removeEventListener('paste', handlePasteEvent);
      }
      wsManager.send(JSON.stringify({ type: 'suspend', id: tab.id }));
      wsManager.removeListener(tab.id);
      terminalRef.current = null;
      term.dispose();
    };
  }, [tab.id, debouncedFit, scheduleWrite]);

  // ── WS reconnect / activate → init ────────────────────────
  useEffect(() => {
    if (active && wsConnected && terminalRef.current) {
      const term = terminalRef.current;
      const cols = term.cols || 80;
      const rows = term.rows || 24;
      wsManager.send(JSON.stringify({
        type: 'init', id: tab.id, cwd: tab.cwd, cols, rows, shellType: tab.shellType
      }));
    }
  }, [active, wsConnected, tab.id, tab.cwd, tab.shellType]);

  // ── Manual refresh trigger ─────────────────────────────────
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0 && terminalRef.current && wsConnected) {
      const term = terminalRef.current;
      const actualCols = term.cols || 80;
      const actualRows = term.rows || 24;
      const SHRINK_COLS = Math.max(20, Math.floor(actualCols / 2));
      const SHRINK_ROWS = Math.max(5, Math.floor(actualRows / 2));
      wsManager.send(JSON.stringify({ type: 'resize', id: tab.id, cols: SHRINK_COLS, rows: SHRINK_ROWS }));

      const restoreTimer = setTimeout(() => {
        if (!terminalRef.current || !wsConnected) return;
        terminalRef.current.reset();
        wsManager.send(JSON.stringify({ type: 'resize', id: tab.id, cols: actualCols, rows: actualRows }));
        wsManager.send(JSON.stringify({ type: 'init', id: tab.id, cwd: tab.cwd, cols: actualCols, rows: actualRows, shellType: tab.shellType }));
        debouncedFit();
      }, 120);

      return () => clearTimeout(restoreTimer);
    }
  }, [refreshTrigger, wsConnected, tab.id, tab.cwd, tab.shellType, debouncedFit]);

  // ── Active tab: refit + focus ──────────────────────────────
  useEffect(() => {
    if (active) {
      debouncedFit();
      const timer = setTimeout(() => { terminalRef.current?.focus(); }, 80);
      return () => clearTimeout(timer);
    }
  }, [active, debouncedFit]);

  // ── Font size, Family & Weight ──────────────────────────────
  useEffect(() => {
    if (terminalRef.current) {
      try {
        terminalRef.current.options.fontSize = actualFontSize;
        if (fontFamily) {
          terminalRef.current.options.fontFamily = fontFamily;
        }
        if (fontWeight) {
          terminalRef.current.options.fontWeight = fontWeight as any;
        }
      } catch (e) {
        console.error('Error changing terminal font settings:', e);
      }
    }
  }, [actualFontSize, fontFamily, fontWeight, debouncedFit]);

  // ── Theme colors ───────────────────────────────────────────
  useEffect(() => {
    if (terminalRef.current) {
      try {
        const isLight = isLightColor(themeBackground);
        terminalRef.current.options.theme = {
          background: themeBackground || '#000000',
          foreground: themeForeground || '#f8fafc',
          cursor: accentColor || '#6366f1',
          cursorAccent: themeBackground || '#000000',
          selectionBackground: isLight
            ? (accentColor ? `color-mix(in srgb, ${accentColor} 40%, #000000)` : '#334155')
            : (accentColor ? `color-mix(in srgb, ${accentColor} 30%, transparent)` : 'rgba(99, 102, 241, 0.3)'),
          selectionForeground: '#ffffff',
          selectionInactiveBackground: isLight
            ? (accentColor ? `color-mix(in srgb, ${accentColor} 20%, #000000)` : '#475569')
            : (accentColor ? `color-mix(in srgb, ${accentColor} 15%, transparent)` : 'rgba(99, 102, 241, 0.15)'),
          black: isLight ? '#0f172a' : '#4a5568',
          red: '#ef4444',
          green: isLight ? '#15803d' : '#10b981',
          yellow: isLight ? '#b45309' : '#f59e0b',
          blue: isLight ? '#1d4ed8' : '#3b82f6',
          magenta: isLight ? '#7e22ce' : '#6366f1',
          cyan: isLight ? '#0369a1' : '#06b6d4',
          white: isLight ? '#0f172a' : '#cbd5e1',
          brightBlack: isLight ? '#475569' : '#718096',
          brightRed: '#f87171',
          brightGreen: isLight ? '#166534' : '#34d399',
          brightYellow: isLight ? '#d97706' : '#fbbf24',
          brightBlue: isLight ? '#1e40af' : '#60a5fa',
          brightMagenta: isLight ? '#6b21a8' : '#818cf8',
          brightCyan: isLight ? '#075985' : '#22d3ee',
          brightWhite: isLight ? '#0f172a' : '#f1f5f9',
        };
      } catch (e) {
        console.error('Error updating terminal theme:', e);
      }
    }
  }, [accentColor, themeBackground, themeForeground]);

  // ── Search toggle keyboard (Ctrl+Shift+F) ─────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!active) return;
      if (e.ctrlKey && e.shiftKey && e.key === 'F') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [active]);

  const handleTerminalFocus = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input') || target.closest('button') || target.closest('select') || target.closest('a')) return;
    if (terminalRef.current) {
      terminalRef.current.focus();
      if (terminalRef.current.textarea) terminalRef.current.textarea.focus();
      onFocusRef.current?.();
    }
  };



  return (
    <div
      className={`terminal-pane-root${isFocusedPane ? ' terminal-pane-focused' : ''}`}
      style={{ backgroundColor: themeBackground || '#0b0f19' }}
      onClick={handleTerminalFocus}
      onTouchEnd={handleTerminalFocus}
      onContextMenu={handleContextMenu}
    >
      {showSearch && (
        <TerminalSearchBar searchAddon={searchAddonRef.current} onClose={closeSearch} />
      )}

      <div className="terminal-element-wrapper" style={{ backgroundColor: themeBackground || '#0b0f19' }}>
        <div 
          ref={containerRef} 
          className="terminal-element" 
          style={{ backgroundColor: themeBackground || '#0b0f19' }}
        />
      </div>

      <TerminalStatusBar
        shellType={tab.shellType}
        wsConnected={wsConnected}
        cursorCol={cursorPos.col}
        cursorRow={cursorPos.row}
        onClear={handleClear}
        onSearch={handleSearchOpen}
        pid={localPid}
      />

      {contextMenu && (
        <TerminalContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          hasSelection={hasSelection}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onSelectAll={handleSelectAll}
          onClear={handleClear}
          onSearch={handleSearchOpen}
          onClose={() => setContextMenu(null)}
        />
      )}

      {smartPasteText && (
        <SmartPasteConfirm
          text={smartPasteText}
          onConfirm={confirmSmartPaste}
          onCancel={() => setSmartPasteText(null)}
        />
      )}
    </div>
  );
}
