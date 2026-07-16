import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { WebglAddon } from '@xterm/addon-webgl';
import { CanvasAddon } from '@xterm/addon-canvas';
import { ImageAddon } from '@xterm/addon-image';
import { wsManager } from '../services/websocket';
import { useTerminalTouchMapping } from '../hooks/useTerminalTouchMapping';
import { useTerminalInitialCommand } from '../hooks/useTerminalInitialCommand';
import {
  TerminalSearchBar,
  SmartPasteConfirm,
  TerminalStatusBar,
  TerminalContextMenu
} from './TerminalSubComponents';
import {
  TerminalInstanceProps,
  isMobileDevice,
  isRemoteConnection,
  getActualFontSize,
  getTerminalTheme,
  copyToClipboard,
  registerFileLinkProvider
} from './TerminalHelpers';

// ── Main Terminal Instance ─────────────────────────────────────
export function TerminalInstance({
  tab, active, wsConnected, fontSize,
  onTitleChange, onActiveProcessesChange, onFocus, refreshTrigger,
  isFocusedPane = false, pid,
  fontFamily, fontWeight, accentColor, themeBackground, themeForeground,
  disableAutoFocus = false, onClearInitialCommand,
  defaultShell, setDefaultShell, handleZoomIn, handleZoomOut, onRefreshTerminal
}: TerminalInstanceProps) {
  const activeProcesses = (tab as any).activeProcesses as any[] | undefined;
  const isAiAgentRunning = activeProcesses?.some(p => p.isClaude || p.isGemini || p.isSuperagent || p.isAgy || p.isOpenCode) || false;

  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const lastViewportRef = useRef<string>('');
  // Tracks every addon loaded into the terminal so we can dispose them
  // individually before term.dispose(), preventing xterm's AddonManager
  // from iterating addons with undefined internal state (_isDisposed error).
  const addonListRef = useRef<{ dispose: () => void }[]>([]);
  const onTitleChangeRef = useRef(onTitleChange);
  const onActiveProcessesChangeRef = useRef(onActiveProcessesChange);
  const onFocusRef = useRef(onFocus);
  // Callback ref used by silence-detection to signal incoming PTY data.
  const onPtyDataRef = useRef<(() => void) | null>(null);

  // Custom hook to handle touch-to-mouse mapping for mobile/tablet devices
  useTerminalTouchMapping({ containerRef, terminalRef, onFocusRef });

  const [showSearch, setShowSearch] = useState(false);
  const [dragOverlay, setDragOverlay] = useState<'left' | 'right' | 'top' | 'bottom' | null>(null);

  // Listen to global pane drag-over events to show split visual indicators
  useEffect(() => {
    const onDragOverEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ terminalId: string; side: 'left' | 'right' | 'top' | 'bottom' | null }>).detail;
      if (detail && detail.terminalId === tab.id) {
        setDragOverlay(detail.side);
      } else {
        setDragOverlay(null);
      }
    };
    const onDragLeaveEvent = () => {
      setDragOverlay(null);
    };

    window.addEventListener('tline-pane-drag-over', onDragOverEvent);
    window.addEventListener('tline-pane-drag-leave', onDragLeaveEvent);
    window.addEventListener('tline-pane-drag-end', onDragLeaveEvent);

    return () => {
      window.removeEventListener('tline-pane-drag-over', onDragOverEvent);
      window.removeEventListener('tline-pane-drag-leave', onDragLeaveEvent);
      window.removeEventListener('tline-pane-drag-end', onDragLeaveEvent);
    };
  }, [tab.id]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [cursorPos, setCursorPos] = useState({ col: 1, row: 1 });
  const [smartPasteText, setSmartPasteText] = useState<string | null>(null);
  const isSmartPasteOpenRef = useRef(false);
  isSmartPasteOpenRef.current = !!smartPasteText;
  const [localPid, setLocalPid] = useState<number | undefined>(pid);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSuspended, setIsSuspended] = useState(false);

  const idleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetIdleTimer = useCallback(() => {
    if (!isRemoteConnection() || isSuspended) return;

    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }

    idleTimeoutRef.current = setTimeout(() => {
      console.log(`[Terminal] Suspending terminal ${tab.id} due to inactivity.`);
      setIsSuspended(true);
      wsManager.send(JSON.stringify({ type: 'suspend', id: tab.id }));
      wsManager.removeListener(tab.id);
    }, 300000);
  }, [tab.id, isSuspended]);

  // Write directly to the terminal instance (xterm.js has internal batching)
  const scheduleWrite = useCallback((data: string) => {
    const term = terminalRef.current;
    if (term) {
      term.write(data);
    }
  }, []);

  const subscribeToSocket = useCallback((term: Terminal) => {
    wsManager.subscribe(tab.id, (payload) => {
      if (payload.type === 'data') {
        scheduleWrite(payload.data);
        resetIdleTimer();
        onPtyDataRef.current?.();
      } else if (payload.type === 'replay') {
        if (payload.isViewport) {
          lastViewportRef.current = payload.data;
          scheduleWrite(payload.data);
        } else if (payload.isScrollback) {
          try {
            term.reset();
          } catch (e) {}
          scheduleWrite(payload.data);
          scheduleWrite(lastViewportRef.current);
        } else {
          scheduleWrite(payload.data);
        }
        resetIdleTimer();
      } else if (payload.type === 'resize_broadcast') {
        try {
          term.resize(payload.cols, payload.rows);
        } catch (e) {}
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
          detail: { message: `Session Re-attached (${tab.id})` }
        }));
      }
    });
  }, [tab.id, resetIdleTimer, scheduleWrite]);

  const handleResume = useCallback(() => {
    setIsSuspended(false);
    
    const term = terminalRef.current;
    if (term && containerRef.current) {
      try {
        fitAddonRef.current?.fit();
      } catch (e) {}

      const actualCols = term.cols || 80;
      const actualRows = term.rows || 24;

      subscribeToSocket(term);

      wsManager.send(JSON.stringify({
        type: 'init',
        id: tab.id,
        cwd: tab.cwd,
        cols: actualCols,
        rows: actualRows,
        shellType: tab.shellType
      }));

      term.focus();
    }
  }, [tab.id, tab.cwd, tab.shellType, subscribeToSocket]);

  useEffect(() => {
    return () => {
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setLocalPid(pid);
  }, [pid]);

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
      if (selected) copyToClipboard(selected);
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

  const actualFontSize = getActualFontSize(fontSize);

  const debouncedFit = useCallback(
    (() => {
      let timeouts: NodeJS.Timeout[] = [];
      let lastCall = 0;
      let rafId: number | null = null;

      const performFit = () => {
        try {
          if (containerRef.current && containerRef.current.clientWidth > 0 && containerRef.current.clientHeight > 0) {
            fitAddonRef.current?.fit();
          }
        } catch (e) {}
      };

      return () => {
        const now = Date.now();

        // Throttle synchronous fit operations using requestAnimationFrame
        if (now - lastCall > 50) {
          lastCall = now;
          if (rafId === null) {
            rafId = requestAnimationFrame(() => {
              rafId = null;
              performFit();
            });
          }
        }

        // Clear existing transition timers
        timeouts.forEach(clearTimeout);
        timeouts = [];

        // Schedule fit intervals to handle transition-based panels (e.g. split panels)
        const intervals = [100, 250, 500];
        intervals.forEach(ms => {
          const tid = setTimeout(() => {
            performFit();
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
      scrollback: 10000,
      scrollOnUserInput: true,
      fastScrollModifier: 'shift',
      fastScrollSensitivity: 5,
      smoothScrollDuration: 0,
      allowProposedApi: true,
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      overviewRulerWidth: 10,
      theme: getTerminalTheme(themeBackground, themeForeground, accentColor)
    });

    // ── Addons ─────────────────────────────────────────────
    addonListRef.current = [];

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    addonListRef.current.push(fitAddon);

    const unicode11Addon = new Unicode11Addon();
    term.loadAddon(unicode11Addon);
    term.unicode.activeVersion = '11';
    addonListRef.current.push(unicode11Addon);

    const webLinksAddon = new WebLinksAddon((_, uri) => {
      window.dispatchEvent(new CustomEvent('tline-open-browser-tab', { detail: { url: uri } }));
    });
    term.loadAddon(webLinksAddon);
    addonListRef.current.push(webLinksAddon);

    const fileLinkProvider = registerFileLinkProvider(term, tab.id, tab.cwd);
    addonListRef.current.push(fileLinkProvider);

    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;
    addonListRef.current.push(searchAddon);

    // Image protocol addon (sixel / iTerm2 inline images)
    const imageAddon = new ImageAddon();
    term.loadAddon(imageAddon);
    addonListRef.current.push(imageAddon);

    term.open(containerRef.current);

    // Monkey-patch viewport.syncScrollArea to prevent uncaught TypeErrors when accessing dimensions on undefined
    try {
      const core = (term as any)._core;
      if (core && core.viewport) {
        const originalSyncScrollArea = core.viewport.syncScrollArea;
        if (typeof originalSyncScrollArea === 'function') {
          core.viewport.syncScrollArea = function (...args: any[]) {
            // Avoid calling syncScrollArea if the renderService or its renderer is not yet initialized
            const renderService = core._renderService;
            if (!renderService || !renderService._renderer) {
              return;
            }
            try {
              return originalSyncScrollArea.apply(this, args);
            } catch (err) {
              // Silence expected TypeError when dimensions are accessed on an uninitialized/disposed renderer
              if (err instanceof TypeError && err.message.includes('dimensions')) {
                return;
              }
              console.warn('xterm.js syncScrollArea error (caught and ignored):', err);
            }
          };
        }
      }
    } catch (e) {
      console.warn('Failed to monkey-patch xterm.js syncScrollArea:', e);
    }

    const loadCanvasRenderer = () => {
      try {
        const canvasAddon = new CanvasAddon();
        term.loadAddon(canvasAddon);
        addonListRef.current.push(canvasAddon);
        console.log('[Terminal] Successfully loaded Canvas fallback renderer.');
      } catch (e) {
        console.warn('Canvas renderer not available, using default DOM renderer:', e);
      }
    };

    // ── GPU renderer (WebGL → Canvas → DOM fallback chain) ──
    let gpuRendererLoaded = false;
    try {
      const webglAddon = new WebglAddon();
      // WebglAddon emits a 'onContextLoss' event; dispose gracefully on context loss
      webglAddon.onContextLoss(() => {
        console.warn('[Terminal] WebGL context lost — disposing WebGL renderer and falling back to Canvas.');
        try {
          webglAddon.dispose();
          addonListRef.current = addonListRef.current.filter(a => a !== webglAddon);
        } catch (_) {}
        loadCanvasRenderer();
      });
      term.loadAddon(webglAddon);
      
      // Patch WebglRenderer to avoid crash when buffer lines are temporarily undefined (e.g. during reset)
      try {
        const renderer = (webglAddon as any)._renderer;
        if (renderer && typeof renderer._updateModel === 'function') {
          const originalUpdateModel = renderer._updateModel;
          renderer._updateModel = function (start: number, end: number) {
            const terminal = this._core;
            if (terminal && terminal.buffer && terminal.buffer.lines) {
              for (let y = start; y <= end; y++) {
                const row = y + terminal.buffer.ydisp;
                if (!terminal.buffer.lines.get(row)) {
                  return;
                }
              }
            }
            return originalUpdateModel.call(this, start, end);
          };
        }
      } catch (err) {
        console.warn('Failed to monkey-patch WebglRenderer._updateModel:', err);
      }

      addonListRef.current.push(webglAddon);
      gpuRendererLoaded = true;
    } catch (e) {
      console.warn('WebGL renderer not available, trying Canvas renderer:', e);
    }
    if (!gpuRendererLoaded) {
      loadCanvasRenderer();
    }

    const handlePasteEvent = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      const text = e.clipboardData?.getData('text');
      if (text) {
        performPasteRef.current(text);
      }
    };

    if (term.textarea) {
      term.textarea.setAttribute('inputmode', 'none');
      term.textarea.addEventListener('paste', handlePasteEvent, true);
    }

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    term.attachCustomKeyEventHandler((e) => {
      if (isSmartPasteOpenRef.current) {
        return false;
      }
      if (e.type === 'keydown') {
        const key = e.key.toLowerCase();
        // Ctrl+C or Cmd+C (Copy) when there is selected text
        const isCopyShortcut = (e.ctrlKey && key === 'c') || (e.metaKey && key === 'c');
        if (isCopyShortcut) {
          if (term.hasSelection()) {
            const selected = term.getSelection();
            if (selected) {
              copyToClipboard(selected);
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
    // Coalesce cursor-move events and throttle them using a timer
    // to avoid a React re-render storm on every cell write (major CPU sink).
    let lastCursorUpdate = 0;
    let cursorTimeout: NodeJS.Timeout | null = null;
    let lastCursor = { col: -1, row: -1 };

    term.onCursorMove(() => {
      const buf = term.buffer.active;
      const col = buf.cursorX + 1;
      const row = buf.cursorY + 1;

      // Skip no-op updates
      if (col === lastCursor.col && row === lastCursor.row) return;
      lastCursor = { col, row };

      const now = Date.now();
      // Throttle: update at most once every 250ms
      if (now - lastCursorUpdate > 250) {
        lastCursorUpdate = now;
        setCursorPos({ col, row });
        if (cursorTimeout) {
          clearTimeout(cursorTimeout);
          cursorTimeout = null;
        }
      } else {
        // Debounce trailing edge: make sure the final position is captured when movement stops
        if (cursorTimeout) clearTimeout(cursorTimeout);
        cursorTimeout = setTimeout(() => {
          setCursorPos({ col, row });
        }, 250);
      }
    });

    subscribeToSocket(term);

    term.onTitleChange((title) => {
      onTitleChangeRef.current?.(title);
    });

    term.onData((data) => {
      wsManager.send(JSON.stringify({ type: 'data', id: tab.id, data }));
      resetIdleTimer();
    });

    term.onResize(({ cols, rows }) => {
      wsManager.send(JSON.stringify({ type: 'resize', id: tab.id, cols, rows }));
    });

    try {
      fitAddon.fit();
    } catch (e) {}
    debouncedFit();
    resetIdleTimer();

    // ── Window and Container resize ────────────────────────
    const handleResize = () => { debouncedFit(); };
    window.addEventListener('resize', handleResize);

    const resizeObserver = new ResizeObserver(() => { handleResize(); });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    // ── Touch mapping and focus triggers ──────────────────────
    const handleFocusTrigger = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.closest('input') || target.closest('button') || target.closest('select') || target.closest('a')) {
        return;
      }
      if (terminalRef.current) {
        const hasSelection = terminalRef.current.hasSelection();
        // Only refocus if terminal isn't already focused.
        // Calling focus() when already focused disrupts xterm.js mouse reporting:
        // apps using mouse tracking (e.g. superagent, claudecode) rely on xterm.js
        // forwarding click/scroll events to PTY — unnecessary focus calls interfere.
        const isAlreadyFocused = document.activeElement === terminalRef.current.textarea;

        if (!hasSelection && !isAlreadyFocused) {
          terminalRef.current.focus();
          if (terminalRef.current.textarea) {
            terminalRef.current.textarea.setAttribute('inputmode', 'none');
            terminalRef.current.textarea.focus();
          }
        }
        onFocusRef.current?.();
        if (isMobileDevice) {
          window.dispatchEvent(new CustomEvent('tline-terminal-focus'));
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousedown', handleFocusTrigger, true);
    }

    setIsInitialized(true);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (container) {
        container.removeEventListener('mousedown', handleFocusTrigger, true);
      }

      if (term.textarea) {
        term.textarea.removeEventListener('paste', handlePasteEvent, true);
      }
      wsManager.send(JSON.stringify({ type: 'suspend', id: tab.id }));
      wsManager.removeListener(tab.id);
      // Step 1: Dispose each addon individually with a safety catch.
      const addons = [...addonListRef.current];
      addonListRef.current = [];
      for (const addon of addons) {
        try {
          addon.dispose();
        } catch (_) {
          // Ignore per-addon errors
        }
      }

      // Step 2 (critical): Clear xterm's internal AddonManager registry.
      // Even after manually disposing addons, xterm's AddonManager still
      // holds references in its internal _addons array. When term.dispose()
      // runs AddonManager.dispose(), it re-iterates those already-disposed
      // addons and calls _wrappedAddonDispose() on them — crashing with
      // "Cannot read properties of undefined (reading '_isDisposed')".
      // Clearing _addons breaks the re-dispose loop entirely.
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mgr = (term as any)._addonManager;
        if (mgr) {
          if (Array.isArray(mgr._addons)) mgr._addons = [];
          // Also clear any disposable registrations the manager holds
          if (Array.isArray(mgr._disposables)) mgr._disposables = [];
        }
      } catch (_) {
        // xterm internal API may vary — safe to ignore if unavailable
      }

      if (cursorTimeout) {
        clearTimeout(cursorTimeout);
      }
      terminalRef.current = null;
      fitAddonRef.current = null;
      searchAddonRef.current = null;
      setIsInitialized(false);
      try {
        term.dispose();
      } catch (err) {
        console.warn('Terminal dispose error (safe to ignore):', err);
      }
    };
  }, [tab.id, debouncedFit, subscribeToSocket]);

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

  // ── Auto-execute saved prompt shortcut once (silence-detection) ───────────
  useTerminalInitialCommand({
    wsConnected,
    isInitialized,
    initialCommand: tab.initialCommand,
    tabId: tab.id,
    onClearInitialCommand,
    terminalRef,
    onPtyDataRef
  });

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
    if (active && isInitialized) {
      debouncedFit();
      if (!disableAutoFocus) {
        const timer = setTimeout(() => {
          if (terminalRef.current) {
            const isAlreadyFocused = document.activeElement === terminalRef.current.textarea;
            const hasSelection = terminalRef.current.hasSelection();
            if (!isAlreadyFocused && !hasSelection) {
              terminalRef.current.focus();
              if (terminalRef.current.textarea) {
                terminalRef.current.textarea.focus();
              }
            }
          }
        }, 120);
        return () => clearTimeout(timer);
      }
    }
  }, [active, debouncedFit, disableAutoFocus, isInitialized]);

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
        // Force xterm to fit after options change
        setTimeout(() => {
          debouncedFit();
        }, 50);
      } catch (e) {
        console.error('Error changing terminal font settings:', e);
      }
    }
  }, [actualFontSize, fontFamily, fontWeight, debouncedFit]);

  // ── Theme colors ───────────────────────────────────────────
  useEffect(() => {
    if (terminalRef.current) {
      try {
        const theme = getTerminalTheme(themeBackground, themeForeground, accentColor);
        if (isAiAgentRunning) {
          theme.cursor = 'transparent';
          theme.cursorAccent = 'transparent';
        }
        terminalRef.current.options.theme = theme;
      } catch (e) {
        console.error('Error updating terminal theme:', e);
      }
    }
  }, [accentColor, themeBackground, themeForeground, isAiAgentRunning]);

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

  // ── Scroll to bottom trigger event listener ─────────────────
  useEffect(() => {
    const handleScrollEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ terminalId?: string }>;
      const targetId = customEvent.detail?.terminalId;
      if (!targetId || targetId === tab.id) {
        if (terminalRef.current) {
          terminalRef.current.scrollToBottom();
        }
      }
    };
    window.addEventListener('tline-scroll-to-bottom', handleScrollEvent);
    return () => window.removeEventListener('tline-scroll-to-bottom', handleScrollEvent);
  }, [tab.id]);

  const handleTerminalFocus = (e: React.MouseEvent | React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('input') || target.closest('button') || target.closest('select') || target.closest('a')) return;
    if (terminalRef.current) {
      const hasSelection = terminalRef.current.hasSelection();
      // Only refocus if the terminal isn't already focused.
      // When an app enables mouse reporting (e.g. superagent), xterm.js forwards
      // click/scroll events to PTY. Calling focus() again while already focused
      // disrupts this forwarding, breaking scroll/click inside the app.
      const isAlreadyFocused = document.activeElement === terminalRef.current.textarea;

      if (!hasSelection && !isAlreadyFocused) {
        terminalRef.current.focus();
        if (terminalRef.current.textarea) {
          terminalRef.current.textarea.setAttribute('inputmode', 'none');
          terminalRef.current.textarea.focus();
        }
      }
      onFocusRef.current?.();
      if (isMobileDevice) {
        window.dispatchEvent(new CustomEvent('tline-terminal-focus'));
      }
    }
  };



  return (
    <div
      data-terminal-pane-id={tab.id}
      className={`terminal-pane-root${isFocusedPane ? ' terminal-pane-focused' : ''}`}
      style={{ backgroundColor: themeBackground || '#0b0f19' }}
      onMouseDown={handleTerminalFocus}
      onTouchEnd={handleTerminalFocus}
      onContextMenu={handleContextMenu}
    >
      {dragOverlay && (
        <div 
          className={`terminal-pane-drag-overlay drag-overlay-${dragOverlay}`} 
          style={{
            position: 'absolute',
            backgroundColor: 'rgba(168, 85, 247, 0.22)',
            border: '2px dashed var(--color-primary, #a855f7)',
            zIndex: 1000,
            pointerEvents: 'none',
            transition: 'all 0.15s ease-in-out',
            left: dragOverlay === 'right' ? '50%' : 0,
            right: dragOverlay === 'left' ? '50%' : 0,
            top: dragOverlay === 'bottom' ? '50%' : 0,
            bottom: dragOverlay === 'top' ? '50%' : 0,
          }}
        />
      )}
      {isSuspended && (
        <div 
          className="terminal-suspended-overlay"
          onClick={handleResume}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(11, 15, 25, 0.85)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            cursor: 'pointer',
            textAlign: 'center',
            padding: '20px'
          }}
        >
          <div style={{
            color: accentColor || '#3b82f6',
            fontSize: '1.25rem',
            fontWeight: 'bold',
            marginBottom: '8px'
          }}>
            Terminal Suspended
          </div>
          <div style={{ color: '#9ca3af', fontSize: '0.875rem', marginBottom: '16px' }}>
            Inactivity timeout of 5 minutes reached.
          </div>
          <button 
            style={{
              backgroundColor: accentColor || '#3b82f6',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              fontWeight: '500',
              cursor: 'pointer',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
            }}
            onClick={(e) => {
              e.stopPropagation();
              handleResume();
            }}
          >
            Click to Resume
          </button>
        </div>
      )}
      {showSearch && (
        <TerminalSearchBar searchAddon={searchAddonRef.current} onClose={closeSearch} />
      )}

      <div className={`terminal-element-wrapper ${isAiAgentRunning ? 'hide-xterm-cursor' : ''}`} style={{ backgroundColor: themeBackground || '#0b0f19' }}>
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
        fontSize={fontSize}
        defaultShell={defaultShell}
        setDefaultShell={setDefaultShell}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        onRefresh={onRefreshTerminal ? () => onRefreshTerminal(tab.id) : undefined}
        onScrollToBottom={() => terminalRef.current?.scrollToBottom()}
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
