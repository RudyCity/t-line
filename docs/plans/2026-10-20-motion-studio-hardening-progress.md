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

## Motion storage diagnostics, safe retention and selectable Full HD (2026-10-21)

- Native Motion Studio now calls authenticated, workspace-scoped GET /api/superagent/motion/storage, proxied read-only to SuperAgent GET /api/motion/storage using T-Line's existing server-only token and workspace policy. POST access is rejected.
- Header displays total render jobs, metadata-reported completed-video disk usage, and old cleanup candidate count. The view gracefully degrades against older SuperAgent servers without the storage endpoint.
- An explicit render width selector offers **640px preview, 1280px HD, and 1920px Full HD** while preserving the existing revision-pinned job render path. This is a width preset, not 4K or arbitrary timeline video support.
- React Motion Studio component tests and backend proxy tests validate UI and authorization behavior. Backend/frontend TypeScript and production Vite bundle builds pass with existing CSS/chunk warnings.
- Underlying engine retains a 1,800-frame cap. Larger render output may exceed T-Line preview's existing 64 MB in-memory blob limit; streaming/download without materializing the entire video remains a separate workflow.
- No packaged/installed Tauri live end-to-end run has been performed. Older SuperAgent servers will return 404 for storage reads; the T-Line UI handles this without blocking editing.

## Read-only queued render recovery diagnostics (2026-10-21)

- The native editor now reads a separate authenticated GET /api/superagent/motion/queue-recovery endpoint through the T-Line server-only SuperAgent bearer proxy. Arbitrary methods and unregistered workspaces remain blocked; POST to the recovery route is not allowed.
- The Motion header presents eligible and blocked persisted queue counts when nonzero. The existing Refresh action now refreshes render jobs, scheduler status, storage and queued-job recovery together.
- This is intentionally inspection-only. Operators can use SuperAgent motion queue-recovery and motion dispatch-queue --apply from CLI after verifying any active process identity; the T-Line browser must not issue remote worker starts or lock deletion.
- Older SuperAgent daemon versions may not implement this endpoint; the UI treats this optional request as unavailable and preserves regular scene editing without a warning cascade.
- Source-level React/Express tests validate the summary UI, authentication policy and HTTP method boundaries; packaged live Tauri E2E is still a separate release gate.

## Opt-in SuperAgent FIFO render supervisor (2026-10-21)

- T-Line Motion Studio preserves the default immediate render behavior and adds a separate FIFO checkbox for queue-only render requests. The scene revision and selected 640/1280/1920 output width stay pinned by SuperAgent.
- With FIFO checked, the authenticated server-side Motion proxy forwards supervised=true in the existing render request. The job is saved without automatically spawning a worker and needs a separately running SuperAgent motion supervisor --watch process (or explicitly invoked --once cycle).
- An additional read-only authenticated GET /api/superagent/motion/supervisor proxy exposes queued supervised count and unverified leader claim; POST and unauthorized workspace paths are rejected. The UI neither starts/stops the supervisor nor tries to steal a stale leader lease.
- Older SuperAgent builds without the supervisor endpoint safely fall back to immediate-only editing because the FIFO checkbox is disabled until capabilities can be read.
- Motion component, proxy and TypeScript tests cover the opt-in transport/status. Packaged Tauri live verification and crash recovery of active encoders remain separate release gates.

## AI Motion Director prompt-first vertical slice (2026-10-21)

