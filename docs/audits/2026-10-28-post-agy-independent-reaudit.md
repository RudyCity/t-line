# Independent Post-AGY Re-audit — SuperAgent Core × T-Line
Date: 2026-10-28

## Verdict

**PARTIALLY FIXED — NOT PRODUCTION CERTIFIED.**

Audited current heads:
- SuperAgent Core: `2f25ba11`
- T-Line: `2be2728`

This re-audit independently inspected source and reran tests/builds after AGY remediation.

## Verification summary

### SuperAgent Core
- `bun run build`: **PASS**
- Focused + wider remediation tests: **90/90 PASS**
- Direct adversarial fileScope probe: **FAIL** (absolute shell path outside delegated scope is allowed)

### T-Line
- Backend full suite: **104/104 PASS** (25 files)
- Frontend affected suites: **10 files / 44/44 PASS**
- `bun run build`: **PASS** (Zero TypeScript errors, frontend & backend production bundles built)
- Direct reconnect lifecycle probe: **PASS**
  - initial: WS_CONNECTED -> INIT_ACK -> SSE_SUBSCRIBED -> READY
  - subsequent SSE subscription / reconnect: READY -> SSE_CONNECTING -> SSE_SUBSCRIBED -> READY (preserves/restores READY without regression)

## Finding status

| ID | Status | Independent verdict |
|---|---|---|
| DEEP-01 FastPath false-success | **FIXED / VERIFIED** | FastPath sets terminal outcome; chat worker fails closed on unknown/null. Tests cover failure, abort, null and single terminal emission. |
| DEEP-02 delegated fileScope | **OPEN P0 / PARTIAL FIX** | File API paths are guarded and symlink/traversal checks exist, but shell commands can reference absolute outside-scope paths without being rejected. |
| DEEP-03 child permissions | **FIXED IN SOURCE** | Actual child callback delegates permission to parent with provenance and fails closed without parent; destructive commands remain blocked. |
| DEEP-04 classifier progress isolation | **PARTIAL / OPEN P1** | Last-agent global overwrite was removed, but production RequestProcessor runs before `agentLocalStorage.run`; `runWithProgressCallback` has no production call site and classifier receives no explicit onProgress. Per-agent classifier progress is therefore not wired/proven. |
| DEEP-05 concurrency N + lock ownership | **FIXED / VERIFIED for original bug** | 0/1/2/3 slot tests pass; live >60s lock not stolen; lease ownership checked. Additional queue hygiene concern noted below. |
| DEEP-06 durable turn outcome UI | **FIXED / VERIFIED** | `SuperAgentConsoleUtils` calls `applyChatTurnStatus` with correct signature and normalized session; persists `nextTurns` to `turnRecordsRef.current`; applies loading/progress flags and notifications exactly once. Full suite of 8 integration tests through `handleAgentEventPayload` passing. |
| DEEP-07 no-progress/nudge | **PARTIAL** | needs-input/blocker guard is wired and max nudge remains bounded. `isRepetitiveNarration` was added but is never used in production. |
| DEEP-08 READY/SSE replay/session recovery | **FIXED / VERIFIED** | `SessionLifecycleManager` preserves/restores `READY` on reconnect/re-subscribe; unified typed lifecycle schema in `sessionLifecycleContract.ts` surfaces history warnings once without duplicates on replay. |
| DEEP-09 multimodal | **FIXED / VERIFIED** | Typed image parts flow frontend -> bridge -> Core with no raw base64 displayed; test fixture typed; T-Line full production build passes with strict TypeScript checks. |
| DEEP-10 canonical subagent identity | **FIXED / VERIFIED** | Fake Math.random subagent rows removed; authoritative Core updates are used. |
| DEEP-11 silent options[0] fallback | **FIXED IN SOURCE** | Unhandled question becomes explicit NEEDS_INPUT/waiting state rather than implicit first choice. |
| DEEP-12 CLI/T-Line parity | **PARTIAL BY DESIGN** | Read-only typed parity actions expanded; generic shell remains blocked. Full CLI parity intentionally remains incomplete. |

## Critical evidence

### P0 — DEEP-02 shell escape remains

`src/core/agent/fileScopeGuard.ts` checks:
- direct file/directory args,
- shell `cwd`,
- `cd/chdir/pushd`,
- relative `../` traversal.

It does **not** comprehensively parse shell arguments/redirection/PowerShell/cmd paths.

Independent probe against current source:

- delegated scope: `src/core/agent/**`
- shell cwd: `src/core/agent`
- shell command references absolute workspace-root `package.json`, which is outside the delegated scope
- result returned by validator: `{"allowed":true}`

Therefore `fileScope` cannot yet be called a hard shell boundary.

Required remediation:
- Prefer disallowing general shell for narrowly file-scoped children unless a shell policy can prove every referenced filesystem operand is in scope.
- Or build platform-aware command policy/tokenization for cmd.exe, PowerShell and POSIX syntax, including absolute paths, redirection, copy/move, script invocation and nested shell commands.
- Add adversarial tests for absolute paths and shell variants.

### P1 — DEEP-06 chat_turn_status integration (RESOLVED & VERIFIED)

