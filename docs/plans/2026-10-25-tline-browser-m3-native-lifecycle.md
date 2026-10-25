# M3 — Native Managed Browser Lifecycle Verification

Date: 2026-10-25
Status: **Rust native and real Windows Chrome headless tests passed; packaged GUI E2E still pending.**
Related: [M2-D real Chrome smoke](2026-10-25-tline-browser-m2d-windows-smoke.md), [Managed Browser runtime plan](2026-10-25-tline-managed-browser-runtime.md).

## Verified changes

1. The Tauri desktop supervisor now checks Chrome's **actual browser identity** on each status refresh and before listing tabs or pairing. The chosen CDP port must match the managed profile's `DevToolsActivePort` and the live `/json/version` browser WebSocket identity. Port reuse or a changed browser identifier fails closed.
2. Desktop browser state distinguishes `starting`, `ready`, `disconnected`, and `exited`. A transiently late debugging port may recover under the original fingerprint. The supervisor does not silently reattach a different browser instance.
3. **Stop owned browser** checks the in-memory Rust Child and runtime generation, then on Windows terminates that exact process tree using the Windows system task utility, falling back to terminating the retained Child if needed. It never runs a generic name-based kill or touches the user's personal Chrome profile.
4. After stopping the owned browser, a leftover `DevToolsActivePort` marker is removed only if its port and fingerprint still match the browser T-Line had launched and there is no live matching endpoint. Unexpected, active or unowned markers remain untouched.
5. The Browser UI disables tab refresh and pairing when the native runtime reports disconnected. Previously prepared pairing is invalidated on disconnection. A separate **Recovery (fresh isolated profile)** choice does not import, delete or reuse personal browser data.

## Tests actually run

- `cd desktop-tauri/src-tauri && cargo test --offline --lib managed_browser::tests` — passed.
- `cargo test --offline --lib managed_browser::tests::real_owned_chrome_lifecycle_smoke -- --ignored --nocapture` — **passed with genuine installed Windows Chrome** using a temporary profile. Confirmed native Rust spawning, identity/port detection, protected live marker, stopping exact owned Chrome process tree, unreachable CDP after stop, and safe stale marker retirement. Test is opt-in to avoid opening Chrome during normal unit runs.
- `cargo check --offline` — passed.
- `cargo build --offline --bin app` — passed; built Windows desktop executable (not launched).
- Frontend TypeScript and focused Managed Browser tests — passed.
- SuperAgent's M2-D headless Chrome gateway tests previously passed with independent owner/observer sessions. That is a separate integration route and not proof of a packaged GUI.

## Local Core inspection

- Core loopback TCP port `127.0.0.1:7888` was reachable, and the Core service info file existed with the expected port and credential shape. No service token was exposed in output.
- A live authenticated HTTP registration round-trip could **not** be completed in this run. The Core service was not restarted or modified.

## Remaining production gates

- Launch the **packaged Tauri Windows app**, click Managed Browser Launch → Pair → Stop and inspect IPC/capabilities, UI/OS window focus, consent and local Core registration with an approved test session.
- Verify live HTTP service-token registration, runtime refresh and lease synchronization across distinct actual Core/MCP processes, not only isolated unit/smoke tests.
- Prove profile behavior on abrupt app exit, system sleep/resume, Chrome crash and restart, and concurrent T-Line app/process attempts. Stale or unowned profiles must continue to fail closed.
- Validate publisher signature and Chrome security update version; do not bundle branded Chrome without licensing review.
- Build optional interactive in-panel CDP screencast only after the packaged window/core checks pass.

Rollback is feature-flagged/manual. Neither personal Chrome nor unrelated SuperAgent processes/tunnels are modified by this work.
