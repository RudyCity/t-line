# T-Line System Tray Audit & Hardening

Date: 2026-10-21
Repository: RudyCity/t-line
Scope: Windows/Tauri tray menus, project/PT​​Y listing, backend polling, Show/Hide, restart and destructive actions.
Status: Implemented and verified by Rust/TypeScript builds and automated tests. Actual installed Windows tray smoke testing remains outstanding.

## Findings and fixes

1. The tray previously called GET /api/workspaces every three seconds, even while the dashboard was hidden. The endpoint can execute multiple expensive Git status/worktree commands. Tray workspace snapshot refresh is now throttled to approximately 21 seconds on success. A failed HTTP/JSON response is retried at the next three-second interval. The cheap active-session and sync-state endpoints refresh independently every three seconds, so one failing endpoint does not freeze the entire tray menu.
2. Sessions under overlapping registered workspaces appeared more than once, producing duplicate native menu command IDs. Tray session placement now assigns a session only to its longest matching workspace path. It deduplicates PIDs, omits invalid PID 0 and limits the number displayed to 36; excess entries are accessible in the dashboard.
3. The tray previously encoded all tab IDs into close_bulk_ids_... menu item identifiers. With many tabs those IDs could become extremely long. Bulk menu item IDs are now fixed by category (agents, browsers, terminals, other and all), and current tab IDs are looked up when a menu event occurs. Categories display at most 14 submenus each, with explicit overflow labels, while Close All still targets the full current category. Tab/workspace names are bounded and control characters removed.
4. Restart Desktop previously manually spawned a second executable before exiting, which can race against the installed single-instance plugin and simply reactivate the old window. It now uses Tauri's request_restart lifecycle, letting normal app Exit cleanup release resources. Owned backend process ownership and external-verified backend protection remain unchanged.
5. The tray now exposes both Show Dashboard and Hide Dashboard, independent of existing close-to-tray behavior.
6. React tray listeners were previously registered inside both the dashboard and detached windows. They now register in the dashboard only; asynchronous listener setup is cancelled/cleaned up if that window unmounts.
7. Close All initiated from a hidden tray no longer immediately closes multiple tabs (and potentially their running PTYs). It first shows the dashboard and requests a visible confirmation. React filters IDs to tabs that are still open before accepting the action. Native browser overlays are temporarily hidden while a confirmation dialog is shown.

## Verification

- Rust/Tauri library: 13 unit tests passed, including new pure tray tests for longest matching workspace, invalid/duplicate PID handling and category-scoped bulk tab IDs.
- Rust: cargo check --release --locked --lib passed, without rebuilding or restarting an installed application.
- Frontend: bun run build:frontend passed and all 136 Vitest tests across 26 files passed.
- Backend: bun run build:backend passed and all 23 Vitest tests across 8 files passed.
- Cargo.lock app version was synchronized from the previously stale 1.3.698 entry to the existing Cargo.toml version 1.3.699 so --locked builds succeed. No other dependency updates were needed.

## Manual Windows validation still needed

Test a real installed NSIS build on a disposable Windows profile: right-click tray shows menus, left-click restores dashboard, Hide Dashboard and title-bar close leave PTYs running, Quit stops only the Tauri-owned child backend, Restart Desktop reliably starts one new T-Line instance, restart/stop are disabled when attached to an externally owned backend, nested workspaces display each PID once, categories with 20+ tabs remain responsive, and Close All confirmation can be cancelled. Test closed or detached windows, WebView2 overlays and backend disconnection/recovery. Automated compilation does not certify installed tray behavior or release readiness.

No currently running T-Line, terminal, or SuperAgent process was restarted by this implementation.