- Added an always-visible natural-language prompt input in MotionStudioTab. Without a selected project it creates a new editable Motion project through SuperAgent; with a selected project it requests bounded semantic revisions through the configured SuperAgent AI model. User does not need a Motion ID, JSON editor, FFmpeg command or separate FIFO supervisor.
- The existing 640/1280/1920px selection controls the immediate detached MP4 render profile for both generate/revise workflows. The scene/timeline/manual editor, job progress and authenticated preview remain available.
- Added authenticated client generate/revise calls and narrow server-only POST proxy allowlist. The proxy retains trusted workspace checks and never forwards desktop user credentials to SuperAgent; service authorization is server-only. AI planner calls have a 120s upstream timeout (SuperAgent provider timeout 90s).
- Added a read-only capability handshake to detect updated SuperAgent servers. When the connected daemon lacks aiPromptDirector support, the AI generate control is disabled with an explanatory message while the manual editor continues functioning.
- Added UI, API-client and backend-proxy tests covering prompt-to-generation, semantic revision, authenticated workspace routing, invalid project paths, unsupported old servers and disabled controls.
- Developer-preview scope is limited to short editable text/shape animations. Real configured-model quality, packaged Tauri end-to-end, persisted prompt history, visual quality assessment, audio/TTS/music and video footage generation remain future release gates. No active SuperAgent daemon or unrelated session was restarted.

## Phase B1 — Motion creative presets and deterministic design QA (2026-10-21)

T-Line Motion Studio now reads SuperAgent Motion Director's deterministic quality report through an authenticated, read-only workspace-scoped GET route: /projects/MOTION_ID/quality. The report is refreshed on project/revision changes and displayed as an expandable Quality checks section next to the AI prompt interface. It distinguishes structural pass/fail from warnings and shows which scene is affected by text overflow, low contrast, or invisible titles. The report explicitly says frame sampling, not AI vision review. On older SuperAgent servers without a quality endpoint, the UI omits the report safely without disrupting editing.

The backend proxy allowlist permits only GET for quality and continues to deny POST/foreign workspace. Client types now include MotionQualityIssue/Report and an optional quality field on generated results. Frontend UI and service tests cover the quality display and authorized endpoint. The SuperAgent engine has new allowlisted AI motion presets slide-left, slide-up, tilt, fade and scene transitions cut/crossfade; all animations remain in the existing editable declarative Motion v1 schema.

This is not yet a professional visual reviewer or automated media/music generation. Real connected provider and packaged Tauri end-to-end qualification remain outstanding.

## Phase B2 — User-uploaded prompt media in T-Line Motion Studio (2026-10-21)

Users can now attach a workspace image/logo and PCM16 WAV file next to the Motion Director prompt, before any Motion scene exists. Existing authenticated T-Line proxy upload endpoints validate media format, file bytes and selected workspace; the browser passes only immutable hash IDs through the prompt generation/revision requests and never accesses the host filesystem or forwards service credentials. The UI shows filename/length and supports remove/re-attach, audio gain selection, and automatically clears successful prompt attachments. Failed requests retain attachments for retry.

The feature is gated on SuperAgent reporting aiWorkspaceMedia=uploaded-image-wav. Older connected daemons continue to show the manual Motion editor and may support prompt text, but cannot silently drop attached media IDs from unsupported endpoints. Workspace changes reset staged media; in-flight upload completion is ignored if the workspace/session has changed.

The revised Motion Studio client supports an optional media object for prompt generation/revision and forwards it only inside workspace-authenticated JSON body. Frontend unit tests cover actual upload control actions, attached ID/gain propagation, cleanup after success, and older-server feature gating. Existing backend proxy endpoints for image, WAV, generate and revise continue to require authorized workspaces. This supports user-supplied media only; it is not TTS, music generation, remote stock search or auto soundtrack looping.

## Phase B3 — Multi-scene images, audio looping, optional Piper narration (2026-10-21)

The T-Line AI prompt panel now accepts up to three user-uploaded images when SuperAgent reports aiSceneImagesMax >= 3; it shows the order of each product image, lets users remove/reorder by removing and reuploading, and forwards their verified asset IDs in sceneImageAssetIds without leaking paths or bytes to the LLM. If a single image is selected, T-Line retains the legacy imageAssetId behavior for backwards compatibility. Capability negotiation prevents unsupported older SuperAgent servers from silently dropping multiple images.

Soundtrack attachments expose a Loop WAV to video end checkbox when aiAudioLoop=true. The manual WAV mixer also supports saving an optional loop flag as part of the normal revision-guarded set-audio-tracks operation. Browser audio playback uses source-time modulo and respects the project's final fade, matching FFmpeg's bounded WAV repetition and AAC MP4 export. No changes to T-Line workspace authentication, render IDs, project concurrency or queue/supervisor mode.

