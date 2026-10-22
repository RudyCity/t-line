# T-Line Brain Explorer — Unified Brain Runtime P0–P3 (2026-10-22)

The T-Line Brain Explorer now shares **generated canonical Brain sources** with SuperAgent Core. Changes to storage, streaming, and artifact indexing are authored only in `superagent/src/core/brain/`, then synchronized using `bun scripts/sync-brain-runtime.ts` from SuperAgent. The check mode (`--check`) detects drift. T-Line's compatibility layer (`backend/src/brainRuntimeCompat.ts`) resolves only the `local-cli` owner; it is **not** a gateway into the MCP OAuth principals.

## Workflow
- Open **SuperAgent → Brain** in T-Line.
- Browse sessions, scratch, artifacts and evidence; inspect CLI Bridge delegation snapshots and per-area capacity.
- Search annotated artifacts across your own local Brain sessions; select a result to open its session.
- Add a concise artifact annotation, which becomes searchable and an optional RMemory candidate. It does not automatically write RMemory.
- Import an artifact. Files 5 MiB or smaller use one bounded upload. Larger files use 128 KiB chunks, SHA-256 and a persisted `.transfers/` offset; reselect the same file after a restart to resume. Maximum file size is 20 MiB.
- Publish with 2-stage confirmation to an enabled SuperAgent *and* T-Line registered local project; never overwrites.
- Cleanup only scratch after preview/confirmation. Retention preview (7/30/90 days) is a dry-run.

## Authentication and safety
All Brain routes are under the existing authenticated T-Line `/api/superagent/brain` router. No arbitrary filesystem executor or OAuth tenant lookup is offered. Byte limits, path traversal protections, create-only destinations, transfer fingerprints, quota enforcement and symlink checks come from the synchronized Core module.

Important distinctions:
- T-Line operator authority is separate from OAuth MCP capabilities. Publishing from T-Line checks the intersection of enabled local project registries, not an OAuth project write grant.
- CLI delegated processes still have their host OS privileges; Brain's scratch directory is not a security sandbox.
- Automated retention is intentionally not enabled; deletion always requires explicit confirmation.
- No RMemory write is performed from the T-Line UI. A human can review the memory candidate and explicitly save it with CLI `/brain remember` in the intended project.

## Routes added
- `GET /search?q=<term>` — owner-scoped index search
- `GET /sessions/:sessionId/resume` — file/annotation state for resuming a session
- `POST /sessions/:sessionId/annotate` — explicit index annotation
- `GET /sessions/:sessionId/memory-candidate?path=artifacts%2Fresult.pdf`
- `POST /sessions/:sessionId/transfers` — create resumable upload
- `GET /sessions/:sessionId/transfers/:transferId` — read resume offset
- `POST /sessions/:sessionId/transfers/:transferId/chunk?offset=N` — bounded binary chunk
- `POST /sessions/:sessionId/transfers/:transferId/finish` — verify content and finalize
- `DELETE /sessions/:sessionId/transfers/:transferId` — abort an interrupted transfer

All are appended to `/api/superagent/brain`. Earlier listing, storage, cleanup, publish, import and download routes remain compatible.

## Release acceptance
```sh
# From SuperAgent repository
bun scripts/sync-brain-runtime.ts --check

# From T-Line repository
bun run build:backend
bun run build:frontend
bun --bun x vitest run backend/tests/brainExplorerRoutes.test.ts
cd frontend && bun --bun x vitest run --config vite.config.ts src/components/__tests__/SuperAgentBrainExplorer.test.tsx
```
The current tests include real loopback HTTP tests, filesystem policy assertions and browser component tests. The packaged T-Line desktop and deployed MCP tunnel must still be restarted and smoke-tested with real operator credentials on the target host before a production sign-off.
