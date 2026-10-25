# Persistent Parallel Assistant Workspace — Implementation Plan

**Date:** 2026-10-25  
**Status:** Planning only — implementation and end-to-end validation not started  
**Primary repository:** `t-line`  
**Runtime repository:** sibling `superagent`  
**Owner experience:** T-Line is a general-purpose assistant cockpit; SuperAgent is the canonical execution runtime.

## 1. Objective and user experience

From one T-Line conversation, accept multiple independent goals, create a bounded execution graph, dispatch several agents concurrently (research, browser, workspace/code, automation), let the user continue chatting while tasks execute, and show per-agent real status, output, approvals and completion summaries. Work must be resumable **only when the persisted execution evidence permits safe resume**, including after UI or network reconnection. No external assistant or third-party integration is required.

Example: "Audit application A, research competitors, and check browser navigation in parallel; report the findings." The main assistant decomposes the request into independently owned tasks; workers execute at the same time when authorized and safe; the parent aggregates evidence and unresolved issues.

Non-goals: cloning an external app; replacing the current model providers or tools; creating a second task database in T-Line; unrestricted unattended writes; cross-owner access; promising that tasks survive power loss without a supervised resident runtime.

## 2. Verified baseline (2026-10-25)

| Capability | Observed code | Gap |
| --- | --- | --- |
| Existing master / worker / subagent execution | `superagent/src/core/agent.ts`, `src/core/tools.ts`, `t-line/frontend/src/components/SuperAgentConsoleHeader.tsx` | Exposing parallel *independent goals* is not the same as safe durable task orchestration. |
| Parallel read-only tool batches | `superagent/src/core/agent/ToolExecutor.ts` (cap 6) | Side-effecting tools deliberately serialize; build dependency- and resource-aware agent scheduler rather than widening all tool concurrency. |
| Scheduler / background jobs | `superagent/src/core/daemon/daemonScheduler.ts` (default maxConcurrentJobs=3), Brain task/CLI delegation | Scheduler/Brain records and workers lack one canonical durable execution lifecycle across interactive sessions. |
| Multi-agent selection | `t-line/backend/src/superAgentBridge.ts:397-433` | Switching process-level mode or args kills the active process tree; must not disrupt other chat sessions, subprocesses or jobs. |
| Desktop task monitor | `t-line/frontend/src/components/SuperAgentTaskMonitor.tsx`; `superagent/src/core/channels/tlineTaskSnapshot.ts` | Mainly bounded read snapshot; creator-scoped CLI cancellation/retry only under explicit gates, not general owner task control. |
| Brain | `t-line/docs/2026-10-22-tline-brain-unification.md` | Logical task records are not proof that another agent process is running. |
| Core rolling restart & affinity | `superagent/docs/plans/2026-10-25-superagent-core-rolling-restart.md` | Supervisor preserves generation affinity but does not serialize active agent state; reconcile before automatic replay. |
| Desktop session lifecycle | `t-line/frontend/src/App.tsx`, `t-line/backend/src/superAgentBridge.ts` | Tab preservation and in-memory SSE buffer are not durable event replay after crash/restart. |

**Current limitations are not release-ready claims.** Validate live local desktop, provider, crash recovery and permissions with actual acceptance runs.

## 3. Architecture and ownership

```text
T-Line UI: Assistant Chat + Task Center + Approval Inbox
  | authenticated REST/WebSocket/SSE (workspace + session + owner)
T-Line backend: thin authenticated proxy / reconnect adapter
  | no duplicated task state or direct ~/.superagent-r file writes
SuperAgent stable API / process supervisor
  | canonical assistant task service, dispatcher, journal, event stream
Durable Task Registry & Execution Journal (~/.superagent-r, scoped IDs)
  | leases / state transitions / idempotency / recovery / evidence
Worker pool: planner, research, browser, workspace, automation, reviewer
  | per-task capability policy, workspace boundary, resource locks
Existing tools: CDP, CLI bridge, MCP, RMemory, Brain, daemon, gateway
```

- Keep **SuperAgent** the single source of truth for jobs, policies, session ownership, artifacts, and status. T-Line is a transport + UX client.
- Preserve the existing supervisor/transport host and connections. Avoid restarting the shared server just to change a chat mode or model preset; select execution profile per session/task.
- Define stable IDs: `ownerId`, `projectId`, `workspaceId`, `sessionId`, `goalId`, `taskId`, `agentRunId`, `attemptId`, `eventSeq`. IDs are not authorization by themselves.
- Task DAG edges encode dependencies; parallel tasks run only when their declared resources/capabilities do not conflict.
- Persistent outbox/event journal uses cursor-based catch-up after reconnect. Existing T-Line SSE buffering is a fast path, not the durable source.

