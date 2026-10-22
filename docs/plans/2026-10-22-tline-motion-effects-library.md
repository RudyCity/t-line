# T-Line Motion Studio Phase 3 — Individual Effects Library

Date: 2026-10-22
Status: Implemented, unit/integration tested, production frontend build passed. Live packaged desktop smoke **not** performed.

## Features

- `frontend/src/components/MotionEffectLibrary.tsx`: collapsible, searchable library of up to 224 registered Motion Effects; all seven effect categories.
- Paginates the existing server catalog in 100-item pages, respects workspace scope, and only offers effects applicable to the selected layer kind or the whole scene.
- Builds parameter inputs from trusted server schemas (`number`, `enum`, `color`, `boolean`, `string`), rejecting invalid values before calling the service.
- `Preview` invokes the canonical SuperAgent revision-guarded, read-only compilation endpoint. The returned composition is shown on T-Line's existing MotionCanvas and MotionTimeline while editing is disabled.
- `Apply` invokes the same single-effect engine with optimistic revision locking; T-Line captures the previous composition for its existing Undo/Redo transaction system.
- Stale preview results are discarded on changed effect selection, category, parameters, target layer, project revision or workspace unmount. User-provided code/scripts and arbitrary effect identifiers are not executed.
- The previously implemented 16 compound presets remain available separately; single effects and compound presets share the authoritative Motion project model and native T-Line editor.

## Authenticated, workspace-scoped API

```http
GET /api/superagent/motion/effects?limit=100&offset=0&workspace=<encoded-workspace>
GET /api/superagent/motion/effects?limit=100&offset=100&workspace=<encoded-workspace>
POST /api/superagent/motion/projects/motion-<id>/effects/preview?workspace=<encoded-workspace>
POST /api/superagent/motion/projects/motion-<id>/effects?workspace=<encoded-workspace>
Content-Type: application/json

{
  "effectId": "entrance-slide-left",
  "targetLayerId": "title",
  "params": {},
  "startFrame": 0,
  "durationFrames": 75,
  "baseRevision": 1
}
```

The T-Line backend `motionProxy.ts` forwards **only** the safe, documented GET /effects filters `limit`, `offset`, `category`, `q`, `targetKind`, `tag`; it preserves server-held SuperAgent credentials and rejects malformed/duplicated filters. It does not forward arbitrary client-supplied query parameters. A scene-targeted effect may omit `targetLayerId`.

## Verification

- SuperAgent: `bun x vitest run motion --maxWorkers=2` — **160/160 tests**, 29 files; Bun build passed.
- T-Line frontend: `MotionEffectLibrary.test.tsx` (3), `MotionPresetPanel.test.tsx` (3), `MotionStudioTab.test.tsx` (21): **27/27 tests** passing with explicit 15-second test timeout under parallel load.
- T-Line backend: `motionProxy.test.ts` including pagination forwarding, rejected duplicate filters, authenticated scene/effects access; TypeScript passed.
- T-Line frontend `bun run build`: passed (pre-existing chunk-size warnings).
- Cross-process/packaged Tauri startup smoke remains outstanding; no running SuperAgent or desktop process was restarted. Do not claim production deployment certification.

## Known limits / next gates

- Effects compile to built-in keyframe/layer primitives; WebGL shader particle effects and nondestructive draggable effect stack are outside this phase.
- The 224 effects have distinct full-scene composition regression coverage in SuperAgent. A color-accurate pixel snapshot for every effect on every graphics/backend driver has **not** been certified.
- When the live SuperAgent process reloads, recheck service capabilities, authorization and workspace path forwarding, project revisions, preview frame parity, and actual MP4 export from the installed Tauri app.
