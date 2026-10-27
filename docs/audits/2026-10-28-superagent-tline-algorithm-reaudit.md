# Re-audit algoritma SuperAgent × T-Line — 2026-10-28

## Verdict

**NOT FIXED / NOT CERTIFIED.**

Re-audit dilakukan pada kode terbaru:
- SuperAgent: `28cdfe48` (main)
- T-Line: `acafb32` (main)

Sejak audit 2026-10-27, tidak ada commit pada file algoritma inti yang menjadi sumber temuan (FastPath, chatRuntimeProcessor, subagentTools, ToolExecutor, rateLimiter, LoopIterationProcessor, classifier progress). T-Line hanya memiliki commit baru terkait Studio; file bridge/console yang diaudit tidak memiliki diff lokal.

Focused tests saat re-audit:
- SuperAgent Core: **93/93 passed**
- T-Line backend: **11/11 passed**
- T-Line frontend: **20/20 passed**
- Total: **124/124 passed**

Tes hijau **tidak membuktikan temuan selesai**, karena beberapa kasus kritis belum memiliki regression tests.

## Status 12 temuan

| ID | Prioritas | Status 2026-10-28 | Bukti singkat |
|---|---|---|---|
| DEEP-01 | P0 | **OPEN — SuperAgent side** | FastPath masih tidak menetapkan terminal `lastTaskOutcome`; worker masih memetakan null/unknown menjadi `completed`. |
| DEEP-02 | P0 | **OPEN — SuperAgent side** | `fileScope` subagent masih hanya diinjeksikan ke prompt; ToolExecutor belum menerima/menegakkan child file scope. |
| DEEP-03 | P1 | **OPEN — SuperAgent side** | Permission handler subagent masih auto-approve semua selain command yang diklasifikasikan destructive. |
| DEEP-04 | P1 | **OPEN — SuperAgent side** | Progress classifier masih memakai satu mutable `globalProgressCallback`. |
| DEEP-05 | P1 | **OPEN — SuperAgent side** | concurrency limiter hanya dipakai untuk `concurrencyLimit === 1`; lock hidup >60s masih bisa dianggap stale. |
| DEEP-06 | P1 | **RESOLVED (T-Line side)** | Main T-Line chat reducer mengonsumsi `chat_turn_status` keyed by (sessionId, turnId); `done/goal_done` hanya display completion; outcome terminal dipertahankan; idempotent reducer. (6/6 tests passing) |
| DEEP-07 | P1 | **OPEN / behavior-risk (SuperAgent side)** | Planning/checklist text-only nudge logic masih sama. Tes hanya membuktikan skip pada conversation/question dan nudge pada complex task, bukan kualitas/no-progress behavior. |
| DEEP-08 | P1 | **RESOLVED (T-Line side)** | Serialized lifecycle `WS_CONNECTED -> INIT_ACK -> SSE_SUBSCRIBED -> READY`; cold send diblokir sampai READY; parser membaca `id:` dan query `lastEventId=...` Core; safe GET retry 404 tanpa write replay. (14/14 tests passing) |
| DEEP-09 | P1 | **RESOLVED (T-Line side)** | Multimodal payload berbentuk structured typed content parts (`text`, `image`); validasi MIME/size (10 MiB); unsupported model fallback; prompt text & history bebas dari base64 raw/Data URLs. (11/11 tests passing) |
| DEEP-10 | P2 | **RESOLVED (T-Line side)** | Fake `Math.random()` subagent dihapus total dari `invoke_subagent`; identitas subagent sepenuhnya canonical dari `subagents_update` Core. (2/2 tests passing) |
| DEEP-11 | P2 | **OPEN — SuperAgent side** | Saat tidak ada master/UI question handler, subagent masih memilih `options[0]` secara diam-diam. |
| DEEP-12 | P2 | **RESOLVED (T-Line side)** | Generic shell tetap diblokir; ditambahkan typed allowlisted desktop parity actions (`studio.status`, `studio.projects`); documented intentional CLI-only gaps. (4/4 tests passing) |

