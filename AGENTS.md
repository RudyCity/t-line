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
| `backend/src/superAgentBridge.ts` | Process lifecycle (auto-start/restart), SSE relay, WebSocket message dispatch, audit logging |
| `backend/src/superAgentRoutes.ts` | REST endpoints: sessions, config/presets, provider profiles, history, audit logs, instances monitor |
| `backend/src/sessionManager.ts` | Session persistence: workspace sessions, messages, input history |
| `backend/src/presetUtils.ts` | Preset and provider profile CRUD — reads/writes `~/.superagent-r/model-config.json` |

### Key Integration Files (SuperAgent side)
| File | Responsibility |
|------|---------------|
| `src/server.ts` | HTTP server: all `/api/*` endpoint handlers, session lifecycle (`activeSessions` map) |
| `src/core/tools/state.ts` | Subagent/Superagent instance registry, event emitters |
| `src/core/config.js` | Config helpers: `getSettings()`, `getConfiguredProviders()`, `getPresets()` etc. |

### Port & Process Convention
- SuperAgent always runs its HTTP server on **port 7888** (hardcoded in both projects — do NOT change).
- The t-line backend **auto-starts** SuperAgent via `bunx superagent --server [--multi]` when a WebSocket connection arrives and port 7888 is not responding.
- Before spawning, the bridge **pings** `GET /api/instances` to avoid double-starting an already-running server.
- If mode (`single`/`multi`) or custom args change, the bridge **kills and restarts** the process automatically.
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
- **Audit log**: All significant events (prompt sent, chat response, errors, permission responses, system start/stop) must be logged via `logSuperAgentEvent(type, data)`.

### Config & Preset Rules (Cross-Project)
- All model configs, presets, and provider profiles live in `~/.superagent-r/model-config.json` (owned by SuperAgent).
- The t-line backend reads/writes this file **only** through `presetUtils.ts` helpers. Never access the file directly from routes.
- When adding a new config field to SuperAgent's `model-config.json`, update `presetUtils.ts` on the t-line side to expose it via the REST API.

### Adding New SuperAgent API Endpoints (Cross-Project Workflow)
When a new feature requires a new SuperAgent HTTP endpoint:
1. **SuperAgent first**: Add the endpoint handler in `D:\backup from pc asus\Documents Development\superagent\src\server.ts`.
2. **Bridge second**: Add the proxy call in `backend/src/superAgentBridge.ts` (use `sendSuperAgentRequest()`).
3. **Route third**: Expose it via a new route in `backend/src/superAgentRoutes.ts` if REST access is needed, or dispatch it from the WebSocket `ws.on('message')` handler in `superAgentBridge.ts` if it is a real-time action.
4. **Frontend last**: Update the frontend stores/hooks to call the new t-line REST or WebSocket endpoint.
5. Run `bun run build` in **both** the t-line backend and the SuperAgent project after changes.

### Forbidden Patterns
- ❌ Do NOT hardcode any SuperAgent HTTP calls outside of `superAgentBridge.ts` or `superAgentRoutes.ts`.
- ❌ Do NOT use `process.env` to configure the SuperAgent port, model, or provider. Use `~/.superagent-r/model-config.json` helpers.
- ❌ Do NOT swallow ECONNREFUSED silently — always attempt one auto-restart before surfacing an error.
- ❌ Do NOT add SuperAgent HTTP logic directly to `server.ts` of t-line; keep it isolated in the bridge/routes files.
- ❌ Do NOT modify SuperAgent's `activeSessions` map behavior without updating the session resolution logic in `superAgentBridge.ts` accordingly.
