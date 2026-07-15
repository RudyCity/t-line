import React, { useState, useEffect, useRef } from 'react';
import { Globe, RotateCw, ExternalLink, MousePointer, ArrowLeft, ArrowRight, Monitor, Tablet, Smartphone, Minus, Plus, Star } from 'lucide-react';
import { TabData } from '../hooks/useTerminals';
import BrowserDevTools, { ConsoleErrorLog, InspectedElement } from './BrowserDevTools';
import { determineRenderMode, getCleanUrl, openInSystemBrowser, BookmarkItem, getFriendlyName, getHelperStatusColorClass as getHelperStatusColorClassUtil, getHelperStatusText as getHelperStatusTextUtil } from './browserUrlUtils';
import { useBrowserListeners } from '../hooks/useBrowserListeners';
import BookmarksDropdown from './BookmarksDropdown';

interface BrowserTabProps {
  tab: TabData;
  isActive: boolean;
  onUpdateTabName?: (newName: string) => void;
  onUpdateTabUrl?: (newUrl: string) => void;
}

export default function BrowserTab({ tab, isActive, onUpdateTabName, onUpdateTabUrl }: BrowserTabProps) {
  const [urlInput, setUrlInput] = useState(tab.url || '');
  const [activeUrl, setActiveUrl] = useState(tab.url || '');
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'inspector'>('console');
  
  const [logs, setLogs] = useState<ConsoleErrorLog[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [inspectedElement, setInspectedElement] = useState<InspectedElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [helperReady, setHelperReady] = useState(false);
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [zoomFactor, setZoomFactor] = useState(1.0);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    try {
      const saved = localStorage.getItem('tline-saved-bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  const [showBookmarksDropdown, setShowBookmarksDropdown] = useState(false);
  const bookmarksDropdownRef = useRef<HTMLDivElement>(null);

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

  // webviewActive: true when the tab is currently the active tab AND should have a live WebView2.
  // When the tab goes inactive, we destroy the WebView2 overlay to free RAM.
  // When it becomes active again, the WebView2 is recreated from the saved URL.
  const [webviewActive, setWebviewActive] = useState(isActive);

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
      if (isActive && !forceHideWebview) {
        webview.show().catch(() => {});
      } else {
        webview.hide().catch(() => {});
      }
    }
  }, [isActive, forceHideWebview, useTauriWebview, renderMode]);

  useEffect(() => {
    isActiveRef.current = isActive;
    if (isActive) {
      // Bring WebView2 back to life when this tab gains focus
      setWebviewActive(true);
    } else {
      // Suspend WebView2 when tab loses focus: destroy it to release RAM.
      // The URL is already stored in activeUrl so it will be restored on next activation.
      const webview = tauriWebviewRef.current;
      if (webview) {
        tauriWebviewRef.current = null;
        const sessionStorageKey = 'tline-active-webview-label-' + tab.id;
        sessionStorage.removeItem(sessionStorageKey);
        webview.close().catch((err: any) => {
          const errMsg = String(err);
          if (!errMsg.includes('webview not found')) {
            console.warn('[BrowserTab] Failed to close webview on suspend:', err);
          }
        });
      }
      setWebviewActive(false);
    }
  }, [isActive, tab.id]);

  // Synchronize dynamic name changes for tab component
  useEffect(() => {
    if (tab.url) {
      setUrlInput(getCleanUrl(tab.url));
      setActiveUrl(tab.url);
    }
  }, [tab.url]);

  // Sync native Tauri webview bounds to containerRef rect
  const syncWebviewBounds = async () => {
    const container = containerRef.current;
    const webview = tauriWebviewRef.current;
    if (!container || !webview || !isActiveRef.current) return;
    try {
      const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi');
      const r = container.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      await webview.setPosition(new LogicalPosition(r.left, r.top)).catch(() => {});
      await webview.setSize(new LogicalSize(r.width, r.height)).catch(() => {});
    } catch (_) {}
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
  }, [useTauriWebview, renderMode, webviewActive, devtoolsHeight, isDevtoolsCollapsed, deviceMode]);

  // Lifecycle of native Webview overlay in Tauri environment.
  // Re-runs whenever webviewActive toggles: creates on true, cleans up on false/unmount.
  useEffect(() => {
    if (!useTauriWebview || !activeUrl || renderMode !== 'tauri-native') return;
    if (!webviewActive) return; // Tab is suspended — do not spawn a new webview

    let active = true;
    let webviewInstance: any = null;
    const sessionStorageKey = 'tline-active-webview-label-' + tab.id;

    const initWebview = async () => {
      try {
        const { Webview } = await import('@tauri-apps/api/webview');
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi');

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
        const uniqueLabel = 'browser-webview-' + tab.id + '-' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem(sessionStorageKey, uniqueLabel);

        webviewInstance = new Webview(currentWindow, uniqueLabel, {
          url: activeUrl,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });

        tauriWebviewRef.current = webviewInstance;

        webviewInstance.once('tauri://error', (err: any) => {
          console.error('[BrowserTab] Native webview error:', err);
          if (webviewInstance) {
            webviewInstance.close().catch(() => {});
          }
          if (tauriWebviewRef.current === webviewInstance) {
            tauriWebviewRef.current = null;
          }
        });

        await new Promise((resolve) => setTimeout(resolve, 150));

        if (!active || !containerRef.current || !webviewInstance || tauriWebviewRef.current !== webviewInstance) return;

        if (isActiveRef.current) {
          await webviewInstance.show().catch(() => {});
        } else {
          await webviewInstance.hide().catch(() => {});
        }

        let lastRect = { left: 0, top: 0, width: 0, height: 0 };
        let consecutiveErrorCount = 0;
        const updateLoop = async () => {
          if (!active || !containerRef.current || !webviewInstance || tauriWebviewRef.current !== webviewInstance) return;

          if (!isActiveRef.current) {
            if (active && tauriWebviewRef.current === webviewInstance) {
              requestAnimationFrame(updateLoop);
            }
            return;
          }

          const container = containerRef.current;
          if (!container) return;

          const r = container.getBoundingClientRect();

          if (
            Math.abs(r.left - lastRect.left) > 0.5 ||
            Math.abs(r.top - lastRect.top) > 0.5 ||
            Math.abs(r.width - lastRect.width) > 0.5 ||
            Math.abs(r.height - lastRect.height) > 0.5
          ) {
            try {
              await webviewInstance.setPosition(new LogicalPosition(r.left, r.top));
              await webviewInstance.setSize(new LogicalSize(r.width, r.height));
              lastRect = { left: r.left, top: r.top, width: r.width, height: r.height };
              consecutiveErrorCount = 0;
            } catch (err) {
              if (!active || tauriWebviewRef.current !== webviewInstance) return;
              const errMsg = String(err);
              if (errMsg.includes('webview not found')) return;
              consecutiveErrorCount++;
              if (consecutiveErrorCount <= 5) {
                console.warn('[BrowserTab] Failed to sync webview bounds:', err);
              }
            }
          }

          if (active && tauriWebviewRef.current === webviewInstance) {
            requestAnimationFrame(updateLoop);
          }
        };

        updateLoop();
      } catch (err) {
        console.error('[BrowserTab] Tauri Webview initialization failed:', err);
      }
    };

    initWebview();

    return () => {
      active = false;
      tauriWebviewRef.current = null;
      sessionStorage.removeItem(sessionStorageKey);
      if (webviewInstance) {
        webviewInstance.close().catch((err: any) => {
          const errMsg = String(err);
          if (!errMsg.includes('webview not found')) {
            console.warn('[BrowserTab] Failed to close webview on cleanup:', err);
          }
        });
      }
    };
  }, [useTauriWebview, tab.id, activeUrl, renderMode, webviewActive]);

  // NOTE: show/hide is no longer used — we destroy/recreate WebView2 on isActive changes
  // to free RAM when the tab is not visible. This block is intentionally left empty.

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
        setUrlInput(cleanUrl);
        setActiveUrl(cleanUrl);
        onUpdateTabUrl?.(cleanUrl);
      }
    };

    webview.addEventListener('console-message', handleConsoleMessage);
    webview.addEventListener('did-navigate', handleElectronNavigate);
    webview.addEventListener('did-navigate-in-page', handleElectronNavigate);
    return () => {
      webview.removeEventListener('console-message', handleConsoleMessage);
      webview.removeEventListener('did-navigate', handleElectronNavigate);
      webview.removeEventListener('did-navigate-in-page', handleElectronNavigate);
    };
  }, [useElectronWebview, iframeKey, webviewEl, renderMode]);

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
        (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js: 'window.history.back()' }).catch(() => {});
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
        (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js: 'window.history.forward()' }).catch(() => {});
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

    let timer: ReturnType<typeof setInterval> | null = null;
    let isSubscribed = true;

    const pollUrl = () => {
      if (!isSubscribed) return;
      const webview = tauriWebviewRef.current;
      if (!webview) return;
      
      const activeLabel = webview.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
      if (activeLabel && (window as any).__TAURI__?.core?.invoke) {
        const jsCode = `
          try {
            var currentUrl = window.location.href;
            var proxyTarget = "";
            try {
              if (window.__TLINE_PROXY_TARGET__) {
                proxyTarget = window.__TLINE_PROXY_TARGET__;
              } else {
                var match = document.cookie.match(/(?:^|;\\s*)tline_proxy_target=([^;]+)/);
                if (match) proxyTarget = decodeURIComponent(match[1]);
              }
            } catch (e) {}

            var realUrl = currentUrl;
            if (proxyTarget && window.location.pathname.indexOf('/api/preview-proxy') === 0) {
              var path = window.location.pathname.substring('/api/preview-proxy'.length) || '/';
              realUrl = new URL(path + window.location.search + window.location.hash, proxyTarget + '/').href;
            }

            if (window.__last_checked_url !== realUrl) {
              window.__last_checked_url = realUrl;
              if (window.__TAURI__ && window.__TAURI__.event && typeof window.__TAURI__.event.emit === 'function') {
                window.__TAURI__.event.emit('tline-webview-event', {
                  type: 'tline-url-changed',
                  payload: { url: realUrl },
                  tabId: "${tab.id}"
                });
              }
            }

            // Enforce zoom factor inside native webview
            if (document.documentElement && document.documentElement.style.zoom !== "${zoomFactor}") {
              document.documentElement.style.zoom = "${zoomFactor}";
            }
            if (document.body && document.body.style.zoom !== "${zoomFactor}") {
              document.body.style.zoom = "${zoomFactor}";
            }
          } catch (e) {}
        `;
        (window as any).__TAURI__.core.invoke('eval_webview_js', { label: activeLabel, js: jsCode }).catch(() => {});
      }
    };

    timer = setInterval(pollUrl, 500);

    return () => {
      isSubscribed = false;
      if (timer) clearInterval(timer);
    };
  }, [useTauriWebview, renderMode, webviewActive, tab.id, zoomFactor]);

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

  const handleReload = () => {
    setLogs([]);
    setInspectedElement(null);
    setIframeKey(prev => prev + 1);
    startLoadingBar();
    if (useTauriWebview && tauriWebviewRef.current && renderMode === 'tauri-native') {
      const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
      if (activeLabel) {
        (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js: 'window.location.reload()' }).catch(() => {});
      }
      // Tauri native: auto-finish after a delay since we can't listen to load events
      setTimeout(finishLoadingBar, 1500);
    } else if (useElectronWebview && webviewEl && renderMode === 'electron-webview') {
      try {
        webviewEl.reload();
      } catch (_) {}
    }
  };

  const handleNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let target = urlInput.trim();
    if (!target) return;
    if (!/^https?:\/\//i.test(target) && !/^file:\/\//i.test(target)) {
      target = 'http://' + target;
    }
    setUrlInput(target);
    setActiveUrl(target);
    onUpdateTabUrl?.(target);
    startLoadingBar();
    // For tauri-native we can't listen to load events, so auto-finish
    if (renderMode === 'tauri-native') {
      setTimeout(finishLoadingBar, 1800);
    }
  };


  useEffect(() => {
    localStorage.setItem('tline-saved-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bookmarksDropdownRef.current && !bookmarksDropdownRef.current.contains(event.target as Node)) {
        setShowBookmarksDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Synchronize zoom factor to Tauri or Electron webviews
  useEffect(() => {
    if (useTauriWebview && tauriWebviewRef.current && renderMode === 'tauri-native') {
      const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
      if (activeLabel) {
        const jsCode = `try {
          if (document.documentElement) document.documentElement.style.zoom = "${zoomFactor}";
          if (document.body) document.body.style.zoom = "${zoomFactor}";
        } catch(e) {}`;
        (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js: jsCode }).catch(() => {});
      }
    } else if (useElectronWebview && webviewEl && renderMode === 'electron-webview') {
      try { webviewEl.setZoomFactor(zoomFactor); } catch (_) {}
    }
  }, [zoomFactor, activeUrl, renderMode, useTauriWebview, webviewActive, tab.id, useElectronWebview, webviewEl]);

  const handleZoomIn = () => setZoomFactor(prev => Math.min(3.0, prev + 0.1));
  const handleZoomOut = () => setZoomFactor(prev => Math.max(0.5, prev - 0.1));
  const handleZoomReset = () => setZoomFactor(1.0);

  const isCurrentBookmarked = bookmarks.some(b => b.url === activeUrl);

  const toggleBookmarkCurrent = () => {
    if (isCurrentBookmarked) {
      setBookmarks(prev => prev.filter(b => b.url !== activeUrl));
    } else {
      if (!activeUrl) return;
      setBookmarks(prev => [
        ...prev,
        {
          id: `bookmark-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          name: getFriendlyName(activeUrl),
          url: activeUrl
        }
      ]);
    }
  };

  const handleNavigateToBookmark = (url: string) => {
    setUrlInput(url);
    setActiveUrl(url);
    onUpdateTabUrl?.(url);
    setShowBookmarksDropdown(false);
    startLoadingBar();
    if (renderMode === 'tauri-native') {
      setTimeout(finishLoadingBar, 1800);
    }
  };

  const removeBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const clearAllBookmarks = () => {
    if (window.confirm('Are you sure you want to clear all bookmarks?')) {
      setBookmarks([]);
    }
  };

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
      {/* Top Navbar */}
      <div className="flex items-center justify-between gap-4 px-4 py-2 bg-[var(--bg-card)]/80 backdrop-blur-md border-b border-[var(--border-color)] select-none">
        
        {/* Left Section: Navigation Controls */}
        <div className="flex items-center gap-1">
          <div className="flex items-center bg-[var(--bg-main)]/50 border border-[var(--border-color)] rounded-lg p-0.5">
            <button 
              onClick={handleBack}
              className="p-1.5 rounded-md hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all cursor-pointer"
              title="Go back"
            >
              <ArrowLeft size={14} />
            </button>

            <button 
              onClick={handleForward}
              className="p-1.5 rounded-md hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all cursor-pointer"
              title="Go forward"
            >
              <ArrowRight size={14} />
            </button>

            <button 
              onClick={handleReload}
              className="p-1.5 rounded-md hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all cursor-pointer"
              title="Reload page"
            >
              <RotateCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Center Section: Beautiful URL Bar */}
        <div className="flex-1 max-w-2xl">
          <form onSubmit={handleNavigate} className="w-full flex items-center">
            <div className="flex-1 relative flex items-center bg-[var(--bg-main)]/60 hover:bg-[var(--bg-main)]/90 focus-within:bg-[var(--bg-main)] focus-within:ring-2 focus-within:ring-purple-500/20 transition-all border border-[var(--border-color)] focus-within:border-purple-500/50 rounded-full px-3 py-1">
              
              {/* Leading Icon */}
              <Globe size={14} className="text-purple-400/80 shrink-0" />
              
              {/* Input field */}
              <input 
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter application URL (e.g., localhost:3000)"
                className="w-full bg-transparent text-xs py-1 px-1 focus:outline-none text-[var(--text-main)] placeholder-[var(--text-muted)] border-none"
              />

              {/* Trailing Icons inside URL Bar */}
              <div className="flex items-center gap-1 shrink-0">
                {activeUrl && (
                  <button
                    type="button"
                    onClick={toggleBookmarkCurrent}
                    className={`p-1 rounded-full transition-colors cursor-pointer hover:bg-[var(--bg-card-hover)] ${
                      isCurrentBookmarked ? 'text-amber-400' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                    title={isCurrentBookmarked ? "Remove bookmark" : "Bookmark this page"}
                  >
                    <Star size={13} fill={isCurrentBookmarked ? "currentColor" : "none"} />
                  </button>
                )}

                {/* Bookmarks Dropdown Component */}
                <BookmarksDropdown
                  showBookmarksDropdown={showBookmarksDropdown}
                  setShowBookmarksDropdown={setShowBookmarksDropdown}
                  bookmarksDropdownRef={bookmarksDropdownRef}
                  bookmarks={bookmarks}
                  clearAllBookmarks={clearAllBookmarks}
                  handleNavigateToBookmark={handleNavigateToBookmark}
                  removeBookmark={removeBookmark}
                />
              </div>

            </div>
          </form>
        </div>

        {/* Right Section: View, Zoom, & Dev Actions */}
        <div className="flex items-center gap-3">
          
          {/* Device Toggles */}
          <div className="flex items-center bg-[var(--bg-main)]/50 border border-[var(--border-color)] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setDeviceMode('desktop')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                deviceMode === 'desktop'
                  ? 'bg-purple-500/20 text-purple-400 font-semibold animate-none'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
              }`}
              title="Desktop View"
            >
              <Monitor size={13} />
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('tablet')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                deviceMode === 'tablet'
                  ? 'bg-purple-500/20 text-purple-400 font-semibold animate-none'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
              }`}
              title="Tablet View"
            >
              <Tablet size={13} />
            </button>
            <button
              type="button"
              onClick={() => setDeviceMode('mobile')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                deviceMode === 'mobile'
                  ? 'bg-purple-500/20 text-purple-400 font-semibold animate-none'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
              }`}
              title="Mobile View"
            >
              <Smartphone size={13} />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center bg-[var(--bg-main)]/50 border border-[var(--border-color)] rounded-lg p-0.5">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] cursor-pointer"
              title="Zoom Out"
            >
              <Minus size={13} />
            </button>
            <span 
              onClick={handleZoomReset}
              className="text-[10px] font-mono px-2 min-w-[36px] text-center text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-main)] transition-colors select-none"
              title="Reset zoom to 100% (Click to reset)"
            >
              {Math.round(zoomFactor * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] cursor-pointer"
              title="Zoom In"
            >
              <Plus size={13} />
            </button>
          </div>

          {/* Developer Actions (Pills/Icons) */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleInspect}
              className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                isInspecting 
                  ? 'bg-purple-500/20 border-purple-500 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.2)]'
                  : 'bg-[var(--bg-main)]/50 border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
              }`}
              title="Inspect Element (Click and select items to inspect)"
            >
              <MousePointer size={14} className={isInspecting ? 'animate-pulse' : ''} />
            </button>

            {isTauri && (
              <button 
                onClick={() => openInSystemBrowser(activeUrl)}
                className="p-1.5 rounded-lg bg-[var(--bg-main)]/50 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-all cursor-pointer"
                title="Open in default system browser"
              >
                <ExternalLink size={14} />
              </button>
            )}
          </div>

        </div>
      </div>

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
                ? 'absolute inset-0 w-full h-full border-none bg-white'
                : deviceMode === 'tablet'
                ? 'relative w-[768px] h-[1024px] max-w-full max-h-full border-[12px] border-[#1e1e24] rounded-[24px] shadow-2xl bg-white flex flex-col transition-all duration-300'
                : 'relative w-[375px] h-[812px] max-w-full max-h-full border-[12px] border-[#1e1e24] rounded-[36px] shadow-2xl bg-white flex flex-col transition-all duration-300'
            }
            style={deviceMode !== 'desktop' ? { 
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
            } : undefined}
          >
            {/* Actual Inner Viewport Area */}
            <div className="w-full h-full relative overflow-hidden bg-white rounded-[inherit]">
              {/* Loading progress bar */}
              {isLoading && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: `${loadProgress}%`,
                    height: '2px',
                    background: 'linear-gradient(90deg, #a855f7, #818cf8)',
                    boxShadow: '0 0 8px rgba(168,85,247,0.7)',
                    transition: loadProgress === 100 ? 'width 0.25s ease-out' : 'width 0.1s linear',
                    zIndex: 50,
                    borderRadius: '0 2px 2px 0',
                  }}
                />
              )}

              {renderMode === 'electron-webview' ? (
                <webview 
                  key={iframeKey}
                  ref={(el: any) => {
                    setWebviewEl(el);
                    if (el) {
                      el.addEventListener('did-start-loading', startLoadingBar);
                      el.addEventListener('did-stop-loading', finishLoadingBar);
                      el.addEventListener('did-finish-load', () => {
                        try {
                          el.setZoomFactor(zoomFactor);
                        } catch (_) {}
                      });
                    }
                  }}
                  src={activeUrl}
                  className={`absolute inset-0 w-full h-full border-none bg-white ${isResizing ? 'pointer-events-none' : ''}`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  allowpopups={true}
                />
              ) : renderMode === 'tauri-native' ? (
                <div 
                  ref={containerRef} 
                  className={`absolute inset-0 w-full h-full bg-white ${isResizing ? 'pointer-events-none' : ''}`}
                />
              ) : renderMode === 'iframe-local' ? (
                <iframe 
                  key={iframeKey}
                  ref={iframeRef}
                  src={activeUrl} 
                  className={`absolute border-none bg-white ${isResizing ? 'pointer-events-none' : ''}`}
                  style={{
                    width: `${100 / zoomFactor}%`,
                    height: `${100 / zoomFactor}%`,
                    transform: `scale(${zoomFactor})`,
                    transformOrigin: 'top left',
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
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-md cursor-pointer"
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
      />
    </div>
  );
}
