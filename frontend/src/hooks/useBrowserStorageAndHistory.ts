import { useState, useEffect, useRef } from 'react';
import { getNativeStorageProbeJs, redactStorageValue } from '../components/browserDiagnostics';
import { BookmarkItem, getFriendlyName } from '../components/browserUrlUtils';
import { HistoryItem } from '../components/HistoryDropdown';

interface UseBrowserStorageAndHistoryProps {
  tabId: string;
  activeUrl: string;
  setActiveUrl: (url: string) => void;
  setUrlInput: (url: string) => void;
  useTauriWebview: boolean;
  useElectronWebview: boolean;
  tauriWebviewRef: React.MutableRefObject<any>;
  webviewEl: any;
  renderMode: string;
  webviewActive: boolean;
  onUpdateTabUrl?: (url: string) => void;
  handleReload: (forceBypassCache?: boolean) => void;
  navigateNative?: (url: string) => void;
}

export function useBrowserStorageAndHistory({
  tabId,
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
  handleReload,
  navigateNative
}: UseBrowserStorageAndHistoryProps) {
  // Zoom State
  const [zoomFactor, setZoomFactor] = useState(1.0);

  // Bookmarks State
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    try {
      const saved = localStorage.getItem('tline-saved-bookmarks');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  // History State
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('tline-browser-history');
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });

  // Storage data state
  const [storageData, setStorageData] = useState<{
    cookies: { name: string; value: string }[];
    localStorage: { key: string; value: string }[];
  }>({ cookies: [], localStorage: [] });
  const [storageError, setStorageError] = useState<string | null>(null);
  const pendingStorageRequest = useRef<string | null>(null);
  useEffect(() => {
    if (!useTauriWebview) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void import('@tauri-apps/api/event').then(({ listen }) =>
      listen<{ tabId: string; type: string; payload?: {
        requestId: string; cookies: { name: string; value: string }[];
        localStorage: { key: string; value: string }[];
      } }>('tline-webview-event', event => {
        if (disposed || event.payload.tabId !== tabId ||
            event.payload.type !== 'tline-storage-snapshot') return;
        const snapshot = event.payload.payload;
        if (!snapshot || snapshot.requestId !== pendingStorageRequest.current ||
            !Array.isArray(snapshot.cookies) || !Array.isArray(snapshot.localStorage)) return;
        pendingStorageRequest.current = null;
        setStorageError(null);
        setStorageData({
          cookies: snapshot.cookies.slice(0, 100).map(entry => ({ name: String(entry.name).slice(0, 100), value: '[redacted]' })),
          localStorage: snapshot.localStorage.slice(0, 100).map(entry => ({
            key: String(entry.key).slice(0, 100),
            value: redactStorageValue(String(entry.key), String(entry.value)),
          })),
        });
      })
    ).then(fn => { if (disposed) fn(); else unsubscribe = fn; })
      .catch(() => { if (!disposed) setStorageError('Native browser event channel unavailable'); });
    return () => { disposed = true; pendingStorageRequest.current = null; unsubscribe?.(); };
  }, [tabId, useTauriWebview]);

  // Add to History when activeUrl changes
  useEffect(() => {
    if (!activeUrl) return;
    setHistory(prev => {
      if (prev.length > 0 && prev[0].url === activeUrl) return prev;
      const newItem: HistoryItem = {
        id: `hist-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: getFriendlyName(activeUrl),
        url: activeUrl,
        timestamp: Date.now()
      };
      return [newItem, ...prev.filter(item => item.url !== activeUrl)].slice(0, 100);
    });
  }, [activeUrl]);

  // Sync history to LocalStorage
  useEffect(() => {
    localStorage.setItem('tline-browser-history', JSON.stringify(history));
  }, [history]);

  // Sync bookmarks to LocalStorage
  useEffect(() => {
    localStorage.setItem('tline-saved-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  // Zoom controls
  const handleZoomIn = () => setZoomFactor(prev => Math.min(3.0, prev + 0.1));
  const handleZoomOut = () => setZoomFactor(prev => Math.max(0.5, prev - 0.1));
  const handleZoomReset = () => setZoomFactor(1.0);

  // Synchronize zoom factor to Tauri or Electron webviews
  useEffect(() => {
    if (useTauriWebview && tauriWebviewRef.current && renderMode === 'tauri-native') {
      const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tabId);
      if (activeLabel) {
        const jsCode = `try {
          if (document.documentElement) document.documentElement.style.zoom = "${zoomFactor}";
          if (document.body) document.body.style.zoom = "";
        } catch(e) {}`;
        (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js: jsCode }).catch(() => {});
      }
    } else if (useElectronWebview && webviewEl && renderMode === 'electron-webview') {
      try { webviewEl.setZoomFactor(zoomFactor); } catch (_) {}
    }
  }, [zoomFactor, activeUrl, renderMode, useTauriWebview, webviewActive, tabId, useElectronWebview, webviewEl]);

  const fetchStorageData = async () => {
    const js = `
      (function() {
        var cookies = [];
        try {
          var cookieArr = document.cookie.split(';');
          for (var i = 0; i < cookieArr.length; i++) {
            var parts = cookieArr[i].split('=');
            var name = parts[0] ? parts[0].trim() : '';
            var val = parts[1] ? parts[1].trim() : '';
            if (name) {
              cookies.push({ name: name, value: '[redacted]' });
            }
          }
        } catch(e) {}

        var ls = [];
        try {
          for (var i = 0; i < localStorage.length; i++) {
            var k = localStorage.key(i);
            if (k) {
              var value = localStorage.getItem(k) || '';
              ls.push({ key: k, value: !/^(theme|appearance|color-?scheme|locale|language|lang|ui-?mode)$/i.test(k) || /token|secret|auth|cookie|session|pass|credential|csrf|xsrf|api.?key|bearer|private|jwt|refresh/i.test(k) || value.length > 128 || /^(Bearer |eyJ)/i.test(value) ? '[redacted]' : value.slice(0, 80) });
            }
          }
        } catch(e) {}

        return JSON.stringify({ cookies: cookies, localStorage: ls });
      })()
    `;

    if (useTauriWebview && tauriWebviewRef.current && renderMode === 'tauri-native') {
      const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tabId);
      if (activeLabel) {
        const requestId = crypto.randomUUID();
        pendingStorageRequest.current = requestId;
        setStorageError(null);
        try {
          await (window as any).__TAURI__?.core?.invoke('eval_webview_js', {
            label: activeLabel, js: getNativeStorageProbeJs(tabId, requestId),
          });
          window.setTimeout(() => {
            if (pendingStorageRequest.current === requestId) {
              pendingStorageRequest.current = null;
              setStorageError('Storage unavailable: native event bridge did not respond.');
            }
          }, 2500);
        } catch {
          pendingStorageRequest.current = null;
          setStorageError('Unable to inspect native WebView storage.');
        }
      }
    } else if (useElectronWebview && webviewEl && renderMode === 'electron-webview') {
      try {
        const res = await webviewEl.executeJavaScript(js);
        if (res) {
          const parsed = JSON.parse(res);
          setStorageData({
            cookies: (parsed.cookies || []).slice(0, 100).map((entry: {name: string}) => ({ name: entry.name, value: '[redacted]' })),
            localStorage: (parsed.localStorage || []).slice(0, 100).map((entry: {key: string; value: string}) => ({ key: entry.key, value: redactStorageValue(entry.key, entry.value) }))
          });
        }
      } catch (e) {
        console.warn('[BrowserTab] Failed to fetch storage from Electron webview:', e);
      }
    } else {
      try {
        const iframe = document.getElementById('browser-iframe-' + tabId) as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          const doc = iframe.contentWindow.document;
          const cookies: { name: string; value: string }[] = [];
          const cookieArr = doc.cookie.split(';');
          for (let i = 0; i < cookieArr.length; i++) {
            const parts = cookieArr[i].split('=');
            const name = parts[0] ? parts[0].trim() : '';
            if (name) cookies.push({ name, value: '[redacted]' });
          }

          const ls: { key: string; value: string }[] = [];
          const winLs = iframe.contentWindow.localStorage;
          for (let i = 0; i < winLs.length; i++) {
            const k = winLs.key(i);
            if (k) ls.push({ key: k, value: redactStorageValue(k, winLs.getItem(k) || '') });
          }

          setStorageData({ cookies, localStorage: ls });
        }
      } catch (_) {}
    }
  };

  const deleteCookie = async (name: string) => {
    const js = 'document.cookie = ' + JSON.stringify(name + '=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;');
    if (useTauriWebview && tauriWebviewRef.current && renderMode === 'tauri-native') {
      const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tabId);
      if (activeLabel) {
        await (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js }).catch(() => {});
        fetchStorageData();
      }
    } else if (useElectronWebview && webviewEl && renderMode === 'electron-webview') {
      try {
        await webviewEl.executeJavaScript(js);
        fetchStorageData();
      } catch (_) {}
    } else {
      try {
        const iframe = document.getElementById('browser-iframe-' + tabId) as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
          fetchStorageData();
        }
      } catch (_) {}
    }
  };

  const deleteLocalStorage = async (key: string) => {
    const js = 'localStorage.removeItem(' + JSON.stringify(key) + ')';
    if (useTauriWebview && tauriWebviewRef.current && renderMode === 'tauri-native') {
      const activeLabel = tauriWebviewRef.current.label || sessionStorage.getItem('tline-active-webview-label-' + tabId);
      if (activeLabel) {
        await (window as any).__TAURI__?.core?.invoke('eval_webview_js', { label: activeLabel, js }).catch(() => {});
        fetchStorageData();
      }
    } else if (useElectronWebview && webviewEl && renderMode === 'electron-webview') {
      try {
        await webviewEl.executeJavaScript(js);
        fetchStorageData();
      } catch (_) {}
    } else {
      try {
        const iframe = document.getElementById('browser-iframe-' + tabId) as HTMLIFrameElement;
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.localStorage.removeItem(key);
          fetchStorageData();
        }
      } catch (_) {}
    }
  };

  const handleNavigateToBookmark = (url: string) => {
    setUrlInput(url);
    const isSameUrl = url === activeUrl;
    if (isSameUrl) {
      handleReload();
    } else {
      setActiveUrl(url);
      onUpdateTabUrl?.(url);
      navigateNative?.(url);
    }
  };

  const handleNavigateToHistory = (url: string) => {
    setUrlInput(url);
    const isSameUrl = url === activeUrl;
    if (isSameUrl) {
      handleReload();
    } else {
      setActiveUrl(url);
      onUpdateTabUrl?.(url);
      navigateNative?.(url);
    }
  };

  const removeBookmark = (id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
  };

  const updateBookmark = (id: string, name: string, folder?: string) => {
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, name, folder } : b));
  };

  const removeHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  return {
    zoomFactor,
    setZoomFactor,
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
  };
}
