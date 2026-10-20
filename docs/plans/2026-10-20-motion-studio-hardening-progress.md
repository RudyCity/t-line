# Motion Studio T-Line Hardening Progress

Date: 2026-10-20
Status: Developer preview; not production certified.

## Scope implemented

- Authenticated backend Motion proxy now restricts requests to exact, existing local paths registered in T-Line, instead of accepting arbitrary browser-supplied workspace paths.
- The proxy performs a server-only bearer-authenticated trust handshake against SuperAgent's existing trusted-directory endpoint. SuperAgent independently checks trusted roots and canonical paths; the client never receives the service credential.
- Motion Studio native editor supports creating text or rectangle layers, removing them, reordering them, and applying a bounded local Undo/Redo stack. Each edit is persisted through the SuperAgent revision-checked transaction API; Undo/Redo also increments the scene revision instead of reverting the server silently.
- Tests exercise accepted/rejected workspaces, the authenticated trust handshake, rejection of invalid upstream authorization, layer insertion/Undo, and existing scene editing/render operations.

## Verification

- T-Line frontend: 37 tests passed across nine suites.
- T-Line backend Motion proxy + workspace authorization: six tests passed.
- Frontend and backend TypeScript checks passed.
- SuperAgent Motion counterpart: eight suites / 27 tests passed, including canonical workspace containment and SVG/Canvas geometry parity.
- The live Tauri Desktop to updated SuperAgent Motion API flow was not tested: an active SuperAgent/Hermes process was not restarted.

## Outstanding release gates

1. Coordinated restart and live authenticated T-Line to SuperAgent smoke with real trusted workspace, create/edit/render and HEAD/Range video access.
2. Production packaging checks on Windows and Linux, including native Canvas and FFmpeg/FFprobe presence.
3. Crash-safe autonomous render scheduling, PID identity ownership and bounded concurrency (the current recovery is explicit/manual).
4. Audio, image/media assets, richer multi-scene compositions, direct drag editing and packaged Tauri interaction tests.
5. Text/font visual parity across frontend preview and FFmpeg export, and true long-form authenticated streaming above the current 64 MB editor blob cap.

Avoid staging or overwriting unrelated T-Line CLI parity, Hermes, MCP OAuth or concurrent changelog/version changes when committing this increment.

## Bounded Render Scheduler UI (2026-10-20)

- The T-Line Motion proxy now allows the read-only, authenticated `/api/motion/scheduler` endpoint, after the same local workspace-registration and trusted-directory checks.
- Native Motion Studio displays workspace queue occupancy and the number of claimed render slots. The service reports a default two concurrent renders (configurable 1–4) and a pending queue capacity of twelve.
- UI polling reuses existing job activity refresh; older SuperAgent versions without the endpoint continue to work without scheduler metadata.
- Motion frontend and backend proxy tests cover scheduler read access and the visible capacity display. The SuperAgent scheduler suite tests contention, waiting-job cancellation, queue saturation and refusal to steal a worker's slot.
- This is a developer preview: there is no automatic lock recovery, restart-resilient FIFO broker or real Tauri end-to-end verification yet. Do not restart Hermes workers without coordination.

## Native Canvas Direct Manipulation (2026-10-20)

