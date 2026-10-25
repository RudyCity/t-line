# T-Line per-agent timeline and Core-bound tool approvals

Date: 2026-10-26
Scope: T-Line desktop UI + a bounded, metadata-only SuperAgent Core journal. Muse runtime remains untouched.

## Reference inspected
- SuperAgent's Ink `src/components/plan-approval-dialog.tsx`: explicit review before proceeding, visible selected action and denial/feedback options.
- T-Line's existing `PermissionCard` and live WebSocket `permission_required` / `approve_permission` flow; existing Core permissions continue to be the sole authorization authority.
- Muse's remote connection documentation concerns its WebSocket/Telegram link, not an accessible Muse desktop screenshot. This implementation is inspired by the review-before-action interaction, **not** a verified pixel-perfect Muse UI reproduction.

## What is implemented

- Third **Agent timeline** tab inside Activity Center, alongside Chat queue and Background tasks.
- Main Agent: chronological tool start/finish and permission requested/decided event metadata from the Core agent journal, with source timestamps. Falls back to observed chat tools if no Core journal is reachable; internal thoughts are never persisted.
- Individual subagents: per-session live data plus durable Core events for status and each observed tool start/finish. Archived subagent identifiers are hashed and do not contain prompt/log/result text. Child journal scopes inherit only from their verified parent agent; global sidebar instances are excluded.
- Detached tasks: **Core-native durable status transitions** from the authenticated, session-scoped `/api/superagent/assistant/tasks/events?cursor=N` journal; each recorded state includes monotonic sequence, revision and source timestamp. If this endpoint is unreachable or has no record, the last known task snapshot is explicitly labeled a snapshot rather than historical evidence.
- On genuine `permission_required`: the center opens the Agent timeline, shows the existing tool description/file diff preview and actual Core-bound **Allow Once / Allow for Session / Allow Always / Deny** action, and marks review outstanding. The main chat has a shortcut to this view instead of a second independent approval card. Ordinary tool/process actions never produce approval buttons.
- A disconnected Core disables approval controls; the final decision handler additionally checks the current open WebSocket and active session. A persistent 'Always' rule requires additional user confirmation. Existing previously saved workspace permission rules remain respected, scoped to the active socket/session.
- Background-task transitions remain in the existing Core task journal (up to 2,500 records). Separately, the Core Agent Execution Journal now persists up to 400 metadata events per workspace/session, retaining at most 96 scope files for up to 7 days. T-Line reads it via authenticated `GET /api/superagent/assistant/agent-timeline`, and displays real main-agent/subagent tool metadata and approval decisions after reconnect. The journal never stores arguments/results or permission capabilities. Both Core event APIs are read-only, cursor-based and paginated.

## Safety boundaries

- The new endpoint is read-only and fixed-path; no new execution endpoint, replay action, or bypass of Core's permission checker was added.
- All clickable approval controls map to a live `permissionId` delivered from Core; no approval for merely observed timeline entries.
- Cross-session packets with explicit mismatched session IDs are ignored; old socket events are ignored after connection/session switches.
- Existing Ask/Plan approval flows remain independent and unchanged.
- No automatic task restart, no write access for read-only delegates, and no Muse code changed.

## Testing

```sh
bun run build:frontend
cd frontend && bun --bun x vitest run --config vite.config.ts \
  src/components/__tests__/AgentExecutionTimeline.test.tsx \
  src/components/__tests__/AssistantTaskJournal.test.ts \
  src/components/__tests__/CoreAgentTimelineApi.test.ts \
  src/components/__tests__/AssistantActivityCenter.test.tsx \
  src/components/__tests__/AssistantTaskDraftPanel.test.tsx \
  src/components/__tests__/SuperAgentAssistantComposer.test.tsx \
  src/components/__tests__/AssistantTurnQueue.test.tsx
```

Tests include exact observed step ordering, subagent/task separation, timestamp provenance, orphan state review, manual per-agent selection, approval forwarded once using the existing handler, and fail-closed disconnected behavior.

## Remaining validation

T-Line packaged Tauri visual QA and a live Core-provider permission roundtrip still need real operator verification. A native Muse UI was not available among Chrome targets inspected, so pixel parity is not claimed. Read-only Core event metadata is durable after session re-establishment, but it does **not** provide a full forensic transcript and cannot replay missing events from Core downtime. Historical approval events never activate approval controls.
