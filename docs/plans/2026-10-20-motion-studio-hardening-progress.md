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
