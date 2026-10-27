# Deep algorithm audit: SuperAgent Core × T-Line Desktop (27 October 2026)

## Scope and evidence
Audited branch main, SuperAgent `ba0f2c39`, T-Line `81a79bd`, using the SuperAgent123 connector. Focus: classifier/fast-path, tool planning/execution, permissions, subagent scope, completion outcomes, concurrency, session and event parity. Prior audit: `docs/audits/2026-10-27-superagent-tline-agent-algorithm-audit.md`. This report adds findings; it does not claim native E2E certification. No product source files changed.

### Tests performed
- SuperAgent Core: 72/72 passed (chatRuntimeLedger/Persistence, loopProgressGuard, subagentDelegationOutcome/FailureReport, permissions).
- T-Line backend: 11/11 passed (coreReconnectSafety, tlineAssistantTurns, agentTimelineV3Proxy).
- T-Line frontend: 20/20 passed (stream print, assistant composer, turn queue, execution timeline).
- **103 passing tests do not cover the new failure hypotheses below.** Frontend Vite deprecation warnings are unrelated.

## Deep findings (new or more precise than previous audit)

### DEEP-01 — P0 — FastPath can produce false-success durable turns (code-proven)
- `superagent/src/core/agent/FastPath.ts:358-410`: catches model and abort errors, emits error/done, resets `isRunning` and `abortController`, but **does not set `agent.lastTaskOutcome`**.
- `superagent/src/core/agent/RequestProcessor.ts:273-277`: high-confidence conversational input calls FastPath and returns false; `Agent.sendMessage` returns without running normal loop/outcome assignment (`src/core/agent.ts:607-645`).
- `superagent/src/core/utils/chatRuntimeProcessor.ts:56-63`: resets outcome to null; treats any value except task_aborted/task_failed/task_incomplete as **completed**.
- Impact: error, abort, or successful fast-path without explicit outcome can be represented as completed. Test `tests/chatRuntimeLedger.test.ts` checks explicit completed/incomplete outcomes but not null/fast-path error.
- Fix: FastPath returns/sets terminal outcome in finally; worker fail-closed maps null/unknown to interrupted, never completed. Add 4 tests (success/failure/abort/null), verify `chat_turn_status` and UI.

### DEEP-02 — P0 — Subagent fileScope is prompt instruction, not demonstrated enforced boundary
- `superagent/src/core/tools/subagentTools.ts:251,473-484`: `fileScope` fed to a plain system-prompt block saying `FILE SCOPE (Enforced)`.
- `src/core/agent/ToolExecutor.ts:179-235,415-450,819-827` checks generic workspace/permissions but no passed per-child fileScope. Grep across subagentTools indicates no other use of `fileScope`.
- Do not assert filesystem enforcement from a prompt. Need prove enforcement at tool resolution AND underlying write/shell paths (with canonicalization/symlinks/Windows case/path aliases); deny before any tool side effect; validate logs. A prompt is advisory, not a hard boundary.
- Safety fix: normalized immutable per-subagent tool policy; checks for all file read/write/exec/chdir, with explicit user-permission escalation per existing YOLO/no-YOLO policies.

### DEEP-03 — P1 — Subagent policy auto-approves broad calls, potentially inconsistent with desktop parent
- `superagent/src/core/tools/subagentTools.ts:578-583,970-975`: delegated Agent permission handler approves everything except commands classified destructive; `toolCall.args.command || ''` for non-command calls => usually not destructive. Actual executor implements additional boundaries, so this is **not** proof of arbitrary write capability, but creates a policy asymmetry and approval/UX gap.
- `server.ts:692-720` root uses interactive owner-bound permission and deadline registry.
- Fix: subagent policy must inherit scoped parent approval authority and per-tool permissions; explicitly deny non-approved out-of-bounds/tool classes even if classifier false; preserve permission receipts and avoid default auto-approval as substitute for operator approval.

### DEEP-04 — P1 — Global classifier progress routed to last constructed Agent
- `superagent/src/core/agent.ts:314-317` every Agent registers callback.
- `superagent/src/core/tools/state.ts:535-543` only one mutable `globalProgressCallback`.
- Actual consumers in `superagent/src/core/requestClassifier.ts:1223-1237,1247-1272`, when explicit callback absent. Overlapping sessions/subagents can misattribute classifier status. Replace with execution-scoped callbacks/AsyncLocalStorage or explicit callback.

### DEEP-05 — P1 — Concurrency config semantics / lock-age correctness
- `superagent/src/core/agent/LoopIterationProcessor.ts:125-130`: limiter used only when `getSettings().concurrencyLimit === 1`. Any value >1 has no equivalent occupancy enforcement along this path. Default config is 0 (=unlimited) so not a default bug.
- `src/core/rateLimiter.ts:145-234`: stale lock recovery uses `!isAlive || age > 60000`; live long-running holder may have lock deleted by waiter. 90-second wait can force release even when legitimate owner exists.
- Fix: permit-counted concurrency limiter, heartbeat/lease ownership token, release only caller-owned lock; test 1, 2, 3, unlimited and slow tool (>60s) across processes.

