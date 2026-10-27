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
| DEEP-01 | P0 | **OPEN — code-proven** | FastPath masih tidak menetapkan terminal `lastTaskOutcome`; worker masih memetakan null/unknown menjadi `completed`. |
| DEEP-02 | P0 | **OPEN — code-proven** | `fileScope` subagent masih hanya diinjeksikan ke prompt; ToolExecutor belum menerima/menegakkan child file scope. |
| DEEP-03 | P1 | **OPEN — code-proven** | Permission handler subagent masih auto-approve semua selain command yang diklasifikasikan destructive. |
| DEEP-04 | P1 | **OPEN — code-proven** | Progress classifier masih memakai satu mutable `globalProgressCallback`. |
| DEEP-05 | P1 | **OPEN — code-proven** | concurrency limiter hanya dipakai untuk `concurrencyLimit === 1`; lock hidup >60s masih bisa dianggap stale. |
| DEEP-06 | P1 | **OPEN — code-proven** | Main T-Line chat reducer masih tidak menangani `chat_turn_status`; `done/goal_done` menghentikan loading. |
| DEEP-07 | P1 | **OPEN / behavior-risk** | Planning/checklist text-only nudge logic masih sama. Tes hanya membuktikan skip pada conversation/question dan nudge pada complex task, bukan kualitas/no-progress behavior. |
| DEEP-08 | P1 | **OPEN — code-proven** | SSE masih dimulai sebelum init selesai; 404 init race tidak dijadwalkan retry; Core replay cursor masih tidak memakai Core `id:`/query `lastEventId`. |
| DEEP-09 | P1 | **OPEN — code-proven** | Image attachment masih menjadi Data URL di dalam string prompt, bukan structured multimodal content. |
| DEEP-10 | P2 | **OPEN — code-proven** | UI masih membuat subagent spekulatif dengan `Math.random()` pada `invoke_subagent`. |
| DEEP-11 | P2 | **OPEN — code-proven** | Saat tidak ada master/UI question handler, subagent masih memilih `options[0]` secara diam-diam. |
| DEEP-12 | P2 | **OPEN / intentional parity gap** | Capability manifest tetap menandai slash commands sebagai `cli-only`; desktop parity belum lengkap. |

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

### T-Line — 31 passed
Backend:
- coreReconnectSafety
- tlineAssistantTurns
- agentTimelineV3Proxy

Frontend:
- SuperAgentStreamPrint
- SuperAgentAssistantComposer
- AssistantTurnQueue
- AgentExecutionTimeline

### Important missing gates
Belum ada bukti tes untuk:
1. FastPath failure/abort/null outcome fail-closed.
2. fileScope hard enforcement (read/write/shell/symlink).
3. concurrency N>1 dan live lock >60s.
4. simultaneous classifier progress isolation.
5. cold first-send ×100.
6. Core SSE id/query replay fidelity.
7. structured image content from T-Line.
8. canonical subagent ID only.
9. no silent options[0].
10. live model CLI-vs-T-Line parity.
11. installed Tauri E2E.

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
