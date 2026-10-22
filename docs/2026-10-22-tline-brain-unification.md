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

## Phase 5: Multi-agent Brain dashboard
Brain Explorer now includes a **Multi-agent tasks** panel. Local CLI sessions can create owner-scoped tasks, list logical agent members, claim a task exclusively, checkpoint current findings, explicitly hand off a finalized artifact to a permitted collaborator's isolated scratch inbox, transfer ownership and mark work complete. Persistent task metadata supports resume after reconnect without reading the full conversation.

Task API routes under `/sessions/:sessionId/tasks` support listing, create, inspect, resume, claim, checkpoint, handoff, transfer and status updates. T-Line uses the canonical generated `brainTasks.ts` module from SuperAgent Core; `brain-runtime-manifest.json` is checked by CI.

Task membership IDs are **not OAuth identities**. T-Line only displays the local-cli owner's tasks; separate OAuth principals remain isolated. The panel does not automatically execute another agent or grant new project write permissions.

### Nested task scratch and live status hardening (2026-10-22)
- Job listing accepts persisted CLI Bridge cwd values inside the owner session's scratch subtree, including `scratch/agents/<agent>/<task>/`; sibling paths are rejected using canonical segment boundaries.
- Cleanup refuses to delete scratch while a nested AGY/Claude delegation is active, using the synchronized SuperAgent Core storage implementation.
- Running tasks refresh sanitized delegation statuses approximately every 12 seconds. A missing snapshot is displayed as unavailable rather than inferred to be successful.
- MCP remote task mutations require one-time-issued agent capabilities; the trusted T-Line operator is separately authenticated and acts only within the `local-cli` owner namespace.
- Additional regressions cover nested active-job listing, denied cleanup, and non-matching sibling paths.

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

## Observability and release gates
- `GET /api/superagent/brain/metrics` returns a 7-day local-cli summary of allowlisted operation names, successes/failures and bounded durations. It does not expose user prompts, token strings, artifact paths or the identities of other MCP tenants.
- Brain Explorer shows an **Activity** summary with the most frequent operation types and average durations. The numbers reflect observed backend operations, not inferred filesystem work.
- T-Line release workflows now run `bun scripts/check-brain-runtime.cjs`, the Brain backend API tests, and the Brain UI tests before packaging the desktop. The independent `brain-integrity.yml` workflow runs on relevant pushes and pull requests.
- Local verification: `bun scripts/check-brain-runtime.cjs` and `bun scripts/verify-brain-release.ts --with-tline` (from the SuperAgent sibling repository).
- No packaged desktop process was available for a real user interaction acceptance test at the time of integration. CI configuration added to source is not evidence that remote GitHub Actions have executed successfully.
