# Phase 5e — T-Line native Core reconnect and explicit saved-session recovery

This implementation is in the **T-Line repository**, separate from SuperAgent's API Core. It requires the Phase 5c/5d Core responses and the existing authenticated T-Line WebSocket channel. It does not install a new Windows service, restart a live listener, or adopt MCP/Muse/Telegram.

## Backend behavior

- A chat POST to Core is sent **once per user's prompt**. If socket connect, timeout, or response delivery fails, T-Line marks its outcome as **unconfirmed**. It does NOT reinitialize and automatically submit the same message a second time. The user should inspect the saved history and chat-turn ledger before deliberately composing a new prompt.
- A definite HTTP error from Core is preserved, including statusCode, code and requiresExplicitResume. SESSION_WORKER_DEAD / SESSION_OWNER_UNAVAILABLE are distinct from CORE_SUPERVISOR_UNAVAILABLE.
- SSE only reports a connected state after an actual HTTP 200, not when a 503 error page is received. A dead-session SSE 503 requires explicit resume instead of reconnecting to another worker. When Core is temporarily down, GET SSE connection retries use a bounded eight-attempt exponential backoff; no prompt or tool call is reissued. No service on Core port 7888 is force-started in response to SSE connection failure.
- T-Line WebSocket supports the read-only action core_health_probe, which checks GET /api/status for the exact bound session using existing server-side bearer credentials. The frontend sends this on WS open/reopen and when the user selects Check connection. A healthy response may reconnect the GET SSE stream without posting chat.
- The action resume_session is accepted **only** after the user clicks the button with an exact matching bound sessionId and approved=true. It performs a single explicit POST /api/init with matching sessionId and resume, workspace and client mode. Core then verifies the durable session receipt, history freshness and ambiguous-turn gates. Failed resume is NOT retried. A successful exact-ID response allows SSE to reconnect; no chat/tool content is replayed.

## User interface

The assistant chat displays a compact status strip when recovery is required:
- Check connection — read-only when WS is up; reconnects the local desktop bridge when it is down.
- Resume saved session — only displayed when Core says the session worker is gone. This is a one-click **user-approved resume request**; it does not resend pending chat.
- Review history — for ambiguous outbound chat or backend review errors, instructs the operator to check durable message/turn evidence. No automatic retry button for side-effecting requests.

WS reconnection has a bounded eight-attempt automatic retry budget and a manual Check connection action.

## Validation

Run in t-line:

    bun --bun x tsc --noEmit --project backend/tsconfig.json
    bun --bun x tsc --noEmit --project frontend/tsconfig.json
    bun --bun x vitest run backend/tests/coreReconnectSafety.test.ts
    cd frontend && bun --bun x vitest run src/components/__tests__/coreReconnectNotice.test.ts

SuperAgent staging, in its separate repo:

    bun run build
    bun scripts/verify-core-session-resume.ts
    bun scripts/verify-core-guardian.ts

**Qualification caveat:** source-level policies and focused integration tests are not the same as the installed desktop executable. Before certifying a complete release, test the matching-version T-Line packaged Tauri UI against the rebuilt Core over authenticated localhost, including actual session owner crash, SSE detach/reconnect, unconfirmed POST and explicit resume. Do not force-stop the existing production listener. The native Desktop shell process must be upgraded during a separately approved maintenance window.

The pure interface and model are at backend/src/coreReconnectSafety.ts and frontend/src/services/coreReconnectNotice.ts. SuperAgent counterpart is docs/guides/core-phase5d-restart-safety.md.
