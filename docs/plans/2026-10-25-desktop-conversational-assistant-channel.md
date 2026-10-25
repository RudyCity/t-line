# Desktop conversational assistant queue — 2026-10-25

## Scope

This increment affects the **T-Line channel only**. The existing Muse and Telegram channel owners, watchers, recoveries and delivery outboxes are untouched. T-Line and the CLI still use the same SuperAgent Core engine. No new model backend or secondary agent runtime was introduced.

## User behavior

- The chat textarea and **Send** remain usable during an active Core turn. The **Abort** control remains separate and targets the owning T-Line session.
- A second ordinary chat message is added to the **Core chat-turn queue** (not a parallel invocation of the same conversation agent). The Core serializes turns per session and persists idempotent message IDs. Separate sessions may be independently active; multi-agent delegation inside a turn still follows existing Core rules.
- **Assistant queue** shows running, pending and recoverable turns, with a bounded history view. Turn metadata comes from the existing Core durable SQLite ledger rather than the unrelated **task drafts** journal. Task drafts remain planning-only.
- On a Core restart, any turn which was running or ambiguously accepted before a crash is marked interrupted; never replay potentially side-effectful work automatically. Only never-started queued turns become recoverable; a visible confirmation is required to resume those queued messages.
- The WebSocket connection is pinned to the exact session ID established at connection time. A stale tab attempting to send to a different session is rejected, rather than silently sending to the previously selected session.
- Session-specific actions (approve permission, answer a question, approve a plan, abort) include the session ID on the Core request; the plan endpoint receives `x-session-id` for correct agent resolution.
- Chat turns use browser-generated UUID idempotency keys; repeat delivery with the same ID is deduplicated by Core. No automatic retry of a *new* user message after ambiguous network failure is introduced.

## Routes

T-Line backend (the outer `/api/superagent` router is authenticated):

| Method | Route | Operation |
|---|---|---|
| GET | `/api/superagent/assistant/turns?workspace=...&sessionId=...` | Scoped, sanitized turn status; excludes prompt and error text |
| POST | `/api/superagent/assistant/turns/recover?workspace=...&sessionId=...` | Explicit recover of never-started queued turns only |

Both require local-operator authority, a validated session and workspace, and Core's server-side bearer token. The proxy only reaches fixed HTTP paths on loopback and does not accept arbitrary tool names or URLs.

## Technical limits / next implementation

1. T-Line is now an asynchronous **conversation** frontend: it can accept follow-ups while a turn runs. These follow-ups are serialized within one session, **not** independent parallel goal workers.
2. No guarantee that a running model/tool survives Core process termination. The journal preserves metadata, not an OS process.
3. A detached durable multi-goal executor and trust-scoped worker claims are separate next milestones; do not describe queued chat turns as autonomous background jobs.
4. Restore mode associated with a historical session before reconnect and verify session conflicts with live desktop E2E.
5. Test actual concurrent terminal/desktop sessions, disconnect/reconnect with large attachments, permissions, completion evidence and packaged Windows desktop.

## Verification

- `bun run build:backend`
- `bun run build:frontend`
- `bun --bun x vitest run backend/tests/tlineAssistantTurns.test.ts backend/tests/assistantTaskProxy.test.ts`
- `cd frontend && bun --bun x vitest run --config vite.config.ts src/components/__tests__/SuperAgentAssistantComposer.test.tsx src/components/__tests__/AssistantTurnQueue.test.tsx`

These cover the authenticated proxy, session boundary helper, sanitized status projection, recovery authorization, composer usability during execution, and assistant queue UI. They are not substitutes for a live packaged-app end-to-end test.
