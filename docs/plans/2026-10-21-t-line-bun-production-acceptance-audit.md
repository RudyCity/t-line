# T-Line Bun Production Acceptance Audit

Date: 2026-10-21
Repository: RudyCity/t-line, branch main
Base migration: 9e186f4
Scope: native Bun 1.4.2 Windows x64 runtime, backend/server, installer, PTY, SuperAgent connection, WebView2 and system tray release readiness.

## Executive outcome

**Runtime and Windows NSIS package: validated by automated executable and archive smoke tests.**
**Complete end-user production acceptance: not yet approved.** Real installed Windows GUI acceptance, updater, WebView2 Browser/Preview, tray and live SuperAgent end-to-end actions remain unverified. No existing running user desktop/terminal/SuperAgent process was restarted, uninstalled or terminated.

## Findings fixed

1. **P0: SuperAgent ready-banner authentication bypass.** T-Line previously accepted a text marker containing "running at http" as sufficient for SuperAgent readiness. This could incorrectly mark a stale/unverified service ready. Now a stdout marker only triggers a read-only authenticated SuperAgent loopback protocol probe; the process is accepted only when the probe returns `compatible`. Existing port-occupied refusal remains.
2. **P0: Desktop backend inherited arbitrary working directory.** An installed Tauri app opened from a Start Menu shortcut or updater could inherit `C:\Windows\System32` or another cwd. Native launcher now explicitly sets cwd to the bundled `backend` package directory, derived from the resolved `backend/dist/server.js`.
3. **P0: Backend listening on all interfaces by default.** The Express/WS backend previously called `server.listen(port)`, potentially binding 0.0.0.0/::. It now explicitly defaults to `127.0.0.1`, protecting workspace FS and terminals from unintended network exposure. Remote binding requires **both** `TLINE_BIND_HOST` and `TLINE_ALLOW_REMOTE_BIND=1`. An invalid `PORT` fails closed.
4. **P1: Installer test only verified file presence and a Bun PTY.** The NSIS gate now extracts the entire `backend/dist/*`, `backend/node_modules/*` and Bun runtime, verifies expected file contents, executes the extracted Bun PTY, then starts the **actual extracted backend** on a temporary port with an isolated profile. It checks an unauthenticated workspace API request receives an HTTP 401 response. The smoke PATH includes only Windows OS directories (not global Bun or Node), because even a clean Windows installation still requires System32 commands.
5. **P1: Bun license version drift.** Installer staging now rejects a Bun executable whose version differs from the pinned and licensed Bun 1.4.2 release.

## Verification evidence

- Build: `bun run build:frontend` and `bun run build:backend` passed.
- Frontend Vitest: **136 passed** (26 files).
- T-Line SuperAgent bridge tests: **18 passed** (7 files).
- Backend Vitest: **26 passed** (9 files including bind-host safety tests).
- Rust/Tauri: **13 tests passed**; `cargo check --release --locked --lib` passed.
- Release verifier: **7 tests passed**.
- `bun scripts/bun-terminal-smoke.cjs`: pass with Bun 1.4.2.
- `bun scripts/bun-backend-smoke.cjs`: pass, HTTP 401 on protected endpoint.
- `bun scripts/check-tauri-bundle.cjs`: **pass**, including extracted NSIS Bun PTY + backend startup without global Bun/Node.
- Built NSIS artifact: `desktop-tauri/src-tauri/target/release/bundle/nsis/t-line_1.3.699_x64-setup.exe`.
- No running app.exe on inspection; backend default 5779 was not listening. No existing user installation was modified.

## Live blockers / not claimed

- **SuperAgent port 7888: `occupied`**, not `compatible`, according to authenticated read-only `probeSuperAgentPort()`. This is intentional fail-closed behavior. Do not kill or hijack that process. Need verify the service identity, client credentials/protocol version and/or move the conflicting service, then run actual agent task E2E. The server package `bun x superagent` may require network on first run; it is not itself bundled into this installer.
- **Installed GUI:** no real Windows NSIS install/update or desktop WebView2 navigation, interactive Browser Preview, tray icon menu, detached window, startup-from-shortcut or live updater run was performed. The archive executable checks do not certify these.
- **Security:** production dependency audit reports no high/critical advisories in pinned staging, but moderate advisories should be reviewed separately. CSP has permissive legacy features that warrant a security-focused review.
- **Performance and reliability:** no user-session runtime memory/CPU baseline, 20+ tabs stress run, antivirus/code-signing test or 24h soak evidence.
- **Versioning/release:** migration QA artifact is v1.3.699; increment version and sign/publish updater manifest only after GUI and SuperAgent acceptance is complete. **Do not advertise a production rollout or releaseApproved=true yet.**

## Suggested next installed-acceptance run

On a disposable Windows installation with no globally installed Node or Bun:
1. Install the NSIS artifact, verify startup from Start Menu, backend bound only on 127.0.0.1:5779 and clean lifecycle on Quit/Restart.
2. Open five interactive terminal tabs, run a command, resize, detach, restore after reload, hide/show through tray, and inspect for abandoned PTY processes.
3. Open several localhost/HTTPS Browser tabs, switch rapidly, navigate history/bookmarks, open DevTools, and confirm WebView2 is reused.
4. Resolve the 7888 protocol/auth conflict **without terminating unknown services**, run a real SuperAgent task and test cancellation, restart, and error recovery.
5. Verify updater signature, code-signing, antivirus acceptance, persisted data migration, and production dependency audit.

Last automation gate status: NSIS payload PASS, runtime PTY PASS, backend isolated startup PASS, installed Windows GUI and live SuperAgent UNVERIFIED.
