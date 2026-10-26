# T-Line Phase 2A — Running Agent Step Evidence & Reviewed Recovery

Date: 2026-10-26. Requires the matching SuperAgent Core version that advertises `execution-step-observation`.

## User flow
In Assistant Activity Center → Background Tasks → Checkpoint, T-Line displays the last 16 sanitized tool event observations, number of unfinished observations and unverified external interactions. A manual-review warning appears when any unfinished, unknown, failed, or externally unverified action exists. The panel can be closed without executing anything.

For failed/cancelled/reconciled terminal attempts, **Retry as Draft** first requests the latest checkpoint. If Core returns manual-review-required evidence, T-Line shows that evidence and requires an explicit confirmation warning of possibly completed external effects. The request supplies an acknowledgement bound to the latest observed step sequence. Core rejects stale sequences. No operation is executed by this action; the separate Run confirmation remains mandatory.

A Core without step-observation capability continues to receive only the older draft controls; a Core that advertises it but fails to return execution evidence blocks reviewed retry rather than guessing.

## Technical scope
- Fixed authenticated backend proxy forwards only approved task paths and whitelisted acknowledgement fields. Arbitrary command/tool args are discarded.
- Frontend `AssistantTaskDraftApi` exposes typed sanitized evidence.
- `AssistantTaskDraftPanel` renders its ordered event timeline without raw prompt, input, result or credentials.
- The existing task state machine, draft checkpoint, runtime authority, CAS revision and owner/workspace/session checks remain in effect.
- This does not add general model suspension/resumption, automatic retries or execution replays.

## Release checks
```sh
bun run build:frontend && bun run build:backend
cd frontend && bun --bun x vitest run --config vite.config.ts \
  src/components/__tests__/AssistantTaskDraftPanel.test.tsx \
  src/components/__tests__/AssistantActivityCenter.test.tsx
cd .. && bun --bun x vitest run backend/tests/assistantTaskProxy.test.ts
```

Native Tauri GUI and real provider/tool lifecycle tests remain required for production release; the automated crash case is simulated. Muse is not modified.