## 4. Work packages in dependency order

### P0-A — Contract, compatibility and safe baseline

- [ ] Inventory active workers, task writers, daemon jobs, session init/abort, CDP leases, and all T-Line bridge lifecycle call sites.
- [ ] Specify a versioned `AssistantTask` schema and transition map: `queued -> planning -> awaiting_approval -> running -> completed | failed | cancelled | interrupted | reconcile_required` (plus `paused` only when the worker can actually pause).
- [ ] Define capabilities/permissions for read, write, browser, process, external side effects and user approval. Classify each operation by idempotency and compensation requirements.
- [ ] Define HTTP/event error semantics, authorization and redaction, single active attempt claim, retry eligibility, and concurrency budgets.
- [ ] Ship contract tests and a feature flag **off by default**; do not turn on execution before safety and integration checks.

**Gate:** invariant tests for task state transitions, owner/workspace isolation, duplicate `idempotencyKey`, stale lease, and unauthorized approval pass.

### P0-B — Canonical durable execution in SuperAgent

- [ ] Add one task journal/service, atomic append or DB transaction, signed/nonce-bound worker claims, heartbeats, bounded logs and state/audit records.
- [ ] Build a dispatcher with bounded concurrency (initial default 3 concurrent independent tasks per owner/workspace; configurable with global host cap and provider rate budgets); separate agent/task concurrency from the existing 6 read-only tool-call maximum.
- [ ] Add DAG scheduling and resource/file-scope locks, shared browser/CDP tab leases, write collision detection, and sequential fallback for shared files.
- [ ] Integrate existing master/subagent and CLI Bridge as worker adapters; preserve prior capabilities and event provenance.
- [ ] Attach task outcome and artifact evidence; never equate a logical Brain task with a spawned worker or infer success from process disappearance.
- [ ] On process start, reconcile journal with PID/start identity, lease, workspace, artifact evidence and side-effect log. Fail ambiguous work as `reconcile_required`; **no blind rerun** of non-idempotent operations.
- [ ] Persist checkpoints at safe task boundaries, not fake resumability of an arbitrary suspended model/tool call.
- [ ] Expose owner-scoped API: `POST /api/assistant/tasks`, `GET /api/assistant/tasks`, `GET /api/assistant/tasks/:id`, `GET /api/assistant/tasks/events?cursor=`, `POST /api/assistant/tasks/:id/{pause,resume,cancel,steer,retry}`, and explicit `approve` as individually allowlisted actions. Implement only actions whose semantics and tests are proven; avoid generic shell or arbitrary command execution routes.
- [ ] Reuse the existing supervisor/runtime paths; never kill unrelated processes, tunnel hosts, connectors, or worker generations.

**Gate:** three isolated goals visibly overlap in execution; duplicate submission yields one goal/task; crash/reconnect replay is consistent; protected/cross-project write and unverified retry are denied.

### P0-C — T-Line transport and session lifecycle

- [ ] Refactor `backend/src/superAgentBridge.ts` process-level `agentMode`/argument restart behavior: the bridge must not `taskkill /T /F` a shared process for a per-chat mode switch. Keep session-owned execution profile as data in API calls.
- [ ] Keep `workspace/sessionId` explicit in init, chat, SSE, approvals and actions; repair detach/reconnect without routing a tab to another session.
- [ ] Add thin authenticated API/event proxy in `backend/src/superAgentRoutes.ts` (or dedicated mounted router) after canonical Core API exists; do not read Core runtime files directly.
- [ ] Implement resume cursor/catch-up with bounded replay and explicit gap diagnostics, backpressure limits, abort signals, redaction, and 409/403/503 error UX.
- [ ] Establish exact lifecycle semantics for closing a tab, T-Line window, tray quit, daemon/core restart, and OS shutdown. Running tasks detach from UI but require a still-running supervised host; optional service/tray host mode needs a separate acceptance gate.
- [ ] Use existing Core supervisor and rolling-restart session affinity; treat a failed owning worker as interrupted until reconciled.

