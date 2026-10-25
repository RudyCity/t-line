import { useEffect, useState } from 'react';
import { isValidNetworkEntry, sanitizeNetworkUrl, type NetworkEntry } from '../components/browserDiagnostics';

/** Native WebView network metadata only; no headers, bodies, cookies or query strings. */
export function useBrowserNetwork(tabId: string, enabled: boolean) {
  const [networkEntries, setNetworkEntries] = useState<NetworkEntry[]>([]);
  useEffect(() => {
    setNetworkEntries([]);
    if (!enabled) return;
    let disposed = false;
    let unsubscribe: (() => void) | undefined;
    void import('@tauri-apps/api/event').then(({ listen }) => listen<{
      tabId: string; type: string; payload: unknown;
    }>('tline-webview-event', event => {
      if (disposed || event.payload.tabId !== tabId ||
          event.payload.type !== 'tline-network-entry' ||
          !isValidNetworkEntry(event.payload.payload)) return;
      const data = event.payload.payload;
      setNetworkEntries(prev => [{
        id: crypto.randomUUID(), time: new Date().toLocaleTimeString(),
        kind: data.kind, method: data.method, url: sanitizeNetworkUrl(data.url),
        status: data.status, durationMs: Math.max(0, Math.round(data.durationMs)),
      }, ...prev].slice(0, 150));
    })).then(fn => { if (disposed) fn(); else unsubscribe = fn; }).catch(() => {});
    return () => { disposed = true; unsubscribe?.(); };
  }, [enabled, tabId]);
  return { networkEntries, clearNetworkEntries: () => setNetworkEntries([]) };
}
