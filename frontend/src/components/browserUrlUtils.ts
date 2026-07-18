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

export interface BookmarkItem {
  id: string;
  name: string;
  url: string;
  folder?: string;
}

export const getFriendlyName = (urlStr: string): string => {
  try {
    const url = new URL(urlStr);
    let name = url.hostname;
    if (url.port) {
      name += `:${url.port}`;
    }
    if (url.pathname && url.pathname !== '/') {
      name += url.pathname;
    }
    return name;
  } catch (_) {
    return urlStr;
  }
};

export const getHelperStatusColorClass = (renderMode: RenderMode): string => {
  if (renderMode === 'tauri-native' || renderMode === 'electron-webview' || renderMode === 'iframe-local') {
    return 'bg-green-500';
  }
  return 'bg-amber-500 animate-pulse';
};

export const getHelperStatusText = (renderMode: RenderMode, helperReady: boolean): string => {
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

export const getPollWebviewJs = (tabId: string, zoomFactor: number): string => {
  return `
    try {
      var currentUrl = window.location.href;
      var proxyTarget = "";
      try {
        if (window.__TLINE_PROXY_TARGET__) {
          proxyTarget = window.__TLINE_PROXY_TARGET__;
        } else {
          var match = document.cookie.match(/(?:^|\\s*)tline_proxy_target=([^;]+)/);
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
            tabId: "${tabId}"
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

      // Intercept target="_blank" links and window.open for Tauri native mode
      if (!window.__tline_blank_link_intercepted) {
        window.__tline_blank_link_intercepted = true;

        window.addEventListener('click', function(e) {
          var target = e.target;
          while (target && target.tagName !== 'A') {
            target = target.parentNode;
          }
          if (target && target.tagName === 'A') {
            var href = target.getAttribute('href');
            var targetAttr = target.getAttribute('target');
            if (targetAttr === '_blank' && href && !href.startsWith('#') && !href.startsWith('javascript:')) {
              e.preventDefault();
              try {
                var absoluteUrl = new URL(href, window.location.href).href;
                if (window.__TAURI__ && window.__TAURI__.event && typeof window.__TAURI__.event.emit === 'function') {
                  window.__TAURI__.event.emit('tline-webview-event', {
                    type: 'tline-open-new-tab',
                    payload: { url: absoluteUrl },
                    tabId: "${tabId}"
                  });
                }
              } catch (err) {}
            }
          }
        }, true);

        var _origOpen = window.open;
        window.open = function(url, target, features) {
          if (url && (target === '_blank' || !target)) {
            try {
              var absoluteUrl = new URL(String(url), window.location.href).href;
              if (window.__TAURI__ && window.__TAURI__.event && typeof window.__TAURI__.event.emit === 'function') {
                window.__TAURI__.event.emit('tline-webview-event', {
                  type: 'tline-open-new-tab',
                  payload: { url: absoluteUrl },
                  tabId: "${tabId}"
                });
              }
              return null;
            } catch (e) {}
          }
          return _origOpen.call(window, url, target, features);
        };
      }
    } catch (e) {}
  `;
};


