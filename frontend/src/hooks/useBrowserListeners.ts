import { useEffect } from 'react';
import { ConsoleErrorLog, InspectedElement } from '../components/BrowserDevTools';
import { getCleanUrl } from '../components/browserUrlUtils';
import { wsManager } from '../services/websocket';
import { TabData } from './useTerminals';

interface UseBrowserListenersProps {
  tab: TabData;
  useTauriWebview: boolean;
  tauriWebviewRef: React.MutableRefObject<any>;
  iframeRef: React.MutableRefObject<HTMLIFrameElement | null>;
  setHelperReady: (ready: boolean) => void;
  setUrlInput: (url: string) => void;
  setActiveUrl: (url: string) => void;
  onUpdateTabUrl?: (url: string) => void;
  onUpdateTabName?: (name: string) => void;
  setLogs: React.Dispatch<React.SetStateAction<ConsoleErrorLog[]>>;
  setInspectedElement: (element: InspectedElement | null) => void;
  setIsInspecting: (inspecting: boolean) => void;
  setActiveSubTab: (tab: 'console' | 'inspector') => void;
}

export function useBrowserListeners({
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
}: UseBrowserListenersProps) {
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
  }, [iframeRef, setHelperReady, setLogs, setInspectedElement, setIsInspecting, setActiveSubTab]);

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
          const cleanUrl = getCleanUrl(eventPayload.url);
          setUrlInput(cleanUrl);
          setActiveUrl(cleanUrl);
          onUpdateTabUrl?.(cleanUrl);
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
  }, [useTauriWebview, tab.id, onUpdateTabName, onUpdateTabUrl, setHelperReady, setUrlInput, setActiveUrl, setLogs, setInspectedElement, setIsInspecting, setActiveSubTab, tauriWebviewRef]);

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
          const cleanUrl = getCleanUrl(eventPayload.url);
          setUrlInput(cleanUrl);
          setActiveUrl(cleanUrl);
          onUpdateTabUrl?.(cleanUrl);
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
  }, [useTauriWebview, tab.id, onUpdateTabName, onUpdateTabUrl, setHelperReady, setUrlInput, setActiveUrl, setLogs, setInspectedElement, setIsInspecting, setActiveSubTab, tauriWebviewRef]);
}
