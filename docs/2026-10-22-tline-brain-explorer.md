# T-Line Brain Explorer & Storage Manager (2026-10-22)

## User workflow
In T-Line, open the **SuperAgent** console and click the Brain icon next to the Live Monitor icon. Brain Explorer is scoped to local CLI sessions under `~/.superagent-r/brain/` (not the Git workspace).

- **Browse**: select a session and inspect scratch/, artifacts/, and evidence/. Text preview is capped at 128 KiB.
- **Storage**: view per-area file count and byte usage. Retention preview identifies scratch files last modified more than 7, 30, or 90 days ago, without removing anything.
- **Cleanup**: select a session, click **Preview cleanup**, inspect the file-count/bytes confirmation and confirm. Scratch contents alone are removed. Artifacts, evidence and manifest are preserved. Preview and confirm tokens expire after 60 seconds and cannot be replayed. Cleanup is rejected if persisted AGY/Claude delegation metadata reports an active job for that scratch.
- **Binary artifact import**: select a supported local file using **Import artifact** (PNG/JPG/WEBP/GIF/PDF/ZIP/MP4/WEBM/WAV/MP3/CSV/JSON/TXT), max 5 MiB. Imported files are stored in artifacts/ (total session files cap 50 MiB for this import operation); never overwrite existing files.
- **Download**: selected artifact/evidence files are offered as binary attachments, max 20 MiB, with no content sniffing or inline HTML rendering.
- **Publish**: select an artifacts/ file and a permitted local project, enter a *relative* destination (for example docs/notes.md), preview the exact canonical root and file hash, then confirm explicitly. The destination must not exist and may not be a hidden or symlinked path. Source modifications after the preview invalidate the confirmation. No overwrite is possible.

## Desktop project permission boundary
The desktop publication pathway is an **operator action** protected by T-Line's existing `authMiddleware`, plus an additional 60-second one-time confirmation. Both of these must be true:
1. A local project is enabled and registered by SuperAgent's projects.json.
2. Its canonical root is also a registered local T-Line workspace.

This is a T-Line local-operator permission path, **not** an MCP OAuth grant and it does *not* confer the MCP `write` capability. Existing MCP `superagent_brain_publish` continues to require its independent OAuth/project-scoped policy. T-Line never forwards a user-selected absolute destination root; it resolves and checks the registered root server-side.

## Authenticated API routes
All routes mount under the T-Line backend's existing `/api/superagent/brain` router (after `authMiddleware`).

Read-only:
- `GET /sessions`
- `GET /sessions/:sessionId/files`
- `GET /sessions/:sessionId/file?path=artifacts%2Fnotes.md`
- `GET /sessions/:sessionId/jobs` (committed CLI Bridge metadata; not a liveness proof)
- `GET /sessions/:sessionId/storage`
- `GET /retention/preview?days=30` (7/30/90 only, bounded scan)
- `GET /projects` (intersection of T-Line and SuperAgent approved local projects)
- `GET /sessions/:sessionId/download?path=artifacts%2Ffile.png` (binary attachment only)

User-triggered mutations:
- `POST /sessions/:sessionId/cleanup/prepare` then `POST /sessions/:sessionId/cleanup/confirm` with `{challenge}`.
- `POST /sessions/:sessionId/publish/prepare` with `{projectId,filePath,destinationPath}`, then `POST /sessions/:sessionId/publish/confirm` with `{projectId,challenge}`.
- `POST /sessions/:sessionId/artifacts/import?name=report.pdf` with `Content-Type: application/octet-stream` and raw bounded bytes.

No generic filesystem, shell, URL proxy, arbitrary relative deletion or auto-retention API has been introduced.

## Security properties
- Only the canonical local-cli owner hash is exposed. OAuth and static bearer MCP Brain owners are not visible.
- Session/path input rejects traversal, dot paths, absolute paths, symlinks, unsafe filenames. Upload and publish are create-only. Imports reject hard links, disallowed extensions, over-limit content and storage quota overflow.
- Cleanup is scoped to scratch and invalidates a one-time auth-token-bound challenge on first confirmation attempt. Scratch file metadata must match preview; active delegation snapshots block both prepare and confirm.
- Publish binds the one-time challenge to the caller bearer token, session, selected artifact, canonical project root and destination. Rechecks permissions and SHA256 at confirmation; rejects symlink path and existing target.
- Retention is a dry-run, not an automatic task: **no data is silently deleted**.
- An approved local CLI may still possess broader OS privileges when running; Brain working directories are not container sandboxes.

## Verification
```sh
bun run build:backend
bun run build:frontend
bun --bun x vitest run --environment node backend/tests/brainExplorerRoutes.test.ts
cd frontend && bun --bun x vitest run --config vite.config.ts src/components/__tests__/SuperAgentBrainExplorer.test.tsx
```

## Remaining limitations
- Desktop application restart and live operator smoke test are still required to verify adoption of changed backend+frontend bundles.
- Bulk retention cleanup, remote/SSH project publication, cross-identity MCP Brain browsing, resumable streams above 20 MiB, and workspace task reconciliation beyond persisted snapshots are not implemented.
- The desktop operator publish pathway does not invoke an MCP project write-grant check; use the MCP publication tool if MCP identity capabilities must govern the write.
