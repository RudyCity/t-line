# Managed Browser M2-D — Windows Chrome integration and runtime identity

Date: 2026-10-25
Status: Windows **headless real Chrome** CDP and gateway integration tested. Not a packaged-Tauri application acceptance test.
Related: 2026-10-25-tline-browser-m2c-native-registry.md

## Verified end-to-end using installed Windows Chrome

Run from the SuperAgent repository: `bun scripts/smoke-managed-chrome.ts`.

The script creates a Chrome profile and CDP coordination directory under the OS temporary directory (not the personal Chrome profile), launches the installed Chrome binary headlessly using a system-selected CDP port, and tests:
- CDP tab discovery through the existing MCP gateway.
- Atomic native-style runtime registration into a local cross-process registry.
- Browser identity fingerprint tied to Chrome's browser debugger ID, not just a port number.
- Successful owner claim for agent A, and rejection of agent B before authorization.
- Owner-enabled sharing and approved observer enrollment via encrypted invitation.
- Observer reading `about:blank` through the allowed CDP command.
- After terminating only the isolated Chrome PID tree: immediate disappearance from `action=managed` despite remaining TTL, and rejection of stale agent operations.
- Owner lease release and temporary directory cleanup.

Observed: **PASS** for the complete chain; no browser personal profile, shared tunnel, existing Core service or unrelated agent was restarted.

## Hardening implemented

T-Line Rust native `managed_browser_gateway_register` now reads the current `DevToolsActivePort` file of its owned profile, obtains Chrome `/json/version` on the same local port, checks the browser WebSocket identity/path and hashes that path (SHA-256) before sending an authenticated local registration. No raw browser debugging URL goes to the UI.

Core rejects registrations whose browser identity fingerprint does not match the running port and target. The gateway `managed` listing only returns identity-verified live registrations, without revealing the fingerprint. An already claimed managed session remembers the fingerprint and rejects control when Chrome is replaced or terminated; releasing the stale lease remains possible.

## Verification coverage

- Real installed Windows Chrome headless: `bun scripts/smoke-managed-chrome.ts` — PASS.
- Registry unit tests: `bun test tests/managedBrowserRegistry.test.ts` — PASS.
- Core TypeScript: `bun --bun x tsc --noEmit` — PASS.
- T-Line Rust tests: `cargo test --offline --lib managed_browser::tests` — PASS.
- T-Line Rust compile: `cargo check --offline` — PASS.

## Still not validated

- The Tauri UI's actual native **Launch/Pair/Stop** clicks on a packaged Windows installer.
- Core's live production HTTP service bearer exchange; smoke calls the registry directly in an isolated process without a running server.
- Screenshot/screencast live viewer in the T-Line UI.
- Multi-process GUI lifecycle when Chrome is moved between windows, app restart/adoption, and signed executable provenance.
- Browser profile repair after an unclean exit; this still fails closed.
- Browser debugging transports cannot authenticate other local same-user processes. An authenticated Core registry cannot fix raw CDP exposure without OS isolation.

Next milestone: packaged Tauri host smoke (owner PID validation, profile lock recovery, native local-service registration) and only then optional live browser mirroring, with no claim of bot-detection bypass.
