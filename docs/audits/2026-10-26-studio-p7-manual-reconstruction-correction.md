# Studio P7 — Manual Correction for Video-to-Code Reconstructed Layers
Date: 2026-10-26
Status: Developer preview; T-Line UI and existing workspace-authorized edit API.

## Implemented

Studio's Video → Editable Studio Code screen now offers an **opt-in manual keyframe correction panel** after a successful vector reconstruction. The panel loads the newly created Studio project from the authenticated workspace, lists only reconstructed path layers (reconstructed-object-1 through reconstructed-object-4), and allows explicit edits to x, y, scaleX, scaleY, and rotation at a user-selected frame.

- The initial editing frame is suggested from the lowest-IoU additional timeline QA sample (when available), but users choose any valid frame and layer. This suggestion is not a claim of model certainty.
- The correction helper builds a **single set-track** edit, preserves every other animation track and untouched keyframes/easing, and inserts the new keyframe in ascending timeline order. A new property track begins at the current base value so later corrections do not unexpectedly change the frame-zero scene.
- Numeric limits are enforced locally: finite numbers, in-range frame index, bounded x/y relative to canvas, scale 0.25–4.0, rotation -180° to +180°. Server-side Studio validation remains authoritative. No raw source video, local file path or token is added to the edit payload.
- Saving uses the existing `POST /api/studio/projects/:id/edits` with `baseRevision`. Conflicts explicitly require **Reload project**; no automatic overwrite. The parent Studio editor updates its project, selection, frame, and revision, and preserves a local undo snapshot when available.
- In-flight requests from a previous workspace/project are discarded if the view switches, instead of updating the newly selected workspace.
- Reconstruction that *fails P6 occlusion/identity validation* still refuses to create a misleading Studio project. This correction panel edits only successfully reconstructed vector scenes; it is **not** hidden-object recovery, identity inference across occlusion or automatic restoration of occluded source pixels.

## Validation

- Typed frontend builder and dedicated React UI tests verify saving a keyframe and reacting to revision conflict/reload, while helper unit tests check preserving source tracks/easing, inserting missing base keyframes, and rejecting bad inputs.
- An actual private Studio HTTP integration test runs encoded MP4 → tracked Studio project → revision-checked set-track edit → verify updated project revision → attempt stale edit → verify revision not overwritten.
- Full Studio/Motion backend and T-Line frontend tests and builds are rerun before commit. This feature adds no new server write endpoint, tokens, or access-control surface.

## Follow-up gaps

- P6 transient occlusion is still *detected and rejected*, not reconstructed. Supporting manual rescue for a rejected clip requires a separate evidence-first workflow with retained reference frame previews and explicit user-approved track associations; do not turn off P6 fail-closed gates.
- Installed Tauri WebView2 click-through, complex real-source video validation, timeline in-app visual annotation, and updated NSIS release package remain unverified.
