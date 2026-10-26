import React, { useState, useEffect, useRef } from 'react';
import { Globe, ExternalLink } from 'lucide-react';
import { TabData } from '../hooks/useTerminals';
import BrowserDevTools, { ConsoleErrorLog, InspectedElement } from './BrowserDevTools';
import { determineRenderMode, getCleanUrl, openInSystemBrowser, getFriendlyName, getHelperStatusColorClass as getHelperStatusColorClassUtil, getHelperStatusText as getHelperStatusTextUtil, getPollWebviewJs } from './browserUrlUtils';
import { useBrowserListeners } from '../hooks/useBrowserListeners';
import { getNativeNavigationJs, shouldPollNativeWebview } from './browserRuntimeUtils';
import BrowserNavigationBar from './BrowserNavigationBar';
import BrowserAgentSessions from './BrowserAgentSessions';
import ManagedBrowserPanel from './ManagedBrowserPanel';
import { useBrowserStorageAndHistory } from '../hooks/useBrowserStorageAndHistory';
import { ConfirmModal } from './Modals';
import { useBrowserScreenshot } from '../hooks/useBrowserScreenshot';
import { getNativeNetworkProbeJs } from './browserDiagnostics';
import { useBrowserNetwork } from '../hooks/useBrowserNetwork';

interface BrowserTabProps {
  tab: TabData;
  isActive: boolean;
  onUpdateTabName?: (newName: string) => void;
  onUpdateTabUrl?: (newUrl: string) => void;
  onManagedBrowserHandoff?: (instruction: string) => boolean;
}

