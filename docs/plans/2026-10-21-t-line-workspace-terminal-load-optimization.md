# T-Line Workspace & Terminal Load/Reload Optimization

Date: 2026-10-21
Scope: T-Line project/worktree metadata, filesystem-triggered refresh, Git status polling, xterm output buffering.
Status: Implemented; compile and targeted tests pass. No installed Windows UI latency benchmark performed.

## Observed bottlenecks

- Frontend requested /api/workspaces every 10 seconds and replaced the React workspace array even when the payload was identical. Terminal and workspace tab controls depended on this array, amplifying unnecessary React updates.
- Workspace metadata refresh spawned worktree-list, one status per worktree and branch Git processes. Cache TTL was eight seconds, so regular ten-second polling often re-ran all Git commands. Concurrent consumers could initiate duplicate probes.
- /api/workspaces scanned all projects at once, and each workspace scanned all worktree dirty statuses in unbounded parallel. On machines with many repositories/worktrees that could overload disk/CPU.
- Recursive file watchers scheduled a debounce timer per filename and broadcast one fs-change message per file. A code build or mass file update could trigger repeated full workspace, Git status and explorer refreshes.
- Terminal renderer joined and submitted its entire buffered PTY output (potentially 10 MB) to xterm in one animation frame, producing UI stalls after large process output or replay.
- The Git Changes panel polled every five seconds even when the desktop/browser window was not visible.

## Changes

- gitManager now reuses one in-flight workspace metadata probe for the same workspace/config and caches successful results for 15 seconds. Cache invalidation uses a generation guard so old in-flight responses cannot repopulate invalidated cache. Worktree and workspace probes use bounded four-way asynchronous concurrency, keeping output order and surfacing errors.
- The React workspace hook coalesces duplicate GETs, aborts obsolete requests on forced refresh/auth change, and uses deep primitive comparisons before setting new workspace data. Polling frequency is 20 seconds when visible, with immediate refresh on visibility return and authorized add/remove/edit operations.
- The filesystem watcher now groups all file changes into one notification per 600 ms, instead of creating hundreds or thousands of pathname timers. React additionally coalesces event-triggered workspace/Git/explorer refresh into at most one per two seconds.
- The Git Changes panel checks every ten seconds only when visible, resuming on visibility change. Watcher events still trigger earlier refresh.
- Terminal PTY output is drained in FIFO batches of at most 64 Ki UTF-16 code units per animation frame rather than a single giant batch. Giant individual frames are capped by the existing 10 MB buffer policy; batch splitting preserves surrogate pairs and ANSI sequence ordering. This is a UI rendering budget, not a change to the running PTY session or its replay protocol.

## Verification

- Frontend TypeScript/Vite production build completed.
- Backend TypeScript build completed.
- 20 backend tests passed including workspace metadata cache reuse/invalidation, bounded Git scan concurrency, backend identity and Motion compatibility.
- 15 frontend tests passed including stable workspace snapshots, ordered/bounded terminal batching, Git feature UI and CLI parity.
- Native Rust/Tauri was not modified. The installed WebView2 runtime and real terminal throughput under load are **not** certified by these test results; do not assign an unmeasured percent improvement.
- No daemon, existing PTY session, tunnel, or persisted workspace configuration was restarted/deleted during implementation.

## Follow-up measurements

On an isolated test profile, compare initial workspace list paint and switching time with 1, 10 and 30 registered projects; track /api/workspaces latency and counts of spawned Git processes while a large repo builds. Check typing latency and frames dropped while replaying 1 MB/10 MB terminal output and confirm that no output is lost when closing/reopening or reattaching. Verify filesystem updates still refresh branch/dirty badges within a few seconds of becoming idle.
