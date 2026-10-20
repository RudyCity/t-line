# T-Line ↔ SuperAgent CLI Parity — Master Audit and Implementation Plan

Date: 2026-10-20
Target: SuperAgent CLI source (`../superagent`, branch `main`) → T-Line React/Tauri desktop (`t-line`, branch `main`)
Status: **Increment 6A implemented (locally persisted observed-task SSE journal with restart recovery); full feature parity NOT achieved.**

## Baseline findings

Audited the actual repositories rather than equating a UI button to working support.

| Area | Current evidence | Deficit |
|---|---|---|
| Slash command registry | Source scanner found **62 statically named CLI commands**, T-Line currently declares **13 same-name UI command handlers**, and **49 names do not have a matching handler**. These counts are a source inventory, not behavioral parity. | Most CLI features cannot be invoked as equivalent desktop actions |
| Legacy local slash handlers | T-Line's `SuperAgentCommands.ts` previously delegated multiple `/command` handlers back to `handleSend('/command')`, causing recursive UI routing. | No safe CLI command dispatcher exists over the current HTTP/SSE bridge |
| Runtime selection | T-Line backend starts `bun x superagent --server --client-mode tline` by default. The resolved package may differ from the checked-out CLI source. | Runtime identity / version mismatch cannot be assumed away |
| Config and auth | Existing settings, provider and preset editors; HTTP/SSE bridge and authenticated backend proxy. | Verify with actual current server, not inferred features; local API permission gates matter |
| Task and session identity | Hermes Phase 5 workspace-scoped live task status is being developed in the SuperAgent repo; T-Line uses a separate UI history implementation. | E2E SSE reconnect, session isolation, cancel/recovery, workspace switching |
| CLI agent operations | CLI source has /agents, /worktree, /tools, /peer, /muse, /selfdev, /daemon, /gateway, /motion, /telegram, /tunnel, /mp, /mcp, /macro. | None of these names is automatically available via a T-Line desktop action |
| Motion Studio | SuperAgent exposes a developing motion implementation. Separate T-Line backend Motion bridge work is in progress. | Needs editor UI, job status/cancel, artifact preview, desktop packaging and cross-repo E2E |
| CDP terminal | SuperAgent CDP read/write/watch/execute modules exist and tests pass. | Real T-Line renderer/PTY remote-debugging compatibility not confirmed |
| E2E | Frontend/backend build and some existing tests pass. | Full CLI↔T-Line action/event-contract parity tests not present |

### High-priority source gaps

**P0 — truthful execution and session safety**
- [x] Automated source comparison script `scripts/audit-superagent-parity.cjs` and committed JSON inventory.
- [x] Surface CLI-only command names in T-Line suggestions with an explicit CLI-only label.
- [x] Reject attempts to run unimplemented CLI slash commands as if they were normal AI chat prompts.
- [x] Replace legacy recursive slash-command forwarding with explicit unsupported notifications (existing actual local UI actions remain untouched).
- [x] Opt-in T-Line local CLI runtime selection: `TLINE_SUPERAGENT_SOURCE_DIR` picks a validated *built* local SuperAgent package rather than relying on bunx; invalid path fails closed.
- [x] Add an authenticated SuperAgent capability manifest at `GET /api/tline/capabilities` with live CLI registry, schema/version and a separate read-only HTTP action allowlist. The source scanner remains for offline autocomplete fallback.
- [x] Change T-Line's port probe from accepting *any* HTTP status on port 7888 to verifying an authorized, versioned JSON `/api/ping` response. Occupied-but-unverified ports are not treated as ready or free, and are never automatically terminated.
- [ ] Reconcile workspace, session ID, mode and active-provider changes before reconnect/restart; never kill unmanaged processes.

**P1 — functional feature parity (not just autocomplete)**
- [x] First real read-only desktop command adapters: `/daemon status`, `/gateway status` and `/parity` server capability inspection. Reject unsupported subcommands before any upstream request.
- [x] Add read-only, typed desktop inspection adapters for `/mcp list`, `/tools list`, `/selfdev status` and `/muse status`; all mutation subcommands remain CLI-only.
- [ ] Implement authorized write/execute adapters for MCP/tools, selfdev, Muse, and Telegram only with explicit per-operation scope and approvals.
- [x] Implement read-only workspace-scoped retained CLI/daemon/Muse task snapshots and cursor-based conditional polling; stale snapshots are discarded on workspace/session switch.
- [x] Add authenticated task SSE streaming, event IDs and bounded replay while the same SuperAgent process is running, with explicit replay-gap reset.
- [x] Persist bounded, sanitized observed task SSE snapshots locally across restarts; resume only events that were actually sampled.
- [ ] Add a source-native durable task transition ledger for changes when no SSE listener is connected; no claim of complete downtime reconstruction.
- [ ] Add authorized cancel/retry adapters with ownership, workspace, session and trusted out-of-band approval verification.
- [ ] Add UI for `/daemon` (schedule, logs, cancel), `/gateway`, `/motion`, `/macro`, `/mp`, `/skills`.
- [ ] Bring `/memory` and `/history` workflow semantics in line with CLI, with workspace-backed sessions.
- [ ] Implement multi-project/worktree authorization, progress visualization, review/approval and CLI agent handoff.
- [ ] Align slash command aliases, subcommands and dynamic plugin commands with the server registry.
- [ ] Implement bounded, versioned API adapters; no opaque raw shell-command proxy.

