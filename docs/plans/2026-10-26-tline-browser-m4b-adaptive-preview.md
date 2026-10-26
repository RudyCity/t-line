# M4-B — Adaptive Native Managed Browser Preview

Date: 2026-10-26
Status: **Implemented and tested in native Windows Rust and frontend. Packaged GUI, real visible-Chrome screencast performance, and production-grade consumer backpressure remain open.**
Previous checkpoint: [M4-A read-only snapshot preview](2026-10-26-tline-browser-m4a-live-preview.md).

## Operator flow

T-Line Desktop → Browser → Managed Browser → explicitly enable → launch/select an owned Chrome profile → Refresh tabs → **Preview**. Native Tauri first attempts a per-tab CDP `Page.startScreencast` on one persistent, locally validated WebSocket. Incoming `Page.screencastFrame` messages are acknowledged with `Page.screencastFrameAck`; JPEG payloads are size-checked and forwarded only to the **main** Tauri WebView at a maximum delivery rate of 5 frames per second. Stream IDs, target IDs, and browser generation are used to reject late or cross-tab frames.

If a browser does not deliver screencast frames (e.g. the installed Windows Chrome tested in headless mode), the **same CDP connection** requests viewport JPEG screenshots about once per second instead. If native streaming setup fails, React's previous M4-A screenshot capture remains the final fallback. The visible preview identifies the current transport mode: `screencast`, `snapshot`, `connecting`, or `paused`. Chrome still owns its separate real window; this is **not** embedding Chrome into WebView2.

Preview is **off by default** and stops when closed, the page/tab changes, Managed Browser is disabled, or the desktop tab/window is hidden. An in-memory stream registry allows only **one active screencast per desktop**, cancels previously active sessions on replacement and on app Exit, and never kills the Chrome process to stop viewing.

## Security and resource guards

- Rust uses the supervised browser Child, profile generation, local port and browser fingerprint. It validates the exact `ws://127.0.0.1:{port}/devtools/page/{targetId}` endpoint from the owned Chrome target listing; no renderer-controlled host/URL/CDP method is accepted.
- Stream workers revalidate the current browser generation and fingerprint about once per second. A stopped/replaced Chrome fails closed, not reassociated to a reused port.
- WebSocket messages are capped at 2.5 MB; the resulting JPEG base64 at 2 MB. A CDP frame is acknowledged even when the UI delivery cadence drops it. Read timeouts permit cancellation and health checks.
- Tauri events are emitted with `EventTarget::webview("main")`, **not** globally to browser/auxiliary WebViews. The React preview verifies stream ID, target ID, JPEG data URL and declared transport mode before rendering. No cookies, CDP WebSocket URLs, bearer tokens, arbitrary page commands, filesystem screenshot output, click/keyboard/scroll commands or external screenshot URLs are involved.
- On hidden or closed UI, the stream is stopped and preview pixels are cleared. Any late frame from an outdated stream is rejected.
- **Limit:** 5 FPS is a native event-send maximum, not a measured achieved FPS. CDP ACK controls Chrome-side production; a separate renderer-consumer ACK/backpressure mechanism and bounded UI event queue are **not yet implemented or load-tested**.

## Tests executed

- `cargo test --offline --lib managed_browser_stream::tests` — native validation of CDP event metadata, JPEG and session IDs.
- `cargo test --offline --lib managed_browser_capture::tests` and other Rust browser tests — existing security and lifecycle regressions.
- `cargo test --offline --lib managed_browser::tests::real_owned_chrome_lifecycle_smoke -- --ignored --nocapture` — **PASS using real installed Windows Chrome and a temporary headless test-only profile.** Observed transport: **`persistent-snapshot-fallback`**; no `Page.screencastFrame` event arrived from this specific headless page. This smoke validates the same-WebSocket fallback, correct JPEG, safe browser shutdown and cleanup, but **does not prove a 5 FPS screencast**.
- Frontend tests cover primary UI Preview routing, stream event validation, stale stream ID/target rejection, close/stop, and legacy screenshot fallback. TypeScript and native Rust compile successfully.

## Remaining gates and next phase

1. Packaged Windows Tauri GUI acceptance: actual primary webview event listening, live visible Chrome frame delivery, Chrome version variations, tab switch, app tray minimize, sleep/resume and actual Core bearer registration.
2. Add renderer frame ACK with a tiny bounded pending queue, drop counters, CPU/RAM/latency metrics and sustained (>30-minute) multi-tab soaks; tune adaptive JPEG quality/viewport based on measured metrics.
3. Keep UI read-only until the authorized CDP owner/share gateway has a native click/scroll/keyboard adapter with explicit user approval, stale-generation and optimistic-revision checks.
4. Never claim that local Chrome's own loopback CDP debugging port is authenticated. Users should only run this on trusted local machines.

Rollback: disable Managed Browser or close Preview; live browser and unrelated Core/agent sessions continue unchanged.
