import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, RotateCw, Bug, MousePointer, Check, 
  AlertCircle, ShieldAlert, Code2, Sparkles, Layout,
  ChevronDown, ChevronUp, ExternalLink, MonitorSmartphone
} from 'lucide-react';
import { TabData } from '../hooks/useTerminals';
import { wsManager } from '../services/websocket';

interface ConsoleErrorLog {
  id: string;
  timestamp: string;
  message: string;
  filename: string;
  lineno: number;
  colno: number;
  stack: string | null;
}

interface InspectedElement {
  tagName: string;
  id: string;
  classes: string[];
  outerHTML: string;
  computedStyles: Record<string, string>;
  selectorPath: string;
}

interface BrowserTabProps {
  tab: TabData;
  isActive: boolean;
  onUpdateTabName?: (newName: string) => void;
}

export default function BrowserTab({ tab, isActive, onUpdateTabName }: BrowserTabProps) {
  const [urlInput, setUrlInput] = useState(tab.url || '');
  const [activeUrl, setActiveUrl] = useState(tab.url || '');
  const [isInspecting, setIsInspecting] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'inspector'>('console');
  
  const [logs, setLogs] = useState<ConsoleErrorLog[]>([]);
  const [inspectedElement, setInspectedElement] = useState<InspectedElement | null>(null);
  
  const [copiedId, setCopiedId] = useState<string | null>(null); // 'element' or log ID
  const [helperReady, setHelperReady] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [forceProxy, setForceProxy] = useState(false);
  const [bypassProxy, setBypassProxy] = useState(false);

  // States for resizable / collapsible DevTools drawer
  const [devtoolsHeight, setDevtoolsHeight] = useState(280);
  const [isDevtoolsCollapsed, setIsDevtoolsCollapsed] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [webviewEl, setWebviewEl] = useState<any>(null);
  const isElectron = typeof window !== 'undefined' && window.navigator.userAgent.toLowerCase().includes('electron');
  const isTauri = typeof (window as any).__TAURI__ !== 'undefined';

  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const isLocalUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'localhost'
        || parsed.hostname === '127.0.0.1'
        || parsed.hostname.startsWith('192.168.')
        || parsed.hostname.endsWith('.local')
        || parsed.protocol === 'file:';
    } catch { return false; }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const tauriWebviewRef = useRef<any>(null);
  const useElectronWebview = isElectron; // Use native Electron webview tag when in Electron
  const useTauriWebview = isTauri;       // Enable native Tauri webview overlay on Tauri platform

  const getBackendProxyUrl = (url: string) => {
    const proxyPath = `/api/preview-proxy?target=${encodeURIComponent(url)}&tabId=${tab.id}`;
    let backendOrigin = window.location.origin;
    if (backendOrigin.includes('localhost:5773') || backendOrigin.includes('127.0.0.1:5773')) {
      backendOrigin = backendOrigin.replace('5773', '5779');
    }
    return `${backendOrigin}${proxyPath}`;
  };

  const openInSystemBrowser = async (url: string) => {
    try {
      await fetch('/api/browser/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
    } catch (e) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Tauri Child Webview Overlay Management
  useEffect(() => {
    if (!useTauriWebview || isElectron || !activeUrl) return;

    let active = true;
    let webviewInstance: any = null;
    const sessionStorageKey = 'tline-active-webview-label-' + tab.id;

    const initWebview = async () => {
      // Small delay to let the container div mount and render in DOM
      await new Promise(resolve => setTimeout(resolve, 100));
      const initialContainer = containerRef.current;
      if (!active || !initialContainer) return;

      try {
        const { Webview } = await import('@tauri-apps/api/webview');
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        const { LogicalPosition, LogicalSize } = await import('@tauri-apps/api/dpi');

        const currentWindow = getCurrentWindow();

        // 1. Retrieve the last active unique label from sessionStorage (handling F5 reload)
        const lastLabel = sessionStorage.getItem(sessionStorageKey);
        let closedOld = false;

        if (lastLabel) {
          try {
            const oldWebview = await Webview.getByLabel(lastLabel);
            if (oldWebview) {
              await oldWebview.close();
              closedOld = true;
            }
          } catch (_) {}
          sessionStorage.removeItem(sessionStorageKey);
        }

        // Also try to close with the fallback default label (handling legacy labels)
        try {
          const fallbackWebview = await Webview.getByLabel('browser-webview-' + tab.id);
          if (fallbackWebview) {
            await fallbackWebview.close();
            closedOld = true;
          }
        } catch (_) {}

        // If we closed an old webview, wait a bit to let Tauri backend unregister the labels
        if (closedOld) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }

        const container = containerRef.current;
        if (!active || !container) return;

        const rect = container.getBoundingClientRect();

        // Generate a unique label to prevent duplicate label conflict in Tauri backend
        // Prefixed with 'browser-' to match the 'browser-*' glob in capabilities/default.json
        const uniqueLabel = 'browser-webview-' + tab.id + '-' + Math.random().toString(36).substring(2, 9);
        sessionStorage.setItem(sessionStorageKey, uniqueLabel);

        const targetUrl = activeUrl 
          ? (bypassProxy ? activeUrl : getBackendProxyUrl(activeUrl))
          : '';
        webviewInstance = new Webview(currentWindow, uniqueLabel, {
          url: targetUrl,
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height,
        });

        tauriWebviewRef.current = webviewInstance;

        // Wait for the webview to be fully created before starting the update loop
        // Register error listener asynchronously
        webviewInstance.once('tauri://error', (err: any) => {
          console.error('[BrowserTab] Native webview error:', err);
          if (webviewInstance) {
            webviewInstance.close().catch(() => {});
          }
          if (tauriWebviewRef.current === webviewInstance) {
            tauriWebviewRef.current = null;
          }
        });

        // Wait a short delay for the native webview registration
        await new Promise((resolve) => setTimeout(resolve, 150));

        if (!active || !containerRef.current || !webviewInstance || tauriWebviewRef.current !== webviewInstance) return;

        // Immediately sync visibility state based on active tab state
        if (isActiveRef.current) {
          await webviewInstance.show().catch(() => {});
        } else {
          await webviewInstance.hide().catch(() => {});
        }

        // Position and size update loop (requestAnimationFrame is extremely smooth)
        let lastRect = { left: 0, top: 0, width: 0, height: 0 };
        let consecutiveErrorCount = 0;
        const updateLoop = async () => {
          if (!active || !containerRef.current || !webviewInstance || tauriWebviewRef.current !== webviewInstance) return;

          // Skip position/size syncing if the tab is inactive
          if (!isActiveRef.current) {
            if (active && tauriWebviewRef.current === webviewInstance) {
              requestAnimationFrame(updateLoop);
            }
            return;
          }

          const container = containerRef.current;
          if (!container) return;

          const r = container.getBoundingClientRect();

          // Only call Tauri APIs if bounds actually changed
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
              consecutiveErrorCount = 0; // reset on success
            } catch (err) {
              consecutiveErrorCount++;
              if (consecutiveErrorCount <= 5) {
                console.warn('[BrowserTab] Failed to sync webview bounds:', err);
              }
              if (consecutiveErrorCount >= 10) {
                console.error('[BrowserTab] Stopping webview bounds sync due to consecutive failures.');
                active = false;
                return;
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
          console.warn('[BrowserTab] Failed to close webview on cleanup:', err);
        });
      }
    };
  }, [useTauriWebview, tab.id, activeUrl, bypassProxy]);

  // Handle Webview visibility on isActive change
  useEffect(() => {
    if (tauriWebviewRef.current && useTauriWebview && activeUrl) {
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
          .catch((err: any) => console.warn('[BrowserTab] Failed to show webview:', err));
      } else {
        tauriWebviewRef.current.hide().catch((err: any) => console.warn('[BrowserTab] Failed to hide webview:', err));
      }
    }
  }, [isActive, useTauriWebview, activeUrl]);

  // Listen to console messages if in Electron and using webview
  useEffect(() => {
    if (!useElectronWebview || !webviewEl) return;
    const webview = webviewEl;

    const handleConsoleMessage = (e: any) => {
      if (e.level === 2) {
        const newLog: ConsoleErrorLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
  }, [isElectron, iframeKey, webviewEl]);

  // Drag handler to resize DevTools drawer
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    const startY = e.clientY;
    const startHeight = devtoolsHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      // Dragging UP (deltaY < 0) increases the drawer height
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

  // Reset state when active tab ID changes to prevent state leaking
  useEffect(() => {
    setUrlInput(tab.url || '');
    setActiveUrl(tab.url || '');
    setLogs([]);
    setInspectedElement(null);
    setIsInspecting(false);
    setHelperReady(false);
    setIframeKey(prev => prev + 1);
  }, [tab.id]);

  // Sync tab URL state if changed externally
  useEffect(() => {
    if (tab.url && tab.url !== activeUrl) {
      setUrlInput(tab.url);
      setActiveUrl(tab.url);
      setHelperReady(false);
      setIframeKey(prev => prev + 1);
    }
  }, [tab.url]);

  // Listen to postMessage from the iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Check if message structure is correct
      if (!event.data || typeof event.data !== 'object') return;
      
      const { type, payload } = event.data;
      
      if (type === 'tline-ready') {
        setHelperReady(true);
        console.log('[BrowserTab] Connection established with preview helper script.');
        // If we are currently in inspect mode, tell the new load to start inspect
        if (isInspecting && iframeRef.current?.contentWindow) {
          iframeRef.current.contentWindow.postMessage({ type: 'tline-start-inspect' }, '*');
        }
      }

      if (type === 'tline-url-changed' && payload?.url) {
        // Update the URL bar to reflect current navigation within the proxy
        setUrlInput(payload.url);
        if (onUpdateTabName) {
          try {
            const hostname = new URL(payload.url).hostname;
            onUpdateTabName(`Preview: ${hostname}`);
          } catch (_) {}
        }
      }
      
      if (type === 'tline-error') {
        const newLog: ConsoleErrorLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toLocaleTimeString(),
          message: payload.message,
          filename: payload.filename,
          lineno: payload.lineno,
          colno: payload.colno,
          stack: payload.stack
        };
        setLogs(prev => [newLog, ...prev].slice(0, 100)); // Cap at 100 logs
      }
      
      if (type === 'tline-element-selected') {
        setInspectedElement(payload);
        setIsInspecting(false); // Element picked, exit inspect mode
        setActiveSubTab('inspector');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [isInspecting]);

  // Listen to WebSocket preview events from native Webview
  useEffect(() => {
    if (!useTauriWebview) return;

    const handleWsMessage = (payload: any) => {
      if (payload.type === 'tline-preview-event' && payload.tabId === tab.id) {
        const { eventType, payload: eventPayload } = payload;
        
        if (eventType === 'tline-ready') {
          setHelperReady(true);
          if (isInspecting && (window as any).__TAURI__?.core?.invoke) {
            const activeLabel = tauriWebviewRef.current?.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
            if (activeLabel) {
              const jsCode = `window.postMessage({ type: "tline-start-inspect" }, "*")`;
              (window as any).__TAURI__.core.invoke('eval_webview_js', { label: activeLabel, js: jsCode }).catch(() => {});
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
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toLocaleTimeString(),
            message: eventPayload.message,
            filename: eventPayload.filename,
            lineno: eventPayload.lineno,
            colno: eventPayload.colno,
            stack: eventPayload.stack
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
  }, [useTauriWebview, tab.id, isInspecting]);

  const handleNavigate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let targetUrl = urlInput.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
    // Auto-upgrade http -> https for non-localhost domains
    if (/^http:\/\//i.test(targetUrl)) {
      try {
        const parsed = new URL(targetUrl);
        const isLocal = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname.endsWith('.local');
        if (!isLocal) {
          targetUrl = targetUrl.replace(/^http:\/\//i, 'https://');
        }
      } catch (_) {}
    }
    setUrlInput(targetUrl);
    setActiveUrl(targetUrl);
    setHelperReady(false);
    setLogs([]);
    setInspectedElement(null);
    setForceProxy(false);
    setIframeKey(prev => prev + 1);

    // Update tab name dynamically
    if (onUpdateTabName) {
      try {
        const hostname = new URL(targetUrl).hostname;
        onUpdateTabName(`Preview: ${hostname}`);
      } catch (err) {
        onUpdateTabName('Web Preview');
      }
    }
  };

  const handleReload = () => {
    setHelperReady(false);
    setLogs([]);
    if (tauriWebviewRef.current && useTauriWebview) {
      if (typeof tauriWebviewRef.current.reload === 'function') {
        tauriWebviewRef.current.reload().catch(() => {
          const targetUrl = activeUrl 
            ? (bypassProxy ? activeUrl : getBackendProxyUrl(activeUrl))
            : '';
          tauriWebviewRef.current.navigate(targetUrl).catch((err: any) => console.error(err));
        });
      } else {
        const targetUrl = activeUrl 
          ? (bypassProxy ? activeUrl : getBackendProxyUrl(activeUrl))
          : '';
        tauriWebviewRef.current.navigate(targetUrl).catch((err: any) => console.error(err));
      }
    } else {
      setIframeKey(prev => prev + 1);
    }
  };

  const toggleInspect = () => {
    const nextState = !isInspecting;
    setIsInspecting(nextState);
    if (useTauriWebview && (window as any).__TAURI__?.core?.invoke) {
      try {
        const activeLabel = tauriWebviewRef.current?.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
        if (activeLabel) {
          const cmd = nextState ? 'tline-start-inspect' : 'tline-stop-inspect';
          const jsCode = `window.postMessage({ type: "${cmd}" }, "*")`;
          (window as any).__TAURI__.core.invoke('eval_webview_js', { label: activeLabel, js: jsCode }).catch((e: any) => {
            console.warn('[BrowserTab] Failed to eval inspect command in Webview:', e);
          });
        }
      } catch (e) {
        console.warn('[BrowserTab] Webview eval error:', e);
      }
    } else if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.postMessage({
        type: nextState ? 'tline-start-inspect' : 'tline-stop-inspect'
      }, '*');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const generateErrorPrompt = (log: ConsoleErrorLog) => {
    return `Here is a JavaScript/Console error captured from my web application:

### 🔴 Error Context
- **Message:** ${log.message}
- **Source:** ${log.filename || 'Unknown source'} ${log.lineno ? `(line ${log.lineno}, col ${log.colno})` : ''}
${log.stack ? `
**Stack Trace:**
\`\`\`
${log.stack}
\`\`\`
` : ''}

Please analyze this error log, explain what is causing it, and provide a clear solution to fix it.`;
  };

  const generateElementPrompt = (el: InspectedElement) => {
    const styleDetails = Object.entries(el.computedStyles)
      .map(([k, v]) => `- \`${k}\`: \`${v}\``)
      .join('\n');

    return `Please analyze this UI element from my web application to troubleshoot styling or layout issues:

### 🔍 Element Context
- **Tag:** \`${el.tagName}\`
- **ID:** ${el.id ? `\`${el.id}\`` : '*None*'}
- **CSS Selector Path:** \`${el.selectorPath}\`
- **Classes:** \`${el.classes.join(' ')}\`

### 🎨 Computed Styles (Layout Details)
${styleDetails}

### 📄 HTML Source Code
\`\`\`html
${el.outerHTML}
\`\`\`

Please inspect this element and recommend layout fixes, cleaner tailwind classes, or code refactorings to improve its layout or styling.`;
  };

  const getHelperStatusText = () => {
    if (useElectronWebview) {
      return 'Chromium Native Webview Active';
    }
    if (!activeUrl) {
      return 'Waiting for preview URL...';
    }
    if (useTauriWebview && bypassProxy) {
      return 'Direct Mode Active';
    }
    if (helperReady) {
      return 'Proxy Helper Active';
    }
    return 'Connecting Helper...';
  };

  const getHelperStatusColorClass = () => {
    if (useElectronWebview) {
      return 'bg-green-500';
    }
    if (!activeUrl) {
      return 'bg-slate-500';
    }
    if (useTauriWebview && bypassProxy) {
      return 'bg-green-500';
    }
    if (helperReady) {
      return 'bg-green-500';
    }
    return 'bg-amber-500 animate-pulse';
  };

  // Point the iframe to our dynamic proxy served by t-line's backend
  const proxyUrl = `/api/preview-proxy?target=${encodeURIComponent(activeUrl)}&tabId=${tab.id}`;

  return (
    <div 
      className="flex flex-col h-full w-full bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden"
      style={{ display: isActive ? 'flex' : 'none' }}
    >
      {/* Top Navbar */}
      <div className="flex items-center gap-2 p-2 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
        <button 
          onClick={handleReload}
          className="p-1.5 rounded hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
          title="Reload Preview"
        >
          <RotateCw size={15} />
        </button>

        <form onSubmit={handleNavigate} className="flex-1 flex items-center gap-1">
          <div className="flex-1 flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-md focus-within:border-[var(--color-primary)] transition-all">
            <Globe size={13} className="text-[var(--text-muted)]" />
            <input 
              type="text" 
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter local URL (e.g. http://localhost:4333)"
              className="flex-1 bg-transparent border-none outline-none text-xs text-[var(--text-main)] font-mono"
            />
          </div>
          <button 
            type="submit" 
            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded transition-colors"
          >
            Go
          </button>
        </form>

        <div className="flex gap-2">
          {/* Open DevTools button (available in Electron or Tauri) */}
          {(useElectronWebview || useTauriWebview) && (
            <button 
              onClick={async () => {
                if (useElectronWebview && webviewEl) {
                  try {
                    webviewEl.openDevTools();
                  } catch (e) {
                    console.error('Failed to open native devtools:', e);
                  }
                } else if (useTauriWebview) {
                  const activeLabel = tauriWebviewRef.current?.label || sessionStorage.getItem('tline-active-webview-label-' + tab.id);
                  if (activeLabel && (window as any).__TAURI__?.core?.invoke) {
                    try {
                      await (window as any).__TAURI__.core.invoke('open_webview_devtools', { label: activeLabel });
                    } catch (e) {
                      console.error('Failed to open Tauri webview devtools:', e);
                    }
                  }
                }
              }}
              className="flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-all cursor-pointer"
              title="Open Developer Tools"
            >
              <Code2 size={13} />
              <span>Open DevTools</span>
            </button>
          )}

          {/* Direct Mode / Proxy Mode toggle for Tauri Webview */}
          {useTauriWebview && (
            <button 
              onClick={() => {
                setBypassProxy(prev => !prev);
                setHelperReady(false);
                setLogs([]);
              }}
              className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold border transition-all cursor-pointer ${
                bypassProxy 
                  ? 'bg-amber-600/20 border-amber-500 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]' 
                  : 'bg-transparent border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
              }`}
              title={bypassProxy ? "Proxy is Bypassed (Direct Mode). Logins and cookies work 100% natively." : "Proxy is Active. Custom Inspect Element is enabled."}
            >
              <MonitorSmartphone size={13} />
              <span>{bypassProxy ? "Direct Mode" : "Proxy Mode"}</span>
            </button>
          )}

          {/* Inspect Element button (available in iframe or Tauri Webview in Proxy Mode) */}
          {!useElectronWebview && (!useTauriWebview || !bypassProxy) && (
            <button 
              onClick={toggleInspect}
              className={`flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold border transition-all ${
                isInspecting 
                  ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.25)]' 
                  : 'bg-transparent border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
              }`}
              title="Inspect Element (Click and select an item in the preview)"
            >
              <MousePointer size={13} className={isInspecting ? 'animate-pulse' : ''} />
              <span>{isInspecting ? 'Inspecting...' : 'Inspect Element'}</span>
            </button>
          )}
        </div>

      </div>

      {/* Main Workspace Split (Iframe top, DevTools bottom) */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Iframe / External Preview Container */}
        <div className="flex-1 bg-[var(--bg-main)] relative min-h-[250px] flex flex-col">
          {!activeUrl ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[var(--bg-main)] select-none">
              <div className="max-w-md w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-8 backdrop-blur-sm">
                <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-glow)] border border-[var(--color-primary-hover)] flex items-center justify-center mx-auto mb-6">
                  <Globe size={28} className="text-[var(--accent-color)] animate-pulse" />
                </div>
                <h2 className="text-[var(--text-main)] font-semibold text-base mb-2">Web Preview</h2>
                <p className="text-[var(--text-muted)] text-[11px] leading-relaxed mb-6">
                  Pratinjau aplikasi web Anda langsung di dalam t-line. Masukkan URL port server lokal Anda di atas untuk memulai.
                </p>
                
                <div className="text-left bg-[var(--surface-overlay)] border border-[var(--border-color)] rounded-lg p-4 mb-6">
                  <div className="text-[10px] font-bold text-[var(--accent-color)] uppercase tracking-wider mb-2">Langkah Memulai:</div>
                  <ul className="text-[11px] text-[var(--text-muted)] space-y-2 list-decimal list-inside">
                    <li>Jalankan server dev di tab <strong>Terminal</strong> (contoh: <code className="bg-black/35 px-1 py-0.5 rounded font-mono text-[var(--accent-color)]">npm run dev</code>).</li>
                    <li>Salin URL lokal Anda ke kolom alamat di atas.</li>
                    <li>Tekan tombol <strong>Go</strong> untuk memuat pratinjau.</li>
                  </ul>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="text-[10px] text-[var(--text-muted)] font-semibold mb-1">PRESET PORT POPULER:</div>
                  <div className="flex justify-center gap-2">
                    <button 
                      onClick={() => { setUrlInput('http://localhost:4333'); setActiveUrl('http://localhost:4333'); }}
                      className="px-3 py-1.5 bg-[var(--surface-overlay)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)] text-[var(--text-main)] text-xs rounded transition-all font-mono"
                    >
                      :4333
                    </button>
                    <button 
                      onClick={() => { setUrlInput('http://localhost:5173'); setActiveUrl('http://localhost:5173'); }}
                      className="px-3 py-1.5 bg-[var(--surface-overlay)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)] text-[var(--text-main)] text-xs rounded transition-all font-mono"
                    >
                      :5173
                    </button>
                    <button 
                      onClick={() => { setUrlInput('http://localhost:8080'); setActiveUrl('http://localhost:8080'); }}
                      className="px-3 py-1.5 bg-[var(--surface-overlay)] hover:bg-[var(--surface-overlay-hover)] border border-[var(--border-color)] text-[var(--text-main)] text-xs rounded transition-all font-mono"
                    >
                      :8080
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : useElectronWebview ? (
            <webview 
              key={iframeKey}
              ref={setWebviewEl}
              src={activeUrl}
              className={`w-full h-full border-none bg-white ${isResizing ? 'pointer-events-none' : ''}`}
              style={{ width: '100%', height: '100%', border: 'none' }}
              allowpopups={true}
            />
          ) : useTauriWebview ? (
            /* Native Tauri Webview placeholder */
            <div 
              ref={containerRef} 
              className={`w-full h-full bg-white ${isResizing ? 'pointer-events-none' : ''}`}
              style={{ width: '100%', height: '100%' }}
            />
          ) : !isTauri && !isLocalUrl(activeUrl) && !forceProxy ? (
            /* External URL landing page — Web mode only (not Tauri) */
            <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 text-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                  <Globe size={28} className="text-purple-400" />
                </div>
                <h2 className="text-[var(--text-main)] font-semibold text-lg">External Website</h2>
                <p className="text-[var(--text-muted)] text-sm max-w-sm leading-relaxed">
                  Browser preview paling optimal untuk{' '}
                  <strong className="text-purple-400">local development apps</strong> (localhost).
                  <br /><br />
                  Situs eksternal memerlukan browser asli untuk berfungsi dengan benar.
                </p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-sm">
                <button
                  onClick={() => openInSystemBrowser(activeUrl)}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-md"
                >
                  <ExternalLink size={15} />
                  Buka di System Browser
                </button>
                <button
                  onClick={() => { setForceProxy(true); setIframeKey(prev => prev + 1); }}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] text-sm font-medium rounded-lg transition-colors"
                >
                  <MonitorSmartphone size={14} />
                  Coba via Proxy Preview
                </button>
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono bg-[var(--bg-card)] border border-[var(--border-color)] px-3 py-2 rounded-md max-w-sm break-all">
                {activeUrl}
              </div>
            </div>
          ) : (
            /* Proxy iframe — local URLs always, external URLs in Tauri or forceProxy */
            <iframe 
              key={iframeKey}
              ref={iframeRef}
              src={proxyUrl} 
              className={`w-full h-full border-none bg-white ${isResizing ? 'pointer-events-none' : ''}`}
              title="App Preview"
            />
          )}
          
          {!useElectronWebview && isLocalUrl(activeUrl) && isInspecting && (
            <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-purple-500/40 bg-purple-500/5 flex items-center justify-center">
              <span className="bg-[var(--bg-card)] border border-[var(--border-color)] text-purple-400 text-xs px-3 py-1.5 rounded-full font-semibold shadow-md pointer-events-auto">
                🔍 Click any element on the page to inspect it
              </span>
            </div>
          )}
        </div>


        {/* DevTools Drawer (Obsidian Theme style) */}
        <div 
          style={{ height: isDevtoolsCollapsed ? '38px' : `${devtoolsHeight}px` }}
          className={`border-t border-[var(--border-color)] bg-[var(--bg-card)] flex flex-col shrink-0 relative ${isResizing ? '' : 'transition-[height] duration-200'}`}
        >
          {/* Resize Handle */}
          {!isDevtoolsCollapsed && (
            <div 
              className="absolute top-0 left-0 right-0 h-1.5 -mt-0.5 cursor-row-resize bg-transparent hover:bg-purple-500/40 active:bg-purple-600 transition-colors z-20"
              onMouseDown={handleMouseDown}
              title="Drag to resize DevTools"
            />
          )}
          
          {/* DevTools Headers */}
          <div 
            className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-1.5 select-none cursor-pointer"
            onDoubleClick={() => setIsDevtoolsCollapsed(prev => !prev)}
            title="Double click to collapse/expand"
          >
            <div className="flex gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDevtoolsCollapsed(false);
                  setActiveSubTab('console');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all ${
                  activeSubTab === 'console' && !isDevtoolsCollapsed
                    ? 'text-purple-400 bg-[var(--bg-card)] border border-[var(--border-color)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Bug size={13} />
                <span>Console Errors</span>
                {logs.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-600/20 text-red-400 border border-red-500/30 rounded-full">
                    {logs.length}
                  </span>
                )}
              </button>
              
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDevtoolsCollapsed(false);
                  setActiveSubTab('inspector');
                }}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all ${
                  activeSubTab === 'inspector' && !isDevtoolsCollapsed
                    ? 'text-purple-400 bg-[var(--bg-card)] border border-[var(--border-color)]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Code2 size={13} />
                <span>Element Inspector</span>
                {inspectedElement && (
                  <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                )}
              </button>
            </div>
            
            {/* Helper status indicator & Collapse toggle */}
            <div className="flex items-center gap-3 text-[10px] font-medium text-[var(--text-muted)]">
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${getHelperStatusColorClass()}`} />
                <span>{getHelperStatusText()}</span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsDevtoolsCollapsed(prev => !prev);
                }}
                className="p-1 rounded hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
                title={isDevtoolsCollapsed ? 'Expand DevTools' : 'Collapse DevTools'}
              >
                {isDevtoolsCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          {/* DevTools Tab Content */}
          {!isDevtoolsCollapsed && (
            <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: 'thin' }}>
              
              {/* CONSOLE ERRORS TAB */}
              {activeSubTab === 'console' && (
                <div className="flex flex-col gap-2 font-mono text-[11px]">
                  {logs.map(log => {
                    const isExpanded = expandedLogId === log.id;
                    return (
                      <div 
                        key={log.id} 
                        className="border border-red-950/40 bg-red-950/10 rounded-lg p-2.5 flex flex-col gap-1.5 text-red-300 relative group"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div 
                            className="flex items-start gap-2 cursor-pointer flex-1 select-text"
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          >
                            <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                            <div className="flex flex-col">
                              <span className="font-semibold break-all text-[12px]">{log.message}</span>
                              <span className="text-[10px] text-red-400/80 mt-0.5">
                                {log.filename || 'console'} {log.lineno ? `:${log.lineno}:${log.colno}` : ''}
                              </span>
                            </div>
                          </div>

                          {/* Prompt Copy Buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            {log.stack && (
                              <button
                                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                                className="px-1.5 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 text-[10px] text-red-400"
                              >
                                {isExpanded ? 'Hide Stack' : 'Show Stack'}
                              </button>
                            )}
                            <button
                              onClick={() => copyToClipboard(generateErrorPrompt(log), log.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-purple-600/80 hover:bg-purple-600 text-white text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                              title="Copy prompt for AI"
                            >
                              {copiedId === log.id ? <Check size={10} /> : <Sparkles size={10} />}
                              <span>{copiedId === log.id ? 'Copied!' : 'Tag to AI'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Expandable Stack Trace */}
                        {isExpanded && log.stack && (
                          <pre className="mt-2 p-2 bg-black/40 rounded border border-red-950/80 text-[10px] text-red-400 overflow-x-auto whitespace-pre">
                            {log.stack}
                          </pre>
                        )}
                      </div>
                    );
                  })}

                  {logs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)] gap-2">
                      <ShieldAlert size={20} className="opacity-40" />
                      <span className="text-xs">No client-side JavaScript errors detected.</span>
                    </div>
                  )}
                </div>
              )}

              {/* ELEMENT INSPECTOR TAB */}
              {activeSubTab === 'inspector' && (
                <div className="h-full flex flex-col">
                  {inspectedElement ? (
                    <div className="flex flex-col gap-3 text-xs">
                      {/* Element metadata overview */}
                      <div className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] pb-2.5">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-purple-600/20 border border-purple-500/30 text-purple-400 font-mono font-bold text-[11px]">
                              &lt;{inspectedElement.tagName}&gt;
                            </span>
                            {inspectedElement.id && (
                              <span className="text-blue-400 font-mono text-[11px]" title="Element ID">
                                #{inspectedElement.id}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono break-all mt-1">
                            Selector: {inspectedElement.selectorPath}
                          </span>
                        </div>

                        <button
                          onClick={() => copyToClipboard(generateElementPrompt(inspectedElement), 'element')}
                          className="flex items-center gap-1 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                          title="Copy prompt for AI"
                        >
                          {copiedId === 'element' ? <Check size={11} /> : <Sparkles size={11} />}
                          <span>{copiedId === 'element' ? 'Copied!' : 'Tag to AI'}</span>
                        </button>
                      </div>

                      {/* Content Details Split */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* CSS Classes & Computed Layout */}
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Computed Layout Styles</span>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px] bg-black/10 p-2.5 rounded-lg border border-[var(--border-color)]">
                            {Object.entries(inspectedElement.computedStyles).map(([key, val]) => (
                              <div key={key} className="flex justify-between border-b border-[var(--border-color)]/30 py-0.5">
                                <span className="text-[var(--text-muted)]">{key}:</span>
                                <span className="text-purple-300 font-semibold">{val}</span>
                              </div>
                            ))}
                          </div>
                          
                          {inspectedElement.classes.length > 0 && (
                            <div className="flex flex-col gap-1 mt-1">
                              <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">CSS Classes</span>
                              <div className="flex flex-wrap gap-1">
                                {inspectedElement.classes.map(cls => (
                                  <span key={cls} className="px-1.5 py-0.5 rounded bg-[var(--bg-main)] border border-[var(--border-color)] font-mono text-[10px]">
                                    {cls}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* HTML Source Preview */}
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">HTML Code Snippet</span>
                          <pre className="flex-1 p-2.5 bg-black/30 rounded-lg border border-[var(--border-color)] font-mono text-[10px] text-emerald-300 overflow-x-auto whitespace-pre-wrap break-all">
                            {inspectedElement.outerHTML}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)] gap-2">
                      <Layout size={20} className="opacity-40" />
                      <span className="text-xs text-center max-w-sm leading-relaxed">
                        Click the <strong className="text-purple-400">Inspect Element</strong> button in the header, then click any UI component on the page to extract its code and style properties.
                      </span>
                    </div>
                  )}
                </div>
              )}

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