An additional narration field and gain control appear only when the connected SuperAgent reports localVoiceoverConfigured=true. Narration uses operator-managed offline Piper with no browser access to executable or model paths. On old servers or without Piper, those controls are hidden, preserving the manual editor and existing WAV upload. This is operator-provided local TTS, not an unrestricted cloud API.

Frontend tests cover three image uploads and ID ordering, looping prompt WAV forwarding, optional narration and gain, browser playback loop timing, mixer edit persistence, and old-server fallback. Remaining: actual packaged Tauri E2E, live AI model/Piper voice synthesis certification, frame screenshot QA, per-scene speech script/timing and licensed music selection.

## B4–F capability increment and outstanding release gates — 2026-10-21

T-Line Motion Studio now feature-negotiates 16:9/1:1/9:16 Director aspect ratios, optional scene-derived Piper narration (only when local Piper is available), an authenticated, on-demand, rendered-frame PNG visual review for up to three scene midpoints, and the extended easeOutBack motion timing curve in the keyframe editor. Snapshots come from the same Canvas renderer used by SuperAgent FFmpeg export; browser preview uses short-lived blob URLs, authenticated workspace routing and explicit revocation across project changes. The motion proxy accepts only scoped GET snapshot endpoints, rejecting POST, HEAD and unregistered/foreign workspaces. SuperAgent added role-tagged music/voice tracks for sidechain ducking in AAC MP4 exports.

This is **not** a full autonomous vision-review agent. Project canvas remains declarative and does not yet ingest footage/video assets, generate stock content, support motion paths or auto-repair aesthetic issues. The T-Line full installed Tauri/Windows WebView2 app, live AI/Piper provider and end-to-end transport have not been reloaded or certified. Build and targeted regression tests prove source-level functionality only. Remaining production gates: packaged desktop smoke, dependency/font parity, security review of renderer media isolation, fault-injection render recovery, licensed asset sourcing, benchmark and user acceptance.

## Opt-in visual AI QA, bounded one-pass repair, SubRip export and editable rounded shapes (2026-10-21)

The native T-Line Motion editor now capability-negotiates sampledModelVisionReview, boundedModelVisionRepair and exportSceneCaptionsSrt. The user can explicitly request a real multimodal model review of up to three rendered PNG scene midpoints, read bounded issues, and stage any suggested revision in the prompt without executing untrusted AI output. A separate explicitly labeled Review & auto-improve once action requests at most one review followed by one existing validated semantic edit and MP4 render under a baseRevision CAS guard; if no blocking issue is found, no project mutation occurs. The backend proxy forwards these POST requests only from registered/trusted local workspaces with server-only SuperAgent auth and rejects other methods/workspaces. The model provider needs image capability; text-only provider errors are surfaced, not silently treated as visual approval.

The editor also exports workspace-authenticated SubRip sidecar captions derived from the visible scene title/subtitle copy and timing, rather than claiming transcription of speech. A new rounded corner inspector for rect layers writes optional cornerRadius via revision-checked declarative replace-composition and is rendered with matching SVG rx and Canvas rounded geometry. Existing scene revisions and non-rounded layers remain compatible. UI/proxy unit tests verify these workflows including bad method/cross-workspace refusal and no-op visual repair. The new features remain a developer preview. Real connected vision-model behavior, absolute content accuracy, live registered-workspace Tauri smoke and production packaging require separate validation; this batch does not include arbitrary video clips, external stock media, speech recognition or self-healing render workers.

### Desktop production packaging investigation (2026-10-21)