**P2 — desktop fidelity**
- [ ] Verify TLine Tauri release build and CDP renderer connection against a running desktop app.
- [ ] Test xterm input/buffer accessibility, multiple tabs, process lifecycle, and loss/recovery of debugging ports.
- [ ] Add motion editor/artifact routing, desktop media resources and e2e user workflows.
- [ ] Add parity gates comparing CLI command/API capability IDs to T-Line UI routes and tests on every PR.
- [ ] Add performance/regression coverage for SSE reconnect, rapid workspace switching and concurrent agents.

## Increment 6A: persisted observed task journal across server restarts

- SuperAgent persists only allowlisted task snapshot metadata from the already
  existing SSE journal. Files live under the local user config root
  `~/.superagent-r/tline-task-ledger/` (hashed per-workspace/session filename,
  no raw workspace path in filename). Per-file mode is 0600 where supported,
  directory mode 0700. Unexpected task properties, credentials and chat
  session IDs are excluded from the durable representation.
- Each persisted scope holds at most 64 previously observed snapshots, with
  an upper file size limit of 2 MiB; at most 64 most-recently-written scopes
  are retained. Files older than 24 hours are rejected. Writes replace files
  atomically; malformed/oversized/foreign-scope journals are ignored.
- A restarted server can recover previously *observed* event IDs and resume
  from one of them in an authenticated matching TLine session. It emits a
  `restart-observation-gap` warning to make it clear that source transitions
  while offline cannot be reconstructed. When disk persistence fails, SSE
  continues in memory but sends `ledger-unavailable`; the UI displays both
  warnings distinctly.
- This is deliberately NOT a source-native durable task transition ledger.
  No native Tauri E2E has yet been confirmed; the running server must reload
  the newly committed code to use this increment. Existing CLI bridge process
  cancellation/retry remains behind CLI authorization; TLine buttons/actions
  are not exposed until per-task ownership and owner approval are verified.

## Increment 5: streaming task snapshots with bounded replay

- SuperAgent adds the `tasks.events` capability and
  `GET /api/tline/tasks/events?workspace=...&sessionId=...` over SSE.
  A valid authenticated request must resolve the **exact active TLine
  session**, same workspace and client mode; the stream closes if session
  authority disappears. At most 24 concurrent SSE listeners are accepted.
- A process-local event journal retains 64 observed task snapshot changes
  per workspace + chat session and at most 64 scopes for 10 minutes of
  inactivity. IDs use random per-process generation and a monotonically
  increasing sequence. `Last-Event-ID` resumes **only** from a retained
  event in the same session. Missing/expired/foreign IDs trigger explicit
  `reset` and the latest full snapshot, never a false claim of replay.
- Events are observed from the existing task sources every three seconds
  **while the stream is connected**. The event journal is not a durable
  source-emitted event log: task transitions occurring while no watcher
  samples them, or before/after restart, cannot be reconstructed.
- TLine provides an authenticated, fixed-path SSE relay that keeps the
  upstream bearer token server-side. The task monitor negotiates SSE,
  consumes streamed events with a bounded parser, persists only in-memory
  resume ID for reconnect, and falls back to conditional snapshot polling
  if an older server lacks `tasks.events`.
- Task mutation, cancellation, retry, and arbitrary command execution are
  still deliberately unsupported, pending explicit per-source authorization
  and an independent owner-approval handshake. Actual Tauri runtime E2E
  remains to be validated after a controlled service upgrade.

## Increment 4: retained task snapshots and desktop monitor

- SuperAgent adds the `tasks.snapshot` read-only action to the authenticated
  TLine capability manifest and implements `GET /api/tline/inspect/tasks.snapshot`.
  The handler requires a validated registered workspace and an active TLine
  session. Source data is projected from the existing CLI delegate store,
  daemon run ledger and current Muse task; there is **no second task engine**.
- Filtering uses canonical filesystem workspace ownership; daemon ledger is
  pre-filtered by exact workspace path and verified again. CLI delegation
  respects `delegateJobVisibleToWorkspace`; Muse task session ID is included
  only when it matches the querying chat's session. No foreign workspace
  IDs, log output, command arguments, artifact paths or policy JSON are sent.
- Each snapshot contains at most 60 task metadata records, plus one SHA-256
  cursor bound to the running server generation. When the client sends the same
  cursor and nothing changed, `changed:false` omits the tasks array.
  After a server restart or reconnection a new cursor triggers **full resync**.
  If a source fails, `incompleteSources` reports the specific unavailable
  subsystem instead of claiming its tasks were successful or absent.
- TLine uses the allowlisted, authenticated `tasks.snapshot` GET proxy with a
  64-character hex cursor validator. `/tasks status` reads a one-shot view.
  An optional collapsible task monitor polls every 3.5s **only while open**,
  suspends while the page is hidden, cancels in-flight requests on workspace
  or chat session changes, and renegotiates capability after a failure.
