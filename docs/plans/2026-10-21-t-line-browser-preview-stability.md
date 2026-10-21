# T-Line Browser / Preview Stability & Performance Hardening

Date: 2026-10-21
Repository: RudyCity/t-line
Scope: frontend BrowserTab, URL polling, bookmark/history native navigation, preview event isolation, zoom, and native error handling.
Status: Code complete; TypeScript frontend build and automated tests pass. Installed Windows WebView2 smoke still required.

## Failure modes found

- Previous BrowserTab destroyed native WebView2 every time a browser tab became inactive, then recreated it when refocused. This wiped in-page SPA/login/scroll context and raced with native creation on rapid tab switches.
- BrowserTab ran a requestAnimationFrame loop to measure and apply native WebView2 position/size on every frame, in addition to an existing ResizeObserver and native bounds resync on relevant layout changes. It also sent two native commands to poll URL approximately twice a second, including hidden tabs.
- Native URL navigation inserted a raw URL inside JavaScript quoted source; bookmark/history navigation only changed React state without reliably navigating the already-running native WebView2.
- Tauri webview eval scripts could be reused with unsafe cookie/localStorage key quoting. Iframe preview events accepted message sources other than the tab's own iframe.
- The page zoom factor was applied to both the root HTML and body, multiplying rather than matching the selected value. Failed creation lacked a per-tab recovery UI.
- Host-initiated navigation could be overwritten by a URL poll returning the previous URL before WebView2 finished loading.

## Improvements

- Native WebView2 is lazily created on first activation and then retained across inactive/active transitions, using show/hide only. Native close happens on real tab unmount, manual per-tab recovery, or an unrecoverable webview error. Existing Vite lazy loading of BrowserTab remains unchanged.
- Native layout resynchronizes on ResizeObserver, window resizing, tab activation and DevTools/device layout change, with epsilon change detection and in-flight IPC guard. Removed the 60fps layout/IPC loop entirely.
- Native URL poll now runs approximately every 1500ms only for active visible tabs; overlapping IPC is disallowed. A short grace period prevents stale URL polling during host-initiated navigation.
- Native navigation script uses JSON string escaping and permits only http/https/file protocols. Bookmark/history navigation now directs the live native WebView2. Browser URL input validates the target before navigation.
- Native error and failed creation paths surface a per-tab Retry Browser action; only that browser instance is recreated.
- Preview iframe message events must originate from the iframe for the specific tab, reducing cross-tab spoofing. Cookie and localStorage key operations use JSON-escaped JS values.
- Native zoom is applied once at the document root; legacy body zoom is cleared.

## Test evidence

- Full frontend: 136 tests passed across 26 files, including dedicated lifecycle simulation tests for native tab switch, closing, and retry after a tauri://error.
- Full backend: 23 tests passed across 8 files, including HTTP/WS secure preview proxy regressions.
- Both frontend and backend build commands completed.
- Browser component tests use mocked Tauri APIs and a simulated native WebView2, not the actual Windows installed WebView2 runtime.

## Remaining acceptance gates and known limitations

- Manual installed Windows WebView2 verification: open 5+ tabs, switch rapidly, preserve login/scroll state, navigate back/forward, reload, open bookmarks/history, and close one tab without affecting others. Test with localhost dev server, HTTPS sites and redirects; validate process memory with many visited hidden browser tabs (retaining WebView2 uses more memory than destroying it).
- Verify native screenshot capture/permissions and direct Storage Inspector results. Existing Tauri eval_webview_js returns command success rather than the evaluated JavaScript result; reading cookies/localStorage via that channel needs a separate structured response bridge, and is not claimed fixed here.
- Shift+Reload currently relies on the embedded engine's normal reload behavior; a guaranteed WebView2 HTTP cache purge requires a separately implemented platform API.
- Check backend preview proxy websocket/HMR behavior and sites with restrictive frame/CSP/network rules under installed Windows conditions. Automated proxy unit tests are not a substitute for installed Tauri E2E acceptance.
- No running T-Line, SuperAgent, or terminal session was restarted by this patch.