- Replaced static SVG scene drawing with a dedicated `MotionCanvas` React component and pure coordinate/transform utilities. This is a workspace-bound, declarative canvas: scene text is never executed as HTML, and the editor shares the existing server revision guard.
- Pointer-captured gestures now support dragging text/rectangle layer positions, rotation handles, and bottom-right resize handles for non-rotated rectangles. Layer values update in the preview during the gesture and are saved as a *single* edit transaction when the pointer is released. Cancel/lost capture, changed scene revision/frame, changed selection, busy editor and inactive tab all avoid saving stale gestures.
- A visible Snap 10px switch controls grid snapping, center-line alignment guides and 15-degree rotation snapping. Canvas math converts client coordinates to composition units and clamps values to server schema bounds.
- Dragging a property already animated by a timeline track creates/updates the current-frame keyframe rather than silently discarding animation. Unanimated positions/rotation use `set-property`; rectangle dimensions use guarded `replace-composition`, preserving the undo/redo stack.
- The focusable canvas supports arrow-key nudge (Shift for larger steps), Alt+left/right rotation and Ctrl+arrows rectangle sizing. Both pointer and keyboard operations are covered by dedicated React/Vitest tests.
- Validation: 54/54 frontend regression tests passed across 12 suites, backend/frontend TypeScript checks and the Vite production build passed. Warnings remain in the pre-existing CSS minification/bundle-size pipeline.
- **Remaining:** native Tauri real-device smoke, rich text/font parity, resize handles for rotated/text objects, asset/audio layers, multi-scene editing, zoom/pan and more advanced transform affordances. This does not declare production readiness.

## Zoom and Pan Canvas Navigation (2026-10-20)

- Added bounded 25–400% zoom, cursor-anchored mouse wheel scaling, fit/reset and explicit Pan mode or middle-button viewport dragging in T-Line native Motion Studio.
- Viewport state is local to the editor, resets when switching projects/workspaces and never alters the authoritative project revision. SVG hit testing uses the actual transformed canvas rectangle so pointer drag remains consistent at variable zoom.
- Pure viewport math and editor interaction tests included; frontend 58/58, both TypeScript checks, and Vite production bundle pass.
- Real packaged Tauri interactions, audio/media tools, and advanced rotated-object sizing remain unverified.

## Rotated Rectangle Resize (2026-10-20)

- T-Line native Motion Canvas now exposes a resize handle at the transformed bottom-right world position for rotated rectangles, including 90-degree and arbitrary-angle rotations.
- Drag deltas are projected into the rectangle's rotated local axes; width/height and x/y update so the opposite world-space corner remains anchored. Snapping applies to local dimensions rather than screen axes.
- Existing revision-guarded `replace-composition` transactions include active-frame keyframe updates for animated x/y tracks, preserving position animation and Undo/Redo semantics.
- Tested seven rotation values, browser pointer resize, and preservation of animated position tracks. Frontend 68/68 tests, frontend/backend TypeScript checks, and Vite production build passed.
- Live Tauri desktop E2E, image/audio/video ingestion, and text/font visual parity remain outstanding; no Hermes process was restarted.

## Interactive Keyframe Timeline (2026-10-20)

- Added `MotionTimeline.tsx` with separate lanes per animated layer property, selectable keyframe markers, drag-to-retime interactions and editing controls for exact frame position, outgoing segment easing (`linear`, `step`, `easeInOut`) and keyframe deletion.
- Added `motionTimelineEdits.ts` pure, schema-compatible operations. Frame collisions, fractional or out-of-range frames and missing tracks are rejected. Preserves existing keyframe values/easing, immutable sorting and current scene revision.
- Deletion of the final keyframe removes its entire track through revision-guarded composition replacement; ordinary changes use `set-track`. T-Line's existing optimistic revision workflow and local Undo/Redo handle both.
- Added isolated, cancellation/revision and frontend-to-API integration tests. Live Tauri verification and cross-process persistence under real SuperAgent sessions remain pending.


## Native Motion Image Import (2026-10-20)

