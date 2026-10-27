# Agent Rules for t-line Project

This document defines style guidelines, behavioral constraints, and coding standards that all AI agents must follow when working on the **t-line** codebase.

## Coding Standards & Architectural Guidelines

- **Best Practices**: Always write clean, secure, type-safe (TypeScript-first), and self-documenting code. Never write inline credentials, bypass security middleware, or introduce PTY command injection vulnerabilities.
- **Modular Design**: Code must be modular. Business logic, routing, services, and UI components should be strictly decoupled. Leverage React custom hooks to extract complex component states where possible.
- **Maintainability**: Maintain high readability. Keep comments and type interfaces up-to-date. Ensure variables, functions, and files have clean and descriptive names.
- **Strict File Length Limit**: No code file in the repository (backend, frontend, or desktop-tauri) should exceed **1000 lines of code**. If a file is approaching this limit, it must be refactored and split into smaller, dedicated sub-modules or utility files.
- **Workflow & Release Cycle**: For every successfully completed task or major change:
  - Commit the changes locally to the Git repository.
  - Bump the version of the application in package.json configurations.
  - Document the updates in CHANGELOG.md.
- **Commit message naming (required)**: Use neutral engineering/capability descriptions. Never name an external competitor, vendor, service or product brand in the commit subject or body, including when adapting another assistant. Appropriate example: `docs: plan persistent parallel assistant workflows`. This restriction applies to commit messages, not necessary technical names in code or documentation.

---

## Studio Desktop Editor & Unified Assistant Control — Mandatory (2026-10-27)

- **T-Line is a desktop client, not a public MCP tool server**. SuperAgent Core/CLI remains the independently accessible agent runtime and tool provider; do not create another T-Line tool gateway.
- **One Director only**. The existing T-Line SuperAgent Assistant is the conversational Studio AI Director. Studio UI is a timeline-first editor; remove the independent Studio Director chat modes without removing canonical Core editing capabilities.
- **One Studio project state**. All assistant-driven and manual edits use the canonical SuperAgent project revision and typed Studio operations. Never mutate React state or project files behind Core's back.
- **Agent handoff is typed and scoped**. Desktop-only focus/open/select/seek operations must target a trusted workspace/project; no generic DOM/shell execution. Mutations must honor project revisions, permissions, operation deduplication and approval for destructive/expensive changes.
- **Design target**. Media/asset browser left, large video preview center, property inspector right, resizable full-width multitrack timeline bottom, compact export toolbar. Reuse existing Studio panels, effects and engine services first.
- **Plan**: docs/plans/2026-10-27-studio-desktop-editor-agent-control-master-plan.md. Each future phase must provide real agent-to-edit-to-preview/undo E2E evidence, not simulation.

---

## One SuperAgent Runtime Target — Mandatory (2026-10-26)

- **Exactly ONE T-Line backend per installed desktop instance**. Keep one normal **primary** SuperAgent runtime stack; Core, MCP and OAuth can be independently owned processes within that one stack. A bounded, private **temporary SuperAgent testing profile** is permitted for migration/QA, but **do not create a second T-Line backend**, duplicate provider state or permanent test daemon.
- **Runtime selection is fixed at T-Line backend startup**. `primary` (default Core port 7888) and `testing` (separate existing private Core owner) are defined in `backend/src/superAgentRuntimeTarget.ts`. Configuration variables: `TLINE_SUPERAGENT_RUNTIME`, `TLINE_SUPERAGENT_CORE_PORT`, `TLINE_SUPERAGENT_OWNER_MODE`, and `SUPERAGENT_CONFIG_DIR`. Testing requires an authenticated `supervised-external` Core whose profile is an existing nonlinked child of `~/.superagent-local-staging/`.
- **No hot switching** across ongoing sessions, chats, approvals, WebSockets or unfinished tool operations. End/drain work and restart the same T-Line application with the selected profile. The UI in `SuperAgentSettingsModal.tsx` reports current selection; `GET /api/superagent/runtime-target` is authenticated, read-only and MUST NOT return secrets or permit rerouting via a POST.
- **Fail closed for testing**. Never auto-start, adopt, kill, reroute to primary, reuse old session IDs or replay POST/tool effects when a temporary Core is offline or has an unverifiable owner. Readiness requires kernel listener PID, private owner status/bearer, correct profile and versioned Core-only ownership contract. Known legacy ports **6759, 6789, 7888, 9877** are protected; inspect current OS ownership instead of assuming old snapshots remain accurate.
- **Legacy primary remains untouched during certification**. Do not stop legacy shared Core/MCP processes or migrate OAuth tokens. Installed desktop E2E, real public TLS, Windows recovery, extended soak, per-client PKCE reauthorization, safe rollback and operator approval are independent R0–R7 gates; passing source tests does not mean production certification.
- **Reuse components first**. Inspect existing routing, hooks, selectors, dialogs, layout, state stores and API helpers before creating a new component. Extend shared UI components and canonical Core APIs rather than duplicating dashboards, backends, ingress or agent registries. Preserve tenant/workspace/session isolation.
- **Git discipline**. Every completed change must be tested, versioned, documented in CHANGELOG and committed using explicit file staging. Do not stage unrelated dirty files; other agents may be editing browser/Studio paths concurrently. Use neutral engineering commit messages without competitor references.

