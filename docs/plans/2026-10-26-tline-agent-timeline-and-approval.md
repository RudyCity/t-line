# T-Line per-agent timeline and Core-bound tool approvals

Date: 2026-10-26
Scope: T-Line desktop UI only; SuperAgent Core and Muse runtime untouched.

## Reference inspected
- SuperAgent's Ink `src/components/plan-approval-dialog.tsx`: explicit review before proceeding, visible selected action and denial/feedback options.
- T-Line's existing `PermissionCard` and live WebSocket `permission_required` / `approve_permission` flow; existing Core permissions continue to be the sole authorization authority.
- Muse's remote connection documentation concerns its WebSocket/Telegram link, not an accessible Muse desktop screenshot. This implementation is inspired by the review-before-action interaction, **not** a verified pixel-perfect Muse UI reproduction.

## What is implemented

- Third **Agent timeline** tab inside Activity Center, alongside Chat queue and Background tasks.
- Main Agent: observed ordered tool action summaries from the active chat, never internal thoughts. No synthetic timestamps.
- Individual subagents: only records observed on the current session's WebSocket `subagents_update` stream; role, status, prompt, optional log steps, timestamps if actually present. Workspace-global unscopeable sidebar agents are NOT copied to this per-session view.
- Detached tasks: **Core-native durable status transitions** from the authenticated, session-scoped `/api/superagent/assistant/tasks/events?cursor=N` journal; each recorded state includes monotonic sequence, revision and source timestamp. If this endpoint is unreachable or has no record, the last known task snapshot is explicitly labeled a snapshot rather than historical evidence.
- On genuine `permission_required`: the center opens the Agent timeline, shows the existing tool description/file diff preview and actual Core-bound **Allow Once / Allow for Session / Allow Always / Deny** action, and marks review outstanding. The main chat has a shortcut to this view instead of a second independent approval card. Ordinary tool/process actions never produce approval buttons.
- A disconnected Core disables approval controls; the final decision handler additionally checks the current open WebSocket and active session. A persistent 'Always' rule requires additional user confirmation. Existing previously saved workspace permission rules remain respected, scoped to the active socket/session.
- Core already persists up to 2,500 owner/workspace-bound detached-task transition records and exposes bounded pages (up to 100). T-Line reads up to four pages per refresh only while timeline is visible and keeps the latest 600 in memory, advancing a validated cursor; this survives restarting the desktop application because Core owns the journal. Full durable chronological subagent/tool calls, detailed tool inputs/output and per-permission decision acknowledgements are **not** available from this task-state journal. These need a separate server-side event source to achieve exact Muse-style replay.

## Safety boundaries

- No new execution endpoint, replay action, or bypass of Core's permission checker was added.
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
  src/components/__tests__/AssistantActivityCenter.test.tsx \
  src/components/__tests__/AssistantTaskDraftPanel.test.tsx \
  src/components/__tests__/SuperAgentAssistantComposer.test.tsx \
  src/components/__tests__/AssistantTurnQueue.test.tsx
```

Tests include exact observed step ordering, subagent/task separation, timestamp provenance, orphan state review, manual per-agent selection, approval forwarded once using the existing handler, and fail-closed disconnected behavior.

## Remaining validation

T-Line packaged desktop Chrome/CDP visual QA and real Core provider permission roundtrip are still needed. Native Muse UI was not available among Chrome targets inspected. Building a truly persistent timeline requires Core to emit durable, session-scoped, timestamped tool/agent state transition events with bounded SSE replay, and a per-permission decision acknowledgement/audit journal. Do not synthesize past transitions from snapshots.
