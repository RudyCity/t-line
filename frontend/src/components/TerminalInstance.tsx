import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { CanvasAddon } from '@xterm/addon-canvas';
import { WebglAddon } from '@xterm/addon-webgl';
import { ImageAddon } from '@xterm/addon-image';
import { wsManager } from '../services/websocket';
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
  isPromptReady,
  getActualFontSize,
  getTerminalTheme,
  copyToClipboard
} from './TerminalHelpers';

// ── Main Terminal Instance ─────────────────────────────────────
export function TerminalInstance({
  tab, active, wsConnected, fontSize,
  onTitleChange, onActiveProcessesChange, onFocus, refreshTrigger,
  isFocusedPane = false, pid,
  fontFamily, fontWeight, accentColor, themeBackground, themeForeground,
  disableAutoFocus = false, onClearInitialCommand
}: TerminalInstanceProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const webglAddonRef = useRef<WebglAddon | null>(null);
  // Tracks every addon loaded into the terminal so we can dispose them
  // individually before term.dispose(), preventing xterm's AddonManager
  // from iterating addons with undefined internal state (_isDisposed error).
  const addonListRef = useRef<{ dispose: () => void }[]>([]);
  const onTitleChangeRef = useRef(onTitleChange);
  const onActiveProcessesChangeRef = useRef(onActiveProcessesChange);
  const onFocusRef = useRef(onFocus);
  // Callback ref used by silence-detection to signal incoming PTY data.
  const onPtyDataRef = useRef<(() => void) | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const [cursorPos, setCursorPos] = useState({ col: 1, row: 1 });
  const [smartPasteText, setSmartPasteText] = useState<string | null>(null);
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

  const handleResume = useCallback(() => {
    setIsSuspended(false);
    
    const term = terminalRef.current;
    if (term && containerRef.current) {
      try {
        fitAddonRef.current?.fit();
      } catch (e) {}

      const actualCols = term.cols || 80;
      const actualRows = term.rows || 24;

      wsManager.subscribe(tab.id, (payload) => {
        if (payload.type === 'data') {
          term.write(payload.data);
          resetIdleTimer();
          onPtyDataRef.current?.();
        } else if (payload.type === 'replay') {
          term.write(payload.data);
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
  }, [tab, resetIdleTimer]);

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


  // ── RAF write-batch queue ──────────────────────────────────
  const writeQueueRef = useRef<string[]>([]);
  const rafHandleRef = useRef<number | null>(null);

  const scheduleWrite = useCallback((data: string) => {
    // If the queue is empty, no RAF is scheduled, and data is small (keystroke echo),
    // write immediately to xterm to eliminate typing delay/latency.
    const term = terminalRef.current;
    if (term && writeQueueRef.current.length === 0 && rafHandleRef.current === null && data.length <= 5) {
      term.write(data);
      return;
    }

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
      scrollback: 3000,
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
      window.open(uri, '_blank', 'noopener,noreferrer');
    });
    term.loadAddon(webLinksAddon);
    addonListRef.current.push(webLinksAddon);

    const searchAddon = new SearchAddon();
    term.loadAddon(searchAddon);
    searchAddonRef.current = searchAddon;
    addonListRef.current.push(searchAddon);

    // Image protocol addon (sixel / iTerm2 inline images)
    const imageAddon = new ImageAddon();
    term.loadAddon(imageAddon);
    addonListRef.current.push(imageAddon);

    term.open(containerRef.current);

    // ── GPU renderers (load after open with progressive fallback) ──
    let isWebglLoaded = false;
    if (!isMobileDevice) {
      try {
        const webglAddon = new WebglAddon();
        webglAddonRef.current = webglAddon;
        addonListRef.current.push(webglAddon);
        webglAddon.onContextLoss(() => {
          // Guard against double-dispose. The 'dispose' call in the addon may throw
          // due to a version mismatch in xterm internals (_core._store undefined).
          // After dispose, fall back to the Canvas renderer.
          try {
            if (webglAddonRef.current) {
              webglAddonRef.current = null;
              // Remove from addonList so cleanup doesn't try to dispose it again
              addonListRef.current = addonListRef.current.filter(a => a !== webglAddon);
              webglAddon.dispose();
            }
          } catch (err) {
            console.warn('WebGL context loss dispose failed (safe to ignore):', err);
            webglAddonRef.current = null;
          }
          // Fallback to CanvasAddon after WebGL context loss
          try {
            const fallbackCanvas = new CanvasAddon();
            term.loadAddon(fallbackCanvas);
            addonListRef.current.push(fallbackCanvas);
          } catch (canvasErr) {
            console.warn('Canvas fallback after WebGL context loss also failed:', canvasErr);
          }
        });
        term.loadAddon(webglAddon);
        isWebglLoaded = true;
      } catch (e) {
        console.warn('WebGL renderer not available, trying Canvas renderer:', e);
        webglAddonRef.current = null;
      }
    }

    if (!isWebglLoaded) {
      try {
        const canvasAddon = new CanvasAddon();
        term.loadAddon(canvasAddon);
        addonListRef.current.push(canvasAddon);
      } catch (e) {
        console.warn('Canvas renderer not available, using default DOM renderer:', e);
      }
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
    term.onCursorMove(() => {
      const buf = term.buffer.active;
      setCursorPos({ col: buf.cursorX + 1, row: buf.cursorY + 1 });
    });

    wsManager.subscribe(tab.id, (payload) => {
      if (payload.type === 'data') {
        scheduleWrite(payload.data);
        resetIdleTimer();
        // Notify silence-detection hook whenever PTY sends output.
        onPtyDataRef.current?.();
      } else if (payload.type === 'replay') {
        scheduleWrite(payload.data);
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

        if (!hasSelection) {
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

    // Touch-to-Mouse Event Mapping for Mobile/Tablet Click Position
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const distX = touch.clientX - touchStartX;
        const distY = touch.clientY - touchStartY;
        const duration = Date.now() - touchStartTime;

        // Detect a quick tap without much dragging
        if (Math.abs(distX) < 10 && Math.abs(distY) < 10 && duration < 300) {
          const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
          if (target && containerRef.current?.contains(target)) {
            // Exclude input/button/select/anchor tags
            if (target.closest('input') || target.closest('button') || target.closest('select') || target.closest('a')) {
              return;
            }

            e.preventDefault();
            e.stopPropagation();

            const mouseOpts = {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: touch.clientX,
              clientY: touch.clientY,
              screenX: touch.screenX,
              screenY: touch.screenY,
              button: 0,
              buttons: 1,
            };

            // Dispatch simulated mouse events so xterm.js captures them at the exact clicked cell position
            const mDown = new MouseEvent('mousedown', mouseOpts);
            target.dispatchEvent(mDown);

            const mUp = new MouseEvent('mouseup', { ...mouseOpts, buttons: 0 });
            target.dispatchEvent(mUp);

            const click = new MouseEvent('click', { ...mouseOpts, buttons: 0 });
            target.dispatchEvent(click);

            // Keep xterm.js focused & inputmode="none" (disables native keyboard, allowing tline virtual keyboard)
            if (terminalRef.current) {
              terminalRef.current.focus();
              if (terminalRef.current.textarea) {
                terminalRef.current.textarea.setAttribute('inputmode', 'none');
                terminalRef.current.textarea.focus();
              }
            }
            onFocusRef.current?.();
            window.dispatchEvent(new CustomEvent('tline-terminal-focus'));
          }
        }
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousedown', handleFocusTrigger, true);
      container.addEventListener('touchstart', handleTouchStart, { passive: true });
      container.addEventListener('touchend', handleTouchEnd, { passive: false });
    }

    setIsInitialized(true);

    return () => {
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      if (container) {
        container.removeEventListener('mousedown', handleFocusTrigger, true);
        container.removeEventListener('touchstart', handleTouchStart);
        container.removeEventListener('touchend', handleTouchEnd);
      }
      if (rafHandleRef.current !== null) {
        cancelAnimationFrame(rafHandleRef.current);
        rafHandleRef.current = null;
        writeQueueRef.current = [];
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

      webglAddonRef.current = null;
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

  // ── Auto-execute saved prompt shortcut once (silence-detection) ───────────
  const FALLBACK_MS = 6000;
  const initialCommandSent = useRef(false);
  useEffect(() => {
    if (!wsConnected || !isInitialized || !tab.initialCommand || initialCommandSent.current) return;

    let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
    let checkTimeout: ReturnType<typeof setTimeout> | null = null;

    const sendCommand = () => {
      if (initialCommandSent.current) return;
      initialCommandSent.current = true;
      onPtyDataRef.current = null;
      if (scheduledTimer) clearTimeout(scheduledTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (checkTimeout) clearTimeout(checkTimeout);

      const cmdStr = tab.initialCommand?.endsWith('\r') || tab.initialCommand?.endsWith('\n')
        ? tab.initialCommand
        : tab.initialCommand + '\r';

      wsManager.send(JSON.stringify({
        type: 'data',
        id: tab.id,
        data: cmdStr
      }));
      onClearInitialCommand?.(tab.id);
    };

    // Fallback: fire unconditionally after FALLBACK_MS
    const fallbackTimer = setTimeout(sendCommand, FALLBACK_MS);

    // Initial check timer
    scheduledTimer = setTimeout(sendCommand, 1500);

    onPtyDataRef.current = () => {
      if (initialCommandSent.current) return;

      if (checkTimeout) clearTimeout(checkTimeout);
      checkTimeout = setTimeout(() => {
        checkTimeout = null;
        if (initialCommandSent.current) return;

        const term = terminalRef.current;
        const promptReady = term ? isPromptReady(term) : false;

        if (promptReady) {
          // Prompt is ready! Schedule sendCommand with 150ms delay
          if (scheduledTimer) clearTimeout(scheduledTimer);
          scheduledTimer = setTimeout(sendCommand, 150);
        } else {
          // Prompt not ready yet; reschedule fallback silence timer for 1200ms
          if (scheduledTimer) clearTimeout(scheduledTimer);
          scheduledTimer = setTimeout(sendCommand, 1200);
        }
      }, 50);
    };

    return () => {
      onPtyDataRef.current = null;
      if (scheduledTimer) clearTimeout(scheduledTimer);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      if (checkTimeout) clearTimeout(checkTimeout);
    };
  }, [wsConnected, isInitialized, tab.initialCommand, tab.id, onClearInitialCommand]);

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
        terminalRef.current.options.theme = getTerminalTheme(themeBackground, themeForeground, accentColor);
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

      if (!hasSelection) {
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
      className={`terminal-pane-root${isFocusedPane ? ' terminal-pane-focused' : ''}`}
      style={{ backgroundColor: themeBackground || '#0b0f19' }}
      onMouseDown={handleTerminalFocus}
      onTouchEnd={handleTerminalFocus}
      onContextMenu={handleContextMenu}
    >
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
