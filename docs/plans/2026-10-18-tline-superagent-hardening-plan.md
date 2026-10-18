# T-Line ↔ SuperAgent Hardening Plan

Date: 2026-10-18
Scope: T-Line bridge and the SuperAgent HTTP/SSE session contract.

## Objectives

Harden credential transport, JWT signing/verification, and workspace/session isolation without disturbing unrelated in-progress SuperAgent changes.

## Findings and tasks

- [x] P1: Use the existing `tline-bearer` WebSocket subprotocol for the SuperAgent console; remove bearer tokens from WebSocket query strings and URL logs.
- [x] P1: Remove the static JWT secret fallback. Fail closed when the JWT secret is absent or shorter than 32 characters.
- [x] P1: Validate session ID together with client mode and workspace before resolving/reusing a session; reject conflicting initialization with HTTP 409.
- [x] P2: Stop logging raw user prompts and bypass credentials.
- [x] P2: Save prompt history against the active workspace.
- [x] P2: Pass workspace context through the memory-search proxy.
- [x] P2: Fix the root test command to run frontend tests with the frontend Vitest configuration and auth regression tests.
- [x] P2: Add automated regression tests for missing/weak JWT secrets.
- [ ] P2: Add dedicated API-level regression tests for session/workspace mismatch and session-ID collision.
- [ ] P3: Implement SSE event replay across server-side disconnects; the current bridge buffers already-received events, but the SuperAgent server does not honor Last-Event-ID.
- [ ] P3: Audit SuperAgent process mode reconciliation when port 7888 is owned by a process not managed by the T-Line bridge.

## Implementation order

1. Applied minimal security fixes in T-Line auth, frontend WebSocket clients, logging, and prompt-history scoping.
2. Hardened SuperAgent session resolution and initialization in `src/server.ts` and `src/serverRoutes.ts`.
3. Propagated workspace through the memory-search proxy.
4. Updated root test invocation and added JWT regression tests.
5. Verified backend/frontend builds, frontend/auth tests, SuperAgent typecheck, and Git whitespace checks.

## Acceptance criteria

- [x] SuperAgent console and terminal WebSocket URLs no longer contain bearer tokens.
- [x] JWT verification fails closed when the configured secret is missing/weak; token creation throws instead of using a default secret.
- [x] Session ID resolution checks the requested workspace and client mode; conflicting initialization returns 409.
- [x] Raw prompts and bypass-token values are not written to application logs.
- [x] Memory search and prompt history carry active workspace context.
- [x] T-Line backend/frontend builds and current test suites pass.
- [ ] Session binding has an API-level regression test and is verified at runtime after restarting SuperAgent/T-Line.
- [ ] SSE replay and process mode reconciliation are validated and hardened.

## Verification snapshot

- T-Line backend build: passed.
- T-Line frontend production build: passed with existing CSS-syntax, dynamic-import, and large-chunk warnings.
- Root `bun run test`: 11 tests passed (9 frontend, 2 auth).
- SuperAgent `bun x tsc --noEmit`: currently blocked by the existing in-progress provider worktree: `ProjectProvider` requires `readFiles`, `listFiles`, `grepSearch`, and `findFiles` that `LocalProjectProvider` and `StandaloneSshProjectProvider` do not yet implement. The latest compiler output reports no errors in the changed `src/server.ts` or `src/serverRoutes.ts`.
- Runtime restart/E2E test: not run; currently-running server was not restarted to avoid interrupting active work.
