# T-Line Full Bun Runtime Migration — Windows Desktop and SuperAgent Bridge

Date: 2026-10-21
Repository: RudyCity/t-line
Branch: main
Scope: T-Line application runtime, backend/terminal process, Windows Tauri launcher, frontend/dev scripts, bundled installer, and how T-Line starts the *separate* SuperAgent server.
Bun target: 1.4.2 (tested Windows x64).
Status: Implemented, compiled, automated smoke tests passed. The installed desktop/UI upgrade, antivirus/Windows code signing and live SuperAgent integration require end-to-end validation.

## What changed

1. **Single Bun runtime for T-Line:** backend `start` and `dev` use Bun; frontend copy/build, root scripts, Tauri asset staging and desktop launcher no longer require `node.exe` / `npm ci`. Original TypeScript output is still in `backend/dist` and runs under Bun. The Tauri dev window launches `bun --cwd backend run dev` and `bun --cwd frontend run dev` directly rather than invoking the root process-clearing dev supervisor.
2. **Native PTY:** `backend/src/terminalManager.ts` now uses Bun.spawn with `terminal` (Windows ConPTY). This eliminates the Node-PTY addon, its worker thread/native ABI requirements and the prior inconsistent behavior in standalone installer staging. It supports interactive input, resizing, output buffering, getPid/getProcessName, multiple listeners and cleanup. A minimal child_process fallback remains when unit tests import the module under Node (production uses Bun).
3. **SQLite compatibility:** removed unused `better-sqlite3` and its types from **T-Line backend**. Bun 1.4.2 rejects loading better-sqlite3; T-Line itself no longer uses that driver, so migrating it to bun:sqlite was unnecessary. The separate **SuperAgent service's** internal persistence and dependencies were **not** migrated or modified here.
4. **SuperAgent startup uses the bundled Bun:** `resolveBunEnv()` prefers `TLINE_BUN_RUNTIME` (passed from Rust launcher) or `process.execPath` when the T-Line backend runs under Bun. SuperAgent process is still launched via Bun `x superagent --server ...` (or explicitly selected local SuperAgent source checkout) with authenticated port 7888 compatibility checks. When a compatible external process exists, T-Line does not spawn a duplicate. `TLINE_SKIP_SUPERAGENT_AUTOSTART=1` is test-only isolation to avoid starting real user sessions.
5. **Redistributable Bun:** `desktop-tauri/prepare-bun-runtime.js` stages a version-checked `bun.exe`; `bun-license.md` records upstream Bun v1.4.2 redistribution notices and `bun-runtime/...` is ignored/generated, not committed. `tauri.conf.json` bundles Bun resources instead of Node resources.
6. **Reproducible production install:** `desktop-tauri/backend/bun.lock` replaces standalone `package-lock.json`; staging uses `bun install --production --frozen-lockfile` with the backend workspace manifest and committed isolated lock. Root `bun.lock` updated independently. Unused T-Line backend `better-sqlite3` and `node-pty` are removed.
7. **Release integrity and security gates:** `scripts/check-tauri-bundle.cjs` inspects NSIS archive for compiled backend, bundled Bun, license and dependencies; byte-compares extracted files to staged sources; executes embedded Bun with empty PATH and tests Windows ConPTY. Motion release gates now use `bun audit --json` and block high/critical security findings. Moderate advisories may still be reported independently.

## Validation completed

- `bun run build:frontend`: pass (pre-existing large terminal-vendor warning).
- `bun run build:backend`: pass.
- `bun run test`: 136/136 frontend and 18/18 T-Line SuperAgent bridge tests passed.
- `bun x vitest run --environment node backend/tests`: 23/23 passed.
- `bun test scripts/motion-release.test.cjs`: 7/7 passed.
- `cargo test --lib --locked`: 13/13 passed.
- `cargo check --release --locked --lib`: passed on Windows.
- `bun scripts/bun-terminal-smoke.cjs`: passed; `desktop-tauri/bun-runtime/bun.exe scripts/bun-terminal-smoke.cjs`: passed; tested input/output/resize.
- `bun scripts/bun-backend-smoke.cjs`: staged backend started successfully under bundled Bun on a randomly allocated loopback port, with an isolated temp profile and without starting SuperAgent; unauthenticated API returned expected HTTP 401.
- `bun desktop-tauri/copy-assets.js`: passed with frozen production Bun lockfile, packaged backend and binary.
- `bun scripts/check-tauri-bundle.cjs`: passed on Windows NSIS package `t-line_1.3.699_x64-setup.exe`, including extracted runtime PTY without a globally installed Bun/Node on PATH.

**Important:** Tests above did not install the NSIS on a user desktop, open a WebView2 UI session or test live SuperAgent MCP/Telegram/Muse workflows under a clean machine. A successful build is not approval to distribute to all users. The Bun binary (~82 MiB) is included as an installer resource, and the Bun upstream license and linked-license requirements must be respected. Source Tree/Worktrees, active PTYs, and user data were not restarted or mutated in the installed application.

## Remaining acceptance checks

- Test install, launch and update from an ordinary Windows machine without system Bun/Node; check antivirus/code signing and supported Windows builds.
- Open and write to actual terminal tabs, resize, reconnect, close and minimize-to-tray; verify no leftover Bun child processes after quit.
- Verify SuperAgent auto-start on port 7888 with the binary from T-Line, then run AI tasks and repeat with a preexisting compatible SuperAgent.
- Exercise project Git refresh, external browser/WebView2 preview, detached windows, and SuperAgent Motion Studio through the installed NSIS.
- Review moderate advisories reported by `bun audit`; high/critical release gate currently passes on staged dependency versions.
