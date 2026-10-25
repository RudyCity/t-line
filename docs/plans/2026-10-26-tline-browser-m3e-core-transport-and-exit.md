# M3-E — Native shutdown and authenticated Core transport tests

Date: 2026-10-26
Status: **Implemented and verified in local native/unit tests. Packaged GUI and active Core registration remain unverified.**
Previous checkpoint: `2026-10-25-tline-browser-m3-native-lifecycle.md`.

## Implemented

- On the actual Tauri application `RunEvent::Exit`, the desktop now stops only the Chrome process trees launched and retained by this T-Line process. Closing the main window to the tray is intentionally NOT an exit and does not stop these browsers.
- Native supervisor shutdown shares the existing owned-Child handle registry and serializes cleanup with the same lock used by launch/stop. The canonical SuperAgent Core process, external tunnels, user Chrome instances, other application processes and profiles are not targeted.
- A naturally exited managed Chrome child is removed from the registry, and its stale `DevToolsActivePort` marker is retired ONLY after matching the previously observed port and fingerprint and verifying no matching endpoint is still alive. Unknown/unowned live profiles fail closed.
- Refactored fixed-loopback authenticated Core registration HTTP client into `desktop-tauri/src-tauri/src/managed_browser_core.rs`, keeping the browser file below the project limit. Production uses the fixed Core port 7888; no renderer-provided host or credentials are accepted.
- Core client validates a successful response with a registration expiry greater than current time and no more than 120 seconds ahead. It rejects 403/invalid/missing/stale registration responses, never falsely marking a pairing ready.
- The front-end has a disconnected-browser regression test: no agent pairing or tab refresh can be initiated; the fresh recovery profile remains available.

## Verified tests

1. `cargo test --offline --lib managed_browser_core::tests` — 2 localhost HTTP contract tests (successful authenticated request and rejected authorization).
2. `cargo test --offline --lib managed_browser::tests` — native lifecycle and security unit tests.
3. Opt-in native Windows Chrome smoke `cargo test --offline --lib managed_browser::tests::real_owned_chrome_lifecycle_smoke -- --ignored --nocapture` — passed after exercising the real app-exit shutdown cleanup logic with an isolated Chrome process tree.
4. `cargo check --offline` — successful Rust type/build check.
5. Frontend browser safety/unit tests and `tsc --noEmit` — successful, including the disconnected pairing regression.
6. No personal Chrome process or shared Core process was restarted; the native test launches and terminates only its own temporary Chrome instance.

## Important remaining gates

- HTTP tests use a temporary local mock service and **do not claim** a successful call to the user's currently running authenticated Core instance on port 7888.
- The installed Windows desktop GUI has not been driven end-to-end through Launch / Pair / Stop IPC; an offline Rust test with real Chrome is not the same as packaged Tauri UI validation.
- A sudden power loss or OS kill cannot run the Tauri Exit hook. Such profiles must fail closed or be explicitly recovered; do not delete live/unowned browser markers.
- Further testing should cover two concurrent managed profiles, suspend/resume, terminal crashes, publisher/signature checks, an authorized Core registration from the packaged binary, and optional in-panel read-only live mirroring through the authenticated gateway.
