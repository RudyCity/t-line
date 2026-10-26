# T-Line Assistant Activity V3 — Phases 1–5

Date: 2026-10-26
Repositories: T-Line frontend/backend and SuperAgent Core.
Muse runtime and Studio/browser managed workstreams: unchanged by these commits.

## Phase 1 — Approval Engine V2
- Core keeps a T-Line-only, exact owner-session approval registry with `pending`, `approved`, `approved_session`, `denied`, and `expired` states. A single decision wins; duplicates reject; a live T-Line permission expires after five minutes and is denied (never implicitly approved).
- Only authorized Core session ownership permits a permission decision. The existing Core `/api/approve` action remains the execution authority; the new `GET /api/tline/approvals` route is a read-only observation.
- T-Line WS bridge now forwards a `permission_decision_ack` only after Core confirms the decision. An unknown transport outcome is **not** retried automatically. T-Line checks exact session+workspace Core status, including after reconnect.
- `Allow Always` is persisted only after the active permission is approved by Core; denying/choosing another mode clears an unconfirmed rule.
- A pending permission whose original Core process died is **not** recreated or re-authorized from historical metadata. A Core restart requires a new genuine permission request from an active agent.

## Phase 2 — Agent Timeline V3
- Every Core tool start/end retains a hashed `callId` where an original tool call ID was present. No raw tool call arguments or capability identifiers enter the journal.
- Verified subagents inherit a server-owned session scope through object identity, including nested and resumed child agents; their hashed parent actor is recorded.
- T-Line displays parent–child links, tool action durations **only if matching start/end exist**, persistent per-session history and a source-timestamp chronology.
- Search by agent/tool and filter by agent type and status. All filters are presentation-only; they never trigger an operation.

## Phase 3 — Read-only event stream
- The authenticated Core `GET /api/tline/agent-timeline/stream` route emits sanitized SSE with validated scope, `id: seq`, bounded replay and `gap` signals, plus heartbeats.
- Desktop backend uses a fixed local-only SSE proxy `GET /api/superagent/assistant/agent-stream`. It does not accept a client-specified host or arbitrary tool/action.
- Frontend uses authenticated streaming fetch, detects bad frames, deduplicates monotonically by cursor, retries with bounded backoff, and switches to read-only polling if disconnected. Switching sessions aborts old streams.
- Core event journal has a fixed retention window; gaps are surfaced instead of inventing events.

## Phase 4 — Safe agent controls
- Inside Agent Timeline, detached tasks expose scoped, confirmed `Request cancel` and `Reconcile orphan` actions only when the task's current state supports them. Both reuse Core's CAS `expectedRevision` and ownership checks.
- The UI reports cancellation as **requested**, never already completed. Recovery/reconciliation never automatically repeats tool calls.
- **Pause/Resume/Retry from an arbitrary execution checkpoint are explicitly unavailable**: Core does not yet provide durable resumable checkpoints for all agent types. The UI redirects to the existing explicit task review flow. Implementing fake buttons or replaying side effects is unsafe.

## Phase 5 — Multi-agent dashboard
- Responsive compact dashboard of agent/task count, active and review counts, tool completion count, and observed average tool duration.
- Separate session filter controls for main/subagents/tasks and status. No invented token or dollar costs; the metadata journal does not contain billing usage metrics.

## Verification
```sh
# SuperAgent Core
bun run build
bun --bun x vitest run tests/tlineAgentTimeline.test.ts tests/tlineAgentTimelineV3.test.ts \
  tests/permissions.test.ts tests/assistantTaskHttpRoutes.test.ts tests/sessionEventScope.test.ts

# T-Line
bun run build:frontend
bun run build:backend
cd frontend
bun --bun x vitest run --config vite.config.ts \
  src/components/__tests__/CoreAgentTimelineStream.test.ts \
  src/components/__tests__/CoreAgentTimelineApi.test.ts \
  src/components/__tests__/CoreApprovalStatusApi.test.ts \
  src/components/__tests__/AssistantActivityCenter.test.tsx \
  src/components/__tests__/AgentExecutionTimeline.test.tsx
cd ..
bun --bun x vitest run backend/tests/agentTimelineV3Proxy.test.ts \
  backend/tests/agentTimelineProxy.test.ts backend/tests/assistantTaskProxy.test.ts
```

## Follow-up: stream and approval hardening
- The Core SSE endpoint now emits valid newline-delimited protocol frames. The desktop parser accepts CRLF split across transport chunks.
- The local proxy honors downstream backpressure by pausing the Core response when the browser cannot drain.
- Read-only streams are session-revalidated during delivery, with concurrency and buffer caps.
- Approval status distinguishes `cancelled`, `expired` and `denied`. The owning Core session remains the only execution authority, with UUID prompt identifiers.
- Test live reconnect, tab closure, owner revocation, expiry and Core restart in a packaged desktop before claiming full native E2E readiness.

## Still needs a live operator test
A packaged Tauri window and real model provider are required to exercise: tool permission → Allow/Deny → confirmed acknowledgement → Core decision/journal → UI restart/reconnect → archived timeline. Current automated tests validate the individual boundaries, not an actual native GUI end-to-end roundtrip. Approvals cannot survive a crashed Core as actionable pending prompts; only their metadata history can.