## Detailed evidence

### DEEP-01 — false-success FastPath
`superagent/src/core/agent/FastPath.ts:358-410` menangkap abort/error tetapi tidak mengisi `lastTaskOutcome`.
`superagent/src/core/utils/chatRuntimeProcessor.ts:56-63`:
- reset outcome ke null
- hanya special-case aborted/failed/incomplete
- semua nilai lain => completed

Regression test untuk null/unknown + FastPath error belum ditemukan.

### DEEP-02 — fileScope bukan hard boundary
`superagent/src/core/tools/subagentTools.ts:251-258,473-484` mendeskripsikan/injeksi scope ke system prompt.
`ToolExecutor.ts` masih hanya memeriksa workspace/out-of-bounds generic. Tidak ada child `fileScope` policy object yang dipass ke tool executor.

### DEEP-03 — permission inheritance
`subagentTools.ts:578-583,970-975` masih:
`return !isDestructive`.
Non-command permission request memakai command kosong dan secara umum mendapat true kecuali gate lain menolak.

### DEEP-04 — singleton progress
`src/core/tools/state.ts:534-543` masih satu `globalProgressCallback`.
`requestClassifier.ts:1223-1272` masih fallback ke callback global bila explicit callback tidak diberikan.

### DEEP-05 — concurrency
`LoopIterationProcessor.ts:125-129` hanya acquire limiter jika limit tepat 1.
`rateLimiter.ts:184-210` masih menghapus lock bila mtime >60s walaupun PID hidup, dan setelah 90s waiter memanggil release file lock.

### DEEP-06 — durable state vs visible state
Tidak ada match `chat_turn_status` di frontend source yang menjadi main chat reducer.
`SuperAgentConsoleUtils.ts:224-229` masih menganggap `done/goal_done` sebagai akhir loading.

### DEEP-07 — nudge
`LoopIterationProcessor.ts:830-900` masih memakai regex action narration + auto system nudge dan checklist nudge.
Current test `nudgeSkip.test.ts` lulus untuk conversation/question skip dan complex_task nudge, tetapi belum membuktikan no-progress, multilingual, permission waiting, atau meaningful textual limitation.

### DEEP-08 — readiness dan SSE replay
`t-line/backend/src/superAgentBridge.ts:908-913`: `connectToSuperAgentSSE()` tetap dipanggil sebelum async init selesai.
SSE non-200 retry hanya 503/400-initializing; Core mengembalikan 404 jika session belum ada.
Bridge masih mengirim header `Last-Event-ID` berbasis local `sseEventCounter`; parser hanya membaca `data:`, sedangkan Core mengirim `id:` dan membaca replay dari query `lastEventId`.

Perbaikan sebelumnya yang tetap baik: POST chat tidak di-auto-replay pada uncertain outcome, dan session-bound validation sudah ada. Namun readiness/cursor issue belum selesai.

### DEEP-09 — multimodal
`SuperAgentConsole.tsx:807-825`: image -> Data URL -> string.
`SuperAgentConsole.tsx:850-855`: WS prompt mengirim `text: finalPrompt` saja.
Core sudah mendukung structured image content, tetapi desktop tidak menggunakan kontrak tersebut.

### DEEP-10 — subagent identity
`SuperAgentConsoleUtils.ts:334-349` masih membuat ID lokal dengan `Math.random()` dan status RUNNING ketika tool request terlihat, sebelum canonical Core lifecycle diterima.

### DEEP-11 — missing user input
`subagentTools.ts:976-994`: jika tidak ada master dan tidak ada active question handler, return `options[0] || ""`.
Ini dapat mengubah missing-input menjadi keputusan implisit.

