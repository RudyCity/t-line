# M4-C — Browser Preview Renderer ACK and Runtime Telemetry

Date: 2026-10-26
Status: **Implemented, native logic + isolated real Chrome smoke + focused frontend tests passed. Not packaged GUI-validated or production accepted.**
Follows [M4-B adaptive live preview](2026-10-26-tline-browser-m4b-adaptive-preview.md).

## New safety and performance behavior

- Every emitted Tauri `managed-browser:frame` event contains a monotonically increasing **sequence** tied to the single current **streamId** and exact page **targetId**. React accepts only validated JPEG frames for that active stream.
- React acknowledges the sequence with the restricted `managed_browser_stream_ack` native command *after* the frame has been committed and the next browser animation frame is scheduled. Duplicate ACKs, stale stream IDs, incorrect sequences, forged targets and ACKs from nonprimary WebViews are rejected.
- Native `FrameFlow` permits **at most one unacknowledged frame**. While the UI is behind, Chrome screencast packets are still acknowledged to CDP but duplicate UI sends are dropped; the native worker never builds a frame queue. A missing UI ACK for 4 seconds ends the native stream, even on a static page.
- The Tauri event is scoped to the primary `main` WebView; the worker double-checks cancellation, owning Chrome Child/generation/fingerprint, and the original CDP page URL. Closing, switching tabs, hidden windows and app Exit cancel the owned stream; no unrelated Chrome process or Core session is terminated.
- Rare startup races are handled: if the first frame arrives before the asynchronous stream-start receipt, React holds **one** validated provisional JPEG only until it learns the matching stream ID. Frames with other IDs are discarded; the provisional frame is not persisted.
- A read-only `managed_browser_stream_stats` command reports native sent/ACK/dropped counts, in-flight state, ACK latency and stream elapsed time. React shows measured incoming FPS, counters and ACK latency and samples **host T-Line CPU/RSS** from sysinfo about every two seconds. Existing Tauri memory stats are optionally read every 15 seconds for **Desktop + WebView** combined RAM. The CPU and RSS metrics do **not** represent whole Chrome multi-process consumption.
- All telemetry is opt-in by opening Preview; no raw CDP URL, cookies, bearer token, script, background service, screenshot file or automatic click/key/page action is introduced.

## Verification performed

- `cargo test --offline --lib managed_browser_flow::tests`: 3 passing deterministic tests. Covers one unacknowledged frame at a time, rejecting duplicates/wrong sequences, deadline failure, failed emission rollback, and **9,000 simulated frames representing 30 minutes at 5 FPS** with bounded pending frames.
- `cargo test --offline --lib managed_browser_stream::tests`: 1 passing CDP validation test. `cargo check --offline`: successful. Native permissions for ACK and stats are registered.
- `cargo test --offline --lib managed_browser::tests::real_owned_chrome_lifecycle_smoke -- --ignored --nocapture`: PASS with installed Windows Chrome in a temporary isolated profile. Observed `persistent-snapshot-fallback`, not Chrome screencast FPS or UI ACK through an installed app.
- Frontend browser Vitest: **19 passing tests**. Verifies matched stream ACK after React render, forged/stale stream rejection, provisional first frame before start receipt, hiding the window and stopping exact stream, and snapshot fallback. Build of browser frontend assets succeeds.
- **Full-repo TypeScript/build wrapper** is subject to concurrent unrelated approval assistant errors in `SuperAgentConsole.tsx` (e.g. nullable `approvedRule`). Browser-focused tests pass; do not claim a clean full frontend typecheck unless that error is fixed by its owner.
- No shared Core or tunnel restarted, no personal Chrome profile touched, no user session interrupted.

## Acceptance gates still open

1. **Packaged Windows GUI E2E**: actual Tauri IPC/stream events, minimized window and tray handling, active Core authenticated registration and authorization under real user sessions.
2. **Real 30-minute soak** on a visible Chrome window with foreground/background swaps, multiple tabs, browser exit/restart, high-frequency page updates, event delivery delays and OS sleep/resume. The deterministic 30-minute-equivalent frame simulation is **not a real 30-minute soak, CPU/memory benchmark, or successful 5 FPS proof**.
3. Measure whole Chrome **process-tree** CPU/RSS and latency separately from the T-Line host. Confirm no sustained RAM growth over time before increasing frame rate/resolution.
4. Native interactive controls need a separately approved gateway action adapter and per-target lease checks; Preview stays read-only.