export default function BrowserTab({ tab, isActive, onUpdateTabName, onUpdateTabUrl, onManagedBrowserHandoff }: BrowserTabProps) {
  const [urlInput, setUrlInput] = useState(tab.url || '');
  const [activeUrl, setActiveUrl] = useState(tab.url || '');
  const activeUrlRef = useRef(activeUrl);
  const nativeNavigationGraceUntilRef = useRef(0);
  useEffect(() => {
    activeUrlRef.current = activeUrl;
  }, [activeUrl]);
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'inspector' | 'storage' | 'network'>('console');
  const { networkEntries, clearNetworkEntries } = useBrowserNetwork(tab.id, true);
  
  const [logs, setLogs] = useState<ConsoleErrorLog[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [inspectedElement, setInspectedElement] = useState<InspectedElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [showClearBookmarksModal, setShowClearBookmarksModal] = useState(false);
  const [helperReady, setHelperReady] = useState(false);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [showBookmarksDropdown, setShowBookmarksDropdown] = useState(false);
  const bookmarksDropdownRef = useRef<HTMLDivElement>(null);

  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
  const historyDropdownRef = useRef<HTMLDivElement>(null);

  const [showAddBookmarkPopover, setShowAddBookmarkPopover] = useState(false);
  const [newBookmarkName, setNewBookmarkName] = useState('');
  const [newBookmarkFolder, setNewBookmarkFolder] = useState('');
  const newBookmarkPopoverRef = useRef<HTMLDivElement>(null);

  const isElectron = typeof window !== 'undefined' && window.process?.versions?.electron !== undefined;
  const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;

  const useElectronWebview = isElectron;
  const useTauriWebview = isTauri;

  const renderMode = determineRenderMode(activeUrl, isTauri, isElectron);

  const containerRef = useRef<HTMLDivElement>(null);
  const tauriWebviewRef = useRef<any>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [webviewEl, setWebviewEl] = useState<any>(null);
  const [devtoolsHeight, setDevtoolsHeight] = useState(250);
  const [isDevtoolsCollapsed, setIsDevtoolsCollapsed] = useState(true);
  const [isResizing, setIsResizing] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const loadProgressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lazily create once on activation; hide/show native WebView2 on switches.
  // Closing it on every switch resets login, SPA, scroll and browser state.
  const [webviewActive, setWebviewActive] = useState(isActive);
  const [nativeError, setNativeError] = useState<string | null>(null);
  const [navigationError, setNavigationError] = useState<string | null>(null);
  const [nativeGeneration, setNativeGeneration] = useState(0);

  const isActiveRef = useRef(isActive);
  const [forceHideWebview, setForceHideWebview] = useState(false);

  useEffect(() => {
    const handleHideEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ hide: boolean }>;
      setForceHideWebview(customEvent.detail.hide);
    };
    window.addEventListener('tline-hide-native-webview', handleHideEvent);
    return () => {
      window.removeEventListener('tline-hide-native-webview', handleHideEvent);
    };
  }, []);

  useEffect(() => {
    const webview = tauriWebviewRef.current;
    if (useTauriWebview && webview && renderMode === 'tauri-native') {
      if (isActive && !nativeError && !forceHideWebview && !showBookmarksDropdown && !showHistoryDropdown && !showAddBookmarkPopover) {
        webview.show().catch(() => {});
      } else {
        webview.hide().catch(() => {});
      }
    }
  }, [isActive, nativeError, forceHideWebview, showBookmarksDropdown, showHistoryDropdown, showAddBookmarkPopover, useTauriWebview, renderMode]);

  const destroyWebview = (webview: any) => {
    if (!webview) return;
    webview.close().catch((err: any) => {
      const errMsg = String(err);
      if (!errMsg.includes('webview not found')) {
        console.warn('[BrowserTab] Failed to close webview:', err);
      }
    });
  };

  useEffect(() => {
    return () => {
      if (loadProgressTimerRef.current) {
        clearInterval(loadProgressTimerRef.current);
        loadProgressTimerRef.current = null;
      }
      if (iframeRef.current) {
        try {
          iframeRef.current.src = 'about:blank';
        } catch (_) {}
      }
    };
  }, []);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (isActive) setWebviewActive(true);
    // Native browser is only destroyed on tab close/unmount.
  }, [isActive]);

  // Synchronize dynamic name changes for tab component
  useEffect(() => {
    if (tab.url) {
      setUrlInput(getCleanUrl(tab.url));
      setActiveUrl(tab.url);
    }
  }, [tab.url]);

  // Track last synchronized bounds to avoid redundant IPC calls to Tauri webview
  const lastBoundsRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const boundsBusyRef = useRef(false);

  // Sync native Tauri webview bounds to containerRef rect
  const syncWebviewBounds = async () => {
    const container = containerRef.current;
    const webview = tauriWebviewRef.current;
    if (!container || !webview || !isActiveRef.current || boundsBusyRef.current) return;
    boundsBusyRef.current = true;
    try {
      const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi');
      const r = container.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      
      // Check if size or position has actually changed (using tolerance threshold)
      const last = lastBoundsRef.current;
      if (
        last &&
        Math.abs(last.left - r.left) < 0.5 &&
        Math.abs(last.top - r.top) < 0.5 &&
        Math.abs(last.width - r.width) < 0.5 &&
        Math.abs(last.height - r.height) < 0.5
      ) {
        return;
      }
      
      await webview.setPosition(new LogicalPosition(r.left, r.top)).catch(() => {});
      await webview.setSize(new LogicalSize(r.width, r.height)).catch(() => {});
      if (tauriWebviewRef.current === webview) {
        lastBoundsRef.current = { left: r.left, top: r.top, width: r.width, height: r.height };
      }
    } catch (_) {
      // Transient native resizing errors may recover on the next layout event.
    } finally {
      boundsBusyRef.current = false;
    }
  };

  // Window resize + ResizeObserver + DevTools height listener: keep native webview bounds synchronized.
  useEffect(() => {
    if (!useTauriWebview || renderMode !== 'tauri-native' || !webviewActive) return;
    const handleResize = () => { void syncWebviewBounds(); };
    window.addEventListener('resize', handleResize);
    const ro = containerRef.current && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(handleResize) : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);
    void syncWebviewBounds();
    // Force delayed resyncs for transitions
    const t1 = setTimeout(handleResize, 100);
    const t2 = setTimeout(handleResize, 250);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (ro) ro.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [useTauriWebview, renderMode, webviewActive, isActive, devtoolsHeight, isDevtoolsCollapsed, deviceMode]);

  // Lifecycle of native Webview overlay in Tauri environment.
  // Re-runs whenever webviewActive toggles: creates on true, cleans up on false/unmount.
  useEffect(() => {
    if (!useTauriWebview || !activeUrlRef.current || renderMode !== 'tauri-native') return;
    if (!webviewActive) return; // Tab is suspended — do not spawn a new webview

    let active = true;
    let webviewInstance: any = null;
    const sessionStorageKey = 'tline-active-webview-label-' + tab.id;

    const initWebview = async () => {
      try {
        setNativeError(null);
        const { Webview } = await import('@tauri-apps/api/webview');
        const { getCurrentWindow } = await import('@tauri-apps/api/window');

        const currentWindow = getCurrentWindow();
        let closedOld = false;

        // Try to close any existing webview first using the stored session label
        const oldLabel = sessionStorage.getItem(sessionStorageKey);
        if (oldLabel) {
          try {
            const oldWebview = await Webview.getByLabel(oldLabel);
            if (oldWebview) {
              await oldWebview.close();
              closedOld = true;
            }
          } catch (_) {}
          sessionStorage.removeItem(sessionStorageKey);
        }

        try {
          const fallbackWebview = await Webview.getByLabel('browser-webview-' + tab.id);
          if (fallbackWebview) {
            await fallbackWebview.close();
            closedOld = true;
          }
        } catch (_) {}

        if (closedOld) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }

        const container = containerRef.current;
        if (!active || !container) return;

        const rect = container.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) {
          setNativeError('Browser surface is not ready. Switch back or retry.');
          return;
        }
        lastBoundsRef.current = null;
        const uniqueLabel = 'browser-webview-' + tab.id + '-' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem(sessionStorageKey, uniqueLabel);

        webviewInstance = new Webview(currentWindow, uniqueLabel, {
          url: activeUrlRef.current,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });

        tauriWebviewRef.current = webviewInstance;

        webviewInstance.once('tauri://error', (err: any) => {
          if (!active) return;
          console.error('[BrowserTab] Native webview error:', err);
          setNativeError('The native browser failed to start. Retry to recreate this browser tab.');
          if (webviewInstance) {
            webviewInstance.close().catch(() => {});
          }
          if (tauriWebviewRef.current === webviewInstance) {
            tauriWebviewRef.current = null;
          }
        });

        await new Promise((resolve) => setTimeout(resolve, 150));

        if (!active || !containerRef.current || !webviewInstance || tauriWebviewRef.current !== webviewInstance) return;

        if (isActiveRef.current && !nativeError) {
          await webviewInstance.show().catch(() => {});
        } else {
          await webviewInstance.hide().catch(() => {});
        }

        // ResizeObserver and window resize listeners replace the old per-frame
        // IPC loop that ran at 60 fps even while nothing moved.
        void syncWebviewBounds();
      } catch (err) {
        if (active) {
          console.error('[BrowserTab] Tauri Webview initialization failed:', err);
          setNativeError('Browser initialization failed. Retry this tab to recover.');
        }
      }
    };

    initWebview();

    return () => {
      active = false;
      tauriWebviewRef.current = null;
      if (!webviewInstance || sessionStorage.getItem(sessionStorageKey) === webviewInstance.label) {
        sessionStorage.removeItem(sessionStorageKey);
      }
      if (webviewInstance) destroyWebview(webviewInstance);
    };
  }, [useTauriWebview, tab.id, renderMode, webviewActive, nativeGeneration]);

  // Stable ref so the hook can call handleReload even though it's defined below
  const handleReloadRef = useRef<(forceBypassCache?: boolean) => void>(() => {});
  const navigateNativeRef = useRef<(url: string) => Promise<boolean>>(async () => false);

  // Call useBrowserStorageAndHistory custom hook — must be called BEFORE any effects that use zoomFactor
  const {
    zoomFactor,
    handleZoomIn,
    handleZoomOut,
    handleZoomReset,
    bookmarks,
    setBookmarks,
    removeBookmark,
    updateBookmark,
    history,
    setHistory,
    removeHistoryItem,
    storageData,
    storageError,
    fetchStorageData,
    deleteCookie,
    deleteLocalStorage,
    handleNavigateToBookmark,
    handleNavigateToHistory
  } = useBrowserStorageAndHistory({
    tabId: tab.id,
    activeUrl,
    setActiveUrl,
    setUrlInput,
    useTauriWebview,
    useElectronWebview,
    tauriWebviewRef,
    webviewEl,
    renderMode,
    webviewActive,
    onUpdateTabUrl,
    handleReload: (...args) => handleReloadRef.current(...args),
    navigateNative: url => navigateNativeRef.current(url)
  });

  // Listen to console messages if in Electron and using webview
  useEffect(() => {
    if (!useElectronWebview || !webviewEl || renderMode !== 'electron-webview') return;
    const webview = webviewEl;

    const handleConsoleMessage = (e: any) => {
      if (e.level === 2) {
        const newLog: ConsoleErrorLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          timestamp: new Date().toLocaleTimeString(),
          message: e.message,
          filename: e.sourceId || 'console',
          lineno: e.line || 0,
          colno: 0,
          stack: null
        };
        setLogs(prev => [newLog, ...prev].slice(0, 100));
      }
    };

    const handleElectronNavigate = (e: any) => {
      if (e.url) {
        const cleanUrl = getCleanUrl(e.url);
        // Skip blob: / about: URLs generated internally by media players
        if (cleanUrl.startsWith('blob:') || cleanUrl === 'about:blank') return;
        setUrlInput(cleanUrl);
        setActiveUrl(cleanUrl);
        onUpdateTabUrl?.(cleanUrl);
      }
    };

    const handlePageTitleUpdated = (e: any) => {
      if (e.title) {
        onUpdateTabName?.(e.title);
      }
    };

    webview.addEventListener('console-message', handleConsoleMessage);
    webview.addEventListener('did-navigate', handleElectronNavigate);
    webview.addEventListener('did-navigate-in-page', handleElectronNavigate);
    webview.addEventListener('page-title-updated', handlePageTitleUpdated);
    return () => {
      webview.removeEventListener('console-message', handleConsoleMessage);
      webview.removeEventListener('did-navigate', handleElectronNavigate);
      webview.removeEventListener('did-navigate-in-page', handleElectronNavigate);
      webview.removeEventListener('page-title-updated', handlePageTitleUpdated);
    };
  }, [useElectronWebview, iframeKey, webviewEl, renderMode, onUpdateTabUrl, onUpdateTabName]);

  // Listen to load and new-window events in Electron webview
  useEffect(() => {
    if (!useElectronWebview || !webviewEl || renderMode !== 'electron-webview') return;
    const webview = webviewEl;

    const handleStartLoading = () => startLoadingBar();
    const handleStopLoading = () => finishLoadingBar();
    const handleFinishLoad = () => {
      try {
        webview.setZoomFactor(zoomFactor);
      } catch (_) {}
    };
    const handleNewWindow = (e: any) => {
      e.preventDefault();
      if (e.url) {
        window.dispatchEvent(new CustomEvent('tline-open-browser-tab', { detail: { url: e.url } }));
      }
    };

    webview.addEventListener('did-start-loading', handleStartLoading);
    webview.addEventListener('did-stop-loading', handleStopLoading);
    webview.addEventListener('did-finish-load', handleFinishLoad);
    webview.addEventListener('new-window', handleNewWindow);

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading);
      webview.removeEventListener('did-stop-loading', handleStopLoading);
      webview.removeEventListener('did-finish-load', handleFinishLoad);
      webview.removeEventListener('new-window', handleNewWindow);
    };
  }, [useElectronWebview, webviewEl, renderMode, zoomFactor]);

  // Listen to iframe, WebSocket preview events, and Tauri event bus
  useBrowserListeners({
    tab,
    useTauriWebview,
    tauriWebviewRef,
    iframeRef,
    setHelperReady,
    setUrlInput,
    setActiveUrl,
    onUpdateTabUrl,
    onUpdateTabName,
    setLogs,
    setInspectedElement,
    setIsInspecting,
    setActiveSubTab,
  });

  // Drag handler to resize DevTools drawer
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = devtoolsHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(120, Math.min(window.innerHeight * 0.8, startHeight - deltaY));
      setDevtoolsHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleBack = () => {
    if (useTauriWebview && tauriWebviewRef.current && renderMode === 'tauri-native') {
      const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
      if (activeLabel) {
        nativeNavigationGraceUntilRef.current = 0;
        setNavigationError(null);
        (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js: 'window.history.back()' })
          .catch(() => setNavigationError('Back navigation failed. The embedded browser may be disconnected.'));
      } else {
        setNavigationError('Embedded browser is not ready for Back navigation.');
      }
    } else if (useElectronWebview && webviewEl && renderMode === 'electron-webview') {
      try {
        webviewEl.goBack();
      } catch (_) {}
    } else if (renderMode === 'iframe-local' && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.history.back();
      } catch (_) {}
    }
  };

  const handleForward = () => {
    if (useTauriWebview && tauriWebviewRef.current && renderMode === 'tauri-native') {
      const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
      if (activeLabel) {
        nativeNavigationGraceUntilRef.current = 0;
        setNavigationError(null);
        (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js: 'window.history.forward()' })
          .catch(() => setNavigationError('Forward navigation failed. The embedded browser may be disconnected.'));
      } else {
        setNavigationError('Embedded browser is not ready for Forward navigation.');
      }
    } else if (useElectronWebview && webviewEl && renderMode === 'electron-webview') {
      try {
        webviewEl.goForward();
      } catch (_) {}
    } else if (renderMode === 'iframe-local' && iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.history.forward();
      } catch (_) {}
    }
  };

  // Poll webview URL in Tauri to keep input URL bar synchronized.
  // Only runs when webviewActive is true (WebView2 is alive).
  useEffect(() => {
    if (!useTauriWebview || renderMode !== 'tauri-native' || !webviewActive) return;

    let subscribed = true;
    let inFlight = false;
    const pollUrl = async () => {
      if (!subscribed || !shouldPollNativeWebview(isActiveRef.current, document.hidden, inFlight)) return;
      const nativeWebview = tauriWebviewRef.current;
      const invoke = (window as any).__TAURI__?.core?.invoke;
      if (!nativeWebview || !invoke) return;
      const label = nativeWebview.label;
      if (!label) return;
      inFlight = true;
      try {
        // Only poll a visible tab, and never overlap IPC requests.
        // The injection sets up preview helpers and reports URL changes.
        await invoke('eval_webview_js', { label, js: getPollWebviewJs(tab.id, zoomFactor) + getNativeNetworkProbeJs(tab.id) });
        const liveUrl: string = await invoke('get_webview_url', { label });
        if (!subscribed || !isActiveRef.current || nativeWebview !== tauriWebviewRef.current || !liveUrl) return;
        const cleanUrl = getCleanUrl(liveUrl);
        // During host-initiated navigation, the old URL can still be reported
        // while WebView2 is loading the new destination. Do not roll the URL
        // bar and persisted tab state back to that stale value.
        if (Date.now() < nativeNavigationGraceUntilRef.current) return;
        if (cleanUrl && !cleanUrl.startsWith('blob:') && cleanUrl !== 'about:blank' &&
            cleanUrl !== activeUrlRef.current) {
          activeUrlRef.current = cleanUrl;
          setUrlInput(cleanUrl);
          setActiveUrl(cleanUrl);
          onUpdateTabUrl?.(cleanUrl);
          if (onUpdateTabName) {
            try { onUpdateTabName('Preview: ' + new URL(cleanUrl).hostname); } catch (_) {}
          }
        }
      } catch (_) {
        // Old/destroyed Webview2 during navigation or close: never retry in a tight loop.
      } finally {
        inFlight = false;
      }
    };
    const timer = setInterval(() => { void pollUrl(); }, 1500);
    return () => {
      subscribed = false;
      clearInterval(timer);
    };
  }, [useTauriWebview, renderMode, webviewActive, tab.id, zoomFactor, onUpdateTabUrl, onUpdateTabName]);

  const startLoadingBar = () => {
    setIsLoading(true);
    setLoadProgress(0);
    if (loadProgressTimerRef.current) clearInterval(loadProgressTimerRef.current);
    // Animate progress: fast at first, then slow down approaching 90%
    loadProgressTimerRef.current = setInterval(() => {
      setLoadProgress(prev => {
        if (prev >= 90) {
          if (loadProgressTimerRef.current) clearInterval(loadProgressTimerRef.current);
          return 90;
        }
        // Gradually decelerate: faster increments at low progress, slower near 90
        const increment = Math.max(0.5, (90 - prev) * 0.08);
        return Math.min(90, prev + increment);
      });
    }, 80);
  };

  const finishLoadingBar = () => {
    if (loadProgressTimerRef.current) clearInterval(loadProgressTimerRef.current);
    setLoadProgress(100);
    setTimeout(() => {
      setIsLoading(false);
      setLoadProgress(0);
    }, 350);
  };

  const handleReload = (forceBypassCache: boolean = false) => {
    setLogs([]);
    setInspectedElement(null);
    setIframeKey(prev => prev + 1);
    startLoadingBar();
    if (useTauriWebview && tauriWebviewRef.current && renderMode === 'tauri-native') {
      const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
      if (activeLabel) {
        const js = forceBypassCache ? 'window.location.reload(true)' : 'window.location.reload()';
        (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js }).catch(() => {});
      }
      setTimeout(finishLoadingBar, 1500);
    } else if (useTauriWebview && renderMode === 'tauri-native') {
      setNativeGeneration(value => value + 1);
      setTimeout(finishLoadingBar, 250);
    } else if (useElectronWebview && webviewEl && renderMode === 'electron-webview') {
      try {
        if (forceBypassCache) {
          (webviewEl as any).reloadIgnoringCache();
        } else {
          webviewEl.reload();
        }
      } catch (_) {}
    }
  };
  // Keep the stable ref in sync so the hook's handleReload callback always calls the latest version
  handleReloadRef.current = handleReload;

  const navigateWebview = async (targetUrl: string): Promise<boolean> => {
    if (!useTauriWebview || renderMode !== 'tauri-native') return true;
    const webview = tauriWebviewRef.current;
    if (!webview) {
      setNavigationError('Embedded browser is not ready. Retry after the page loads.');
      return false;
    }
    try {
      const js = getNativeNavigationJs(targetUrl);
      const label = webview.label;
      const invoke = (window as any).__TAURI__?.core?.invoke;
      if (!label || typeof invoke !== 'function') {
        setNavigationError('Embedded browser connection is unavailable.');
        return false;
      }
      nativeNavigationGraceUntilRef.current = Date.now() + 4000;
      await invoke('eval_webview_js', { label, js });
      setNavigationError(null);
      return true;
    } catch (error) {
      nativeNavigationGraceUntilRef.current = 0;
      console.warn('[BrowserTab] Navigation failed:', error);
      setNavigationError('Navigation failed. The page was not changed; retry or reload.');
      return false;
    }
  };

  navigateNativeRef.current = navigateWebview;

  const handleNavigate = async (e: React.FormEvent) => {
    e.preventDefault();
    let target = urlInput.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target) && !/^file:\/\//i.test(target)) {
      const isLocalHost = /^(?:localhost|127\.0\.0\.1|192\.168\.[0-9.]+|[^/]+\.local)(?::[0-9]+)?(?:\/|$)/i.test(target);
      target = (isLocalHost ? 'http://' : 'https://') + target;
    }
    try {
      const parsed = new URL(target);
      if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) {
        throw new Error('Unsupported navigation protocol');
      }
      target = parsed.href;
    } catch (_) {
      setNativeError('Please enter a valid HTTP, HTTPS, or local file URL.');
      return;
    }
    const isSameUrl = target === activeUrl;
    if (isSameUrl) {
      handleReload();
    } else {
      // Do not advertise a new URL until the native host accepted navigation.
      if (!(await navigateWebview(target))) {
        setUrlInput(activeUrlRef.current);
        return;
      }
      setNativeError(null);
      setNavigationError(null);
      activeUrlRef.current = target;
      setActiveUrl(target);
      setUrlInput(target);
      onUpdateTabUrl?.(target);
      startLoadingBar();
      if (renderMode === 'tauri-native') {
        setTimeout(finishLoadingBar, 1800);
      }
    }
  };

  // Handle Click Outside for Dropdowns & Popovers
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (bookmarksDropdownRef.current && !bookmarksDropdownRef.current.contains(target)) {
        setShowBookmarksDropdown(false);
      }
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(target)) {
        setShowHistoryDropdown(false);
      }
      if (newBookmarkPopoverRef.current && !newBookmarkPopoverRef.current.contains(target)) {
        setShowAddBookmarkPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const isCurrentBookmarked = bookmarks.some(b => b.url === activeUrl);

  const toggleBookmarkCurrent = () => {
    if (!activeUrl) return;
    if (isCurrentBookmarked) {
      const found = bookmarks.find(b => b.url === activeUrl);
      if (found) {
        setNewBookmarkName(found.name);
        setNewBookmarkFolder(found.folder || '');
      }
    } else {
      setNewBookmarkName(getFriendlyName(activeUrl));
      setNewBookmarkFolder('');
    }
    setShowAddBookmarkPopover(!showAddBookmarkPopover);
  };

  const handleSaveNewBookmark = () => {
    if (!activeUrl) return;
    if (isCurrentBookmarked) {
      // Update existing
      setBookmarks(prev => prev.map(b => b.url === activeUrl ? { ...b, name: newBookmarkName, folder: newBookmarkFolder.trim() || undefined } : b));
    } else {
      // Add new
      setBookmarks(prev => [
        ...prev,
        {
          id: `bookmark-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: newBookmarkName,
          url: activeUrl,
          folder: newBookmarkFolder.trim() || undefined
        }
      ]);
    }
    setShowAddBookmarkPopover(false);
  };

  const clearAllBookmarks = () => {
    setShowClearBookmarksModal(true);
  };

  const clearAllHistory = () => {
    setHistory([]);
  };

  const handleCaptureScreenshot = useBrowserScreenshot(tab.id, useElectronWebview, webviewEl);

  useEffect(() => {
    if (activeSubTab === 'storage') {
      fetchStorageData();
    }
  }, [activeSubTab, activeUrl]);

  const getHelperStatusColorClass = () => getHelperStatusColorClassUtil(renderMode);
  const getHelperStatusText = () => getHelperStatusTextUtil(renderMode, helperReady);

  const toggleInspect = async () => {
    const nextState = !isInspecting;
    setIsInspecting(nextState);
    if (useTauriWebview && tauriWebviewRef.current && renderMode === 'tauri-native') {
      const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
      if (!activeLabel) return;
      try {
        const host = window.location.host.endsWith(':5773') ? window.location.host.replace(':5773', ':5779') : window.location.host;
        const res = await fetch(`http://${host}/api/preview-proxy/tline-helper.js`);
        if (res.ok) {
          const helperCode = await res.text();
          const setupCode = `window.__TLINE_TAB_ID__ = "${tab.id}"; window.__TLINE_NATIVE__ = true; ${helperCode}`;
          await (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js: setupCode }).catch(() => {});
        }
      } catch (_) {}
      const cmd = nextState ? 'tline-start-inspect' : 'tline-stop-inspect';
      (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js: `window.postMessage({ type: "${cmd}" }, "*")` }).catch(() => {});
    } else if (renderMode === 'iframe-local' && iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: nextState ? 'tline-start-inspect' : 'tline-stop-inspect' }, '*');
    }
  };

  return (
    <div 
      className="flex flex-col h-full w-full bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden"
      style={{ display: isActive ? 'flex' : 'none' }}
    >
      {/* Top Navbar Component */}
      <BrowserNavigationBar
        urlInput={urlInput}
        setUrlInput={setUrlInput}
        activeUrl={activeUrl}
        isLoading={isLoading}
        isInspecting={isInspecting}
        toggleInspect={toggleInspect}
        deviceMode={deviceMode}
        setDeviceMode={setDeviceMode}
        zoomFactor={zoomFactor}
        handleZoomIn={handleZoomIn}
        handleZoomOut={handleZoomOut}
        handleZoomReset={handleZoomReset}
        handleBack={handleBack}
        handleForward={handleForward}
        handleReload={handleReload}
        handleNavigate={handleNavigate}
        bookmarks={bookmarks}
        showBookmarksDropdown={showBookmarksDropdown}
        setShowBookmarksDropdown={setShowBookmarksDropdown}
        bookmarksDropdownRef={bookmarksDropdownRef}
        handleNavigateToBookmark={handleNavigateToBookmark}
        removeBookmark={removeBookmark}
        updateBookmark={updateBookmark}
        clearAllBookmarks={clearAllBookmarks}
        history={history}
        showHistoryDropdown={showHistoryDropdown}
        setShowHistoryDropdown={setShowHistoryDropdown}
        historyDropdownRef={historyDropdownRef}
        handleNavigateToHistory={handleNavigateToHistory}
        removeHistoryItem={removeHistoryItem}
        clearAllHistory={clearAllHistory}
        isCurrentBookmarked={isCurrentBookmarked}
        toggleBookmarkCurrent={toggleBookmarkCurrent}
        showAddBookmarkPopover={showAddBookmarkPopover}
        setShowAddBookmarkPopover={setShowAddBookmarkPopover}
        newBookmarkName={newBookmarkName}
        setNewBookmarkName={setNewBookmarkName}
        newBookmarkFolder={newBookmarkFolder}
        setNewBookmarkFolder={setNewBookmarkFolder}
        newBookmarkPopoverRef={newBookmarkPopoverRef}
        handleSaveNewBookmark={handleSaveNewBookmark}
        handleCaptureScreenshot={handleCaptureScreenshot}
        openInSystemBrowser={openInSystemBrowser}
        isTauri={isTauri}
      />
      {navigationError && (
        <div role="alert" className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
          <span>{navigationError}</span>
          <button type="button" aria-label="Dismiss browser navigation error"
            className="underline" onClick={() => setNavigationError(null)}>Dismiss</button>
        </div>
      )}

      <BrowserAgentSessions active={isActive} />
      <ManagedBrowserPanel active={isActive} initialUrl={activeUrl} onSendToAgent={onManagedBrowserHandoff} />

      {/* Main Browser Viewport Area — min-h-0 so DevTools can claim space */}
      <div className="flex-1 bg-[var(--bg-main)] relative min-h-0 overflow-hidden flex flex-col">
        {/* Device Mode Resolution Label overlay */}
        {deviceMode !== 'desktop' && (
          <div className="flex items-center justify-between px-4 py-1.5 bg-[var(--bg-card)] border-b border-[var(--border-color)] text-xs text-[var(--text-muted)] select-none shrink-0">
            <span className="font-semibold capitalize text-purple-400">
              {deviceMode} View
            </span>
            <span className="font-mono bg-[var(--bg-main)] px-2 py-0.5 rounded border border-[var(--border-color)]">
              {deviceMode === 'mobile' ? '375 x 812' : '768 x 1024'} px
            </span>
          </div>
        )}

        <div className={`flex-1 min-h-0 overflow-auto ${deviceMode !== 'desktop' ? 'flex justify-center items-start p-6 bg-[var(--bg-main)]' : 'relative'}`}>
          <div
            className={
              deviceMode === 'desktop'
                ? 'absolute inset-0 w-full h-full border-none bg-[var(--bg-main)]'
                : deviceMode === 'tablet'
                ? 'relative w-[768px] h-[1024px] max-w-full max-h-full border-[12px] border-[#1e1e24] rounded-[24px]  bg-[var(--bg-main)] flex flex-col transition-all duration-300'
                : 'relative w-[375px] h-[812px] max-w-full max-h-full border-[12px] border-[#1e1e24] rounded-[36px]  bg-[var(--bg-main)] flex flex-col transition-all duration-300'
            }
            style={deviceMode !== 'desktop' ? { 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            } : undefined}
          >
            {/* Actual Inner Viewport Area */}
            <div className={`w-full h-full relative overflow-hidden bg-[var(--bg-main)] rounded-[inherit] ${forceHideWebview ? 'pointer-events-none invisible opacity-0' : ''}`}>
              {/* Loading progress bar */}
              {isLoading && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${loadProgress}%`,
                    height: '2px',
                    background: 'var(--color-primary)',
                    boxShadow: '0 1px 3px var(--color-primary-glow)',
                    transition: loadProgress === 100 ? 'width 0.25s ease-out' : 'width 0.1s linear',
                    zIndex: 50,
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}
              {renderMode === 'electron-webview' ? (
                <webview 
                  key={iframeKey}
                  ref={setWebviewEl}
                  src={activeUrl}
                  className={`absolute inset-0 w-full h-full border-none bg-[var(--bg-main)] ${isResizing || forceHideWebview ? 'pointer-events-none' : ''}`}
                  style={{ width: '100%', height: '100%', border: 'none', visibility: forceHideWebview ? 'hidden' : 'visible' }}
                  allowpopups={true}
                />
              ) : renderMode === 'tauri-native' ? (
                <div 
                  ref={containerRef} 
                  className={`absolute inset-0 w-full h-full bg-[var(--bg-main)] ${isResizing || forceHideWebview ? 'pointer-events-none' : ''}`}
                >
                  {nativeError && (
                    <div role="alert" className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[var(--bg-main)] p-5 text-center">
                      <p className="text-sm text-red-300">{nativeError}</p>
                      <button type="button" className="rounded-md bg-purple-600 px-3 py-2 text-xs text-white"
                        onClick={() => setNativeGeneration(value => value + 1)}>Retry Browser</button>
                    </div>
                  )}
                </div>
              ) : renderMode === 'iframe-local' ? (
                <iframe 
                  key={iframeKey}
                  ref={iframeRef}
                  src={activeUrl} 
                  className={`absolute border-none bg-[var(--bg-main)] ${isResizing || forceHideWebview ? 'pointer-events-none' : ''}`}
                  style={{
                    width: `${100 / zoomFactor}%`,
                    height: `${100 / zoomFactor}%`,
                    transform: `scale(${zoomFactor})`,
                    transformOrigin: 'top left',
                    visibility: forceHideWebview ? 'hidden' : 'visible',
                  }}
                  title="App Preview"
                  onLoad={finishLoadingBar}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center bg-[var(--bg-main)]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                      <Globe size={28} className="text-purple-400" />
                    </div>
                    <h2 className="text-[var(--text-main)] font-semibold text-lg">External Website</h2>
                    <p className="text-[var(--text-muted)] text-sm max-w-sm leading-relaxed">
                      External websites require a native environment shell to be displayed inline.
                      <br /><br />
                      To display this page, launch the desktop app or open it in your system browser.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 w-full max-w-sm">
                    <button
                      onClick={() => openInSystemBrowser(activeUrl)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors  cursor-pointer"
                    >
                      <ExternalLink size={15} />
                      Open in System Browser
                    </button>
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono bg-[var(--bg-card)] border border-[var(--border-color)] px-3 py-2 rounded-md max-w-sm break-all">
                    {activeUrl}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* DevTools Drawer (Obsidian Theme style) */}
      <BrowserDevTools
        logs={logs}
        inspectedElement={inspectedElement}
        activeSubTab={activeSubTab}
        setActiveSubTab={setActiveSubTab}
        isDevtoolsCollapsed={isDevtoolsCollapsed}
        setIsDevtoolsCollapsed={setIsDevtoolsCollapsed}
        devtoolsHeight={devtoolsHeight}
        isResizing={isResizing}
        handleMouseDown={handleMouseDown}
        getHelperStatusColorClass={getHelperStatusColorClass}
        getHelperStatusText={getHelperStatusText}
        expandedLogId={expandedLogId}
        setExpandedLogId={setExpandedLogId}
        copiedId={copiedId}
        copyToClipboard={copyToClipboard}
        storageData={storageData}
        storageError={storageError}
        networkEntries={networkEntries}
        onClearNetwork={clearNetworkEntries}
        onRefreshStorage={fetchStorageData}
        onDeleteCookie={deleteCookie}
        onDeleteLocalStorage={deleteLocalStorage}
      />

      {showClearBookmarksModal && (
        <ConfirmModal
          show={showClearBookmarksModal}
          title="Clear All Bookmarks"
          message="Are you sure you want to clear all bookmarks? This action cannot be undone."
          confirmLabel="Clear All"
          variant="danger"
          onConfirm={() => {
            setBookmarks([]);
            setShowClearBookmarksModal(false);
          }}
          onCancel={() => setShowClearBookmarksModal(false)}
        />
      )}
    </div>
  );
}

