import { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
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
}

export function TerminalInstance({ tab, active, wsConnected, fontSize, onTitleChange }: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const onTitleChangeRef = useRef(onTitleChange);

  useEffect(() => {
    onTitleChangeRef.current = onTitleChange;
  }, [onTitleChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Instantiate Terminal with enhanced behavior (superagent-style)
    const term = new Terminal({
      cursorBlink: true,
      fontSize: fontSize,
      fontFamily: 'JetBrains Mono, Fira Code, Courier New, monospace',
      lineHeight: 1.2,
      letterSpacing: 0,
      scrollback: 10000,           // Large scrollback buffer (like superagent)
      scrollOnUserInput: true,     // Scroll to bottom when user types
      fastScrollModifier: 'shift', // Shift+scroll = fast scroll
      fastScrollSensitivity: 5,
      smoothScrollDuration: 0,     // No animation lag on scroll
      allowProposedApi: true,      // Enable proposed API for link support
      macOptionIsMeta: true,
      rightClickSelectsWord: true, // Right-click selects word (superagent behavior)
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

    // --- Addons ---
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // WebLinksAddon: makes URLs clickable in the terminal (like superagent)
    const webLinksAddon = new WebLinksAddon((_, uri) => {
      window.open(uri, '_blank', 'noopener,noreferrer');
    }, {
      urlRegex: /(?:https?|ftp):\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/
    });
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);

    // Slight timeout to let DOM render completely, then fit
    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch (e) {
        console.error('Initial terminal fit failed:', e);
      }
    }, 100);

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    // Setup communication with Multiplexing Websocket
    wsManager.subscribe(tab.id, (payload) => {
      if (payload.type === 'data') {
        term.write(payload.data);
      } else if (payload.type === 'title') {
        onTitleChangeRef.current?.(payload.title);
      } else if (payload.type === 'exit') {
        term.write('\r\n\r\n[Process Exited]\r\n');
      }
    });

    // Listen to title changes from the terminal shell
    term.onTitleChange((title) => {
      onTitleChangeRef.current?.(title);
    });

    // Listen to user keyboard entries
    term.onData((data) => {
      wsManager.send(JSON.stringify({
        type: 'data',
        id: tab.id,
        data
      }));
    });

    // Listen to resizes
    term.onResize(({ cols, rows }) => {
      wsManager.send(JSON.stringify({
        type: 'resize',
        id: tab.id,
        cols,
        rows
      }));
    });

    // Window resize handler
    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch (e) {}
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      term.dispose();
    };
  }, [tab.id]);

  // Hook to handle WebSocket reconnect and initial configuration
  useEffect(() => {
    if (wsConnected && terminalRef.current) {
      const term = terminalRef.current;
      const cols = term.cols || 80;
      const rows = term.rows || 24;
      wsManager.send(JSON.stringify({
        type: 'init',
        id: tab.id,
        cwd: tab.cwd,
        cols,
        rows,
        shellType: tab.shellType
      }));
    }
  }, [wsConnected, tab.id, tab.cwd, tab.shellType]);

  // Refit when this terminal becomes the active tab
  useEffect(() => {
    if (active && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
        } catch (e) {}
      }, 50);
    }
  }, [active]);

  // Dynamic font size updates
  useEffect(() => {
    if (terminalRef.current && fitAddonRef.current) {
      try {
        terminalRef.current.options.fontSize = fontSize;
        setTimeout(() => {
          try {
            fitAddonRef.current?.fit();
          } catch (e) {}
        }, 50);
      } catch (e) {
        console.error('Error changing terminal font size:', e);
      }
    }
  }, [fontSize]);

  return <div ref={containerRef} className="terminal-element" />;
}
