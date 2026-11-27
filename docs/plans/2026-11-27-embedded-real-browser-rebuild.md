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

## Follow-up delivery (same day, second pass)

### 1. Must-have (native evidence)
- Added an opt-in live test `browser::live_tests::real_engine_launch_cdp_navigate_and_cleanup`
  (`cargo test --lib -- --ignored real_engine_launch`). It discovers the installed engine, spawns the
  real browser with the production launch arguments in an isolated profile, waits for the verified
  loopback CDP endpoint and fingerprint, lists live page targets, navigates a target to
  `https://example.com/`, asserts the URL appears in the live target list, then tree-kills the owned
  process and removes the profile.
  - Result on this machine: **1 passed** (1.83 s), engine = installed Google Chrome.
- `cargo build --offline` produces the desktop binary (exit 0), so the module links in a full app build.
- Packaged GUI acceptance is still a human step: see the checklist below.

### 2. Good-to-have
- **Core-owned session metadata**: SuperAgent now serves `GET /api/browser/sessions` (loopback-only,
  bearer-authenticated, projection without tokens/cookies). T-Line proxies it through
  `GET /api/superagent/browser/sessions` and the direct `~/.superagent-r/cdp-sessions` disk reader
  (`backend/src/browserSessions.ts`) was deleted. One source of truth remains: Core.
- **Overlay-safe docking**: `useOverlayWatch` observes `[role="dialog"]`, `[aria-modal="true"]`, and
  `[data-tline-overlay]` and withdraws the native browser window, covering overlays that never emit
  `tline-hide-native-webview`.
- **`lib.rs` split: intentionally deferred.** `lib.rs` carries another agent's uncommitted hunk; a
  1.8k-line refactor would collide. It stays flagged until that work lands.

### 3. Nice-to-have
- **Real profile bookmarks**: `browser_bookmarks` reads the installed browser's own `Bookmarks` file for
  the owned profile (read-only, bounded, folders flattened, only HTTP(S) entries) and the toolbar lists
  them under "From the browser profile".
- **Process telemetry**: `browser_telemetry` samples RSS and CPU of the exact owned browser PID via
  `sysinfo`; the status rail shows `RSS x MiB � CPU y%`.
- **Cross-platform docking: documented, not implemented.** True embedding needs `SetParent` (Windows) or
  X11 reparenting (Linux); macOS has no equivalent. Non-Windows hosts keep a fully functional real
  browser in its own window ("Own window"), and the embedded command fails with an explicit message
  instead of silently degrading. No unverified platform code was added.

### Packaged GUI acceptance checklist (manual)
1. `bun run build:tauri`, install, open a Browser tab, choose an engine, press **Open real browser here**.
2. Resize the window and the sidebar; the browser follows the viewport with no blank gutters.
3. Scroll, type, play a video with audio, press Ctrl+F and Ctrl+/- inside the page (handled by the real engine).
4. Switch T-Line tabs and open a modal: the surface must disappear and return on activation.
5. Press **Connect agent**, accept the handoff in chat; confirm the agent claims the same tab.
6. **Take control**, ask the agent to type; Core must reject agent writes. **Return to agent** resumes.
7. Stop the browser, confirm no orphan process remains, then relaunch on the same profile.
8. Quit T-Line while the browser is embedded; confirm the owned process exits.

### Updated verification
- `cargo test --lib` ? **29 passed, 1 ignored** (the ignored test is the live browser check).
- Live check ? **1 passed**.
- `cargo build --offline` ? exit 0.
- `bun --bun x tsc --noEmit` (SuperAgent) ? exit 0.
- Frontend browser contract ? **11 passed**.
## Third pass: closure of the remaining audit items

### 1. Must-have
- **Automated native proof** stayed green after the refactors below.
- **SuperAgent contract tests for the session projection**: new pure module
  `src/core/browserSessionProjection.ts` (`isLoopbackRemote`, `projectCdpSessions`) is now the only
  path used by `GET /api/browser/sessions`, and `tests/browserSessionProjection.test.ts` locks the
  loopback gate, token stripping, malformed-entry dropping, participant/owner repair, and summary math
  (4 tests). A packaged GUI pass is still a human checklist item.

### 2. Good-to-have
- **`lib.rs` is now under the 1000-line rule (973 lines)** without touching the concurrent change:
  - `tray_menu.rs` (323 lines): system tray menu construction plus `is_paths_equal`/`get_folder_name`.
  - `system_metrics.rs` (61 lines): the `get_memory_usage` command.
  - Deleted `build_error_page_html` and its three tests: it was dead production code (the app navigates
    to `/error.html`), kept alive only by its own tests.
- **Overlay detection hardened**: `useOverlayWatch` now also matches `.modal-overlay`, which is the
  class used by `Modals.tsx`, `SettingsModal.tsx`, and `CheckpointsPanel.tsx` (12 call sites), in
  addition to `role="dialog"`, `aria-modal`, and `data-tline-overlay`.

### Verification after the third pass
- `cargo test --lib` ? **26 passed, 1 ignored** (the three deleted tests covered removed dead code).
- `cargo check --offline` ? exit 0; no warnings.
- SuperAgent `tsc --noEmit` ? exit 0; `tests/browserSessionProjection.test.ts` ? **4 passed**.
- Frontend `tsc --noEmit` ? exit 0.