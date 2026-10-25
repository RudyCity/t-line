# M4-A — Native read-only managed browser live preview

Date: 2026-10-26
Status: **Implemented and tested with real local Windows Chrome in native Rust; not yet accepted in packaged Tauri GUI.**
Previous checkpoint: `2026-10-26-tline-browser-m3e-core-transport-and-exit.md`.

## Usage

Open T-Line Desktop → Browser → **Managed Browser** → enable controls → launch or select a T-Line-managed Chrome profile → **Refresh tabs** → **Preview** beside an owned page tab. A screenshot of that tab appears directly in the T-Line panel and updates approximately every 1.5 seconds while the preview and Browser tab remain active. **Close preview** removes the image. Chrome itself stays in a separate window; the page is not embedded as a native child window.

The new viewer is deliberately **read-only**. No mouse, keyboard, scroll, navigation, JavaScript injection, cookies, or CDP WebSocket addresses are returned to the React renderer. Page control by an agent still requires SuperAgent's authorized CDP claim/share gateway.

## Architecture

- `desktop-tauri/src-tauri/src/managed_browser_capture.rs`: bounded native CDP screenshot command. The native command accepts *only* a managed profile ID, the exact owned Rust generation and a target ID. It revalidates the owned `Child` handle and CDP fingerprint before capture and again before returning pixels.
- The native worker discovers the exact selected page through `http://127.0.0.1:{ownedPort}/json/list`. It validates that the returned page debugger is `ws://127.0.0.1:{ownedPort}/devtools/page/{targetId}`, with no credentials, query, fragment, alternative hostname, or remote URL. The only CDP method sent is `Page.captureScreenshot` using JPEG quality 55, viewport-only.
- Screenshot frames are bounded (up to 2.5 MB CDP payload / 2 MB Base64), rejected on invalid/mismatched IDs, and returned as a temporary `data:image/jpeg;base64,...` string. The screenshot is not written to disk by T-Line or passed into chat/model context.
- `frontend/src/components/ManagedBrowserLivePreview.tsx` polls in one-in-flight-request mode at about 1.5-second intervals, pauses when the document is hidden, and cancels updates on close or browser/profile/generation/target change. It checks the expected frame target and encoded JPEG header before displaying.
- `ManagedBrowserPanel.tsx`: preview is **OFF by default**, must be explicitly selected per page, and is disabled when the owned Chrome debugging connection is missing. Agent pairing is a separate control.
- New native command is registered in Tauri `invoke_handler`, build manifest and capability permission `allow-managed-browser-capture`; the command checks the original primary UI origin and refuses arbitrary windows.

## Verification executed

- Native `cargo test --offline --lib managed_browser_capture::tests` — 2 tests (strict URL validation and screenshot response limits).
- Native `cargo test --offline --lib managed_browser::tests::real_owned_chrome_lifecycle_smoke -- --ignored --nocapture` — **PASS**, with installed Windows Chrome launched headlessly under a temporary isolated profile. The test successfully captured a real JPEG screenshot and then stopped only the owned process tree.
- Native `cargo check --offline` — PASS.
- Frontend `ManagedBrowserLivePreview.test.tsx`, `ManagedBrowserPanel.test.tsx` and pairing tests — 15 tests passed, including explicit open/close, strict frame validation and avoidance of implicit agent claims.
- Frontend production build succeeds. The full frontend TypeScript checker may be blocked by a concurrently edited, unrelated assistant UI file; do not mistake that issue for a browser code failure.

## Limitations / next gates

This is a **polled screenshot preview** (~0.67 FPS), not official `Page.startScreencast`, GPU screen mirroring, a native embedded Chromium window, or interactive browsing. It is intended for local user observation. A same-user untrusted process can still reach Chrome's unprotected loopback CDP port if the OS allows; this does not create a new network-accessible CDP service but cannot by itself harden Chrome's local transport.

Remaining gates: packaged Windows GUI / Tauri IPC validation, actual installed Core authentication and multiagent pairing, viewer frame size/RAM/CPU soak with complex sites, sleep/resume recovery, screenshot blank-frame behavior for GPU/video, user-consent/privacy review, and an authorized interaction adapter with collaboration/lease policy. Keep the external Chrome window available for unsupported controls and site permission prompts.

Rollback: disable Managed Browser in the UI to stop preview capture without affecting existing SuperAgent Core/agent sessions or other Chrome profiles.