### DEEP-06 — P1 — Durable completion/visible completion diverge
- `superagent/src/core/utils/chatRuntimeProcessor.ts:54-69` emits durable turn states.
- `t-line/frontend/src/components/SuperAgentConsoleUtils.ts:153-461` lacks handler for `chat_turn_status`, and clears loading when `agent_event.done`/goal_done occurs at lines 223-228. Some separate queue/activity controls consume states, but primary chat reducer does not.
- Fix: keyed turn state reducer, `done` is display lifecycle and cannot certify `completed`, preserve failed/interrupted/aborted status.

### DEEP-07 — P1 — Planner/checklist response nudge may induce unnecessary repeated LLM turns
- `superagent/src/core/agent/LoopIterationProcessor.ts:830-900`: action-narration regex + length <600 + early iteration injects a new system nudge; unfinished checklist can also nudge. Guard caps nudges via `MAX_TEXT_ONLY_CONTINUATIONS`. This is controlled but can still mask "model did not invoke tool" under apparent repeated thinking.
- Test multi-language narration, no-tool legitimate answer, meaningful no-tool limitation, plan pending approval, and end-of-budget. Record actual tool-call count vs nudge count to distinguish model choice from transport.
- Not proven T-Line-specific; because both paths share Agent, compare exactly same model/preset first.

### DEEP-08 — P1 — First-send, SSE and session cursor issues (from prior audit, confirmed present)
- `t-line/backend/src/superAgentBridge.ts:908-913` starts SSE before awaiting session init; `Core serverRoutes.ts:313-323` returns 404 when session absent, retry handling excludes 404 init race; `SuperAgentConsole.tsx:785-855` sends if WS OPEN.
- `superAgentBridge.ts:733-749,807-822` uses local SSE counter and header Last-Event-ID, while Core `serverRoutes.ts:333-335` reads `lastEventId` query for replay.
- Reconcile typed READY and Core event sequence, maintain no blind replay of POST chat/approval.

### DEEP-09 — P1 — Model vision never receives actual image in desktop composer
- `t-line/frontend/src/components/SuperAgentConsole.tsx:807-825,850-855`: images become textual Data URLs, not image content parts. Core `Agent.sendMessage` and FastPath `src/core/agent/FastPath.ts:84-113` already support content parts when model vision-capable.
- Fix typed multimodal transport with allowed MIME, upload budgets, and robust unsupported-model behavior.

### DEEP-10 — P2 — Observable subagent identity drift
- `t-line/frontend/src/components/SuperAgentConsoleUtils.ts:306-323` creates temporary subagents with Math.random ID from `invoke_subagent` request; Core `server.ts:565-590` emits actual IDs and statuses.
- Canonical Core IDs only; distinguish `requested` from `started`, do not show orphan RUNNING cards.

### DEEP-11 — P2 — Root/child contextual ownership & UX
- Core `server.ts:666-690` resolves global question owner by single running session in lastActiveWorkspace; ambiguity returns no session. `server.ts:723-750` onQuestion resolves null when no owner.
- Child question fallback `subagentTools.ts:584-601,976-994` may auto-select `options[0]` when no master/UI handler exists. The fallback is a behavior policy, not proof of specific production failure, and can turn missing user input into silent model assumptions.
- Fix typed `needs_input` state and root provenance; never silently select first option for decisions involving mutations, irreversible steps, or required choices.

### DEEP-12 — P2 — Mode parity is intentionally incomplete
- Core `src/core/channels/tlineCapabilities.ts:33-52` marks CLI slash registry as `desktopExecution: 'cli-only'`; T-Line `SuperAgentConsole.tsx:743-783` rejects some commands. Do not install a generic shell runner; add typed allowlisted desktop actions with policy checks.
- T-Line and CLI both use `Agent`; surface claims of 'weaker model' must be proven by side-by-side traces instead of inferred.

## Acceptance matrix (require before saying fixed)
A. FastPath success, throw, network error and abort -> correct durable state exactly once.
B. Same session/turn/model on CLI vs T-Line: same classifier category, tool manifests, plan permissions and command dispatch where parity intended.
C. Concurrency 0/1/2/3, 60-120s slow tool, concurrent sessions, 2 subagents; no lock theft, no cross-session progress.
D. Child fileScope denied outside allowlist for file write, read, shell, symlink traversal; maintain no YOLO / YOLO / full YOLO semantics.
E. First-turn cold init ×100, reconnect ×100, session switch ×100; every accepted turn has terminal outcome, zero auto-replay of side effects.
F. 1-2 images + text, unsupported model, oversize file; true multimodal SDK parts.
G. End-to-end Tauri installed desktop, not just mocks: real model, approval, subagent, replay gaps, history resume, native commands.

## Recommendation / sequence
1. **Fix outcome state + fail-closed queue and add regression tests** (highest confidence bug).
2. **Enforce delegated tool scope and owner-bound approval** (security & correctness).
3. **Fix Core session READY/event ID protocol and multimodal content**.
4. **Replace singleton progress / subagent view IDs; harmonize turn reducer**.
5. **Implement N-concurrency limiter, owned leases, and tracing; benchmark CLI/T-Line side-by-side**.

## Scope limitations
This is a static source audit plus focused unit/integration tests; it is not evidence of a full live-model Tauri workflow. No product code was edited and no push was done during this audit.