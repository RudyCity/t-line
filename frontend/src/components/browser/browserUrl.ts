/** Pure address helpers for the embedded real browser. */

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const HOST_PORT = /^(?:localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|[^:/\s?#]+):\d{1,5}(?:[/?#]|$)/i;

/** Returns a navigable HTTP(S) address, or null when the input is not one. */
export function normalizeAddress(input: string): string | null {
  const raw = input.trim();
  if (!raw || raw.length > 4096 || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  const explicitHttp = /^https?:\/\//i.test(raw);
  if (!explicitHttp && SCHEME.test(raw) && !HOST_PORT.test(raw)) {
    // Blocks javascript:, file:, devtools:, chrome:, and similar.
    return null;
  }
  const withScheme = explicitHttp
    ? raw
    : HOST_PORT.test(raw)
      ? `http://${raw}`
      : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
  } catch {
    return false;
  }
}

/** Compact label for the address field; the full address stays in the input. */
export function addressLabel(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return value;
    const host = url.host;
    const path = url.pathname === '/' ? '' : url.pathname;
    const label = host + path + url.search + url.hash;
    return label.length > 96 ? `${label.slice(0, 93)}…` : label;
  } catch {
    return value;
  }
}