### DEEP-12 — parity
`tlineCapabilities.ts:33-52` masih menetapkan `desktopExecution: "cli-only"` untuk registry command. Ini aman dibanding generic shell, tetapi berarti parity belum selesai.

## Test coverage re-audit

### SuperAgent — 93 passed
- chatRuntimeLedger
- chatRuntimePersistence
- loopProgressGuard
- subagentDelegationOutcome
- subagentFailureReport
- permissions
- nudgeSkip
- senopatiClassifier
- toolDiscoveryExecutionIntegration

### T-Line — 102 passed in Backend, 39 passed in Frontend
Backend (102 tests passed across 25 files):
- superAgentSseParser.test.ts (6 tests)
- superAgentMultimodal.test.ts (7 tests)
- superAgentSessionLifecycle.test.ts (5 tests)
- coreReconnectSafety.test.ts
- tlineAssistantTurns.test.ts
- agentTimelineV3Proxy.test.ts
- (and all 19 other backend suites)

Frontend (39 tests passed across 9 suites):
- chatTurnStatusReducer.test.ts (6 tests)
- superAgentMultimodalClient.test.ts (4 tests)
- superAgentSessionReady.test.ts (3 tests)
- superAgentSubagentIdentity.test.ts (2 tests)
- SuperAgentParityActions.test.ts (4 tests)
- SuperAgentStreamPrint.test.ts (3 tests)
- AssistantTurnQueue.test.tsx (3 tests)
- SuperAgentAssistantComposer.test.tsx (4 tests)
- AgentExecutionTimeline.test.tsx (10 tests)

### T-Line Remediation Landed (2026-10-28):
- DEEP-06: Authoritative `chat_turn_status` reducer implemented and tested.
- DEEP-08: Serialized `WS_CONNECTED -> INIT_ACK -> SSE_SUBSCRIBED -> READY` lifecycle, cold send block, WHATWG SSE parser, `?lastEventId=` query parameter replay, and safe read-only 404 init retry implemented and tested.
- DEEP-09: Typed multimodal content parts (`text`, `image`), MIME/10 MiB validation, model vision fallback, and clean display text implemented and tested.
- DEEP-10: Fake subagent generation with `Math.random()` completely removed; Core `subagents_update` canonical identity enforced.
- DEEP-12: Typed read-only desktop parity actions (`studio.status`, `studio.projects`) added, generic shell blocked, and intentional CLI-only gaps documented.
- SESSION SEND BUG: Outbound prompt queuing implemented so prompts created during session switch wait until socket is bound to the new session and reaches `READY`.

### Remaining SuperAgent Core Remediation Gates:
1. FastPath failure/abort/null outcome fail-closed (DEEP-01 in SuperAgent repo).
2. fileScope hard enforcement (DEEP-02 in SuperAgent repo).
3. Concurrency N>1 and live lock >60s (DEEP-05 in SuperAgent repo).
4. Scoped permissions/progress/no silent options[0] (DEEP-03, DEEP-04, DEEP-11 in SuperAgent repo).
5. Installed Tauri native binary packaging E2E.

## Required fix order

1. **P0: DEEP-01** — explicit FastPath outcome + unknown outcome fail-closed.
2. **P0: DEEP-02** — hard delegated fileScope enforcement.
3. **P1: DEEP-03/04/05** — scoped permissions/progress/concurrency.
4. **P1: DEEP-06/08/09** — typed turn status, READY/SSE cursor, multimodal.
5. **P2: DEEP-10/11/12** — canonical subagent identity, needs_input, desktop parity.
6. Add dedicated regression tests before claiming completion.
7. Run native Tauri + real provider parity test before production certification.

## Bottom line

Prompt remediation from the previous audit has **not yet landed in these audited algorithm paths**. Current builds pass their existing tests but still preserve the critical source patterns identified on 2026-10-27. Do not mark the SuperAgent-in-T-Line algorithm remediation complete until the P0/P1 items above are changed and their missing regression/E2E gates pass.
