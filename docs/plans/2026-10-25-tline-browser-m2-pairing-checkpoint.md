# T-Line Browser M2-A — Verified Gateway Handoff

**Date:** 2026-10-25
**Scope:** Safe operator-initiated linkage between a T-Line-owned Chrome tab and the *existing* SuperAgent MCP browser gateway.
**Status:** M2-A implemented and unit/compile verified; M2-B automatic authenticated attachment and live Windows E2E are NOT complete.

## Implemented

- Added Tauri native command `managed_browser_gateway_pairing` in `desktop-tauri/src-tauri/src/managed_browser.rs`, registered in build manifest and Tauri capability policy. The command accepts only `profileId`, `generation`, `targetId`. It does **not** accept arbitrary CDP ports, executable paths, URLs, shell commands or external hosts.
- Verify the caller is the trusted main T-Line webview on an allowed app origin. Verify a live Rust `Child` handle owned by T-Line, matching generation and a real page target in its own local CDP `/json/list` endpoint. Respond with a minimal `profileId`, `generation`, `port`, `targetId` handoff (no tokens, WS debugger URLs, cookies, response bodies or session capability). Response size limited to 128 KiB. No direct remote HTTP/CDP route is added.
- Explicit operator action: in Browser -> Managed Browser -> Enable -> Launch Chrome -> Refresh tabs -> **Pair agent** for the chosen tab. Confirmation is required for handoff. The UI renders a copyable instruction to call existing `superagent_browser_gateway` actions `discover` and `claim`. An existing owner claim is never overridden; SuperAgent's gateway requires invitation for shared participation.
- Reuse T-Line's authenticated **read-only** `/api/superagent/browser/sessions` projection to monitor whether that exact port and tab now has a live coordinator claim. The UI says “No active gateway claim observed” until the claim exists. Claim presence is **not** proof that an agent is actively running.
- Strict privacy projection: participant records are rebuilt with allowlisted `agentId` and `role` only; token hashes, owner capabilities and extra fields are not forwarded. Browser tab URL metadata has userinfo/query/fragment removed.
- Clear pairing data on profile change, feature toggle OFF, stop and native browser generation change.
- No changes to SuperAgent's MCP gateway/source are required for this *manual* handoff. It already supports dynamic local port, `discover`, `claim`, approved `request_attach`, permissioned `execute`, serial write queue and session TTL.

## Validation

- Native Rust: `cargo check --offline`, `cargo test --offline --lib managed_browser::tests`.
- React: `bun --bun x tsc --noEmit -p frontend/tsconfig.json`, browser/gateway Vitest.
- A regression test deliberately injected a simulated `tokenHash` in participant data and found the first projection implementation leaked it. Fixed by explicitly mapping only `agentId` and `role`; regression now passes.
- No actual Chrome/Tauri UI install was started, and no live agent was attached to a new managed tab during these checks.

## Operator instructions (local desktop)

1. Open T-Line desktop -> Browser -> Managed Browser and explicitly enable controls.
2. Launch a Chrome window under one of the **T-Line managed profiles** and open a permitted web page. Other Chrome profiles are not automatically attached.
3. Select the tab's **Pair agent** button. Confirm and **Copy for assistant**.
4. Paste into a T-Line chat where SuperAgent's `superagent_browser_gateway` MCP tool is connected. The agent executes `discover` on the given local port, then `claim` for the exact target ID, or requests owner-approved access if claimed.
5. Check **Gateway claim status** in T-Line and the existing browser session monitor. A missing claim means pairing is incomplete; do not infer that the agent connected.
6. On browser restart/new generation or profile change, generate fresh pairing information. Never share the CDP port to untrusted processes, public networks or tunnels.

## Pending / limitations

- **M2-B:** one-click, *authenticated automatic* handoff to an agent session, with trusted session ownership and no exposed local CDP endpoint or privilege escalation. The current button **copies instructions**, not an auto-claim. Keep this distinction visible.
- The CDP debugging listener is local and **not authenticated by Chrome itself**. A pairing descriptor is not a secret and does not protect against malicious same-user local processes. This MVP is for trusted developer computers, not remote/public distribution.
- Windows packaged Tauri acceptance, Chrome process-tree lifecycle, profile recovery after crashes, target migration and ability to distinguish stale browser generations at the gateway are still pending.
- Bundling an alternative browser binary, version freshness and signed executable verification are not included.
- Do not expose automatic source injection, page cookies, credentials, unrestricted remote debugging, CAPTCHA bypass or anti-spam evasion in later phases.

See `docs/plans/2026-10-25-tline-managed-browser-runtime.md` for the full P0–P2 release criteria.