For this Motion increment, the T-Line backend and frontend builds passed, and the Windows Tauri copy-assets step completed. The full package build exposed two genuine integration gates:
- Existing production builds attempted to call open_devtools() on Webview/WebviewWindow without the Cargo devtools feature and failed with Rust E0599. This commit now gates that command behind the explicit devtools feature. Default/release builds return a safe error instead of invoking a developer-only API. No DevTools permission is enabled for production.
- The CI environment supplied CI=1, but the installed Bun/Tauri CLI expected Boolean text for the --ci value. The build:tauri script now passes CI=true to the last CLI build step, which allowed compilation to progress beyond the argument parsing error.

A subsequent Tauri packaging attempt did NOT complete: the current Windows machine has multiple concurrent cargo.exe/rustc.exe processes and the new build was blocked waiting for the shared artifact directory lock. Those processes were not killed or interrupted. No new verified distributable should be claimed on the basis of this attempt. The Tauri backend dependency installation separately reported three high-severity vulnerability findings, requiring a dedicated dependency audit/remediation before production distribution; forcing major dependency updates without compatibility analysis was intentionally avoided. Existing frontend CSS-minifier and large-JS-bundle warnings persist. Source-level native Cargo feature gating and unit tests do not replace packaged installed Tauri/WebView2 end-to-end testing.

## Release candidate gate investigation — 2026-10-21

A Rust release application binary was observed at desktop-tauri/src-tauri/target/release/app.exe on the development Windows host. Presence alone does not certify an installed app or establish that the binary matches current Git HEAD. Tauri packaging originally rejected CI=1 because the CLI expects a boolean. The build script now uses scripts/run-tauri-build.cjs to pass CI=true using a child process environment, in a cross-platform manner, rather than a POSIX inline assignment.

Run bun run motion:release-check for a readable gate report, or bun run motion:release-gate to fail unless every gate passes. Use node scripts/check-motion-release.cjs --json for machine-readable output. The release checker audits packaged backend production dependencies, checks local FFmpeg and Rust binary existence, and labels live vision model, Piper voice model, installed WebView2 and extended stress tests as unverified. Missing or unreachable audit results are never treated as clean.

**Unresolved production security blocker:** npm audit reports three high advisories through the same production dependency path: http-proxy-middleware@4.2.0 -> micromatch@4.0.8 -> braces@3.0.3. Braces has a stack-exhaustion advisory GHSA-vfj7-8cjw-p6xm. These were the newest available npm versions at the time of the check. PreviewProxy uses a fixed function pathFilter rather than constructing attacker-controlled glob patterns, but the advisory is NOT considered remediated. Do not blindly run npm audit fix --force; it suggests a breaking major downgrade of the proxy middleware. Security-review a replacement/patched package and require a clean follow-up dependency audit before production.

Generated lockfiles changed during native asset staging and build. They have not been staged by this task. Installer packaging, trusted installed desktop E2E, model/Piper availability, dependency remediation and resilient render restart handling remain open.

## P0 Security Hardening + P1 Tauri Windows Production Build — 2026-10-21

P0 is implemented for the previously blocked dependency chain. Replaced the only http-proxy-middleware usage in backend/src/previewProxy.ts with a narrow backend/src/securePreviewProxy.ts using http-proxy@1.18.1, eliminating production transitive micromatch/braces from the preview path. The replacement supports authenticated-style local browser preview HTML injection, cookies, redirect rewriting, query cleanup and HMR websocket upgrades. The target parser only allows HTTP(S) origins without credentials, extra paths or control/HTML characters; malformed targets cannot be used as arbitrary upstream endpoints. The HTML rewriting buffer is bounded to 4 MiB (including bounded decompression), preventing unbounded memory use from a hostile upstream preview page. Source-level HTTP+WS integration tests cover legacy-compatible behavior, invalid targets and oversized HTML. New production dependency lockfile is pinned and packaged with npm ci --omit=dev; copy-assets now fails on a missing lockfile rather than silently selecting fresh dependency versions. The Windows staging install reports 128 packages installed, 129 audited, **zero production dependency vulnerabilities**. This is an audit result for the packaged backend dependency set, not a claim that every T-Line feature or connected system has passed independent penetration testing.

