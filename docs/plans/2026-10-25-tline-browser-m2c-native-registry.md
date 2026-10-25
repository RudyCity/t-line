# M2-C — Native authenticated managed browser registration

Date: 2026-10-25
Status: Implemented in T-Line and SuperAgent source; unit/type checks passed. Full installed-Windows E2E and automatic CDP ownership remain pending.

## Behavior

1. The operator enables Managed Browser, launches a **real, visible** browser under an isolated T-Line profile, chooses a page and explicitly confirms **Pair agent**.
2. The native Tauri supervisor verifies the browser is still owned by its Rust Child handle, its generation matches and the page target exists on its loopback debugging endpoint.
3. The new native-only command `managed_browser_gateway_register` reads the local Core service information file (`~/.superagent-r/server-info-7888.json`); it rejects an invalid port, symlink, oversized file or non-hex bearer. The secret **never goes to React, browser URLs or chat**.
4. Rust sends fixed JSON fields `profileId`, `generation`, `port`, `targetId`, and hashed `browserFingerprint` to Core's authenticated **loopback-only** `POST /api/browser/managed/register`. The request has a bounded timeout and a fixed destination. Core checks the target exists and rejects conflicting live generations.
5. Core writes short-lived, **90-second** registry metadata (not a CDP capability) to the canonical gateway directory using an atomic rename and restrictive local file permissions. This supports separate Core/MCP processes. The MCP `superagent_browser_gateway` tool's read-only `managed` action lists nonexpired registrations.
6. While the panel is visible and opted-in, the native register command rechecks the target every 45 seconds. Browser stop, profile switch and runtime generation changes clear T-Line's pairing. Missing Core or a failed registration prevents *automatic* assistant dispatch and preserves **Copy for assistant** fallback.
7. After successful registration, the existing one-click handoff sends a bounded instruction to the correct workspace chat. The agent must still call `discover` + `claim` or request approved shared access. Core registry data does **not** issue a token, reserve tab ownership or bypass lease revision checks.

## Security / assumptions

- No client-supplied executable path, CDP host, endpoint URL or remote destination; local process ownership is established by Rust, **not** from a frontend-provided PID.
- Core also requires the existing service bearer and loopback socket origin; it never trusts the browser page content or a CDP hostname supplied by the UI.
- Registration announces **a local tab**, not an authority delegated to the model. Existing MCP session identity, owner token/capability and per-target lock remain canonical.
- Unauthenticated Chrome local debugging ports remain accessible to other same-user local processes; Core's registry cannot fix Chrome's own transport authorization. Isolate untrusted programs with OS controls.
- Crashes or app closure can leave metadata for up to 90 seconds; a stale listed entry does not allow a claim if CDP target is gone, and no core-side Chrome process is killed.
- The Core service token's file location must match the supported local Core installation; a missing/out-of-date token fails closed.
- The registry is an **authenticated announcement**, not a cryptographic OS attestation that can be presented to arbitrary remote peers.
- No browser executable was downloaded, no Chrome window was launched in this change, and **no live multiagent CDP attachment was tested**.

## Verification and next gates

- SuperAgent: `bun test tests/managedBrowserRegistry.test.ts`, `bun --bun x tsc --noEmit`.
- T-Line: Rust `cargo check --offline`, `cargo test --offline --lib managed_browser::tests`; frontend Vitest and TypeScript; production frontend build.
- Next: test packaged desktop with an actual Chrome process and external Core/MCP processes. Validate the native service-token read path, browser port reuse/stale-generation, multiagent owner and observer claims, crashes/restarts, and OS process permissions.
- **Not in scope:** direct privilege grant to an agent, silent claims, interactive Chrome mirror, optional browser binary bundling or anti-bot evasion. See the Managed Browser Runtime plan for later phases.

Rollback: disabling Managed Browser stops new registration refreshes. Existing short-lived Core entries expire; it does not kill personal Chrome, stop Core, stop tunnels or abort unrelated agents.
