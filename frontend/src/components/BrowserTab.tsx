import React, { useState, useEffect, useRef } from 'react';
import { Globe, RotateCw, ExternalLink, MousePointer, ArrowLeft, ArrowRight } from 'lucide-react';
import { TabData } from '../hooks/useTerminals';
import { wsManager } from '../services/websocket';
import BrowserDevTools, { ConsoleErrorLog, InspectedElement } from './BrowserDevTools';
import { determineRenderMode } from './browserUrlUtils';

interface BrowserTabProps {
  tab: TabData;
  isActive: boolean;
  onUpdateTabName?: (newName: string) => void;
}

export default function BrowserTab({ tab, isActive, onUpdateTabName }: BrowserTabProps) {
  const [urlInput, setUrlInput] = useState(tab.url || '');
  const [activeUrl, setActiveUrl] = useState(tab.url || '');
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'inspector'>('console');
  
  const [logs, setLogs] = useState<ConsoleErrorLog[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [inspectedElement, setInspectedElement] = useState<InspectedElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);
  const [helperReady, setHelperReady] = useState(false);

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

  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Synchronize dynamic name changes for tab component
  useEffect(() => {
    if (tab.url) {
      setUrlInput(tab.url);
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

  // Window resize + ResizeObserver: keep native webview glued to container
  useEffect(() => {
    if (!useTauriWebview || renderMode !== 'tauri-native') return;

    const handleWindowResize = () => { void syncWebviewBounds(); };
    window.addEventListener('resize', handleWindowResize);

    let ro: ResizeObserver | null = null;
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const attachObserver = () => {
      if (cancelled || typeof ResizeObserver === 'undefined') return;
      const container = containerRef.current;
      if (!container) {
        // Container not mounted yet — retry shortly
        retryTimer = setTimeout(attachObserver, 50);
        return;
      }
      if (ro) ro.disconnect();
      ro = new ResizeObserver(() => { void syncWebviewBounds(); });
      ro.observe(container);
      void syncWebviewBounds();
    };
    attachObserver();

    return () => {
      cancelled = true;
      window.removeEventListener('resize', handleWindowResize);
      if (retryTimer) clearTimeout(retryTimer);
      if (ro) ro.disconnect();
    };
  }, [useTauriWebview, activeUrl, renderMode, isActive]);

  // Force bounds resync when DevTools height/collapse changes
  // Native webview is OS overlay — covers DevTools unless bounds shrink
  useEffect(() => {
    if (!useTauriWebview || renderMode !== 'tauri-native') return;
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => { void syncWebviewBounds(); });
    });
    const t = setTimeout(() => { void syncWebviewBounds(); }, 220);
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(t);
    };
  }, [devtoolsHeight, isDevtoolsCollapsed, useTauriWebview, renderMode]);

  // Lifecycle of native Webview overlay in Tauri environment
  useEffect(() => {
    if (!useTauriWebview || !activeUrl || renderMode !== 'tauri-native') return;

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
  }, [useTauriWebview, tab.id, activeUrl, renderMode]);

  // Handle Webview visibility on isActive change
  useEffect(() => {
    if (tauriWebviewRef.current && useTauriWebview && activeUrl && renderMode === 'tauri-native') {
      if (isActive) {
        tauriWebviewRef.current.show()
          .then(async () => {
            const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi');
            await new Promise(resolve => setTimeout(resolve, 50));
            const container = containerRef.current;
            if (container && tauriWebviewRef.current) {
              const r = container.getBoundingClientRect();
              await tauriWebviewRef.current.setPosition(new LogicalPosition(r.left, r.top)).catch(() => {});
              await tauriWebviewRef.current.setSize(new LogicalSize(r.width, r.height)).catch(() => {});
            }
          })
          .catch((err: any) => {
            const errMsg = String(err);
            if (!errMsg.includes('webview not found')) {
              console.warn('[BrowserTab] Failed to show webview:', err);
            }
          });
      } else {
        tauriWebviewRef.current.hide().catch((err: any) => {
          const errMsg = String(err);
          if (!errMsg.includes('webview not found')) {
            console.warn('[BrowserTab] Failed to hide webview:', err);
          }
        });
      }
    }
  }, [isActive, useTauriWebview, activeUrl, renderMode]);

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

    webview.addEventListener('console-message', handleConsoleMessage);
    return () => {
      webview.removeEventListener('console-message', handleConsoleMessage);
    };
  }, [useElectronWebview, iframeKey, webviewEl, renderMode]);

  // Listen to postMessage from the iframe (local mode fallback)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      const { type, payload } = event.data;
      if (type === 'tline-ready') {
        setHelperReady(true);
        if (iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'tline-ack-ready' }, '*');
        }
      }
      if (type === 'tline-error') {
        const newLog: ConsoleErrorLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          timestamp: new Date().toLocaleTimeString(),
          message: payload.message,
          filename: payload.filename || 'unknown',
          lineno: payload.lineno || 0,
          colno: payload.colno || 0,
          stack: payload.stack || null
        };
        setLogs(prev => [newLog, ...prev].slice(0, 100));
      }
      if (type === 'tline-element-selected') {
        setInspectedElement(payload);
        setIsInspecting(false);
        setActiveSubTab('inspector');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Listen to WebSocket preview events from native Webview
  useEffect(() => {
    const handleWsMessage = (payload: any) => {
      if (payload.type === 'tline-preview-event' && payload.tabId === tab.id) {
        const { eventType, payload: eventPayload } = payload;
        if (eventType === 'tline-ready') {
          setHelperReady(true);
          if (useTauriWebview && tauriWebviewRef.current && (window as any).__TAURI__?.core?.invoke) {
            const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
            if (activeLabel) {
              (window as any).__TAURI__.core.invoke('eval_webview_js', {
                label: activeLabel,
                js: 'window.postMessage({ type: "tline-ack-ready" }, "*")'
              }).catch(() => {});
            }
          }
        }
        if (eventType === 'tline-url-changed' && eventPayload?.url) {
          setUrlInput(eventPayload.url);
          if (onUpdateTabName) {
            try {
              const hostname = new URL(eventPayload.url).hostname;
              onUpdateTabName(`Preview: ${hostname}`);
            } catch (_) {}
          }
        }
        if (eventType === 'tline-error') {
          const newLog: ConsoleErrorLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            timestamp: new Date().toLocaleTimeString(),
            message: eventPayload.message,
            filename: eventPayload.filename || 'unknown',
            lineno: eventPayload.lineno || 0,
            colno: eventPayload.colno || 0,
            stack: eventPayload.stack || null
          };
          setLogs(prev => [newLog, ...prev].slice(0, 100));
        }
        if (eventType === 'tline-element-selected') {
          setInspectedElement(eventPayload);
          setIsInspecting(false);
          setActiveSubTab('inspector');
        }
      }
    };

    wsManager.addGlobalMessageListener(handleWsMessage);
    return () => {
      wsManager.removeGlobalMessageListener(handleWsMessage);
    };
  }, [useTauriWebview, tab.id, onUpdateTabName]);

  // Listen to Tauri event bus for events emitted directly from native webview
  useEffect(() => {
    if (!useTauriWebview || !(window as any).__TAURI__?.event) return;

    let isMounted = true;
    let unlistenTauriEvent: (() => void) | null = null;
    import('@tauri-apps/api/event').then(({ listen }) => {
      if (!isMounted) return;
      listen<{ type: string; payload: any; tabId: string | null }>('tline-webview-event', (event) => {
        if (!isMounted) return;
        const { type: eventType, payload: eventPayload, tabId: eventTabId } = event.payload;
        if (eventTabId !== tab.id) return;
        if (eventType === 'tline-element-selected') {
          setInspectedElement(eventPayload);
          setIsInspecting(false);
          setActiveSubTab('inspector');
        }
        if (eventType === 'tline-error') {
          const newLog: ConsoleErrorLog = {
            id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            timestamp: new Date().toLocaleTimeString(),
            message: eventPayload.message,
            filename: eventPayload.filename || 'unknown',
            lineno: eventPayload.lineno || 0,
            colno: eventPayload.colno || 0,
            stack: eventPayload.stack || null
          };
          setLogs(prev => [newLog, ...prev].slice(0, 100));
        }
        if (eventType === 'tline-url-changed' && eventPayload?.url) {
          setUrlInput(eventPayload.url);
          if (onUpdateTabName) {
            try {
              const hostname = new URL(eventPayload.url).hostname;
              onUpdateTabName(`Preview: ${hostname}`);
            } catch (_) {}
          }
        }
        if (eventType === 'tline-ready') {
          setHelperReady(true);
          if (tauriWebviewRef.current && (window as any).__TAURI__?.core?.invoke) {
            const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
            if (activeLabel) {
              (window as any).__TAURI__.core.invoke('eval_webview_js', {
                label: activeLabel,
                js: 'window.postMessage({ type: "tline-ack-ready" }, "*")'
              }).catch(() => {});
            }
          }
        }
      }).then(unlisten => {
        if (!isMounted) {
          try {
            const res = unlisten();
            if ((res as any) instanceof Promise) {
              (res as any).catch(() => {});
            }
          } catch (_) {}
          return;
        }
        unlistenTauriEvent = unlisten;
      }).catch(() => {});
    }).catch(() => {});

    return () => {
      isMounted = false;
      if (unlistenTauriEvent) {
        try {
          const res = unlistenTauriEvent();
          if ((res as any) instanceof Promise) {
            (res as any).catch((err: any) => {
              const errMsg = String(err);
              if (!errMsg.includes('handlerId')) {
                console.warn('[BrowserTab] Error in unlisten promise:', err);
              }
            });
          }
        } catch (e) {
          const errMsg = String(e);
          if (!errMsg.includes('handlerId')) {
            console.warn('[BrowserTab] Error calling unlisten:', e);
          }
        }
      }
    };
  }, [useTauriWebview, tab.id, onUpdateTabName]);

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

  const handleReload = () => {
    setLogs([]);
    setInspectedElement(null);
    setIframeKey(prev => prev + 1);
    if (useTauriWebview && tauriWebviewRef.current && renderMode === 'tauri-native') {
      const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
      if (activeLabel) {
        (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js: 'window.location.reload()' }).catch(() => {});
      }
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
  };

  const openInSystemBrowser = (url: string) => {
    if (isTauri && (window as any).__TAURI__?.core?.invoke) {
      (window as any).__TAURI__.core.invoke('open_in_browser', { url }).catch((e: any) => {
        console.error('[BrowserTab] Failed to open url in system browser:', e);
      });
    } else {
      window.open(url, '_blank');
    }
  };

  const getHelperStatusColorClass = () => {
    if (renderMode === 'tauri-native' || renderMode === 'electron-webview') {
      return 'bg-green-500';
    }
    if (renderMode === 'iframe-local') {
      return 'bg-green-500';
    }
    return 'bg-amber-500 animate-pulse';
  };

  const getHelperStatusText = () => {
    if (renderMode === 'tauri-native') {
      return 'Tauri Native Shell Active';
    }
    if (renderMode === 'electron-webview') {
      return 'Electron Webview Shell Active';
    }
    if (renderMode === 'iframe-local') {
      return helperReady ? 'Local Iframe (Connected)' : 'Local Iframe (Connecting...)';
    }
    return 'Fallback Static Mode';
  };

  const toggleInspect = async () => {
    const nextState = !isInspecting;
    setIsInspecting(nextState);

    if (useTauriWebview && tauriWebviewRef.current && renderMode === 'tauri-native') {
      try {
        const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
        if (activeLabel) {
          // Proactively fetch and inject the helper code if needed
          try {
            const host = window.location.host.endsWith(':5773') 
              ? window.location.host.replace(':5773', ':5779') 
              : window.location.host;
            const res = await fetch(`http://${host}/api/preview-proxy/tline-helper.js`);
            if (res.ok) {
              const helperCode = await res.text();
              // Inject tabId and native flag
              const setupCode = `
                window.__TLINE_TAB_ID__ = "${tab.id}";
                window.__TLINE_NATIVE__ = true;
                ${helperCode}
              `;
              await (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js: setupCode }).catch(() => {});
            }
          } catch (fetchErr) {
            console.warn('[BrowserTab] Failed to fetch/inject helper code during inspect toggle:', fetchErr);
          }

          const cmd = nextState ? 'tline-start-inspect' : 'tline-stop-inspect';
          const jsCode = `window.postMessage({ type: "${cmd}" }, "*")`;
          (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js: jsCode }).catch((e: any) => {
            console.warn('[BrowserTab] Failed to eval inspect command in Webview:', e);
          });
        }
      } catch (e) {
        console.warn('[BrowserTab] Webview eval error:', e);
      }
    } else if (renderMode === 'iframe-local' && iframeRef.current?.contentWindow) {
      const cmd = nextState ? 'tline-start-inspect' : 'tline-stop-inspect';
      iframeRef.current.contentWindow.postMessage({ type: cmd }, '*');
    }
  };

  return (
    <div 
      className="flex flex-col h-full w-full bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden"
      style={{ display: isActive ? 'flex' : 'none' }}
    >
      {/* Top Navbar */}
      <div className="flex items-center gap-2 p-2 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
        <button 
          onClick={handleBack}
          className="p-1.5 rounded hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
          title="Go back"
        >
          <ArrowLeft size={15} />
        </button>

        <button 
          onClick={handleForward}
          className="p-1.5 rounded hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
          title="Go forward"
        >
          <ArrowRight size={15} />
        </button>

        <button 
          onClick={handleReload}
          className="p-1.5 rounded hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
          title="Reload page"
        >
          <RotateCw size={15} />
        </button>

        <form onSubmit={handleNavigate} className="flex-1 flex gap-2">
          <input 
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="Enter application URL (e.g., localhost:3000)"
            className="flex-1 px-3 py-1.5 bg-[var(--bg-main)] text-sm rounded-lg border border-[var(--border-color)] focus:outline-none focus:border-purple-500 text-[var(--text-main)] placeholder-[var(--text-muted)]"
          />
          <button 
            type="submit"
            className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm cursor-pointer"
          >
            Go
          </button>
        </form>

        <button
          onClick={toggleInspect}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
            isInspecting 
              ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.25)]'
              : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
          }`}
          title="Inspect Element (Click and select an item in the preview)"
        >
          <MousePointer size={13} className={isInspecting ? 'animate-pulse' : ''} />
          <span>Inspect</span>
        </button>

        {isTauri && (
          <button 
            onClick={() => openInSystemBrowser(activeUrl)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--bg-main)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all cursor-pointer"
            title="Open in default browser"
          >
            <ExternalLink size={13} />
            <span>Open Browser</span>
          </button>
        )}
      </div>

      {/* Main Browser Viewport Area — min-h-0 so DevTools can claim space */}
      <div className="flex-1 bg-[var(--bg-main)] relative min-h-0 overflow-hidden">
        {renderMode === 'electron-webview' ? (
          <webview 
            key={iframeKey}
            ref={setWebviewEl}
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
            className={`absolute inset-0 w-full h-full border-none bg-white ${isResizing ? 'pointer-events-none' : ''}`}
            title="App Preview"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8 text-center">
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
