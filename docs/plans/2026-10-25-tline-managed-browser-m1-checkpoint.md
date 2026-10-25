# Managed Browser — Initial Native Implementation Checkpoint

Date: 2026-10-25
Status: P0-A foundation + P0-B experimental implementation; P0-C/M2 and full release not complete.
Source plan: 2026-10-25-tline-managed-browser-runtime.md

## Implemented
- Isolated desktop Rust module: desktop-tauri/src-tauri/src/managed_browser.rs.
- Tauri fixed commands with main-webview and local app-origin checks: managed_browser_discover, managed_browser_status, managed_browser_launch, managed_browser_stop, managed_browser_targets.
- Discover installed Windows Chrome only from conventional known per-user / Program Files paths. Do not accept caller-supplied executable or profile paths.
- Launch a visible real Chrome process with a non-default T-Line application-local profile directory, a dynamically allocated loopback CDP port and a runtime generation identifier. Each profile ID is strictly validated. Main UI confirmation required.
- Run the potentially blocking launch wait in a Rust blocking worker. Browser child handles are kept in a desktop-owned registry and isolated from the shared SuperAgent task/CLI lifecycle.
- Stop only processes held by an owned Rust Child handle and matching runtime generation. No taskkill of another process, no takeover or copying existing Chrome profiles. A failed/stale/unowned process cannot be stopped from this interface.
- Read up to 50 page targets from the selected owned process's local CDP list endpoint, with response size capped at 128 KiB and sensitive query/fragment metadata omitted.
- Add experimental Managed Browser panel to the T-Line Browser tab: OFF by default, explicit user opt-in and confirmation, preset isolated profiles, launch/status/stop/target list, error states and Chrome-window-not-embedded disclosure.
- Existing WebView2 preview and CDP agent session sharing panels remain unchanged. Managed Chrome is an independent visible window.

## Verification performed
- Rust cargo check --offline succeeded.
- Rust managed_browser unit tests succeeded (3).
- Frontend TypeScript typecheck succeeded.
- New managed browser UI tests succeeded (3). Existing BrowserTab lifecycle tests succeeded (2).
- Do NOT interpret these as a Windows packaged app smoke test. No real browser was started or controlled through this change.

## Known gaps / blocked release gates
1. **Automatic SuperAgent CDP binding (M2)** is not implemented. A managed browser starts with a local debugging endpoint, but no authenticated SuperAgent target registration/agent attachment exists for this process. The existing external Chrome CDP gateway still works separately.
2. **Full browser window lifecycle:** Rust owns the initial process, but Chrome may have additional child processes; stop/exit handling requires packaged Windows verification. App restart cannot safely re-adopt a previous instance; existing profile debug-lock files fail closed.
3. **Publisher/signature validation:** discovery restricts to known install locations but does not yet verify Authenticode publisher signatures or patch freshness. Treat as opt-in developer capability, not a hardened production release.
4. **CDP local threat model:** loopback debugging endpoints are not authenticated by Chrome; other same-user local processes may access them. Do not tunnel or forward raw ports. A trusted authenticated gateway/proxy is required before unattended agents are allowed.
5. **In-panel live Chrome viewport (M4)** is not implemented; T-Line explicitly uses a separate real Chrome window.
6. **Bundled Chromium (M5)** is not included. License review, provenance verification, updater, rollback and security notices are still required before adding binaries.
7. **Native packaged Windows E2E and real-site compatibility (M6)** are not verified; login/CAPTCHA restrictions cannot be guaranteed away.
8. Feature opt-in is currently in the UI component state and resets on remount, which deliberately leaves managed automation OFF by default. Persistent settings/agent-specific access policies are pending.
9. No executable or browser profile was downloaded into the Git repository.

## Next engineering order
1. Verify packaged Tauri window with existing personal Chrome running, two T-Line managed profiles and launch/relaunch/stop, without affecting user processes.
2. Build an authenticated runtime registration handshake to the existing SuperAgent browser gateway, returning *opaque runtime references* to agents instead of raw local CDP ports.
3. Add per-tab owner lease, permissioned actions, explicit user approvals for sensitive actions, agent queue and tested recovery/generation invalidation.
4. Only then implement optional frame-based Chrome mirror, browser runtime bundle and production auto-update controls.

The shared SuperAgent backend and existing tunnels were not restarted by this change. Avoid committing unrelated concurrent assistant/Studio work.