See `docs/guides/single-superagent-runtime-target.md` (T-Line) and
`docs/guides/runtime-primary-and-temporary-test-profile.md` (SuperAgent).
Record ownership evidence in the R0–R7 execution/evidence documents; do not
claim an installed native app or public rollout from a loopback-only smoke test.

---

## Mandatory T-Line Backend Crash Log Triage (Windows)

**Always inspect crash logs BEFORE changing code, restarting a service, or claiming a Desktop Bridge disconnect is a backend crash.** Full guide: `docs/guides/backend-crash-diagnostics.md`.

### Files to read

| Evidence | Path | Interpretation |
|---|---|---|
| Backend crash JSONL | `%USERPROFILE%\.tline-logs\backend-crashes.jsonl` | Synchronous start/exit, `uncaught_exception`, `unhandled_rejection`, stack, PID, uptime and memory; rotated backup ends in `.1` |
| Backend text log | `%USERPROFILE%\.tline-backend.log` | Previous requests, WebSocket events, bridge activity |
| Desktop child lifecycle | `backend_exit.log` in the **Tauri app-data directory** | Start, attach/refusal, spawn, startup timeout and exit code **only for a backend child owned by Tauri** |
| Desktop child stdout/stderr | `backend_run.log` in the **same Tauri app-data directory** | Recent backend output, preserved across launches |
| SuperAgent bridge log (if present) | `%USERPROFILE%\.tline-superagent.log` | SuperAgent Core/proxy failures; not proof of a T-Line backend crash |

Locate the Tauri app-data directory from the actual app installation (not the repo root); for a Windows diagnostic search, find `backend_exit.log` under `%APPDATA%`. Do not assume the installed binary contains current source changes.

### PowerShell: read recent evidence without changing processes

```powershell
Get-Content "$HOME\.tline-logs\backend-crashes.jsonl" -Tail 20 -ErrorAction SilentlyContinue
Get-Content "$HOME\.tline-backend.log" -Tail 100 -ErrorAction SilentlyContinue
Get-ChildItem "$env:APPDATA" -Recurse -Filter backend_exit.log -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host "Tauri logs: $($_.DirectoryName)"
  Get-Content $_.FullName -Tail 30
  Get-Content (Join-Path $_.DirectoryName "backend_run.log") -Tail 100 -ErrorAction SilentlyContinue
}
```

### Required crash / disconnect investigation

