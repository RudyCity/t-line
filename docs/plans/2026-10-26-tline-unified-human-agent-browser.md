# Unified Human–Agent Browser Control (2026-10-26)

Status: **Implemented in source with focused automated tests. Native packaged Windows GUI acceptance remains open.**

## User experience
- **One persistent, T-Line-owned Chrome profile and one exact CDP tab**, with a shared live image for both human and agent; switching control does not create another Chrome process.
- In the embedded Chrome toolbar choose **Connect Agent** (verified local Core registration and workspace-specific gateway handoff). A connected agent must claim or obtain approved access through the existing CDP gateway.
- **Take Control** requests a native-verified, Core-authenticated human hold. Human mouse/keyboard/navigation remain enabled; authorized Core CDP agent writes are rejected while the hold persists. Agent reads remain possible.
- **Return to Agent** releases the human hold after queued human input drains, so authorized agent writes can resume on the same target. The frontend stops accepting human input during agent mode.
- Human/agent status is keyed to profile, generation and target ID. Closing, restarting or selecting another Chrome target does not silently reuse local mode state.

## Security boundaries
- The managed Chrome process is owned by T-Line, native calls originate from the primary trusted Tauri WebView, and Core control endpoints require the existing bearer identity over fixed loopback.
- Registration is short-lived and revalidated for every handoff, including active CDP page identity and native Chrome fingerprint. CDP coordinator serializes the control switch with official agent writes.
- This prevents collisions for tools **using the canonical SuperAgent CDP coordinator**. It cannot stop a separate local process from connecting directly to Chrome's exposed local debugging port. Do not expose the port on a public network or tunnel.
- Agent claiming remains explicit; human takeover is not an agent login or implicit CDP owner token, and no credentials or browser cookies are copied between profiles.
- Challenges such as reCAPTCHA must still be completed by a person. This change does not bypass detection or guarantee acceptance by an external website.

## Verification
- Core: `bun test tests/managedBrowserControl.test.ts` — 2 passed.
- T-Line: `bun --bun x tsc --noEmit`, targeted frontend Vitest browser suites — 17 passed.
- Tauri Rust: `cargo check --offline` passed.
- Pending: packaged Windows app UI with native credential and Core connectivity, concurrent real agent input under human takeover, restart/disconnect recovery and a real Chrome stream performance soak. Existing installed binary may not include this code until built/installed.

No active user Chrome, Core server, tunnels or running desktop processes were restarted during this implementation.
