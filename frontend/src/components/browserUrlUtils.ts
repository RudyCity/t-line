/** Opens a URL in the user's system default browser through the backend. */
export const openInSystemBrowser = (url: string) => {
  if (!url) return;

  let absoluteUrl = url;
  try {
    absoluteUrl = new URL(url, window.location.href).href;
  } catch (error) {
    console.warn('[browser] Failed to resolve URL for the system browser:', error);
  }

  const token = localStorage.getItem('token') || '';
  fetch('/api/browser/open', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ url: absoluteUrl }),
  })
    .then(async (response) => {
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Status ${response.status}`);
      }
    })
    .catch((error) => {
      console.error('[browser] Failed to open the URL via the backend, falling back:', error);
      const invoke = (window as unknown as { __TAURI__?: { core?: { invoke?: (name: string, args?: unknown) => Promise<unknown> } } })
        .__TAURI__?.core?.invoke;
      if (typeof invoke === 'function') {
        void invoke('open_in_browser', { url: absoluteUrl }).catch(() => window.open(absoluteUrl, '_blank'));
      } else {
        window.open(absoluteUrl, '_blank');
      }
    });
};