1. First distinguish **backend T-Line port 5779**, **SuperAgent Core port 7888**, and **frontend WebSocket-only disconnect**. Disconnect does not necessarily mean any process crashed.
2. Inspect crash JSONL, backend log and (if desktop-owned) Tauri lifecycle/output logs. Correlate **PID, UTC timestamps, exit code, and surrounding messages**; `backend_exit.log` uses Unix millisecond timestamps.
3. `uncaught_exception` provides stack evidence, while `unhandled_rejection` alone does not prove an exit. `unexpected_exit` without a JS exit event suggests an external kill, native runtime issue or OS termination. `startup_timeout` is a readiness/auth failure, not proof of a crash.
4. Reporter sources: `backend/src/crashDiagnostics.ts`, `backend/src/server.ts`, `desktop-tauri/src-tauri/src/backend_diagnostics.rs`, `desktop-tauri/src-tauri/src/lib.rs`. For bridge reconnects inspect `frontend/src/components/SuperAgentConsole.tsx` and `backend/src/superAgentBridge.ts`.
5. Reproduce fatal errors **only in an isolated test child**; never force-kill the live backend, Core, or unrelated processes. Run `bun --bun x vitest run --environment node backend/tests/crashDiagnostics.test.ts backend/tests/coreReconnectSafety.test.ts` and `cargo test --manifest-path desktop-tauri/src-tauri/Cargo.toml --lib backend_diagnostics` for relevant changes.
6. Logs contain **best-effort redaction**, not guaranteed secret removal. Never forward unreviewed log content or tokens to external destinations. If Tauri itself is forcibly terminated, it cannot record a subsequent child exit. Do not mistake missing Tauri logs for evidence of no crash when backend was attached externally.

---

## SuperAgent Integration Development

This section governs all development related to the t-line ↔ SuperAgent integration. When working on any feature that touches SuperAgent connectivity, always read **both** codebases before making changes.

### SuperAgent Project Path
The SuperAgent project is located at: `D:\backup from pc asus\Documents Development\superagent`  
When a fix or feature requires changes to SuperAgent itself (not just the t-line bridge), **edit files directly in the SuperAgent project directory**.

### Architecture Overview

t-line communicates with SuperAgent via a local HTTP + WebSocket + SSE bridge:

```
t-line Frontend (React)
    │  WebSocket (ws://.../superagent?workspace=...&agentMode=...)
    ▼
t-line Backend (Express)
    │  superAgentBridge.ts  ← process lifecycle manager + HTTP proxy
    │  superAgentRoutes.ts  ← REST API bridge (sessions, config, history)
    ▼
Selected SuperAgent Core (primary :7888; testing verified isolated port)
    │  POST /api/init        ← initialize/resume a session
    │  POST /api/chat        ← send a prompt
    │  GET  /api/events      ← SSE stream (agent events)
    │  GET  /api/instances   ← running sub/superagent instances
    │  POST /api/abort       ← abort current run
    │  POST /api/approve     ← respond to permission request
    │  POST /api/answer      ← respond to agent question
    │  POST /api/plan/approve← approve agent plan
```

### Key Integration Files (t-line side)
| File | Responsibility |
|------|---------------|
| `backend/src/superAgentBridge.ts` | Process lifecycle (auto-start/restart), SSE relay, WebSocket message dispatch |
| `backend/src/superAgentRuntimeTarget.ts` | Startup-only primary/testing target validation; exactly one backend |
| `backend/src/superAgentCoreOwnership.ts` | Authenticated owner contract and OS listener PID verification |
| `backend/src/superAgentRoutes.ts` | Authenticated REST proxy to the selected Core; no duplicate backend or arbitrary upstream URL |
| `backend/src/sessionManager.ts` | Server-based prompt history fallback helpers |
| `backend/src/presetUtils.ts` | Deprecated direct file access — all config CRUD is proxied via `superAgentRoutes.ts` |

### Key Integration Files (SuperAgent side)
| File | Responsibility |
|------|---------------|
| `src/serverRoutes.ts` | HTTP server: all `/api/*` REST endpoint handlers (config, presets, memory, history, workspaces, browser, etc.) |
| `src/server.ts` | HTTP server entrypoint, WebSocket real-time engine, session lifecycle (`activeSessions` map) |
| `src/core/tools/state.ts` | Subagent/Superagent instance registry, event emitters |
| `src/core/config.js` | Config helpers: `loadModelConfig()`, `saveModelConfig()`, `getSettings()`, `getPresets()` etc. |

### Port & Process Convention
- Primary SuperAgent Core defaults to **port 7888**; a test-only Core may use a separate, verified loopback port and private profile. T-Line retains ONE backend. See `docs/guides/single-superagent-runtime-target.md`.
- **Primary/legacy only:** the bridge may start the Core only after a verified free/default port and existing controlled startup checks. **Testing/supervised-external never spawns a Core**; an unavailable test target is a visible error, not permission to fall back to 7888.
- Before any optional primary Core launch, probe the authenticated `GET /api/ping` response and verify its ownership classification. A malformed, occupied or untrusted listener must not be adopted or killed.
- Mode (`single`/`multi`) is scoped to the chat session: switching mode opens a new chat session without killing the shared core, existing tasks, or unrelated connections. Startup arguments remain fixed until an explicit supervised restart; T-Line never force-restarts the shared core on mode changes.
- `forceKillPort7888()` is **permanently disabled** and MUST NOT be used for cleanup. For independently test-owned processes, use only authenticated owner drain and OS identity proof; production shared PIDs are off limits.