- T-Line Motion Studio now includes an `Import image` control accepting local PNG/JPEG/WebP files (up to 1 MB). The browser sends the encoded file to its authenticated T-Line backend; the server-only proxy forwards it after registered-workspace and trusted-directory checks. Raw operating-system paths and SuperAgent credentials never enter the scene.
- The upload returns an immutable workspace-owned PNG asset ID, used in a revision-checked `add-layer` edit. The editor centers the image, exposes it as a selectable layer with existing positioning/opacity/rotation tracks and preserves the scene's undo/redo history.
- The canvas obtains authenticated PNG bytes and exposes only short-lived Blob URLs to SVG `image` elements. URLs are revoked on project/workspace/revision change, unmount, and late responses. There are no external image URLs.
- T-Line backend Motion proxy allowlists image POST and id-bound GET/HEAD; JSON upload cap is 1.6 MB to accommodate base64 for a 1 MB source. Tests cover auth routing, signed URLs not leaking service credentials, preview type/size checks and revision-checked image insertion.
- Still pending: asset library browsing/cleanup, large image import, audio/video media layers, crop/masks, native Tauri E2E, and full preview/export font parity. Version/changelog files are owned by a concurrent T-Line change and intentionally excluded from this Motion-only commit.


## Authenticated Native Audio Track (2026-10-20)

- Added `MotionAudioPanel` to T-Line with authenticated local WAV import/replace, start-frame and volume fields, revision-checked Save/Remove, and an optional Blob-backed WAV player. The player previews the source clip, not a live mixed timeline; final AAC timing is applied at render.
- Browser uploads only the WAV payload, not an OS file path. Backend Motion proxy explicitly allowlists `/audio` POST (3 MB bounded JSON) and hash-ID GET/HEAD, and carries a server-only SuperAgent token behind registered local-workspace enforcement. Browser access uses the T-Line auth token and temporary object URLs which are revoked on project/workspace change.
- Schema v1 now supports one `composition.audio` (assetId, startFrame, volume) entry alongside visual layers. T-Line Undo/Redo uses the existing `set-audio` revisioned edit transaction; missing/malformed/foreign audio fails closed.
- Tested audio UI, editor revision integration, authenticated client transport and proxy, plus SuperAgent real H.264 + AAC rendering. T-Line frontend 94/94 tests, backend proxy tests and Vite production build passed, with existing CSS/chunk warnings.
- Remaining: multiple clips, MP3/FLAC ingest, mixer, waveform/timeline A/V preview sync, packaged desktop E2E. Concurrent T-Line release files are intentionally not touched by this Motion-only increment.

## Multi-track WAV Mixer UI (2026-10-20)

- Native Motion Studio now supports four individually editable audio clips with frame start offset, gain, fade-in and fade-out frame controls, independent WAV Blob previews, per-clip Save/Remove and bounded Add WAV.
- New audio imports append to existing `composition.audioTracks`, migrating legacy `composition.audio` through one revision-checked `set-audio-tracks` update. Individual changes preserve other clips. Undo/Redo of composition snapshots continues to operate against server-validated audio references.
- Verified isolation of clip 2, invalid frame values, fifth-clip guard and native Motion Studio import, alongside an actual two-clip H.264+AAC render and backward-compatible single-clip engine.
- Remaining: waveform UI, synced mixed-audio playback while scrubbing, audio mastering and mobile/native packaged Tauri smoke. Current per-clip preview plays source WAV in isolation.

## Waveform and Frame-Synchronized Audio Preview (2026-10-20)

- SuperAgent adds hash-validated PCM16 waveform envelope lookup, returning only 96 bounded numeric peak values over workspace-gated HTTP. T-Line explicitly allowlists this GET route through its authenticated service-token proxy.
- The T-Line mixer visualizes each clip in declarative SVG with a timeline-relative playhead. Clicking its waveform stops playback and seeks to the corresponding project frame; source WAV players remain separate from timeline audio players.
- Timeline audio previews use the current frame for per-clip start offsets, gain, fade in and fade out. A monotonic elapsed-time visual clock reduces frame drift. Browser volume above 1 and WebView autoplay restrictions mean live audio is best effort, not identical to AAC render output.
- Tests cover envelope bounds, scope/auth protection, waveform seek, individual clip timing/gain/pause, rational playback clock, full frontend and proxy suites, and Vite production build.
- Remaining: packaged Tauri end-to-end A/V synchronization, Web Audio mixing with sample-accurate timing, audio metering, longer PCM tracks, mastering and visual export parity.