**Gate:** toggling between single and multi in one tab never terminates a different tab's active task; T-Line disconnect/reconnect does not duplicate execution; correctly scoped SSE replays without cross-session events.

### P1-A — T-Line assistant experience and command/control center

- [ ] Create a unified `Assistant Workspace` view: main chat, goals/tasks DAG, active agent cards, progress evidence, resource usage, budget, timeline, child logs, approval inbox and final synthesis.
- [ ] Buttons: inspect, pause/resume (if supported), steer, cancel, retry (only if eligible), open artifact, compare attempts; show reasons when not authorized.
- [ ] Keep chat responsive while independent tasks continue; new messages can create new tasks or steer an existing task by explicit task ID, not by accidental session fallback.
- [ ] Show queue position, lock waits, errors and ambiguous/recovery states; never show invented percentages when no measurable progress exists.
- [ ] Per-session controls for concurrency, model preset, tool scopes, max spend/time, automation preference and background execution.
- [ ] Accessibility, loading/empty/error states and desktop/tray notifications; persist only benign UI preferences in frontend storage.
- [ ] Reuse Brain Explorer, `ActiveTasksBar`, `SubAgentTerminalModal`, `SuperAgentTaskMonitor` rather than duplicate panels.

**Gate:** operator can open 3 tasks, interact with chat, inspect distinct logs, approve an allowed action, safely cancel only the intended task, and receive a grounded aggregate report.

### P1-B — General-assistant planner, delegation and synthesis

- [ ] Make the default assistant role general-purpose, not coding-only. Use existing assistant identity, classifier and RMemory bootstrap before task planning.
- [ ] Decompose user goals to typed subtasks; allow parallelism only for independent scopes. Ask only when authorization or ambiguity requires it.
- [ ] Pick existing specialist skills/tools dynamically with explicit resource budgets; support research/browser/file/code/automation workers as *roles*, not additional always-running processes.
- [ ] Combine results with references to task/artifact evidence, highlight disagreements, missing verification and actions requiring approval.
- [ ] Avoid repeated plan cycles, spawned-agent loops, self-approval and unbounded task expansion; enforce fan-out, depth, token, runtime and cost limits.

**Gate:** benchmark fixtures show correct decomposition and aggregation without permission escalation, cross-project leakage or duplicated tool execution.

### P2 — Proactive and resilient assistant

- [ ] Optional scheduled/trigger-based goals with owner-approved capabilities, quotas, rate limits and notification routing.
- [ ] Verified skill/memory candidates from successful outcomes; explicit review to promote actionable memory or automation.
- [ ] Host process supervision, restart status and diagnostics; external service mode is opt-in and must not hijack existing port 7888.
- [ ] Governance dashboard: daily job budget, permission scopes, stop-all for *owned* tasks, audit trail, retention/export and recovery checks.
- [ ] Performance/resource profiling under 1, 3 and 6 logical tasks, CPU/RAM and provider throttling, browser tab contention.

**Gate:** unattended approved read-only recurring task completes; safe retry of idempotent work; ambiguous external write remains blocked for human review.

## 5. Suggested implementation file map

**SuperAgent runtime**
- `src/core/assistant/` (new canonical task types, state machine, dispatcher, journal, worker adapter, event replay, policies).
- `src/core/agent.ts`, `src/core/tools.ts`, `src/core/agent/ToolExecutor.ts`: integration points, not wholesale rewrites.
- `src/core/daemon/`, `src/core/brain/`, `src/core/runtime/`, `src/core/channels/`: unify observability and authority, respect existing scopes.
- `src/serverRoutes.ts` or modular route registration: owner-scoped endpoints and stream.
- `tests/assistant*.test.ts`: deterministic concurrency, recovery, idempotency and abuse regressions.

**T-Line desktop**
- `backend/src/superAgentBridge.ts`: session-scoped mode, reconnect and non-destructive lifecycle.
- `backend/src/superAgentRoutes.ts`: authorized proxy with explicit action allowlist.
- `frontend/src/components/`: assistant task center and approval surfaces building on existing components.
- `frontend/src/hooks/`: typed task API, event-cursor client and optimistic-safe updates.
- `backend/tests/`, `frontend/src/components/__tests__/`: contract, bridge, UI and reconnection tests.
- `desktop-tauri/`: only after desktop lifecycle requirements are validated.

## 6. Acceptance matrix / failure injection