- Task evidence remains `verified`, `unverified`, `failed` or
  `not_applicable` as projected by the existing task sources. Polling does not
  prove OS process liveness, cannot replay intermediate transitions, and does
  not implement SSE resume, cancellation or task retry.
- No service was restarted or CLI workspace process terminated. Live Tauri E2E
  is pending an updated SuperAgent runtime with the new endpoint.

## Increment 3: safe MCP/tool/SelfDev/Muse observation

- SuperAgent registers `GET /api/tline/inspect/:action` for the exact
  `mcp.status`, `tools.catalog`, `selfdev.status`, and `muse.status` actions.
  Requests must come through the existing server authorization and resolve to
  a registered workspace **with an active TLine session**. No CLI command,
  shell command, or remote task is started by these endpoints.
- MCP shows names, transport, connectivity and tool **counts** only, never
  environment variables, endpoint headers, URL credentials or command args.
  MCP config is server-runtime-global; it is not misrepresented as isolated
  per workspace. Tool catalog lists names only, without arguments.
- Selfdev reports workspace-specific counters and non-secret configuration
  flags. Muse reports active task metadata only when its workspace matches
  the caller; completion evidence is unverified, not assumed successful.
- TLine expands the authenticated allowlisted GET proxy and slash suggestions,
  while refusing `/mcp reload`, `/selfdev disable`, `/muse stop`,
  `/tools run`, and other mutation forms before any network call.
- Cross-workspace and credential-redaction unit tests were added. Live Tauri
  E2E still needs an updated running SuperAgent; no server was restarted.
- Offline source-parity scanner numbers (62 static command names, 49 without
  matching historical TLine source handlers) describe source *handlers*, not
  the additional API status adapters; these are counted separately.

## Increment 2: live typed read-only actions

- SuperAgent: authenticated `GET /api/tline/capabilities` exposes live command
  names and aliases, but explicitly marks these as CLI-only. A separate HTTP
  allowlist currently contains just `daemon.status` and `gateway.status`.
- T-Line: `GET /api/superagent/parity/:action?workspace=...` verifies server-side
  bearer availability, only accepts declared read-only paths, validates the
  manifest shape, preserves non-2xx HTTP status, limits response to 1 MiB, and
  requires workspace context.
- UI: `/parity`, `/daemon status`, `/gateway status` use manifest negotiation
  and typed requests independently of LLM/model presets. No prompt or arbitrary
  slash command is sent to SuperAgent. `/daemon jobs/runs` and gateway writes
  remain intentionally unsupported because daemon state is global and missing
  workspace authorization would expose other workspaces.
- T-Line port probing now requires an authenticated, parseable SuperAgent
  `/api/ping` response with a version. Ports occupied by unrelated or
  unauthorized HTTP servers fail closed instead of triggering blind startup.
- Unit tests cover server command registry contract, backend proxy restrictions,
  port identity/occupancy and frontend command negotiation.
- **Live server restart and full Tauri E2E are not performed.** Running services
  may still use an older build without the new capability endpoint; in that
  situation the UI explicitly reports unsupported runtime version.

## Increment 1 developer instructions

Regenerate the source inventory after SuperAgent CLI command changes:

```sh
node scripts/audit-superagent-parity.cjs
node scripts/audit-superagent-parity.cjs --check
```

By default the tool reads sibling `../superagent`. To audit a different checkout,
set `TLINE_SUPERAGENT_SOURCE_DIR` to its absolute path. This tool does **not**
execute CLI commands, contact remote services, or rewrite SuperAgent source.

To launch T-Line against a local, already-built SuperAgent CLI checkout (opt-in):

```powershell
$env:TLINE_SUPERAGENT_SOURCE_DIR="D:\backup from pc asus\Documents Development\superagent"
# Run `bun run build` from the SuperAgent source before starting T-Line.
bun run dev:backend
```

The backend defaults to the existing `bun x superagent` launcher when this
variable is absent. It **does not** automatically restart a running process or
prove that an already-running process on port 7888 matches the selected local build.
The runtime selection is explicit to prevent accidental running of a stale package.

### Verification

- Frontend: `bun run build:frontend` and `bun run test`.
- Backend: `bun run build:backend` and
  `bun x vitest run tests/superAgentRuntime.test.ts --environment node`.
- Parity drift: `node scripts/audit-superagent-parity.cjs --check`.
- Full release gates still require actual UI/manual Tauri testing, server identity
  validation, and functional CLI↔T-Line integration coverage. No full parity claim.

## Next implementation boundary

Do **not** recreate the CLI command logic in React. SuperAgent is the authority.
Each parity action must have (a) registered server capability, (b) authorization,
(c) versioned typed request/response/event contract, (d) T-Line UI adapter, and
(e) a cross-project test. CLI commands requiring terminal-local UI should be
marked CLI-only until a genuine server-equivalent operation exists.

Motion Studio is concurrently under development; this increment deliberately
does not edit its endpoint/bridge files.