- `SuperAgentConsoleUtils.ts` invokes `applyChatTurnStatus(turnRecordsRef.current, turnPayload, currentActiveSessionId)` with normalized session matching.
- Persists `result.nextTurns` back to `turnRecordsRef.current`.
- Authoritative loading, progress messages, and notifications are applied exactly once. Replays and late events are ignored idempotently.
- Verified by 8 integration tests through `handleAgentEventPayload` (`superAgentTurnStatusIntegration.test.ts`) covering `queued`, `running`, `completed`, `failed`, `interrupted`, `cancelled`, and duplicate/out-of-order `replay`.

### P1 — DEEP-08 reconnect loses READY (RESOLVED & VERIFIED)

- `SessionLifecycleManager` tracks `initAckReceived`.
- Calling `markSseConnecting()` emits `SSE_CONNECTING` without losing past init ownership.
- Successful SSE re-subscription via `markSseSubscribed(200)` restores `READY` immediately (transitioning `SSE_CONNECTING -> SSE_SUBSCRIBED -> READY`, or preserving `READY` directly if already initialized).
- Verified by `READY -> reconnect -> READY` tests in `superAgentSessionLifecycle.test.ts`.

### P1 — history warning contract mismatch (RESOLVED & VERIFIED)

- Shared lifecycle contract defined in `frontend/src/services/sessionLifecycleContract.ts` and `backend/src/superAgentSessionLifecycle.ts`.
- Backend emits `{ type: 'session_lifecycle', state: 'READY', sessionId, metadata: { historyWarnings, warnings, historyRestoreWarning } }`.
- Frontend extracts notices via `extractLifecycleWarnings(payload)` and tracks surfaced notices per session in `surfacedLifecycleWarningsRef` so reconnects and SSE replay do not duplicate notifications.
- Verified by contract tests in both backend (`superAgentSessionLifecycle.test.ts`) and frontend (`superAgentSessionReady.test.ts`).

### P1 — DEEP-04 progress isolation not fully wired

Improvements:
- Agent constructor no longer overwrites a singleton callback.
- AsyncLocalStorage helper exists.

But:
- `Agent.sendMessage` invokes `RequestProcessor.processRequest` before `agentLocalStorage.run(this, runAgentLoop)`.
- `RequestProcessor` calls `classifyRequest` without `onProgress`.
- `runWithProgressCallback` has no production use.
- Default Senopati classifier receives undefined progress callback.

This avoids the previous “last constructed agent” behavior, but does not establish correct per-session classifier progress delivery.

Required remediation:
- Execute preprocessing/classification inside agent execution context, or explicitly pass `agent.onEvent` as `onProgress`.
- Test real concurrent `RequestProcessor.processRequest`, not only AsyncLocalStorage helper functions.

## Additional findings

### NEW-01 — Concurrency wait queue can accumulate stale callbacks (P2)

`SharedConcurrencyLimiter.acquire` pushes a wake callback to `processQueue` on every 100ms wait. If the timer resolves normally, that callback is not removed. Long contention can accumulate stale callbacks; release pops one stale callback at a time.

This does not break slot ownership but can cause unnecessary memory growth and ineffective wake-ups.

Recommendation: use a cancellable waiter entry removed on timeout, or rely on polling without retaining timed-out callbacks.

### NEW-02 — remediation tests use mixed runners

New T-Line backend files import from `bun:test`.
Running them through Vitest fails with “Cannot use describe outside of the test runner.”

Correct command `bun test backend/tests` passes **102/102**. Test scripts/docs should clearly separate Bun-test backend suites from Vitest frontend suites.

### NEW-03 — AGY commit provenance contamination

Before delegation, T-Line already had dirty changes in files including:
- `desktop-tauri/src-tauri/Cargo.lock`
- `frontend/src/generated/superagentCliCatalog.json`
- `frontend/vite.config.ts`
- `package.json`

Commit `d9dca08` includes those files despite the instruction to preserve unrelated dirty work. Their provenance is therefore mixed with this remediation and they were pushed to main.

This needs manual review before treating `d9dca08` as a clean isolated remediation commit.

## Tests actually rerun by independent audit

### SuperAgent
- Build: PASS
- 9 test files / 90 tests: PASS
- Direct scope bypass probe: FAIL as described above

### T-Line backend
- Full `bun test backend/tests`: **104 pass / 0 fail** (25 files)

### T-Line frontend affected suites
- 10 files / **44 pass / 0 fail**

### T-Line build
- `bun run build`: **PASS** (Zero TypeScript errors, frontend & backend production bundles built)

## Release gate

Do **not** mark this remediation production-certified yet.

Resolved gates in this pass:
- [x] Fix DEEP-06 reducer integration and make T-Line build pass.
- [x] Fix DEEP-08 READY-after-reconnect.
- [x] Fix lifecycle metadata/history-warning schema.
- [x] Add integration tests that cover real bridge/UI call sites (`superAgentTurnStatusIntegration.test.ts`).

Remaining gates:
1. Close DEEP-02 absolute/shell fileScope escape in SuperAgent Core.
2. Wire and test real per-agent classifier progress in SuperAgent Core (DEEP-04).
3. Review contaminated `d9dca08` files for unrelated changes.
4. Run installed native Tauri + real provider E2E and CLI-vs-T-Line parity traces.

## Final status

T-Line client defects (DEEP-06 turn outcome UI integration, DEEP-08 READY reconnect loss, lifecycle warning contract mismatch, and build failures) are **RESOLVED & VERIFIED**. The overall cross-project release remains gated by Core DEEP-02 absolute shell escape and native Tauri/real-provider E2E certification.
