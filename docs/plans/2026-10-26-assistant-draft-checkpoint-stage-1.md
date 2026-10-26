# T-Line desktop — manual draft checkpoint controls

Date: 2026-10-26. Implemented with SuperAgent Core task store, **not Muse**.

In Activity Center → Tasks, supported Core versions expose Pause draft, Resume to draft, Inspect Checkpoint and Retry as draft. The capability flag is `supportedModes: ["analysis","patch-preview","draft-checkpoint"]`; older Core does not show these actions.

- Pause stores an unstarted draft checkpoint. It does not suspend an active tool or model.
- Resume returns a paused draft to Ready. **No worker runs** until the user separately confirms Run.
- Retry creates a new queued draft from a reviewed terminal failed, cancelled or reconcile_required attempt. Source history is retained, and the new draft records `retryOfTaskId`. Nothing is silently retried.
- Checkpoint inspection reads persisted metadata and explains whether draft-only resume is possible; it never executes or restores model memory.
- Cross-session, wrong workspace, bad revisions and unknown tool options are rejected in the fixed backend proxy and Core state machine.

Controls are wired through `AssistantTaskDraftApi`, `AssistantTaskDraftPanel` and `AssistantTaskCards`. The Agent Timeline links to Task Actions and explicitly distinguishes unstarted draft controls from unavailable running-worker checkpoint restoration.

Validation:
```sh
bun run build:frontend && bun run build:backend
cd frontend && bun --bun x vitest run --config vite.config.ts src/components/__tests__/AssistantTaskDraftPanel.test.tsx src/components/__tests__/AgentExecutionTimeline.test.tsx
cd .. && bun --bun x vitest run backend/tests/assistantTaskProxy.test.ts
```

Native packaged Tauri + live model/provider E2E is still needed for a full production readiness claim. A queued checkpoint is a **durable state boundary**, not a snapshot of CPU/GPU inference, browser, shell process or in-flight external transactions.
