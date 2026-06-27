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
export function TerminalInstance({ tab, active, wsConnected, fontSize, onTitleChange, onFocus }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const onTitleChangeRef = useRef(onTitleChange);
  const onFocusRef = useRef(onFocus);
  const [showSearch, setShowSearch] = useState(false);

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
      fontSize: fontSize,
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

    setTimeout(() => {
      try { fitAddon.fit(); } catch (e) { console.error('Initial fit failed:', e); }
    }, 100);

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // ── WebSocket subscriptions ──────────────────────────
    wsManager.subscribe(tab.id, (payload) => {
      if (payload.type === 'data') {
        term.write(payload.data);
      } else if (payload.type === 'replay') {
        // Buffer replay on reconnect — write silently
        term.write(payload.data);
      } else if (payload.type === 'title') {
        onTitleChangeRef.current?.(payload.title);
      } else if (payload.type === 'exit') {
        term.write('\r\n\r\n[Process Exited]\r\n');
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

    // ── Window and Container resize ──────────────────────
    const handleResize = () => {
      try {
        if (containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
          fitAddon.fit();
        }
      } catch (e) {}
    };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      term.dispose();
    };
  }, [tab.id]);

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


  // ── Active tab: refit + focus ────────────────────────────
  useEffect(() => {
    if (active && fitAddonRef.current) {
      setTimeout(() => {
        try { fitAddonRef.current?.fit(); } catch (e) {}
        terminalRef.current?.focus();
      }, 50);
    }
  }, [active]);

  // ── Font size ────────────────────────────────────────────
  useEffect(() => {
    if (terminalRef.current && fitAddonRef.current) {
      try {
        terminalRef.current.options.fontSize = fontSize;
        setTimeout(() => { try { fitAddonRef.current?.fit(); } catch (e) {} }, 50);
      } catch (e) {
        console.error('Error changing terminal font size:', e);
      }
    }
  }, [fontSize]);

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
    >
      {showSearch && (
        <TerminalSearchBar searchAddon={searchAddonRef.current} onClose={closeSearch} />
      )}
      <div ref={containerRef} className="terminal-element" />
    </div>
  );
}
