/* Browser diagnostics run inside the active preview and emit bounded metadata only.
 * Raw cookies, auth tokens, request bodies, query strings, and headers never cross the bridge. */
export type NetworkEntry = {
  id: string; kind: 'fetch' | 'xhr'; method: string; url: string;
  status: number; durationMs: number; time: string;
};
export const isSensitiveStorageKey = (key: string): boolean =>
  /token|secret|auth|cookie|session|pass|credential|csrf|xsrf|api.?key|bearer|private|jwt|refresh/i.test(key);
export function redactStorageValue(key: string, value: string): string {
  if (!/^(?:theme|appearance|color-?scheme|locale|language|lang|ui-?mode)$/i.test(key) || isSensitiveStorageKey(key) || /^(?:Bearer\s+|eyJ[A-Za-z0-9_-]{15,}\.|sk[-_])/i.test(value) ||
      value.length > 128 || /[^\x20-\x7e]/.test(value)) return '[redacted]';
  return value.slice(0, 80);
}
export function sanitizeNetworkUrl(value: string, origin = 'http://localhost'): string {
  try {
    const url = new URL(value, origin);
    if (!['http:', 'https:'].includes(url.protocol)) return '[unsupported protocol]';
    return url.origin + url.pathname.slice(0, 160);
  } catch { return '[invalid URL]'; }
}
function nativeStorageProbe(tabId: string, requestId: string) {
  try {
    const redact = (key: string, value: string) =>
      !/^(?:theme|appearance|color-?scheme|locale|language|lang|ui-?mode)$/i.test(key) ||
      /token|secret|auth|cookie|session|pass|credential|csrf|xsrf|api.?key|bearer|private|jwt|refresh/i.test(key) ||
      /^(?:Bearer\s+|eyJ[A-Za-z0-9_-]{15,}\.|sk[-_])/i.test(value) ||
      value.length > 128 || /[^\x20-\x7e]/.test(value) ? '[redacted]' : value.slice(0, 80);
    const local: Array<{key: string; value: string}> = [];
    try {
      for (let i = 0; i < Math.min(localStorage.length, 100); i++) {
        const key = localStorage.key(i);
        if (key) local.push({ key: key.slice(0, 100), value: redact(key, localStorage.getItem(key) || '') });
      }
    } catch (_) {}
    const cookies: Array<{name: string; value: string}> = [];
    try {
      for (const part of document.cookie.split(';').slice(0, 100)) {
        const name = part.split('=')[0]?.trim();
        if (name) cookies.push({ name: name.slice(0, 100), value: '[redacted]' });
      }
    } catch (_) {}
    const tauriEvents = (window as any).__TAURI__?.event;
    if (typeof tauriEvents?.emit === 'function') void tauriEvents.emit('tline-webview-event', {
      type: 'tline-storage-snapshot', tabId,
      payload: { requestId, cookies, localStorage: local }
    });
  } catch (_) {}
}
function nativeNetworkProbe(tabId: string) {
  const win = window as any;
  if (win.__tlineNetworkInstalled) return;
  win.__tlineNetworkInstalled = true;
  const sanitizedUrl = (value: string) => {
    try { const u = new URL(value, location.href); return /^https?:$/.test(u.protocol) ? u.origin + u.pathname.slice(0, 160) : '[other]'; }
    catch { return '[unknown]'; }
  };
  const emit = (kind: 'fetch' | 'xhr', method: string, url: string, status: number, start: number) => {
    try {
      const tauriEvents = win.__TAURI__?.event;
      if (typeof tauriEvents?.emit === 'function') void tauriEvents.emit('tline-webview-event', {
        type: 'tline-network-entry', tabId,
        payload: { kind, method: String(method).slice(0, 10), url: sanitizedUrl(url),
          status: Number(status) || 0, durationMs: Math.round(performance.now() - start) }
      });
    } catch (_) {}
  };
  const originalFetch = window.fetch?.bind(window);
  if (originalFetch) {
    window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const method = init?.method || (input instanceof Request ? input.method : 'GET');
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const start = performance.now();
      try {
        return originalFetch(input, init).then(response => {
          emit('fetch', method, url, response.status, start); return response;
        }, error => { emit('fetch', method, url, 0, start); throw error; });
      } catch (error) { emit('fetch', method, url, 0, start); throw error; }
    }) as typeof window.fetch;
  }
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method: string, url: string | URL, ...args: any[]) {
    (this as any).__tlineNetwork = { method, url: String(url) };
    return (originalOpen as any).apply(this, [method, url, ...args]);
  };
  XMLHttpRequest.prototype.send = function(...args: any[]) {
    const data = (this as any).__tlineNetwork;
    if (data) {
      const start = performance.now();
      this.addEventListener('loadend', () => emit('xhr', data.method, data.url, this.status, start), { once: true });
    }
    return (originalSend as any).apply(this, args);
  };
}
export function getNativeStorageProbeJs(tabId: string, requestId: string): string {
  return '(' + nativeStorageProbe.toString() + ')(' + JSON.stringify(tabId) + ',' + JSON.stringify(requestId) + ');';
}
export function getNativeNetworkProbeJs(tabId: string): string {
  return '(' + nativeNetworkProbe.toString() + ')(' + JSON.stringify(tabId) + ');';
}
export function isValidNetworkEntry(value: unknown): value is Omit<NetworkEntry, 'id' | 'time'> {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  return (item.kind === 'fetch' || item.kind === 'xhr') && typeof item.method === 'string' &&
    item.method.length <= 10 && typeof item.url === 'string' && item.url.length <= 300 &&
    typeof item.status === 'number' && Number.isInteger(item.status) &&
    typeof item.durationMs === 'number' && Number.isFinite(item.durationMs);
}
