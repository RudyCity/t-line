# T-Line Brain Explorer (2026-10-22)

## User workflow
Open a SuperAgent console tab in T-Line, then click the **Brain** icon beside the Live Monitor toggle. The Brain Explorer drawer lets you select a local session and inspect `scratch/`, `artifacts/`, and `evidence/` files. Text previews are read-only (128 KiB maximum). The drawer does not change the active project or Git worktree.

The delegation section shows the most recent **persisted CLI Bridge job snapshot** for each job whose canonical cwd exactly matches that session's scratch. It is not a live liveness check; no task controls, deletion, or shell execution are exposed.

## API
The T-Line backend mounts these GET-only routes under the existing authenticated `/api/superagent` router:
- `/api/superagent/brain/sessions`
- `/api/superagent/brain/sessions/:sessionId/files`
- `/api/superagent/brain/sessions/:sessionId/file?path=artifacts%2Freport.md`
- `/api/superagent/brain/sessions/:sessionId/jobs`

All four endpoints are read-only and source files are not served as arbitrary downloads.

## Security boundary
- Backend resolves only the owner namespace `sha256("local-cli").slice(0, 24)` inside `~/.superagent-r/brain/`, mirroring SuperAgent's local CLI Brain owner hash. **OAuth and MCP bearer identities are not exposed** by T-Line; extending access to those requires authenticated principal delegation.
- Session IDs and relative file paths are strictly validated. Parent traversal, absolute paths, hidden files, symlink components, oversized/binary previews, and foreign session manifests are denied.
- Delegation metadata is read from immutable `cli-bridge/delegations/jobs.d` snapshots. Only jobs whose cwd canonicalizes to the chosen session's scratch are shown. Prompts, environment variables, log paths and output tails never leave the backend.
- A valid T-Line login token is required by the existing `authMiddleware` mounted before the Brain Explorer router. The frontend only sends its normal session Authorization header.

## Verification
```sh
bun run build:backend
bun run build:frontend
bun --bun x vitest run --environment node backend/tests/brainExplorerRoutes.test.ts
cd frontend && bun --bun x vitest run --config vite.config.ts src/components/__tests__/SuperAgentBrainExplorer.test.tsx
```

## Known limits
- Brain Explorer currently provides read-only visibility, not editing/publishing/cleanup controls.
- Only local CLI-owned Brain sessions are shown; remote MCP sessions require a separately authorized identity pathway.
- Job statuses are persisted snapshots, not proof of active running processes.
- Desktop runtime smoke testing after app restart is still required; passing tests and builds do not prove the running desktop binary has picked up updated code.
