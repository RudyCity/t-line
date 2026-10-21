# T-Line P0–P2 Startup, Reload and Terminal Performance

Date: 2026-10-21
Repository: RudyCity/t-line
Scope: Desktop frontend and Express backend. SuperAgent engine is not changed.
Status: Implemented and compiled; automated regression passed. Real installed WebView2 performance still requires measurement.

## P0 – Startup and terminal lifecycle

- App.tsx now uses React.lazy with local Suspense boundaries for FileViewerTab, DiffViewerTab, BrowserTab, TerminalGridTab, SplitLayoutRenderer, SuperAgentConsole, and MotionStudioTab. Restored file/agent/motion tabs initialize only after first activation and stay mounted on subsequent switches, preserving local edits and agent sessions.
- Vite splits the React/UI vendor bundle from the terminal xterm/WebGL vendor bundle. The static HTML modulepreload list contains UI vendor only; the terminal bundle is loaded on demand. The normal frontend main bundle fell from about 964 kB to about 321 kB (minified, before gzip); UI vendor from about 693 kB to about 195 kB. This is a packaging result, not a startup-duration benchmark.
- HTML initially loads only the default Outfit / JetBrains Mono families instead of requesting dozens of unused Google Fonts. Previously selected font families are fetched on demand; system-local fonts are not fetched remotely.
- Terminal grid cards initialize their expensive xterm renderer only as they approach the viewport. Quick Launch with an initial command is explicitly exempt, so background command execution is not deferred by the visibility heuristic. Once shown, a card keeps its mounted terminal until its grid parent unmounts.
- useTerminals preserves a latest metadata snapshot on the pagehide event, covering the final 500ms localStorage debounce window during hard reload. No PTY close is sent by this persistence path.

## P0 – Incremental React state reconciliation

- Incoming WebSocket sync and initial REST restore now use reconcileTabs/reconcileTerminalInstances. Unchanged tab/instance objects retain their identities to avoid expensive downstream rerenders.
- Terminal one-shot initialCommand from remote snapshots is always discarded and cannot execute on reattach. Locally active initial commands are preserved until their explicit local acknowledgement clears them. Locally detached window ownership is not overwritten.
- Existing full sync wire format remains backward compatible with other T-Line windows. A compact delta-based wire protocol is a future migration requiring version negotiation; it is **not** claimed by this patch.

## P1 – WebSocket and disk persistence

- Outbound offline WebSocket queue is bounded (512 records / 1M UTF-16 code units) and superseded resize/init commands are coalesced by terminal id. If the queue is full, senders receive an explicit toast and log warning rather than silently discarding typed input; no action is taken against a live remote PTY.
- Backend /api/sync/state uses async atomic JSON persistence via same-directory temp write + rename. Saves are serialized to preserve order, unchanged state avoids duplicate broadcast, GET waits for queued writes, and failed saves do not poison future requests.
- The previous synchronous multi-tab fs.writeFileSync is removed from the state-sync POST path; other unrelated server logging remains unchanged.

## P1 – Process monitor

- Process-tree reads for the same PID reuse in-flight results with a short 3s cache shared across terminal/WebSocket monitors. Failures are evicted and the cache is bounded. Existing terminal title/process polling intervals remain for compatibility; a full shared single-timer scheduling redesign is not claimed.

## P2 – System statistics and workspace list

- System memory polling runs at 15s rather than 5s, skips hidden windows, merges overlapping requests and avoids React updates for small fluctuations. Foreground refresh is immediate on visibility restore.
- Sidebar workspace process indicators reuse a precomputed index per workspace and terminal metadata change, instead of searching every terminal at each card render. For long project lists, non-active cards use CSS content-visibility with intrinsic height to skip offscreen rendering work.

## Verification and caveats

- Both backend and frontend production build commands succeeded.
- Full frontend Vitest suite: 131/131 passed, 24 test files.
- Full backend Vitest suite: 23/23 passed, 8 test files.
- Tests include offline queue backpressure, sync reference reuse and one-shot commands, async atomic state persistence and process scan de-duplication. Existing UI/Motion/Git tests were also run.
- The installer was not restarted or installed during this change. Long-lived PTY, live Tauri WebView2, multi-window crash recovery and precise startup latency still need real Windows smoke/benchmark runs. No percentage speedup is claimed.
- Recommended acceptance before a production release: exercise 20+ restored tabs and many grid cards; scroll to reveal unloaded cards; execute Quick Launch offscreen; edit file and switch tabs; disconnect/reconnect WebSocket under sustained output; verify state sync after fast reload and process monitor CPU/memory. Test on a disposable profile before upgrading active Hermes/Muse sessions.