### Session & Workspace Rules
- Every SuperAgent HTTP interaction **must** include the `x-workspace-path` header **and** the `?workspace=` query param. Both are read by `resolveSession()` in `server.ts`.
- Sessions are workspace-keyed in `activeSessions` map. Never assume a single global session.
- Always call `POST /api/init` before `POST /api/chat` to ensure the session is initialized. If `/api/chat` returns `{ error: "Session not initialized" }`, call `/api/init` and retry once.
- Session IDs (`sessionId`) must be passed through consistently from the frontend WebSocket message → bridge → SuperAgent HTTP request.

### Error Handling Standards
- **ECONNREFUSED / offline Core**: only primary/legacy mode may use the existing verified-free-port startup path. Testing/supervised-external MUST fail closed and surface unavailable status. Never blindly resend an accepted chat/tool POST, reinitialize/replay ambiguous effects, or turn an occupied port into a spawn candidate.
- **HTML error pages**: Detect `<!doctype` / `<html>` in response body and convert to a descriptive JSON error. Never forward raw HTML to the frontend.
- **Timeouts**: Wrap all HTTP proxy calls in try/catch with `timeoutMs`. Default 30s for chat, 2s for abort. On timeout, surface a clear user-facing message.


### Config & Preset Rules (100% Server Proxy Architecture)
- All model configs, presets, provider profiles, memory, history, and workspace files live in and are managed **exclusively by SuperAgent**.
- The t-line backend **MUST NOT** read or write `~/.superagent-r/model-config.json` or session files directly from disk in route handlers.
- All REST requests in `superAgentRoutes.ts` MUST use existing authenticated Core proxy helpers with `resolveSuperAgentCorePort()` for the **selected startup target**. Never hardcode an alternate service, public ingress or per-workspace port.
- SuperAgent HTTP server is the **Single Source of Truth** for all application state.

### Adding New SuperAgent API Endpoints (Cross-Project Workflow)
When a new feature requires a new SuperAgent HTTP endpoint:
1. **SuperAgent first**: Add the endpoint handler in `D:\backup from pc asus\Documents Development\superagent\src\serverRoutes.ts`.
2. **Proxy in t-line**: Add the corresponding proxy handler in `backend/src/superAgentRoutes.ts` using `proxyToSuperAgent('/api/...', fallback, workspace, timeout, method, body)`.
3. **Frontend last**: Call the `/api/superagent/...` route from frontend stores/hooks.
4. Run `bun run build` in **both** `backend` and `superagent` to verify zero TypeScript errors.

### Forbidden Patterns
- ❌ Do NOT read/write SuperAgent model, token, history or session stores inside `superAgentRoutes.ts`. Proxy to the selected Core. The narrow, read-only owner/service-token discovery in dedicated auth/ownership modules is an exception; never expose these credentials to the renderer.
- ❌ Do NOT hardcode any SuperAgent HTTP calls outside of `superAgentBridge.ts` or `superAgentRoutes.ts`.
- ✅ Only the startup selector may read `TLINE_SUPERAGENT_RUNTIME`, `TLINE_SUPERAGENT_CORE_PORT`, `TLINE_SUPERAGENT_OWNER_MODE` and `SUPERAGENT_CONFIG_DIR` for a verified existing Core. Never switch active agent sessions; model/provider settings still use Core HTTP APIs.
- ❌ Do NOT suppress connection errors or auto-restart an unowned/testing Core. Show a clear unavailable/owner-verification error; primary startup is allowed only after existing safe port-ownership checks.
- ❌ Do NOT add SuperAgent HTTP logic directly to `server.ts` of t-line; keep it isolated in `superAgentRoutes.ts` and `superAgentBridge.ts`.
- ❌ Do NOT modify SuperAgent's `activeSessions` map behavior without updating the session resolution logic in `superAgentBridge.ts` accordingly.
