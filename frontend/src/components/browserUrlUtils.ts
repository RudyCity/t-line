export type RenderMode = 'tauri-native' | 'electron-webview' | 'iframe-local' | 'external-fallback';

export const isLocalUrl = (url: string): boolean => {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'localhost'
      || parsed.hostname === '127.0.0.1'
      || parsed.hostname.startsWith('192.168.')
      || parsed.hostname.endsWith('.local')
      || parsed.protocol === 'file:';
  } catch {
    return false;
  }
};

export const determineRenderMode = (
  url: string,
  isTauri: boolean,
  isElectron: boolean
): RenderMode => {
  if (!url) {
    return 'external-fallback';
  }

  const local = isLocalUrl(url);
  if (isTauri) {
    return 'tauri-native';
  }
  if (isElectron) {
    return 'electron-webview';
  }
  if (local) {
    return 'iframe-local';
  }
  return 'external-fallback';
};

export const getCleanUrl = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith('/api/preview-proxy')) {
      const target = parsed.searchParams.get('target');
      if (target) {
        const cleanPath = parsed.pathname.substring('/api/preview-proxy'.length) || '/';
        const newParams = new URLSearchParams(parsed.searchParams);
        newParams.delete('target');
        newParams.delete('tabId');
        const searchStr = newParams.toString() ? '?' + newParams.toString() : '';
        return new URL(cleanPath + searchStr + parsed.hash, target).href;
      }
    }
  } catch (_) {}
  return url;
};

export const openInSystemBrowser = (url: string) => {
  if (!url) return;

  let absoluteUrl = url;
  try {
    absoluteUrl = new URL(url, window.location.href).href;
  } catch (e) {
    console.warn('[BrowserTab] Failed to resolve URL for system browser:', e);
  }

  const token = localStorage.getItem('token') || '';
  fetch('/api/browser/open', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ url: absoluteUrl })
  })
    .then(async (res) => {
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Status ${res.status}`);
      }
    })
    .catch((e) => {
      console.error('[BrowserTab] Failed to open url via backend API, falling back:', e);
      const isTauri = typeof window !== 'undefined' && (window as any).__TAURI__ !== undefined;
      if (isTauri && (window as any).__TAURI__?.core?.invoke) {
        (window as any).__TAURI__.core.invoke('open_in_browser', { url: absoluteUrl }).catch((e2: any) => {
          console.error('[BrowserTab] Failed to open url in system browser via Tauri:', e2);
          window.open(absoluteUrl, '_blank');
        });
      } else {
        window.open(absoluteUrl, '_blank');
      }
    });
};

