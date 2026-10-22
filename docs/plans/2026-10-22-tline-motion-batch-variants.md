# T-Line Motion P2 — Batch Aspect Variants

Date: 2026-10-22
Status: Implemented and tested; packaged desktop smoke outstanding.

- `MotionBatchVariantsPanel` lets the user choose any subset of 16:9, 1:1, 9:16, then explicitly request new child projects and queued MP4 renders.
- Source Motion project remains untouched and selectable; the editor refreshes its project and job lists after a successful batch request.
- T-Line backend allows POST to `/projects/:id/variants` only after authentication and workspace validation; renderer bearer credentials remain server-side.
- The UI distinguishes queued jobs from completed MP4 files and exposes created project IDs and per-variant errors.
- Tests cover ratio selection, no-op empty selections, queue error display, editor orchestration, and proxy path restrictions.

Remaining production gate: verify live render workers, artifact readiness and resume behavior after packaging Tauri.
