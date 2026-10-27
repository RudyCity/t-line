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
- Backend full suite: **102/102 PASS**
- Frontend affected suites: **39/39 PASS**
- `bun run build`: **FAIL**
  - `superAgentMultimodalClient.test.ts`: unused `size`
  - `SuperAgentConsole.tsx`: unused `readFileAsDataURL`
  - `SuperAgentConsoleUtils.ts`: wrong `applyChatTurnStatus` invocation/signature
- Direct reconnect lifecycle probe: **FAIL**
  - first subscription -> READY
  - subsequent SSE subscription -> SSE_SUBSCRIBED (not READY)

## Finding status

| ID | Status | Independent verdict |
|---|---|---|
| DEEP-01 FastPath false-success | **FIXED / VERIFIED** | FastPath sets terminal outcome; chat worker fails closed on unknown/null. Tests cover failure, abort, null and single terminal emission. |
| DEEP-02 delegated fileScope | **OPEN P0 / PARTIAL FIX** | File API paths are guarded and symlink/traversal checks exist, but shell commands can reference absolute outside-scope paths without being rejected. |
| DEEP-03 child permissions | **FIXED IN SOURCE** | Actual child callback delegates permission to parent with provenance and fails closed without parent; destructive commands remain blocked. |
| DEEP-04 classifier progress isolation | **PARTIAL / OPEN P1** | Last-agent global overwrite was removed, but production RequestProcessor runs before `agentLocalStorage.run`; `runWithProgressCallback` has no production call site and classifier receives no explicit onProgress. Per-agent classifier progress is therefore not wired/proven. |
| DEEP-05 concurrency N + lock ownership | **FIXED / VERIFIED for original bug** | 0/1/2/3 slot tests pass; live >60s lock not stolen; lease ownership checked. Additional queue hygiene concern noted below. |
| DEEP-06 durable turn outcome UI | **OPEN P1** | Reducer exists, but integration calls it with the wrong argument order/count. TypeScript build catches this; at runtime status processing is effectively wrong/no-op. |
| DEEP-07 no-progress/nudge | **PARTIAL** | needs-input/blocker guard is wired and max nudge remains bounded. `isRepetitiveNarration` was added but is never used in production. |
| DEEP-08 READY/SSE replay/session recovery | **PARTIAL / OPEN P1** | Cold init order, 404 retry, Core `id:` parsing, `?lastEventId=`, and no-write-replay are improved. Reconnect state regresses READY -> SSE_SUBSCRIBED; history warning payload contract is mismatched frontend/backend. |
| DEEP-09 multimodal | **FIXED IN SOURCE, NOT SHIPPABLE YET** | Typed image parts now flow frontend -> bridge -> Core and base64 is not displayed. Relevant tests pass, but T-Line build currently fails. |
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

### P1 — DEEP-06 chat_turn_status integration is broken

`chatTurnStatusReducer.applyChatTurnStatus` signature:
`(currentTurns, payload, currentActiveSessionId?)`

But `SuperAgentConsoleUtils.ts` calls:
`applyChatTurnStatus(payload, turnRecordsRef.current, setMessages, setLoading, setToolProgressMsg)`

Consequences:
- TypeScript compile fails.
- At runtime the reducer receives the payload as `currentTurns` and Map as `payload`, so authoritative status is not applied correctly.
- Tests exercise reducer directly but do not cover the real integration call.

Required remediation:
- Call reducer with correct arguments.
- Apply returned `nextTurns`, loading/progress flags and notification explicitly.
- Add a test through `handleAgentEventPayload` for running -> completed/failed/interrupted/cancelled, not just direct reducer unit tests.

### P1 — DEEP-08 reconnect loses READY

Direct state-machine probe:

`WS_CONNECTED -> INIT_ACK -> SSE_SUBSCRIBED -> READY` works initially.

Calling `markSseSubscribed(200)` again (representing SSE reconnect) changes state:
`READY -> SSE_SUBSCRIBED`

Since frontend sets `sessionReadyRef.current=false` for every non-READY lifecycle event, prompt sending can become blocked after a successful SSE reconnect.

Required remediation:
- Preserve READY when an already initialized READY session re-subscribes.
- Or call an explicit `markSseConnecting()` transition and return to READY only when both init ownership and stream subscription remain valid.
- Add reconnect-after-READY test.

### P1 — history warning contract mismatch

Backend lifecycle sends:
`{ type:'session_lifecycle', ..., metadata:{ warnings, historyWarnings, ... } }`

Frontend checks:
`payload.meta?.historyRestoreWarning`

Therefore Core resume/history warnings are not surfaced through the actual contract.

The current frontend test constructs `meta.historyRestoreWarning`, so it tests a shape the backend does not emit.

Required remediation:
- Define one shared lifecycle schema/type.
- Read `payload.metadata.historyWarnings/warnings` (or change backend consistently).
- Add a bridge->frontend contract test using an actual backend lifecycle event.

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
- Full `bun test backend/tests`: **102 pass / 0 fail**

### T-Line frontend affected suites
- 9 files / **39 pass / 0 fail**

### T-Line build
- **FAIL (3 TypeScript errors)**

## Release gate

Do **not** mark this remediation production-certified yet.

Minimum gates:
1. Close DEEP-02 absolute/shell fileScope escape.
2. Fix DEEP-06 reducer integration and make T-Line build pass.
3. Fix DEEP-08 READY-after-reconnect.
4. Fix lifecycle metadata/history-warning schema.
5. Wire and test real per-agent classifier progress.
6. Add integration tests that cover the real bridge/UI call sites instead of copied/mock logic.
7. Review contaminated `d9dca08` files for unrelated changes.
8. Then run installed Tauri + real provider E2E and CLI-vs-T-Line parity traces.

## Final status

Core remediation contains substantial valid fixes, but the combined SuperAgent × T-Line system remains **NOT CERTIFIED** due to one P0 scope escape, broken T-Line status integration/build, and reconnect/session contract defects.