1. **Parallel execution:** three truly independent tasks overlap in timestamped worker traces; concurrency cap respected; fourth queues when configured cap is three.
2. **Isolation:** two users/projects/workspaces/sessions cannot read, steer, cancel or inherit each other's tasks, memory, browser tabs or approval tokens.
3. **Writer collision:** two workers writing the same file are serialized or blocked; distinct worktrees are independent; abort releases only owned leases.
4. **Session switches:** changing model/mode in T-Line does not restart the shared process, drop ongoing work, or lose existing SSE/chat ownership.
5. **Reconnect/restart:** tab close, frontend reload, socket break, transport restart, API rolling restart and worker crash tested independently; event gaps explicit, no duplicated side effects.
6. **Recovery:** abandoned/partial actions become `interrupted` or `reconcile_required` with evidence; only idempotent verified work is auto-retried.
7. **Approval/security:** disallowed filesystem paths, external side effects, cross-owner actions, expired credentials and unauthorized direct APIs fail closed.
8. **Usability:** main chat accepts new independent work while prior tasks run; each agent card shows real timestamps/results; errors do not appear as successes.
9. **Resources:** bounded CPU/RAM, stdout/event size, worker fan-out, cost/token and browser tab leases; instrument queue wait and completion time.
10. **Packaging:** both repo builds and focused tests pass; local loopback E2E and packaged Tauri GUI acceptance executed and recorded separately.

## 7. Rollout and ownership

- Stage 0: documentation + contract/tests. No production job spawning.
- Stage 1: canonical backend behind opt-in feature flag; shadow task projection compared with existing dashboard, no execution duplication.
- Stage 2: T-Line control UI behind flag, local internal acceptance in disposable workspaces.
- Stage 3: canary on one owner/workspace with read-only workers first; then explicitly approved writes.
- Stage 4: expand to general use only after crash/recovery, budget and security gates pass.
- Rollback turns off *new* dispatch without deleting active records; existing workers are drained/retained using verified ownership and supervisor rules, not blanket termination.
- Keep unrelated dirty working-tree changes untouched in both repositories. Stage only files belonging to this feature.

## 8. Source control policy

- For every commit related to this initiative, **do not include external competitor, vendor, service, or product brand names in the commit subject or body**.
- Use neutral, capability-based messages, e.g. `docs: plan persistent parallel assistant workflows`, `feat: add durable task coordinator`, `fix: preserve sessions during mode switches`, `test: cover concurrent task isolation`.
- The repository names and necessary technical identifiers can remain in source code and documentation; the no-brand rule specifically governs **commit messages**.
- Never stage unrelated files or automatically rewrite prior commits.

## Implementation checkpoint — 2026-10-25

- **P0-A partially implemented:** typed persistent task state machine, owner/workspace journal, revision guards, bounded event sequence and tested model mode resolver. Full authorization contract and runtime endpoint are open.
- **P0-B foundation implemented in SuperAgent:** bounded in-process parallel dispatcher with per-resource read/write locks, verified CAS task claim, idempotent durable task creation, and no automatic replay of unknown side effects. This module is not yet wired to real agent spawning, task API or desktop actions.
- **P0-C mode-switch safety implemented:** desktop now creates a separate mode-scoped chat session and shared backend no longer kills the core process on changes to chat mode. Startup flag changes require explicit supervised restart. Session restart/disconnect E2E remains open.
- **Verification:** SuperAgent 13 focused tests and TypeScript build pass; T-Line 2 mode tests and backend/frontend builds pass. No packaged desktop or live concurrent model-worker acceptance was run.
- **Remaining milestones:** task-to-worker adapter, scoped authenticated orchestration APIs, durable streamed events, task control UI, crash reconciliation, proactive goals and packaged desktop acceptance.
- **Evidence:** `superagent/docs/plans/2026-10-25-persistent-parallel-task-runtime.md`.

## 9. Starting order

1. P0-A contract + lifecycle audit.
2. P0-B core task journal, scheduler, lease safety.
3. P0-C T-Line non-disruptive session bridge, API and streaming.
4. P1-A desktop UI, then P1-B dynamic delegation and synthesis.
5. P2 proactive workflows only after the safe execution model is proven.

**Definition of done:** the user can issue multiple goals from T-Line, watch and steer real isolated concurrent agents, continue chatting, reconnect without duplicate side effects, inspect reliable completion evidence and cancel/retry within explicit permissions. Anything less remains a partial implementation.
