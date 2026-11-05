# Final Independent Re-audit — SuperAgent Core × T-Line
Date: 2026-10-28

## Verdict

**T-Line remediation VERIFIED. Combined SuperAgent × T-Line remains NOT PRODUCTION-CERTIFIED because one P0 Core delegated fileScope shell escape remains.**

Audited remediation commits:
- SuperAgent Core: `f3d2d2c9`
- T-Line: `8517938`

## Independent verification

### SuperAgent Core
- 98/98 focused regression tests PASS.
- Audited source files are unchanged from `f3d2d2c9` in the current workspace.
- FastPath outcome, child permissions, real RequestProcessor classifier progress isolation, concurrency ownership/waiter hygiene, and repetitive-narration guard are verified.
- **Adversarial delegated shell probe still finds an environment-variable expansion bypass.**

### T-Line
- Backend full suite: 104/104 PASS.
- Frontend affected suites: 47/47 PASS.
- Full `bun run build`: PASS.
- Direct reconnect probe: READY -> SSE_CONNECTING -> READY -> READY, with `canSendPrompt() === true`.

## Finding status

| ID | Final status |
|---|---|
| DEEP-01 FastPath false-success | FIXED / VERIFIED |
| DEEP-02 delegated fileScope | **OPEN P0** |
| DEEP-03 child permissions | FIXED / VERIFIED |
| DEEP-04 classifier progress isolation | FIXED / VERIFIED |
| DEEP-05 concurrency | FIXED / VERIFIED |
| DEEP-06 durable turn status UI | FIXED / VERIFIED |
| DEEP-07 nudge/no-progress | FIXED for audited concern |
| DEEP-08 READY/SSE/session replay | FIXED / VERIFIED |
| DEEP-09 multimodal | FIXED / VERIFIED build/tests |
| DEEP-10 canonical subagent identity | FIXED / VERIFIED |
| DEEP-11 silent first-option fallback | FIXED |
| DEEP-12 CLI/T-Line parity | PARTIAL BY DESIGN / acceptable |

## P0 blocker — environment-variable shell expansion escapes fileScope

`fileScopeGuard.ts` now blocks literal absolute paths, traversal, redirection, common file-operation operands, script paths, nested shells, and direct symlink/reparse escapes. However it validates the unexpanded shell command string.

Independent probe:

```text
scope = src/core/agent/**
cwd   = src/core/agent

powershell -Command "Get-Content $env:WINDIR\win.ini"
=> allowed: true

cmd /c type %WINDIR%\win.ini
=> allowed: true
```

At execution time PowerShell/cmd expands those variables to paths outside the delegated scope. `ToolExecutor` uses this validator before shell execution, so this remains a real delegated-scope policy bypass.

The current hard-enforcement tests do not cover `$env:VAR`, `%VAR%`, `$HOME`, environment expansion, or environment-derived `Join-Path` operands.

### Required remediation

Preferred solution: for children with explicit `fileScope`, fail closed on generic shell unless a narrowly typed command policy can resolve every filesystem operand. If shell support is retained, explicitly handle/reject PowerShell environment variables and provider paths, cmd `%VAR%` / delayed variables, POSIX environment variables / tilde / command substitution, nested shells, scripts, pipelines, and redirection.

Add adversarial tests through **ToolExecutor**, not only helper tests, for the exact environment-variable bypasses above.

## T-Line verification details

### DEEP-06
`SuperAgentConsoleUtils` now calls `applyChatTurnStatus(turnRecordsRef.current, turnPayload, currentActiveSessionId)`, stores `nextTurns`, applies loading/progress changes, and emits notifications once. Production integration tests cover queued/running/completed/failed/interrupted/cancelled/replay/session filtering.

### DEEP-08
`SessionLifecycleManager` now preserves READY on direct re-subscribe and restores READY after `SSE_CONNECTING -> SSE_SUBSCRIBED` when init is already acknowledged. Core event cursor and no-write-replay behavior remain covered.

### Lifecycle warnings
Frontend consumes backend `metadata` through `extractLifecycleWarnings`, with legacy `meta` compatibility. Warnings are deduplicated per session.

## Regression counts rerun independently

- Core: **98 pass / 0 fail**.
- T-Line backend: **104 pass / 0 fail**.
- T-Line frontend affected suites: **47 pass / 0 fail**.
- T-Line production build: **PASS**.

## Certification decision

**T-Line side: remediation verified.**

**Combined SuperAgent × T-Line: NOT CERTIFIED** until DEEP-02 environment-expansion shell bypass is closed and adversarial ToolExecutor tests pass.

After that P0 is fixed, the remaining release gate is installed native Tauri + real-provider E2E/parity validation.