P1 installer repair: bundle resources explicitly include ../backend/dist/, ../backend/node_modules/ and ../backend/package.json; the archive uses the _up_/backend path layout that the existing Rust runtime already resolves. The Windows NSIS archive grew from an incomplete approximately 3 MB app-only installer to the resource-bearing t-line_1.3.698_x64-setup.exe (13,494,338 bytes). Verification with 7-Zip proved the archived backend/dist/server.js, better_sqlite3.node, http-proxy package and backend/package.json are present. An extracted-archive smoke loaded better-sqlite3 into a memory database and successfully queried sqlite_version() = 3.53.2, and verified the packaged http-proxy runtime exports createProxyServer. No existing T-Line daemon, user workspace or installed desktop executable was restarted. A new scripts/check-tauri-bundle.cjs verifies the NSIS archive content and integrates with scripts/check-motion-release.cjs, which fails closed if a payload is missing or stale. Tests cover the verifier's positive and negative cases.

**Outstanding P1 release acceptance gates:** actual isolated Windows installer installation and launch with WebView2 under a clean OS profile; end-to-end workspace auth + Motion MP4 in the installed GUI; the system Node.js prerequisite used by Rust (Node is not currently bundled in the installer); code-signing / update trust and cross-platform packaging. Live configured vision model and Piper E2E and extended crash/fault testing remain open. A content-correct installer and a production-audit-clean dependency graph do **not** alone establish that the application is production-ready.

### Final P0/P1 gate validation

- Targeted regression: 59 frontend Motion tests, 12 backend Motion/proxy tests (including bounded HTML and WebSocket compatibility), and 5 release-gate script tests. Frontend and backend builds succeeded.
- Final Windows NSIS archive passed the Tauri bundle checker: source-to-staging byte equality, source-to-NSIS byte equality for backend server.js, previewProxy.js, securePreviewProxy.js and manifest by selective archive extraction, and archived native better_sqlite3.node and http-proxy dependency. This avoids false failures from rebuilding byte-identical output with newer timestamps.
- Smoke from the extracted NSIS loaded SQLite 3.53.2 in memory and resolved the HTTP proxy module. This is not an installed desktop/WebView2 login or Motion render acceptance test.
- Backend production dependency audit: zero known npm production vulnerabilities in 129 audited packages after migration; no force-fix or unsupported dependency downgrade.
- Remaining release gates intentionally fail closed: system Node.js prerequisite on clean machines, installed Tauri/WebView2 workspace-auth and video playback, signing/updater trust, connected vision model/Piper E2E, and stress/fault resilience.

### P1 clean-machine runtime closure: embedded Node.js (2026-10-21)

The Windows NSIS installer now includes a separately staged licensed Node.js runtime (node-runtime/node.exe and its unmodified distribution LICENSE). The copy-assets step sources the real Node executable from the build machine, checks it is a supported Node.js release, requires the distribution license, copies both only to ignored build artifacts, and executes the copy to confirm the staged runtime version. No Node executable or third-party license binary is committed to the Git repository.

The Tauri Rust launcher resolves node-runtime/node.exe from the installed Resource directory before falling back to system Node in development/older portable builds. The eager pre-Tauri system-node-only check was moved into the Tauri setup phase so a clean machine can load bundled resources first. This removes the external Node.js prerequisite for the packaged Windows executable without changing the active user's background service.

A Windows NSIS installer of 36,059,454 bytes was built with bundled Node.js 24.13.0. The installer was selectively extracted and its Node binary was launched with an empty system PATH; it printed v24.13.0. Both the extracted runtime and LICENSE matched staging bytes exactly. The automated Tauri bundle checker now extracts and byte-compares these assets, verifies the Node executable runs without PATH, and fails if any resource is missing. The release checker records a passing bundled-node-runtime gate when all checks pass.

Important: bundled Node.js removes an installation prerequisite, but Node itself has its own security update lifecycle separate from npm audit. Keep the binary and licensing information updated for each release. Installer GUI startup, WebView2, real workspace authentication, live SuperAgent Motion rendering, code signing and updater verification still require clean-Windows installed-app smoke and certification.
