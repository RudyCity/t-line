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
SuperAgent HTTP Server (port 7888)
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
| `backend/src/superAgentRoutes.ts` | 100% Proxy REST API bridge to SuperAgent port 7888 (all 45 endpoints) |
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
- The t-line backend **auto-starts** SuperAgent via `bunx superagent --server [--multi]` when a WebSocket connection arrives and port 7888 is not responding.
- Before spawning, the bridge **pings** `GET /api/instances` to avoid double-starting an already-running server.
- Mode (`single`/`multi`) is scoped to the chat session: switching mode opens a new chat session without killing the shared core, existing tasks, or unrelated connections. Startup arguments remain fixed until an explicit supervised restart; T-Line never force-restarts the shared core on mode changes.
- Use `forceKillPort7888()` only as a last-resort cleanup utility; prefer graceful restart via the bridge.

### Session & Workspace Rules
- Every SuperAgent HTTP interaction **must** include the `x-workspace-path` header **and** the `?workspace=` query param. Both are read by `resolveSession()` in `server.ts`.
- Sessions are workspace-keyed in `activeSessions` map. Never assume a single global session.
- Always call `POST /api/init` before `POST /api/chat` to ensure the session is initialized. If `/api/chat` returns `{ error: "Session not initialized" }`, call `/api/init` and retry once.
- Session IDs (`sessionId`) must be passed through consistently from the frontend WebSocket message → bridge → SuperAgent HTTP request.

### Error Handling Standards
- **ECONNREFUSED on port 7888**: Reset `autoSuperAgentProcess` + `isStartingSuperAgent` to `null`/`false`, call `ensureSuperAgentServer()` to restart, re-initialize session, then retry the request. Do NOT propagate a raw `ECONNREFUSED` error to the frontend.
- **HTML error pages**: Detect `<!doctype` / `<html>` in response body and convert to a descriptive JSON error. Never forward raw HTML to the frontend.
- **Timeouts**: Wrap all HTTP proxy calls in try/catch with `timeoutMs`. Default 30s for chat, 2s for abort. On timeout, surface a clear user-facing message.


### Config & Preset Rules (100% Server Proxy Architecture)
- All model configs, presets, provider profiles, memory, history, and workspace files live in and are managed **exclusively by SuperAgent**.
- The t-line backend **MUST NOT** read or write `~/.superagent-r/model-config.json` or session files directly from disk in route handlers.
- All REST requests in `superAgentRoutes.ts` MUST be proxied to SuperAgent on port 7888 using `proxyToSuperAgent()` or `sendSuperAgentRequest()`.
- SuperAgent HTTP server is the **Single Source of Truth** for all application state.

### Adding New SuperAgent API Endpoints (Cross-Project Workflow)
When a new feature requires a new SuperAgent HTTP endpoint:
1. **SuperAgent first**: Add the endpoint handler in `D:\backup from pc asus\Documents Development\superagent\src\serverRoutes.ts`.
2. **Proxy in t-line**: Add the corresponding proxy handler in `backend/src/superAgentRoutes.ts` using `proxyToSuperAgent('/api/...', fallback, workspace, timeout, method, body)`.
3. **Frontend last**: Call the `/api/superagent/...` route from frontend stores/hooks.
4. Run `bun run build` in **both** `backend` and `superagent` to verify zero TypeScript errors.

### Forbidden Patterns
- ❌ Do NOT read or write `~/.superagent-r/*` files directly inside `superAgentRoutes.ts`. Always proxy to SuperAgent port 7888.
- ❌ Do NOT hardcode any SuperAgent HTTP calls outside of `superAgentBridge.ts` or `superAgentRoutes.ts`.
- ✅ Only the startup selector may read `TLINE_SUPERAGENT_RUNTIME`, `TLINE_SUPERAGENT_CORE_PORT`, `TLINE_SUPERAGENT_OWNER_MODE` and `SUPERAGENT_CONFIG_DIR` for a verified existing Core. Never switch active agent sessions; model/provider settings still use Core HTTP APIs.
- ❌ Do NOT swallow ECONNREFUSED silently — always attempt one auto-restart before surfacing an error.
- ❌ Do NOT add SuperAgent HTTP logic directly to `server.ts` of t-line; keep it isolated in `superAgentRoutes.ts` and `superAgentBridge.ts`.
- ❌ Do NOT modify SuperAgent's `activeSessions` map behavior without updating the session resolution logic in `superAgentBridge.ts` accordingly.
