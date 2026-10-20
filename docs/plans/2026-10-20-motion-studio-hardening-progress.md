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
