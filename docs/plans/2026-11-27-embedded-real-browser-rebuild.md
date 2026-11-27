# Embedded Real Browser Rebuild (2026-11-27)

Status: **Implemented in source; Rust, backend, and frontend contract tests pass. Native packaged Windows GUI acceptance is still open** (see Verification).

## Why this replaced the previous browser

The previous browser feature streamed JPEG frames from a **headless** Chrome through a custom CDP client and replayed synthetic input. Measured limits made it unusable as a browser: ≤5 FPS, no audio/video, 16-character text chunks, 14 supported keys, Windows-only single-engine discovery, rejected deep-link query strings, a hardcoded Core port, and ≈2,400 lines of duplicated CDP code next to SuperAgent's mature CDP toolchain.

The rebuild inverts the model:

- **The browser owns rendering, input, media, zoom, find-in-page, downloads, and CDP.**
- **T-Line owns the window host, lifecycle, isolated profile, navigation controls, and the verified agent handoff.**
- **No pixels pass through T-Line.** No CDP frames, no synthetic input, no image transport.

## Architecture

```
React (trusted UI)                 Rust (Tauri)                        SuperAgent Core
┌───────────────────────┐ invoke  ┌────────────────────────┐  HTTP    ┌──────────────────┐
│ BrowserSurface        │────────▶│ browser/commands.rs    │─────────▶│ /api/browser/    │
│  BrowserToolbar       │         │ browser/engine.rs      │ (backend │   managed/       │
│  BrowserAgentBar      │         │ browser/launch.rs      │  proxy)  │   register       │
│  dock viewport div    │         │ browser/session.rs     │          │   control        │
└──────────┬────────────┘         │ browser/dock.rs (Win32)│          └──────────────────┘
           │ bounds/visibility    │ browser/cdp.rs (toolbar)│
           ▼                      └───────────┬────────────┘
   real Chrome/Edge/Brave/Chromium window  ◀──┘  HWND reparented into the T-Line window
   own profile · own renderer · own input · loopback CDP endpoint
```

### Key modules

| File | Responsibility |
|---|---|
| `desktop-tauri/src-tauri/src/browser/engine.rs` | Deterministic discovery of installed Chrome/Edge/Brave/Chromium (Windows, macOS, Linux paths) plus strict HTTP(S) address policy that keeps deep links and rejects credentials. |
| `.../browser/launch.rs` | Spawns the real engine in `--app` mode with an isolated profile and `--remote-debugging-port=0`; hides the window until docked. Pure, unit-tested argument builder. |
| `.../browser/identity.rs` | `DevToolsActivePort` marker parsing, live `/json/version` cross-check, SHA-256 browser fingerprint, bounded target listing, safe marker retirement. |
| `.../browser/session.rs` | One owned process per profile; lifecycle labels; tree-kill by retained `Child` handle only; app-exit cleanup. |
| `.../browser/dock.rs` | Windows `SetParent`/window-style reparenting, DPI-scaled bounds, show/hide, focus, detach. Non-Windows hosts fail with a clear message. |
| `.../browser/cdp.rs` | Allow-listed one-shot page commands for the T-Line toolbar (`navigate`, `reload`, `back`, `forward`). Not a generic CDP proxy. |
| `.../browser/commands.rs` | The whole Tauri command surface, gated to the trusted primary UI and re-verifying the owned generation. |
| `backend/src/managedBrowserHandoff.ts` | Recomputes the browser fingerprint from the live loopback endpoint, then proxies `register`/`control` to the **selected** Core runtime. |
| `frontend/src/components/browser/*` | `BrowserSurface`, toolbar, agent bar, dock bridge, typed IPC guards. |
| `frontend/src/components/BrowserTab.tsx` | Thin shell: desktop → real browser surface; web build → plain preview. |

## Agent control

- `browser_pairing` returns only verified identity: `profileId`, `generation`, `port`, `targetId`, `engineId`. No CDP credential, no Core credential.
- The T-Line backend computes the fingerprint itself and proxies to Core, so the renderer cannot forge a browser identity.
- Core registration/control no longer hardcodes port `7888` and no longer reads `server-info-7888.json` from Rust.
- The SuperAgent CDP toolchain claims the same tab the user sees; **Take control** places a Core-verified human hold that blocks agent writes while native human input keeps working.

## Removed

`managed_browser.rs`, `managed_browser_core.rs`, `managed_browser_capture.rs`, `managed_browser_input.rs`, `managed_browser_stream.rs`, `managed_browser_flow.rs` (Rust), and `ManagedBrowserPanel`, `ManagedBrowserLivePreview`, `managedBrowserGateway`, `managedBrowserTypes`, `managedGatewaySessions`, `BrowserDevTools`, `BrowserNavigationBar`, `BrowserAgentSessions`, `BrowserSharedControls`, `browserDiagnostics`, `browserRuntimeUtils`, `BookmarksDropdown`, and the four legacy `useBrowser*` hooks with their tests.

## Deliberate limits

- **Windows-only docking.** Other platforms can still run an owned browser window but not embed it; the UI reports this instead of silently degrading.
- Firefox is not supported: it no longer ships CDP, and SuperAgent's browser tools speak CDP. Chromium-family only.
- The embedded surface is a child window, so it sits above the WebView. T-Line withdraws it while its own overlays are open (`tline-hide-native-webview`, dropdowns, hidden document) — a global modal system can still cover it only if an overlay is opened without that event.
- Downloads, print, permissions, and reCAPTCHA remain the real browser's own responsibility; T-Line does not proxy them.

## Verification (this change)

- `cargo test --offline --manifest-path desktop-tauri/src-tauri/Cargo.toml --lib` → **27 passed, 0 failed**.
- `bun --bun x vitest run tests/managedBrowserHandoff.test.ts` (backend) → **4 passed**.
- `bun --bun x vitest run src/components/browser/__tests__/browserContract.test.ts` (frontend) → **9 passed**.
- `bun --bun x tsc --noEmit` in `frontend` and `backend` → exit 0.
- **Open:** packaged Windows app acceptance (docked Chrome resize/DPI/focus, real agent claim through Core, restart/cleanup). Source tests cannot prove native window behaviour.
