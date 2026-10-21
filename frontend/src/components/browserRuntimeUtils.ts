/**
 * Native WebView2 accepts script source, not a URL parameter. JSON encoding
 * keeps quotes, backslashes and newlines within a JavaScript string literal.
 */
export function getNativeNavigationJs(targetUrl: string): string {
  const url = new URL(targetUrl);
  if (!['http:', 'https:', 'file:'].includes(url.protocol)) {
    throw new Error('Unsupported native browser URL scheme');
  }
  return 'window.location.assign(' + JSON.stringify(url.href) + ')';
}

/** Native WebView2 should only be polled while its tab is visible. */
export function shouldPollNativeWebview(active: boolean, hidden: boolean, inFlight: boolean): boolean {
  return active && !hidden && !inFlight;
}
