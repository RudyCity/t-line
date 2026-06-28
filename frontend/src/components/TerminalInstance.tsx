import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { SearchAddon } from 'xterm-addon-search';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import { wsManager } from '../services/websocket';

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
  onFocus?: () => void;
  refreshTrigger?: number;
}

// ── Search Bar Sub-Component ──────────────────────────────
interface SearchBarProps {
  searchAddon: SearchAddon | null;
  onClose: () => void;
}

function TerminalSearchBar({ searchAddon, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [regex, setRegex] = useState(false);
  const [resultMsg, setResultMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const doSearch = useCallback((term: string, forward = true) => {
    if (!searchAddon || !term) {
      setResultMsg('');
      return;
    }
    const opts = { caseSensitive, regex };
    const found = forward
      ? searchAddon.findNext(term, opts)
      : searchAddon.findPrevious(term, opts);
    setResultMsg(found ? '' : 'No results');
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
    if (!v) { searchAddon?.clearDecorations?.(); setResultMsg(''); }
    else doSearch(v, true);
  };

  return (
    <div style={{
      position: 'absolute', top: 0, right: '12px', zIndex: 100,
      display: 'flex', alignItems: 'center', gap: '6px',
      background: 'rgba(15,17,26,0.97)',
      border: '1px solid rgba(168,85,247,0.35)',
      borderTop: 'none', borderRadius: '0 0 8px 8px',
      padding: '6px 10px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      backdropFilter: 'blur(12px)'
    }}>
      <input
        ref={inputRef}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="Find in terminal…"
        style={{
          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '4px', color: '#f1f5f9', fontSize: '12px',
          padding: '3px 8px', outline: 'none', width: '180px', fontFamily: 'var(--font-mono)'
        }}
      />
      {resultMsg && (
        <span style={{ fontSize: '10px', color: '#f87171' }}>{resultMsg}</span>
      )}
      <button
        title="Case sensitive (Alt+C)"
        onClick={() => setCaseSensitive(v => !v)}
        style={{
          background: caseSensitive ? 'rgba(168,85,247,0.3)' : 'transparent',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
          color: caseSensitive ? '#c084fc' : '#64748b', fontSize: '11px',
          padding: '2px 6px', cursor: 'pointer'
        }}>Aa</button>
      <button
        title="Use regex (Alt+R)"
        onClick={() => setRegex(v => !v)}
        style={{
          background: regex ? 'rgba(168,85,247,0.3)' : 'transparent',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px',
          color: regex ? '#c084fc' : '#64748b', fontSize: '11px',
          padding: '2px 6px', cursor: 'pointer'
        }}>.*</button>
      <button title="Previous (Shift+Enter)" onClick={() => doSearch(query, false)}
        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', padding: '2px 4px' }}>↑</button>
      <button title="Next (Enter)" onClick={() => doSearch(query, true)}
        style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', padding: '2px 4px' }}>↓</button>
      <button title="Close (Esc)" onClick={onClose}
        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px', padding: '2px 4px' }}>×</button>
    </div>
  );
}

// ── Main Terminal Instance ────────────────────────────────
export function TerminalInstance({ tab, active, wsConnected, fontSize, onTitleChange, onFocus, refreshTrigger }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const onTitleChangeRef = useRef(onTitleChange);
  const onFocusRef = useRef(onFocus);
  const [showSearch, setShowSearch] = useState(false);
  const isFirstRender = useRef(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);

  // ── RAF write-batch queue ─────────────────────────────────
  // Data arriving from the WebSocket is pushed here and flushed in a single
  // requestAnimationFrame callback, so xterm.js only repaints once per frame
  // (≈16ms) instead of on every individual WS message. This eliminates the
  // blink/flicker seen when AI agents stream rapid output (spinners, TUI redraws).
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
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    window.addEventListener('contextmenu', closeMenu);
    return () => {
      window.removeEventListener('click', closeMenu);
      window.removeEventListener('contextmenu', closeMenu);
    };
  }, [contextMenu]);

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
    setContextMenu({
      x: e.clientX,
      y: e.clientY
    });
  };

  const handleCopy = () => {
    if (terminalRef.current) {
      const selected = terminalRef.current.getSelection();
      if (selected) {
        navigator.clipboard.writeText(selected);
      }
    }
    setContextMenu(null);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && terminalRef.current) {
        wsManager.send(JSON.stringify({ type: 'data', id: tab.id, data: text }));
      }
    } catch (err) {
      console.error('Failed to paste:', err);
    }
    setContextMenu(null);
  };

  const handleSelectAll = () => {
    if (terminalRef.current) {
      terminalRef.current.selectAll();
      setHasSelection(true);
    }
    setContextMenu(null);
  };

  const handleClear = () => {
    if (terminalRef.current) {
      terminalRef.current.clear();
    }
    setContextMenu(null);
  };

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

  useEffect(() => {
    onTitleChangeRef.current = onTitleChange;
  }, [onTitleChange]);

  useEffect(() => {
    onFocusRef.current = onFocus;
  }, [onFocus]);

  const closeSearch = useCallback(() => {
    setShowSearch(false);
    searchAddonRef.current?.clearDecorations?.();
    terminalRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    // ── Instantiate Terminal ─────────────────────────────
    const term = new Terminal({
      cursorBlink: true,
      fontSize: actualFontSize,
      fontFamily: 'JetBrains Mono, Fira Code, Courier New, monospace',
      lineHeight: 1.2,
      letterSpacing: 0,
      scrollback: 10000,
      scrollOnUserInput: true,
      fastScrollModifier: 'shift',
      fastScrollSensitivity: 5,
      smoothScrollDuration: 0,
      allowProposedApi: true,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      theme: {
        background: '#000000',
        foreground: '#f8fafc',
        cursor: '#a855f7',
        cursorAccent: '#000000',
        selectionBackground: 'rgba(168, 85, 247, 0.3)',
        selectionForeground: '#ffffff',
        selectionInactiveBackground: 'rgba(168, 85, 247, 0.15)',
        black: '#1e293b',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#cbd5e1',
        brightBlack: '#475569',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#f1f5f9'
      }
    });

    // ── Addons ───────────────────────────────────────────
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

    term.open(containerRef.current);

    if (term.textarea) {
      term.textarea.setAttribute('inputmode', 'none');
    }

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // ── WebSocket subscriptions ──────────────────────────
    wsManager.subscribe(tab.id, (payload) => {
      if (payload.type === 'data') {
        // Use RAF-batched write to prevent xterm repaint on every WS message
        scheduleWrite(payload.data);
      } else if (payload.type === 'replay') {
        // Buffer replay on reconnect — batch write silently
        scheduleWrite(payload.data);
      } else if (payload.type === 'title') {
        onTitleChangeRef.current?.(payload.title);
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

    // Call debouncedFit on initialization after registering listeners
    debouncedFit();

    // ── Window and Container resize ──────────────────────
    const handleResize = () => {
      debouncedFit();
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // ── Capturing focus triggers for click/touch (bypassing xterm stopPropagation) ──
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
      // Cancel any pending RAF write to avoid writing to disposed terminal
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
        rafHandleRef.current = null;
        writeQueueRef.current = [];
      }
      
      // Suspend sending terminal updates to backend, remove listener, and nullify ref
      wsManager.send(JSON.stringify({ type: 'suspend', id: tab.id }));
      wsManager.removeListener(tab.id);
      terminalRef.current = null;
      term.dispose();
    };
  }, [tab.id, debouncedFit, scheduleWrite]);

  // ── WebSocket reconnect or activation → send init ────────
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

  // ── Manual refresh trigger with normalize trick ─────────────
  // Kirim resize kecil dulu (shrink), delay, lalu restore ke ukuran asli.
  // Ini memaksa PTY + aplikasi TUI (Claude Code, Antigravity CLI, dll)
  // yang menggunakan alternate screen buffer untuk redraw ulang dengan benar.
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0 && terminalRef.current && wsConnected) {
      const term = terminalRef.current;

      // Ambil ukuran aktual terminal saat ini
      const actualCols = term.cols || 80;
      const actualRows = term.rows || 24;

      // Step 1: Shrink — kirim ukuran kecil ke PTY backend untuk trigger SIGWINCH
      const SHRINK_COLS = Math.max(20, Math.floor(actualCols / 2));
      const SHRINK_ROWS = Math.max(5, Math.floor(actualRows / 2));
      wsManager.send(JSON.stringify({
        type: 'resize', id: tab.id, cols: SHRINK_COLS, rows: SHRINK_ROWS
      }));

      // Step 2: Restore ke ukuran asli setelah delay singkat
      // PTY + TUI apps akan menerima SIGWINCH kedua dan redraw ke ukuran benar
      const restoreTimer = setTimeout(() => {
        if (!terminalRef.current || !wsConnected) return;

        // Reset visual buffer xterm
        terminalRef.current.reset();

        // Restore ukuran terminal ke backend
        wsManager.send(JSON.stringify({
          type: 'resize', id: tab.id, cols: actualCols, rows: actualRows
        }));

        // Re-init untuk replay buffer dari backend
        wsManager.send(JSON.stringify({
          type: 'init', id: tab.id, cwd: tab.cwd, cols: actualCols, rows: actualRows, shellType: tab.shellType
        }));

        // Re-fit xterm agar sinkron dengan container
        debouncedFit();
      }, 120);

      return () => clearTimeout(restoreTimer);
    }
  }, [refreshTrigger, wsConnected, tab.id, tab.cwd, tab.shellType, debouncedFit]);


  // ── Active tab: refit + focus ────────────────────────────
  useEffect(() => {
    if (active) {
      debouncedFit();
      const timer = setTimeout(() => {
        terminalRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [active, debouncedFit]);

  // ── Font size ────────────────────────────────────────────
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (terminalRef.current) {
      try {
        terminalRef.current.options.fontSize = actualFontSize;
        debouncedFit();
      } catch (e) {
        console.error('Error changing terminal font size:', e);
      }
    }
  }, [actualFontSize, debouncedFit]);

  // ── Search toggle keyboard (Ctrl+F when terminal is focused) ─
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

  return (
    <div 
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onClick={handleTerminalFocus}
      onTouchEnd={handleTerminalFocus}
      onContextMenu={handleContextMenu}
    >
      {showSearch && (
        <TerminalSearchBar searchAddon={searchAddonRef.current} onClose={closeSearch} />
      )}
      <div ref={containerRef} className="terminal-element" />

      {contextMenu && (
        <div 
          className="terminal-context-menu"
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 1000
          }}
        >
          <button
            onClick={handleCopy}
            disabled={!hasSelection}
            className="terminal-context-menu-item"
          >
            <span>Copy</span>
          </button>
          <button
            onClick={handlePaste}
            className="terminal-context-menu-item"
          >
            <span>Paste</span>
          </button>
          <div className="terminal-context-menu-separator" />
          <button
            onClick={handleSelectAll}
            className="terminal-context-menu-item"
          >
            <span>Select All</span>
          </button>
          <button
            onClick={handleClear}
            className="terminal-context-menu-item"
          >
            <span>Clear Terminal</span>
          </button>
        </div>
      )}
    </div>
  );
}
