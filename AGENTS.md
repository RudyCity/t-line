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
- ❌ Do NOT use `process.env` to configure the SuperAgent port, model, or provider. Use SuperAgent's HTTP config endpoints.
- ❌ Do NOT swallow ECONNREFUSED silently — always attempt one auto-restart before surfacing an error.
- ❌ Do NOT add SuperAgent HTTP logic directly to `server.ts` of t-line; keep it isolated in `superAgentRoutes.ts` and `superAgentBridge.ts`.
- ❌ Do NOT modify SuperAgent's `activeSessions` map behavior without updating the session resolution logic in `superAgentBridge.ts` accordingly.
