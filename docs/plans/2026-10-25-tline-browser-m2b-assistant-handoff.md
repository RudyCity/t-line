# M2-B: One-click workspace assistant handoff
Date: 2026-10-25
Status: Implemented conversational handoff. Authenticated direct CDP claim remains pending.
Related: docs/plans/2026-10-25-tline-browser-m2-pairing-checkpoint.md

## Operator workflow
1. In desktop T-Line Browser, enable Managed Browser, launch real Chrome with a separate managed profile, and select a page tab.
2. Select Pair agent and confirm. Rust verifies the owned process, runtime generation, and exact live target.
3. T-Line locates the registered workspace of that Browser tab and opens its matching SuperAgent agent tab. The verified gateway discover/claim instructions are routed to that existing agent's chat session, without copy/paste.
4. The chat-turn request uses the established WebSocket only when workspace, active chat session, and selected model preset match. Attachments are not included. Requests have a 60-second lifetime and are consumed once.
5. The agent must still call the existing authorized SuperAgent MCP browser gateway. An owner claim is not silently overridden; approved shared access remains mandatory for already-owned tabs.
6. T-Line's existing claim monitor reports an observed claim if one exists. A submitted chat prompt is not evidence of a successful CDP connection.

## Changes
- App.tsx: in-memory, workspace-scoped one-shot routing to the agent tab, including creation/reuse of agent tab in the selected workspace.
- BrowserTab.tsx and ManagedBrowserPanel.tsx: typed callback after the user's explicit native pairing confirmation, preserving manual copy fallback if no workspace is registered.
- SuperAgentConsole.tsx: existing session WebSocket dispatch when ready, with exact workspace and session matching. Preserves draft input, prevents browser instructions entering local prompt history, and rejects stale handoffs.
- browserHandoffRouting.ts: pure workspace destination and expiry validation, with tests.

## Security and limitations
- No arbitrary CDP WebSocket exposure, remote debugging proxy, new bearer capability or direct browser mutation endpoint.
- Native Rust process ownership and generation checks remain the issuer gate. Coordinator and gateway retain their own agent claims, queue, permissions, and TTL.
- The instruction includes local debugging port and target identifier, not cookies, bearer tokens or WebSocket credentials. Chat history may store these identifiers, so use trusted local environments only.
- On a missing/busy tool or model, browser restart, stale target, or claimed tab, the assistant may fail to attach; manual copy is available and the claim monitor remains the source of truth.
- This is not production-ready auto-authenticated owner claim. A later milestone needs actor-bound native proof, a gateway registration handshake, actual E2E Chrome attachment, process-restart invalidation and local endpoint hardening.
- Interactive embedded Chrome viewer and browser executable bundling are not included.

## Verification
Run frontend TypeScript type check, browser and assistant unit tests, and production frontend build. Packaged Tauri Windows GUI E2E and real multiagent CDP attachment are not verified by these tests.
