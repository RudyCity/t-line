# T-Line Phase 2B-1 — Pre-Execution Checkpoint Visibility

Date: 2026-10-26. Requires the matching SuperAgent Core detached-task checkpoint API.

- Activity Center → Tasks → Checkpoint shows recorded pre-execution gate count, incomplete observations, unverified external interactions and steps missing durable preflight evidence.
- If a previously active task lacks durable history, the UI warns that **no observations ≠ no side effects**.
- The Retry-as-New-Draft flow still fetches scoped Core evidence and confirms the latest sequence when review is required. No previously executed tool or model turn is replayed.
- UI types support three ordered phases: `started`, `prepared`, `finished`.
- Running task execution resumption is **not** implemented. Only Phase 1's paused draft may be returned to a ready draft without execution.
- Existing Core versions that omit the new optional fields remain display-compatible; they do not gain resumable execution capabilities.

Regression:
```sh
bun run build:frontend && bun run build:backend
cd frontend && bun --bun x vitest run --config vite.config.ts \
  src/components/__tests__/AssistantTaskDraftPanel.test.tsx \
  src/components/__tests__/AssistantActivityCenter.test.tsx
```
Native Tauri and real provider crash/restart validation is still required.
