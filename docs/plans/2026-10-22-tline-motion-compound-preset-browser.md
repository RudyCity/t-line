# T-Line Motion Studio — Compound Preset Browser

Date: 2026-10-22
Status: Implemented and build-tested in T-Line source; live packaged Tauri E2E and server restart are not verified.

## Features

- `frontend/src/components/MotionPresetPanel.tsx`: compact, responsive preset browser with local search and accessible native select for 16 curated compound recipes.
- Selected text layers accept integer start frame, duration (12–420 frames and within the composition), and intensity (0.25–2).
- **Preview** sends one authenticated `POST /api/superagent/motion/projects/:id/presets/preview` via the T-Line backend; SuperAgent compiles and returns an uncommitted project revision. The editor displays this preview in the actual MotionCanvas and read-only MotionTimeline for scrubbing/playback. It does not write to disk.
- **Apply** sends `POST /api/superagent/motion/projects/:id/presets` with the current project revision and selected text layer. It uses the canonical SuperAgent revision-checked transaction; T-Line caches the original composition in its existing undo history. Undo uses a new revision transaction with replace-composition.
- Preview invalidates on parameter changes, target-layer changes, project/revision changes, and component teardown; stale asynchronous preview results are ignored.
- The backend motion proxy exposes narrowly enumerated read-only catalog routes and POST project routes. It keeps workspace registration, server-only bearer credentials and method allowlisting. Unknown paths, unauthorized workspaces, and unexpected GET/POST combinations are still denied.
- Older SuperAgent servers that lack the `compoundPresets` capability retain the existing editor without showing an unusable browser.

## API contract

```http
GET /api/superagent/motion/presets?workspace=<encoded-local-workspace>
GET /api/superagent/motion/presets/neon-impact?workspace=<encoded-local-workspace>

POST /api/superagent/motion/projects/motion-<id>/presets/preview?workspace=<encoded-local-workspace>
POST /api/superagent/motion/projects/motion-<id>/presets?workspace=<encoded-local-workspace>
Content-Type: application/json

{"baseRevision":1,"presetId":"neon-impact","targetLayerId":"title","startFrame":0,"durationFrames":75,"intensity":1}
```

Do **not** put bearer tokens in URLs. The browser authenticates against T-Line; the backend forwards only the server-held SuperAgent service token after verifying the selected workspace.

## Validation

- T-Line frontend TypeScript: pass.
- T-Line backend TypeScript: pass.
- T-Line Vite production build: pass; existing large-bundle warning remains.
- `MotionPresetPanel.test.tsx`: 3/3 tests.
- `MotionStudioTab.test.tsx`: 20/20 tests, including preview → apply → revision-guarded undo.
- Backend `motionProxy.test.ts` and `motionWorkspaceAccess.test.ts`: 6/6 tests.
- SuperAgent `bun x vitest run motion --maxWorkers=2`: 159/159 across 29 files, including new uncommitted preview endpoint.
- SuperAgent Bun/TypeScript build: pass.

## Release limitations

1. Running SuperAgent and T-Line services must be restarted **in a coordinated maintenance window** to load the new API/proxy and capability. No active Hermes/SuperAgent sessions are restarted by this change.
2. A packaged Tauri WebView2 smoke test against a freshly restarted, authenticated SuperAgent service is still needed; unit integration tests are not a replacement for this release gate.
3. Preview supports deterministic SVG/Canvas frame scrubbing, not shader-powered realtime WebGL playback or advanced GPU particles.
4. Presets are applied as baked track changes; a fully nondestructive stack with independent per-effect phase-edit handles is future work.
5. The preview applies to supported text layers only. Other layer types are disabled in the editor rather than silently ignored.
