# T-Line — native Studio migration

Date: 2026-10-22

## Migration

- Canonical display: **SuperAgent Studio**.
- Canonical native editor: `StudioTab.tsx` and `Studio*` panel/utility modules, with `studioApi` client in `frontend/src/services/studioApi.ts`.
- Canonical T-Line API proxy: `/api/superagent/studio`, sending authorized workspace-scoped requests to upstream `/api/studio`.
- Existing `/api/superagent/motion` is retained as an authenticated legacy alias, forwarded to `/api/motion` upstream; original project/job IDs remain routable.
- Tab type `studio`, tab ID `studio-*`. On loading `tline-tabs-v2`, stored `type: 'motion'` is upgraded in-memory to `studio` without changing its persisted tab ID or workspace assignment.
- Source and test filenames prefixed `motion*` or `Motion*` within T-Line were renamed to `studio*`/`Studio*`, and imports/exports updated. Motion fields that describe actual animation motion and old persisted IDs are deliberately accepted.
- Canonical release tooling: `studio:release-check`, `studio:release-gate`, `scripts/check-studio-release.cjs` and `scripts/check-studio-installer-snapshot.cjs`.

## Deployment and caveats

- Running processes and packaged installers built prior to the migration still serve the old frontend/backend; they need a coordinated update. This task does not restart active user services.
- Old project data is **not automatically renamed**. Use the guarded `superagent studio migrate` CLI in a maintenance window, only after complete backup.
- Do not treat the old NSIS package as a tested Studio release. The installer must be rebuilt and verified on the *new Studio source version* and tested in WebView2.
- Third-party library/media licenses remain separate from the original Studio template policy.

## Testing

- `cd frontend && bun x vitest run src/components/__tests__/Studio*.test.tsx src/services/__tests__/studio*.test.ts`
- `cd backend && bun x vitest run tests/studioProxy.test.ts tests/studioWorkspaceAccess.test.ts`
- `bun test tests/studioInstallerSnapshot.test.cjs scripts/studio-release.test.cjs`
- `bun run build:frontend && bun run build:backend`
