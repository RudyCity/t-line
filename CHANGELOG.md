# Changelog

All notable changes to the **t-line** workspace manager project will be documented in this file.

## [1.3.99] - 2026-06-29

### Added
- **Model Context Protocol (MCP) Server**: Exposes workspace data, file operations, git worktrees, and terminal execution capabilities directly to external AI assistants.
  - Implemented custom JSON-RPC 2.0 message processor and SSE endpoints (`/api/mcp/sse`, `/api/mcp/message`).
  - Added 7 specialized tools: `list_workspaces`, `get_workspace_details`, `run_command`, `read_file`, `write_file`, `create_worktree`, and `remove_worktree`.
  - Enforced security filters verifying that all file operations and command executions reside strictly inside configured workspaces.
  - Protected endpoints by requiring active session token validation.
- **MCP Stdio Proxy Bridge**: Created a lightweight stdio-to-WebSocket proxy (`mcp-stdio.ts`) allowing stdio-only clients like Claude Desktop to bridge directly into the running backend.
- **MCP Dashboard & Settings Tab**: Designed a premium, interactive tab inside the `SettingsModal` displaying connection status, active client stats, copy-paste config guides for Claude Desktop and Cursor, and a live-updating audit log of tool calls.

---

## [1.3.98] - 2026-06-29

### Added
- **Terminal Active Processes Loading & Badges**: Added active process monitoring to the workspace list and branch list.
  - Implemented OS process tree scanning (`getActiveProcessesForPid`) on Windows/Unix in `terminalManager.ts`.
  - Added a 2.5s interval in WebSocket title polling to check active child processes and push the list to client.
  - Rendered a glowing pulsing green dot overlapping workspace and worktree icons when a terminal has active commands running.
  - Added beautiful styled gradient glow badges next to workspace/worktree items for specific processes (Claude Code, Gemini CLI, Cursor, Superagent CLI, and general "Active" processes).

---

## [1.3.97] - 2026-06-29

### Refactored
- **Code Modularization (App.tsx)**: Refactored the core frontend `App.tsx` file to improve maintainability and strictly conform to the 1,000-line limit:
  - Extracted update checking and GitHub release checks to a new custom hook `useUpdateChecker.ts`.
  - Extracted tab context menus, tooltips, and tab closure actions to a new custom hook `useTabUiHandlers.ts`.
  - Extracted authentication lifecycle, login, and setup checks to a new custom hook `useAuth.ts`.
  - Reduced `App.tsx` file size from 1,582 lines to 1,222 lines.

---

## [1.3.96] - 2026-06-29

### Fixed
- **Workspace & Branch Badges Out-of-date**: Fixed a bug where workspace cards and worktree branch dirty count badges were never updated after initial load. Added periodic workspace list polling (every 10 seconds) in the frontend.
- **Save Refetch & Cache Invalidation**: Saving a file in the code editor now triggers an immediate workspace refresh in the frontend. Also, the backend file write endpoint `/api/fs/write` now automatically clears the workspace status cache to ensure the badges update instantly.
- **Type Safety**: Fixed a TypeScript compilation error in `FileViewerTab.tsx` regarding implicit `any` type for Monaco model iterator.

---

## [1.3.95] - 2026-06-29

### Added
- **Git Spawning Optimization (RAM & CPU)**: Added an 8-second memory caching mechanism to `getWorkspaceInfo` in the backend. Since the Electron app polls workspace info every 5 seconds, this completely stops the backend from constantly spawning slow and resource-heavy `git status` and `git worktree list` child processes in the background. The cache is automatically cleared when workspaces or worktrees are added, removed, or updated.

---

## [1.3.94] - 2026-06-29

### Added
- **RAM Optimization**: Implemented several memory optimizations to reduce the footprint of Electron, Node, React, and terminal sessions:
  - Added `--max-old-space-size=384` js-flags to Electron to restrict V8 heap size in main/renderer processes.
  - Enabled GPU command buffer pruning on idle.
  - Limited the Node.js backend utility process memory limit to `192MB`.
  - Disposed of Monaco Editor models on tab unmount/file change to prevent memory leaks.
  - Reduced terminal scrollback history from 10,000 to 3,000 lines.
  - Halved the PTY session output buffer limit to 64KB.

---

## [1.3.93] - 2026-06-29

### Fixed
- **System Tray PTY Sessions**: Fixed an issue where the tray menu would not update when terminal sessions changed due to the polling loop ignoring identical status updates.
- **Git Worktree Support in Tray**: Updated session-to-workspace mapping to look up git worktree paths in addition to main workspace paths. Submenu items for terminal sessions in a worktree now explicitly indicate the active worktree's branch.

---

## [1.3.92] - 2026-06-29

### Fixed
- **CI Build & Release**: Removed the redundant `softprops/action-gh-release@v2` step from `release.yml`. Since `electron-builder` already publishes and uploads all built binaries and updater metadata files when `GH_TOKEN` is present, the extra upload step was duplicate and resulted in double-uploaded files with space-spaced and hyphenated names.

---

## [1.3.91] - 2026-06-29

### Fixed
- **CI Build Fix**: Reverted workflow back to the original simple structure without native builder rebuild workarounds (removed `electron-rebuild` and extra python setup steps that caused lockfile/compromised conflicts during npm execution), letting `electron-builder` natively handle compiling `node-pty`.

---

## [1.3.90] - 2026-06-29

### Fixed
- **CI Build Fix**: Overhauled GitHub Actions `release.yml` to properly handle native module compilation across all platforms:
  - Added `setup-python@v5` (Python 3.11) required by `node-pty` native build
  - Added Linux build tools (`build-essential`, `libx11-dev`, `libxkbfile-dev`, `libsecret-1-dev`)
  - Added macOS Xcode CLI tools setup
  - Added `electron-rebuild` step to rebuild `node-pty` against the correct Electron ABI
  - Added `fail-fast: false` so all 3 platform jobs run independently
  - Added `GH_TOKEN` env for `electron-builder` publish step

---

## [1.3.89] - 2026-06-29

### Fixed
- **Build Fix**: Removed unused `React` import in `UpdateNotification.tsx` that caused a TypeScript `TS6133` error and broke the GitHub Actions CI build on all platforms.

---

## [1.3.88] - 2026-06-29

### Added
- **Manual Update Check in Settings**: Added a "Software Update" row in the Settings → General tab with a **Check** button that triggers `electron-updater` to immediately check GitHub Releases for a new version. The row displays contextual status badges: *Checking…* (spinner), *Up to date* (green checkmark), *vX.X.X available* (purple), *Downloading… N%* (blue), and *Failed* (red with tooltip). When an update is downloaded and ready, the button becomes **Restart & Install vX.X.X**, directly triggering `quitAndInstall`. The row is only rendered inside the Electron desktop environment (hidden in browser).

---

## [1.3.87] - 2026-06-29

### Added
- **Auto-Update System**: Implemented a full end-to-end auto-update system powered by `electron-updater`. The app now automatically checks GitHub Releases for a newer version 5 seconds after startup and every 4 hours thereafter. Downloads happen silently in the background. A non-intrusive floating toast notification (bottom-right) informs users when an update is available, shows a real-time download progress bar (with speed and size info), and presents a "Restart & Install" button when the update is ready. Users can dismiss the toast or manually retry on error. The system is a no-op in development mode.

---

## [1.3.86] - 2026-06-29

### Changed
- **Minimalist Welcome Dashboard**: Redesigned the Empty Dashboard welcome page to be sleek and minimalist: removed the heavy colorful background gradients and glow behind the card; removed the pulsing animation (`animate-pulse`) from the primary CTA button and the Folder icon; simplified the card layout with a clean border (`border-white/5`) and a subtle dark-slate background (`bg-[#090c14]/40`).

---

## [1.3.85] - 2026-06-29

### Added
- **Deletion Loading Skeletons & Success Toasts**: Integrated real-time visual feedback when removing workspaces or worktrees. Displays a responsive, non-interactive loading card skeleton with red border highlights, pulse animations, and spinning loaders for workspaces, and a matching tree connector loading node for worktrees. Dispatches user-facing success notifications (`tline-toast` events) upon completion.

---

## [1.3.84] - 2026-06-29

### Changed
- **Minimalist Header Height & Control Pill Design**: Reduced desktop top-bar height (`--topbar-height`) from 56px to 40px to maximize vertical editor/terminal space. Eliminated the solid dark wrapper background and border on the right action control pill. Separated application action buttons (Help, Settings, Logout) from window actions (Minimize, Maximize, Close), styling them as borderless transparent icons that blend seamlessly into the header background.

---

## [1.3.83] - 2026-06-29

### Changed
- **Footer Status Bar Layout Reorganization**: Relayouted footer items into cleaner, logically grouped sections: Left Section displays metadata (application version and the RAM resource usage statistics pill); Center Section groups active Workspace directory context, active Git branch status badge, and terminal font zoom & shell selection controls; Right Section is dedicated to Cloudflare Tunnel status, URL, and actions. This prevents screen crowding when tunnels are active or workspace paths are long.

---

## [1.3.82] - 2026-06-29

### Added
- **Real-time Memory (RAM) Usage Widget in Footer**: Implemented memory diagnostics directly into the bottom status bar footer. Displays the RAM consumption for the Backend process (`B: XX MB`) and Desktop application (`D: XX MB`, aggregating memory working set size across all Electron processes). Added a detailed hover dropup tooltip showing complete memory breakdown (RSS and Heap memory for the Backend process, App Total and Main Process RSS for Desktop, and Free/Total Host System Memory). Added `/api/system/stats` backend endpoint and Electron main process IPC handler `get-memory-usage` to safely fetch these values.

---

## [1.3.81] - 2026-06-29

### Fixed
- **Monorepo Packaging & Internal Asset Resolution**: Resolved a major packaging issue where external `backend` and `frontend` assets were excluded from compiled builds due to `electron-builder` limitations. Created a cross-platform asset copying pipeline (`copy-assets.js`) to move assets inside the `desktop` workspace directory before compilation. Rewrote `projectRoot` resolution to use `app.getAppPath()` to guarantee path correctness, allowing the utility process to execute directly from within the `app.asar` archive and resolve production dependencies seamlessly.

---

## [1.3.80] - 2026-06-29

### Fixed
- **Portable Build Backend Spawning (utilityProcess)**: Resolved a critical uncaught exception (`Error: spawn ... ENOENT`) that occurred exclusively in packaged portable builds. Migrated the backend process spawning mechanism from manual OS execution via `child_process.spawn(process.execPath)` to Electron's official `utilityProcess.fork` API. This leverages Electron's internal helper process architecture, preventing file permission/existence failures under the temporary directories used by portable NSIS wrappers.

---

## [1.3.79] - 2026-06-29

### Fixed
- **Unpacked Physical Path & Shell Escape Resolution**: Resolved backend startup failure in packaged builds caused by Windows cmd shell whitespace splitting in directories containing spaces. Re-enabled `asarUnpack` for `backend/**/*` inside `desktop/package.json` to generate clean physical file locations, configured `desktop/main.js` to dynamically map `projectRoot` to `app.asar.unpacked`, and disabled `shell` spawning for binary executables in production. This guarantees backend processes spawn seamlessly under any folder path.

---

## [1.3.78] - 2026-06-29

### Optimized
- **Monorepo Bundle Size & Hoisting Resolution**: Fixed a critical packaging issue where backend dependencies (like `express`, `ws`, and `node-pty`) were missing from the production package because of npm workspaces hoisting. Declared the backend production dependencies directly inside `desktop/package.json`. This prompts `electron-builder` to bundle only the required production dependencies and automatically exclude all heavy `devDependencies` (like `typescript`, `ts-node-dev`, and types), resolving execution crashes on clean systems and optimizing the bundle size.

---

## [1.3.77] - 2026-06-29

### Fixed
- **Production Backend Executable Spawning**: Fixed backend initialization failure in packaged production builds. Reconfigured the spawn command in `desktop/main.js` to run the backend inside Electron's runtime (`process.execPath`) using `ELECTRON_RUN_AS_NODE=1` environment mode to guarantee ABI compatibility for native modules. Added `asarUnpack` configuration for `backend/**/*` inside `desktop/package.json` to prevent executable path loading blocks under the ASAR archive.

---

## [1.3.76] - 2026-06-29

### Fixed
- **Single Instance Focus Lock**: Integrated Electron `requestSingleInstanceLock` and `second-instance` event handlers in `desktop/main.js`. This resolves the issue where opening the executable again when it was already running in the background (minimized to the tray) did not show the window, by immediately focusing and restoring the existing application instance.

---

## [1.3.75] - 2026-06-29

### Fixed
- **Linux Packaging Metadata Validation**: Added required packaging fields (`author`, `homepage`, and `maintainer`) inside `desktop/package.json` to resolve build failures for Debian/Linux targets on GitHub Actions.

---

## [1.3.74] - 2026-06-29

### Added
- **Dynamic System Update Checker**: Integrated an automatic update checker. Added `/api/system/version` backend endpoint to read the application version dynamically, and configured the frontend to compare it against the latest GitHub release and show toast notifications and highlighted warning badges with direct download links in the UI.

---

## [1.3.73] - 2026-06-29

### Added
- **Multi-Platform CI/CD Release Workflow**: Created a GitHub Actions workflow `.github/workflows/release.yml` that builds and compiles Windows, macOS, and Linux releases in the cloud automatically.
- **macOS & Linux Build Configurations**: Added new build targets for `mac` (`dmg`, `zip`) and `linux` (`AppImage`, `deb`) to the `desktop` configurations.

---

## [1.3.72] - 2026-06-29

### Changed
- **Documentation Overhaul**: Redesigned and rewrote the primary project README to emphasize marketing appeal, highlighting key value propositions, user pain points solved, high-performance GPU Canvas rendering, and Git Worktrees workflow benefits. Added the visual application preview showcase in the documentation.

---

## [1.3.71] - 2026-06-29

### Fixed
- **Workspace Actions Dropdown Overlap**: Fixed a CSS stacking context bug where subsequent workspace cards overlapped and obscured the open dropdown menu of preceding workspace cards. Lifted the dropdown menu's open state to the parent `WorkspaceList` component and introduced a conditional `.ws-card-dropdown-open` class that sets a higher `z-index` (50) on the active card, ensuring the dropdown menu renders on top of all sibling cards.
- **Single-Dropdown Policy**: Managing the open dropdown state in the parent ensures only one workspace dropdown can be open at a time, automatically closing any open dropdown when another is toggled.

---

## [1.3.70] - 2026-06-29

### Added
- **xterm — Canvas GPU Renderer**: Terminal now uses `@xterm/addon-canvas` Canvas-based renderer instead of the default DOM renderer, delivering significantly smoother scrolling and rendering, especially during rapid streaming output from AI agents and build logs.
- **xterm — Image Protocol Support**: Added `@xterm/addon-image` enabling inline image rendering in the terminal via sixel and iTerm2 inline image protocol. CLI tools that output images (e.g., `viu`, image previews) will now render inline.
- **xterm — Terminal Status Bar**: A compact translucent status bar now appears at the bottom of each terminal pane showing: shell type (PS/CMD/Bash/etc.), WebSocket connection dot (green/red), cursor position (col:row), font size, and inline zoom in/out and clear/search buttons.
- **xterm — Premium Context Menu**: Right-click context menu redesigned with icons for each action, keyboard shortcut hints (Copy, Paste, Select All, Find…, Clear), scale-in animation, and a distinct danger style for destructive actions.
- **xterm — Smart Paste Warning**: Pasting 3 or more lines now shows an inline confirmation dialog with a preview of the content, preventing accidental multi-line pastes in interactive shells.
- **xterm — Upgraded Search Bar**: Search overlay now uses a slide-down animation, a grouped input wrapper with search icon, better visual toggle buttons for case-sensitive and regex modes, and distinct red styling when no results are found.
- **xterm — Split Pane Focus Ring**: In split-pane layouts, the currently focused terminal pane is highlighted with a violet glow border animation, making it immediately clear which pane is active.
- **xterm — Zoom from Status Bar**: Zoom in/out buttons in the status bar fire a `tline-zoom` custom event, wired to the same zoom handlers as keyboard shortcuts, so font size can be adjusted directly from the terminal bar.
- **xterm — Custom Mouse Cursor**: Changed the default mouse cursor inside the terminal screen from the `text` I-beam selector to a standard `default` arrow pointer. This makes mouse interaction feel natural in interactive TUI apps (e.g. Ink TUI interfaces with hover states), while still allowing dynamic overrides to `pointer` when hovering web links.

---




### Changed
- **Workspace Panel — Branch Collapse**: Branch/worktree list per workspace is now collapsed when there are more than 3 entries. A "+N more branches" toggle button appears to expand/collapse the full list, keeping the panel compact.
- **Workspace Panel — Compact Card Design**: Workspace cards are now more minimal with tighter padding, smaller font sizes, and less vertical gap. Replaced the old ad-hoc Tailwind utility classes with dedicated `.ws-card`, `.ws-card-active`, `.ws-card-dirty`, and `.ws-card-idle` CSS classes.
- **Workspace Panel — Search Bar**: Added a real-time search input at the top of the workspace list. Filters workspaces by name or path as you type, with a clear (×) button and focus highlight.
- **Workspace Panel — Dirty-First Sort**: Workspaces with uncommitted changes (dirty worktrees) are automatically sorted to the top of the list so they are immediately visible without scrolling.
- **Workspace Panel — Dirty Count Pill**: If a workspace has uncommitted changes, a compact amber badge showing the total dirty file count is now displayed inline next to the workspace name.

---

## [1.3.68] - 2026-06-28

### Fixed
- **ANSI Black Color Invisible in Terminal**: The xterm.js theme had `black` set to `#1e293b` (near-identical to the `#000000` terminal background), making any program output using ANSI color 0 completely invisible. Changed `black` to `#4a5568` and `brightBlack` to `#718096` so all 16 ANSI colors are clearly readable on the dark background.

---

## [1.3.67] - 2026-06-28

### Fixed
- **Worktree Delete Backend Fallback**: If `git worktree remove --force` still fails with a Permission Denied/lock error (e.g. held by antivirus or File Explorer), the backend now falls back to: (1) clear read-only flags on all files in the directory, (2) force-delete the folder tree via `fs.rmSync`, then (3) run `git worktree prune` to clean up Git's internal registry. This ensures the worktree is always fully removed even when Git itself cannot acquire the necessary file lock.

---

## [1.3.66] - 2026-06-28

### Fixed
- **Worktree Delete Permission Denied**: When removing a git worktree, the app now automatically closes all terminal tabs and file tabs whose path is inside that worktree **before** issuing the backend delete command. This releases any OS-level file locks held by open terminal processes, preventing the `Permission denied: failed to delete '<path>'` error on Windows.

---

## [1.3.65] - 2026-06-28

### Changed
- **Enlarged Sidebar Logo**: Increased the `TPlusLogo` component size in the sidebar header to 28px (up from 22px) for a much clearer and more prominent visual presence.

---

## [1.3.64] - 2026-06-28

### Changed
- **Taskbar Icon White Background Fix**: Generated a new high-quality `T+` PNG icon with a solid dark indigo background (#0f172a) filling the entire 512x512 canvas. This replaces the transparent-corner version to prevent Windows from rendering white backgrounds in the corners.
- **Sidebar Header Logo Scaling**: Increased the size of the inline vector `TPlusLogo` SVG component inside the sidebar header from 16px to 22px for better readability and a more premium, balanced appearance.

---

## [1.3.63] - 2026-06-28

### Changed
- **Unified Sidebar Brand Logo**: Replaced the generic Lucide terminal icon in the sidebar header with the inline vector `TPlusLogo` SVG component, unifying the app UI branding with the taskbar and system tray icons.

---

## [1.3.62] - 2026-06-28

### Added
- **T+ SVG and PNG Logo**: Designed and wrote a scalable vector graphics (SVG) version of the brand logo at `desktop/icon.svg`, and generated a matching premium high-resolution `T+` PNG at `desktop/icon.png` for unified tray and taskbar support.

---

## [1.3.61] - 2026-06-28

### Added
- **Premium Application Icon Asset**: Created a custom premium glowing purple developer logo featuring a stylized 't' merging with a Git branch/terminal line, replacing `desktop/icon.png` to serve as the unified icon for both the taskbar/window and the system tray.

---

## [1.3.60] - 2026-06-28

### Changed
- **Accidental Closure Prevention for Small Tabs**: Added a CSS container query so that when tabs shrink in width (under 75px), the close button is completely hidden on hover for inactive tabs. This avoids accidental clicks and exactly matches Google Chrome's tab behavior.

---

## [1.3.59] - 2026-06-28

### Added
- **Dirty Files Count Badge**: Added an amber number badge next to dirty git branches/worktrees in the sidebar tree view, showing the exact count of uncommitted changes/untracked files.

---

## [1.3.58] - 2026-06-28

### Fixed
- **Stuck Tooltip Bug**: Fixed custom tab tooltips occasionally getting stuck on the screen when a tab is closed, clicked, or when a context menu is open. Added an automatic cleanup effect based on active tabs list changes.
- **Context Menu Interaction**: Prevented event bubbling on tab and terminal right-clicks, and registered window listeners for `contextmenu` to close open menus when right-clicking elsewhere.

---

## [1.3.57] - 2026-06-28

### Added
- **3-Strikes Tunnel Login Protection**: Restricted failed login attempts from external tunnel requests (Cloudflare Tunnels or other external proxy headers) to a maximum of 3. If exceeded, the offending IP address is automatically blocked.
- **Login Block List UI**: Added a dedicated section under the settings modal's Access Control tab, displaying real-time blocked login attempts with metadata (timestamp and failed attempts) and direct "Unblock" action support.

### Changed
- **Modals Codebase Refactoring**: Extracted and separated the `SettingsModal` code into [SettingsModal.tsx](file:///d:/backup%20from%20pc%20asus/Documents%20Development/t-line/frontend/src/components/SettingsModal.tsx) to improve modularity and adhere strictly to the 1000-line file length limit.

---

## [1.3.56] - 2026-06-28

### Added
- **Backend Reconnection & Control Dashboard**: Implemented a beautiful, self-contained connection error page that is displayed in the desktop window whenever the backend service is stopped, starting, or fails to respond.
- **Automated Reconnect Ping**: The error page automatically check/pings the local backend server every 2 seconds via native Electron IPC handlers, automatically reloading the main app once the connection is restored.
- **Direct Backend Window Controls**: Enabled starting, restarting, and manual retrying of the local backend service using action buttons directly inside the Electron window, synced with real-time status updates from the main process.

---

## [1.3.55] - 2026-06-28

### Added
- **Chrome-Like Shrinking Tabs**: Added flexible shrinking layouts for terminal and file tabs in the topbar tab list. When many tabs are open, they dynamically shrink down in width (down to 36px), hiding inactive close buttons and labels gracefully.
- **Sleek Custom Tooltips**: Implemented custom floating glassmorphic tooltips containing the full tab name/type and working directory/file path when a tab is hovered or clicked.

## [1.3.54] - 2026-06-28

### Fixed
- **Inactive Workspace Main Branch Icon Color**: Ensured that the `GitBranch` icon for the `main` branch of an inactive workspace is rendered in gray (`text-slate-500`) instead of purple. This aligns it with the gray/slate color of the inactive branch name text, preventing inactive workspaces from appearing partially selected.

## [1.3.53] - 2026-06-28

### Changed
- **Selected Workspace Coloring Consistency**: Prioritized active/selected workspace styling (purple) over git dirty status coloring (amber) in `WorkspaceList.tsx`. The active/selected workspace will now always remain consistently purple, while other inactive workspaces will turn amber when they have uncommitted changes.

## [1.3.52] - 2026-06-28

### Removed
- **Blinking Git Dirty Status Dots**: Removed the redundant blinking amber/orange dots next to git branch names in the workspace sidebar list and footer. Dirty status continues to be indicated by the text and branch icon turning amber.
- **Blinking Version Dot**: Removed the blinking animation from the purple application version indicator in the footer and updated the hardcoded version text from `v1.3.42` to the current version `v1.3.51` (which will be bumped to `v1.3.52` in release).

## [1.3.51] - 2026-06-28

### Fixed
- **Terminal Grid Sizing Sync**: Resolved an issue where clicking and scrolling in interactive TUI applications (like `superagent`) did not work or was misaligned.
  - Added resize execution to backend `init` message handler, ensuring that re-attaching/opening a terminal updates the PTY grid size to match the frontend `xterm.js` viewport.
  - Adjusted frontend `TerminalInstance` initialization to call the initial `debouncedFit` after registering the `onResize` listener, capturing and sending the initial grid dimensions to the PTY backend.

## [1.3.50] - 2026-06-28

### Fixed
- **Mobile Keyboard Auto-Popup**: Stopped the virtual touch keyboard from automatically opening when tapping/clicking inside the terminal area on mobile. The keyboard now only opens when explicitly toggled using the dedicated Keyboard icon in the top-bar.

## [1.3.49] - 2026-06-28

### Fixed
- **Terminal Workspace/Tab Switch Freeze**: Fixed a bug where switching workspaces/tabs while running a highly active CLI tool (like `agy` or `claude code`) in a terminal causes the React UI to freeze.
  - Implemented a `suspend` message to temporarily detach the terminal session sender on the backend when its tab is unmounted, keeping the PTY process and buffer alive in the background without wasting network bandwidth and CPU.
  - Added a `removeListener` method to the WebSocket client to clean up message handlers.
  - Properly nullified `terminalRef.current` in the cleanup function of `TerminalInstance` to ensure any queued requestAnimationFrame writes return early instead of attempting to write to a disposed terminal.

## [1.3.48] - 2026-06-28

### Changed
- **Version Bump**: Bumped version to `1.3.48`.

## [1.3.47] - 2026-06-28

### Added
- **Workspace Edit Settings Feature**: Added capability to edit existing workspace configurations directly from the workspace list.
  - Users can now change the **Default Terminal Shell** and configure an optional **Custom Display Name** for any workspace.
  - Added `PUT /api/workspaces` backend endpoint to update workspace configurations.
  - Added a new `<WorkspaceEditModal>` settings dialog.
  - Added a settings edit button in the workspace list (and the mobile actions dropdown).

## [1.3.46] - 2026-06-28

### Added
- **Unified Custom Confirm/Alert Modals**: Replaced all browser-native `alert()` and `confirm()` prompts with a clean, unified custom `<ConfirmModal>` component to keep design consistency and premium dark mode experience.
  - Modals support custom titles, custom messages, customizable confirm/cancel action labels, and theme variants (e.g. Danger red for deletion).
  - Native confirmation requests (like Workspace or Worktree deletions) and API errors now display in the new modal.

## [1.3.45] - 2026-06-28

### Changed
- **Sleek Session Re-attached Toast**: Replaced the annoying raw `[t-line: Session Re-attached]` terminal text stream with a clean, responsive bottom toast notification.
  - Desktop/Tablet: Displays at the bottom-left corner above the status bar.
  - Mobile: Displays at the bottom-center.
  - Automatic dismissal after 3 seconds with smooth slide-up and fade-out animations.

## [1.3.44] - 2026-06-28

### Added
- **Git Status Badges on Changes Tab**: Added real-time changed files count badges to the Git Changes tab button. When the sidebar is expanded, a count pill is displayed; when the sidebar is collapsed, a small circular notification badge is displayed on the top right of the GitCompare icon.
- **Git Status Badges in Workspace Explorer**: Files and folders in the workspace file tree now display Git status badges.
  - Files display badges like `modif` (for modified), `baru` (for untracked/added), `rename` (for renamed), or `hapus` (for deleted), styled with transparent background colors and borders.
  - Folders display a right-aligned count of changed files inside the directory.
- **Auto Git Status Synchronization**:
  - Global `changedFiles` state managed at `App.tsx` and refreshed using a silent 5-second polling loop.
  - Immediate refetch when saving files in the Monaco Editor or manually refreshing Explorer/Changes panels.

## [1.3.43] - 2026-06-28

### Added
- **Per-Workspace Active Tab Memory**: Klik workspace di sidebar sekarang otomatis memindahkan fokus ke tab terakhir yang aktif di workspace tersebut. Jika tidak ada tab yang aktif, akan memilih tab pertama workspace, atau membuka shell baru di direktori workspace tersebut.
- **Tanda Checkmark pada Workspace Aktif**: Workspace yang tab-nya sedang aktif kini memiliki tanda checkmark (✓) dan style visual ungu yang mempertegas focus workspace saat ini.

### Improved
- **Responsive Workspace Actions**:
  - Pada layar mobile (`< 768px`): Tombol aksi workspace (delete, worktrees, git changes, browse files, terminal) disatukan ke dalam menu dropdown titik tiga (`⋮`) yang responsif dan ringkas.
  - Pada layar tablet/desktop (`≥ 768px`): Semua tombol aksi selalu ditampilkan secara langsung tanpa memerlukan efek hover.

## [1.3.41] - 2026-06-28

### Fixed
- **Terminal Blink/Flicker saat AI Agent Berjalan**: Eliminasi blinking yang terjadi ketika menjalankan AI coding agents (superagent, Claude Code, Antigravity CLI, dll) yang menghasilkan output streaming cepat (spinner, TUI redraws).
  - **Backend (`terminalManager.ts`)**: Tambah mekanisme **batch-flush 16ms** — data output PTY sekarang dikumpulkan dalam `pendingFlushChunks` lalu dikirim ke WebSocket sekaligus setiap 16ms (≈ 1 frame @60fps), menggantikan model lama yang mengirim setiap chunk PTY secara individual (ratusan WS messages/detik).
  - **Frontend (`TerminalInstance.tsx`)**: Tambah **RAF write-queue** — data WebSocket yang datang dikumpulkan dalam `writeQueueRef` lalu di-flush ke `term.write()` dalam satu `requestAnimationFrame`, memastikan xterm.js hanya repaint sekali per frame, bukan setiap kali data WS tiba.
  - Cleanup `cancelAnimationFrame` ditambahkan pada unmount untuk mencegah write ke terminal yang sudah di-dispose.

## [1.3.40] - 2026-06-28

### Improved
- **Terminal Refresh Normalize Trick**: Ubah logic refresh terminal dari simple `reset + init` menjadi **shrink → restore** sequence. Saat tombol refresh diklik, PTY backend menerima resize kecil (setengah ukuran asli) terlebih dahulu, lalu setelah 120ms dikembalikan ke ukuran asli. Ini memaksa PTY mengirim dua sinyal SIGWINCH sehingga aplikasi TUI yang berjalan di alternate screen buffer (seperti Claude Code, Antigravity CLI, dll) melakukan **full redraw** dengan posisi yang benar, bukan sekadar resize visual saja.

## [1.3.39] - 2026-06-28

### Fixed
- **Tab real process name display**: Tab now shows the live active process name (e.g., `node`, `python`, `git`) instead of the static initial name. When the shell returns to idle (process name matches shellType), the tab name reverts to the original workspace-based name. Uses `focusedInst.name` from `terminalInstances` instead of static `t.name` in `App.tsx` tab rendering.
- **initialName tracking**: Added optional `initialName` field to `TerminalInstanceData` to preserve the original tab name across process title overrides.

## [1.3.38] - 2026-06-28

### Fixed
- **Mobile Side Menu z-index overlap**: Increased z-index of mobile sidebar, right sidebar (`z-index: 90`), and sidebar overlay (`z-index: 80`) in `layout.css` to sit cleanly above terminal split pane floating control bars (`z-index: 50`) on mobile screens.

## [1.3.37] - 2026-06-28

### Removed
- **Drag-and-Drop Tab Features**: Completely disabled HTML5 drag-and-drop actions on tabs (both tab reordering and drag-and-drop splitting), removing all overlay layers, drag states, refs, and unused local bindings to simplify layout orchestration and align with built-in button split options.

## [1.3.36] - 2026-06-28

### Removed
- **Terminal Pane Borders**: Removed the 1px purple/transparent border around terminal pane containers in `SplitLayoutRenderer.tsx` to provide a completely clean borderless terminal screen.

## [1.3.35] - 2026-06-28

### Added
- **Icon-Only Collapsed Sidebar**: Refactored the collapsed sidebar behavior to transition into a 48px vertical icon-only Activity Bar instead of hiding completely. Clicking any collapsed icon switches the active tab view and automatically expands the sidebar panel. Active tabs in collapsed mode feature a left purple indicator bar.

## [1.3.34] - 2026-06-28

### Changed
- **Seamless Tab-Terminal Theme Merge**: Changed `.top-bar` background to `#0b0f19` and removed `border-bottom` in `layout.css` to allow the top bar/tab area to blend seamlessly into the terminal view as a single cohesive dark slate surface.

## [1.3.33] - 2026-06-28

### Fixed
- **Multi-Stage Fit to Prevent Overflow**: Updated `debouncedFit` in `TerminalInstance.tsx` to run instantly and at sequential delays (50ms, 150ms, 300ms, 500ms) to cleanly capture window state maximization, split-pane resizes, and sidebar transitions.
- **Hidden Overflow on Pane Wrapper**: Added `overflow: 'hidden'` to the terminal leaf wrapper `div` in `SplitLayoutRenderer.tsx` to prevent the xterm canvas scrollbar or canvas viewport from overflowing the pane.

## [1.3.32] - 2026-06-28

### Changed
- **Zero-Padding Content Viewport**: Changed desktop `.content-area-tabs` wrapper padding from 16px to 0 in `layout.css` to allow the terminal to fully stretch to the left and right edges of the window layout.
- **Matched Background Colors**: Set `.terminal-container` background color to `#0b0f19` in `components.css` to perfectly align with xterm's slate background color, ensuring any leftover grid column spacing is visually hidden.

## [1.3.31] - 2026-06-28

### Changed
- **Edge-to-Edge Terminal Layout (No padding/borders)**: Removed the padding, rounding, shadows, and borders from `.terminal-container` and `.terminal-element` in `components.css`. The terminal canvas now sits completely flush and edge-to-edge (nempel ke kanan dan kiri) in its parent pane for a maximized, premium view.

## [1.3.30] - 2026-06-28

### Added
- **Tab Reordering (Drag and Drop)**: Integrated HTML5 drag-and-drop support on tab headers in `App.tsx`, enabling users to click, grab, and reorder tabs left/right seamlessly (just like Chrome browser tabs).
- **Automated Startup Session Restoration**: Replaced the manual background active session import banner/prompt with a fully automated restoration sequence. Active sessions are automatically queried and imported silently into UI tabs upon startup or authentication, ensuring a seamless user experience.

## [1.3.29] - 2026-06-28

### Fixed
- **Non-Destructive Terminal Refresh**: Refactored the terminal refresh button handler in `App.tsx` and `useTerminals.ts` to be non-destructive. Clicking the button now calls `term.reset()` to clear the frontend canvas visually and triggers a websocket `init` re-attach. This forces the backend to replay its session history buffer rather than killing the active shell process, preserving all background processes and build tasks.

## [1.3.28] - 2026-06-28

### Added
- **Terminal Context Menu (Copy/Paste/Select All/Clear)**: Added a premium custom HTML right-click context menu in the terminal panel, allowing users to Copy selected text, Paste clipboard data, Select All terminal text, and Clear the terminal screen. Selection state detection is managed dynamically.
- **Active PTY Sessions inside System Tray**: Added a dynamic listing of active terminal PTY sessions grouped by their workspaces inside the Electron system tray context menu. It polls running terminal sessions and workspaces periodically and updates context menu submenus smoothly when state changes occur.

## [1.3.27] - 2026-06-28

### Added
- **Refresh Terminal Button in Footer**: Added a Refresh/Restart Terminal button to the footer's layout control pill. When clicked, it terminates the active terminal session process on the backend and initiates a fresh terminal shell in the same workspace directory without closing/reopening the tab manually.

## [1.3.26] - 2026-06-28

### Added
- **Restart Desktop option in System Tray**: Added a new "Restart Desktop" menu item to the system tray context menu. This lets users relaunch the Electron wrapper shell cleanly via `app.relaunch()` and `app.quit()`.

## [1.3.25] - 2026-06-28

### Added
- **Auto-Close Tabs on Workspace Removal**: Updated `handleRemoveWorkspace` in `App.tsx` to automatically close all active terminal and file tabs that belong to the workspace being removed. This performs websocket unsubscriptions, deletes terminal instances from state, and safely updates the active tab focus.

## [1.3.24] - 2026-06-28

### Fixed
- **System Tray Backend Detection**: Enhanced the backend detection mechanism in `desktop/main.js` by checking `localhost` first, and falling back to `127.0.0.1` on error or timeout. This resolves connection check failures on systems where the loopback interfaces resolve to different IP families (IPv4 vs IPv6).
- **Real-Time Status Polling**: Implemented a periodic 5-second polling interval in the Electron main process to check the backend's status. The system tray will now dynamically update its status and enable/disable menu items in real-time, even if the backend process is started or stopped manually outside of Electron.

## [1.3.23] - 2026-06-28

### Added
- **Password Visibility Toggles**: Added eye/eye-off toggle buttons next to all master password inputs across the application (login, setup form, and master password change tabs in settings). This allows users to inspect or hide their entered password text for better accuracy.

## [1.3.22] - 2026-06-28

### Changed
- **Header Shortcut Icon**: Changed the keyboard shortcuts button icon in the top header from `Keyboard` to `HelpCircle`. This avoids confusion and visual collision on mobile screens where a second `Keyboard` icon toggles the virtual touch keyboard.

## [1.3.21] - 2026-06-28

### Added
- **Full Screen Mobile Login/Auth Screen**: Styled `.auth-wrapper` and `.auth-card` to match the full-screen layout on mobile (stretching edge-to-edge, zero margin, zero border-radius) while centering form content vertically for a premium user experience.

## [1.3.20] - 2026-06-28

### Added
- **Full Screen Mobile Modals**: Styled dialog modals (`.modal-overlay` and `.modal-content`) to take up the full width and height of the screen (edge-to-edge, zero margin, zero border-radius) on mobile devices to optimize display space and styling.

## [1.3.19] - 2026-06-28

### Fixed
- **CSS Reset Specificity**: Wrapped the universal CSS reset (`* { margin: 0; padding: 0; }`) and default element styles (`body`, `button`, `input`, `a`, etc.) inside Tailwind CSS's `@layer base` block. This prevents unlayered CSS resets from overriding layered Tailwind utility classes (like `.px-4` or `.md:px-4`) under standard CSS Cascade Layer rules.
- **index.css Modularization**: Refactored the large, 1,311-line `index.css` file by splitting it into modular, smaller stylesheets (`base.css`, `layout.css`, `components.css`) to adhere to the project's strict 1,000-line file length limit.

## [1.3.18] - 2026-06-28

### Fixed
- **Modal Overlay App-Region Interaction**: Added `-webkit-app-region: no-drag` to `.modal-overlay` and `.modal-content` in CSS. This resolves an issue in Electron frameless windows where clicks on the modal (which sits on top of draggable title/topbar zones) were intercepted as window drag events by the OS, preventing input fields (like the master password fields in settings) from receiving focus and keyboard input.

## [1.3.17] - 2026-06-28

### Fixed
- **Footer Horizontal Padding Adjustment**: Increased horizontal padding on the left and right sides of the footer (`Footer.tsx`) from `px-4` (16px) to `px-6` (24px) to give elements more breathing room and prevent a cramped layout near the screen boundaries.

## [1.3.16] - 2026-06-28

### Added
- **Modern Footer Redesign**: Reorganized the footer status bar (`Footer.tsx`) with a premium, space-efficient, and responsive layout:
  - Added new visual icons for Workspace (`Folder`) and Network (`Globe`) to align with design standards.
  - Implemented glassmorphism styling (`backdrop-blur-md bg-[#080b13]/90 border-t border-white/10 shadow-[0_-2px_10px_rgba(0,0,0,0.3)]`).
  - Added micro-interaction animations such as hover scaling on zoom controls and translation animations on action buttons.
  - Re-styled the default HTML select element with a custom background, borders, and a custom SVG chevron icon indicator to match other premium elements.
  - Formatted active Cloudflare Tunnel statuses into unified badges with subtle glowing dropshadows.
  - Integrated mobile-responsive styles to automatically hide labels/text descriptions and collapse elements, avoiding vertical overlaps on small screen widths.

## [1.3.15] - 2026-06-28

### Fixed
- **Mobile Terminal Action Bar Relocation**: Relocated the floating terminal action bar inside `SplitLayoutRenderer.tsx` from the top-right corner (`top-2 right-2`) to the bottom-right corner (`bottom-2 right-2 top-auto`) on mobile and tablet viewport sizes. The top-right positioning is preserved (`lg:top-2 lg:right-2 lg:bottom-auto`) on desktop screens. This prevents buttons from overlapping the terminal output area or other header elements on small devices.

## [1.3.14] - 2026-06-28

### Added
- **Cloudflare Quick Tunnel Propagation Tip**: Added a helpful info tooltip (`Info` icon from `lucide-react`) next to the generated tunnel URL in `Footer.tsx` when a Cloudflare Quick Tunnel is launched. This informs users that dynamic subdomains (like `*.trycloudflare.com`) can take 5-15 seconds for DNS records to propagate, guiding them to wait and reload if they encounter a "This site can't be reached (NXDOMAIN)" error.

## [1.3.13] - 2026-06-28

### Added
- **Cloudflare Tunnel Start/Stop Loading Feedbacks**: Added a reactive `tunnelLoading` state inside the `useTunnel` hook. The Cloudflare Tunnel status badge in `Footer.tsx` now shows a blue spinning loader and displays `Starting...` or `Stopping...` while operations are in progress. Disabled all tunnel control buttons (Quick URL, Custom, Stop) during loading to prevent race conditions. Also integrated the loading feedback with a rotating spinner inside the submit button and disabled forms inside `TunnelSetupModal` (`Modals.tsx`).

## [1.3.12] - 2026-06-28

### Added
- **Responsive Terminal Split Actions**: Modified the floating action bar in `SplitLayoutRenderer.tsx` to be always visible on mobile and tablet screen sizes (`opacity-100 lg:opacity-0 lg:group-hover/pane:opacity-100`) because hover events do not exist on touch devices. Enlarged the touch target size of the action buttons from `20px` to `28px` (`w-7 h-7 lg:w-5 lg:h-5`) and increased icon sizes on mobile and tablet viewports to make them touch-friendly. Added `onTouchEnd` event stop propagation to prevent touch event leaks.

## [1.3.11] - 2026-06-28

### Fixed
- **Terminal Resize / Fit Debouncing**: Debounced terminal fit actions inside `TerminalInstance.tsx` using a callback helper. This prevents multiple overlapping `fit()` calls from executing simultaneously during initial page render, font size changes, and layout transitions (such as sidebar animation or virtual keyboard popping up). Redundant fits are now coalesced into a single sizing request, eliminating terminal content flashing ("blink-blink") and reducing PTY resize network traffic.

## [1.3.10] - 2026-06-28

### Fixed
- **Mobile Terminal Click Focus & Virtual Keyboard**: Added capturing phase event listeners for click and touch events on the terminal container inside `TerminalInstance.tsx` to bypass `xterm.js`'s event propagation blocking (`stopPropagation`). Also wrapped the terminal instance's focus callback inside `SplitLayoutRenderer.tsx` to ensure `focusTerminal` is always invoked when the user taps on a terminal pane on mobile, reliably toggling the virtual touch keyboard.

## [1.3.9] - 2026-06-28

### Added
- **Tunnel URL Copy Action**: Added a "Copy" button next to the "Open" button in the footer when a Cloudflare Tunnel is active. This allows the user to copy the active tunnel URL to their clipboard with a temporary success indicator state showing a green checkmark and "Copied".

## [1.3.8] - 2026-06-28

### Fixed
- **node-pty AttachConsole Crash**: Added a try-catch block to `node-pty`'s internal console process list agent and monkeypatched `node-pty`'s `WindowsPtyAgent` constructor in `terminalManager.ts` to run the console process list fork silently on Windows. This suppresses distracting and noisy uncaught `AttachConsole failed` stack traces in the backend log console during terminal process cleanup.

## [1.3.7] - 2026-06-28

### Fixed
- **Mobile Top-Bar & Icon Alignments**: Increased size of Keyboard and MoreVertical toggle icons to `18px` in mobile view to align with other icons. Adjusted top-bar margins and padding to `12px`, and increased action buttons' touch target paddings to `6px`.
- **Right Drawer Touch Enhancements**: Adjusted padding on mobile "New Tab" button in RightSidebar.

## [1.3.6] - 2026-06-28

### Fixed
- **Custom Keyboard Padding**: Increased the bottom padding of the virtual touch keyboard on mobile devices to `24px` to prevent overlapping with native gesture bars and home indicator areas.

## [1.3.5] - 2026-06-28

### Added
- **Mobile Right Drawer Menu**: Relocated active tabs, settings, and logout options on mobile screens to a dedicated right side slide-out drawer menu.
- **Top-Bar Menu Toggle Button**: Added a new menu action button (vertical dots icon) in the top-right of the navigation bar on mobile screens to open the right drawer.
- **Top-Bar Cleanup**: Hid settings and logout buttons from the top bar on mobile, moving them cleanly to the new right menu drawer.

## [1.3.4] - 2026-06-28

### Fixed
- **Welcome Dashboard Spacing**: Increased the vertical margins (`mb-`) of elements (icon wrapper, title, and description text) on the empty dashboard view to add more breathing room and prevent texts from sticking too close together.

## [1.3.3] - 2026-06-28

### Fixed
- **Welcome Dashboard Bottom Padding**: Replaced Tailwind inline card padding configuration with custom `.welcome-card-outer` and `.welcome-card-inner` classes, enforcing explicit paddings (40px on desktop and 24px on mobile) using `!important` to resolve the button padding cutoff.

## [1.3.2] - 2026-06-28

### Added
- **Responsive & Minimalist Terminal Spacing**: Refactored the terminal content area classes and container padding. Added mobile-first overrides that remove boundaries, borders, and paddings for a highly minimalist experience on small screens while keeping terminal layouts edge-to-edge.
- **Desktop Padding Area**: Added a beautiful 16px desktop padding area around the terminal container to restore the premium rounded-border look when tabs/terminals are active on desktop.
- **Responsive Welcome Dashboard**: Optimized `EmptyDashboard` layout with responsive paddings, margins, button sizes, and icon scaling to ensure a compact, minimalist experience on mobile.

## [1.3.1] - 2026-06-27

### Fixed
- **Monaco Full-Width Stretch**: Updated `FileViewerTab.tsx` parent container class names with `flex-1 w-full h-full` and passed `width="100%"` explicitly to the Monaco `<Editor>` component, ensuring the coding area stretches cleanly to fill the entire horizontal space of the right viewport pane.

## [1.3.0] - 2026-06-27

### Added
- **Debounced Auto-Save**: Integrated a 1000ms debounced auto-save mechanism inside `FileViewerTab.tsx`. Edits are automatically saved to disk when the user pauses typing.
- **Auto-Save Status Bar**: Created real-time feedback elements in the header (e.g. `Saving...`, `Saved` checkmark, `Modified`, or `Auto-save active`) to indicate write status dynamically.

## [1.2.9] - 2026-06-27

### Added
- **Monaco Code Editor Integration**: Replaced the text area with a full Monaco Editor (`@monaco-editor/react`) for code editing. Features full syntax highlighting, automatic language selection from file extensions, smooth caret animations, and a customized `#030408` theme background.
- **Default Editable Mode**: Enabled file editing by default upon opening any file. Added visual `Modified` state flags, real-time dirty state tracking, and a Save / Revert action bar in the header.

## [1.2.8] - 2026-06-27

### Fixed
- **Sidebar Auto-Collapse on File Open**: Updated `openFileTab` inside `useTerminals.ts` to trigger the `onTerminalOpen` callback. This automatically closes/collapses the left sidebar panel on mobile and tablet devices when a file is opened, immediately showing the File Viewer/Editor interface.

## [1.2.7] - 2026-06-27

### Added
- **Pulsing Skeleton Loader**: Replaced the reading spinner in `FileViewerTab.tsx` with a highly-polished layout-aligned skeleton loader that simulates header bars and rows of code text when loading a file.

## [1.2.6] - 2026-06-27

### Added
- **File Explorer Editor Support**: Integrated an editor mode inside `FileViewerTab.tsx` with a toggled textarea, enabling full-featured file edits. Exposed a new POST `/api/fs/write` route in `server.ts` to write updated files back to disk.

## [1.2.5] - 2026-06-27

### Added
- **Hide Keyboard Button**: Added a dedicated `✕` button to the far right of the mobile virtual keyboard's modifier toolbar. Clicking this button hides the touch virtual keyboard directly from the interface.

## [1.2.4] - 2026-06-27

### Fixed
- **Mobile & Tablet Responsive Buttons**: Made the active sessions alert banner container use `flex-col md:flex-row` and added `whitespace-nowrap` to the action buttons to prevent text wrapping on narrow screen sizes. Also updated the welcome dashboard buttons container (`EmptyDashboard.tsx`) to use `flex-col sm:flex-row` to stack cleanly on mobile screen sizes.

## [1.2.3] - 2026-06-27

### Added
- **Mobile Sidebar Active Tabs Menu**: Added a new mobile-only sidebar panel tab called `Tabs` that lists all currently active pseudoterminal tabs. Clicking any tab in this menu activates it and collapses the sidebar.
- **Auto-Responsive Text Size**: Locked the default terminal font size to `8px` on mobile/tablet viewports (screen width <= 768px) to reduce line-wrapping and improve code readability, while keeping the user's preferred zoom size on desktop.

### Fixed
- **App.tsx Refactoring**: Moved the sidebar panel content rendering blocks into a separate component `SidebarContentPanel.tsx` to keep the code modular and under the 1000-line limit (reduced `App.tsx` from 1060 lines down to 903 lines).

## [1.2.2] - 2026-06-27

### Added
- **Auto-Suppress Native Keyboard & Auto-Open Custom Keyboard**: Dynamically set `inputmode="none"` on the hidden helper `<textarea>` of xterm.js to suppress the native mobile virtual keyboard. Integrated an `onTerminalFocus` callback so that clicking/tapping on any terminal instance automatically opens the custom virtual touch keyboard on mobile.

## [1.2.1] - 2026-06-27

### Fixed
- **Mobile Navigation Overlap**: Added `calc(env(safe-area-inset-bottom, 0px) + 16px)` bottom padding to the virtual keyboard to prevent the Enter and Space keys from being covered by browser bottom bars or Android system navigation indicators.
- **Minimalistic Mobile Header**: Reduced `--topbar-height` from 56px to 42px on mobile viewports. Hid the desktop-specific `Keyboard Shortcuts` button from the Topbar when accessed from mobile devices.
- **Sleeker Virtual Keyboard Key Sizes**: Reduced QWERTY keys font size to `text-[12px]` and vertical padding to `py-2.5`, making the layout much more compact and professional.

## [1.2.0] - 2026-06-27

### Added
- **Custom Touch On-Screen Keyboard**: Integrated a premium, toggleable virtual on-screen keyboard (`MobileKeyboard`) visible on mobile screens (< 768px). Includes sticky modifier locks for `Ctrl` and `Alt` (enabling shortcuts like `Ctrl+C` or `Ctrl+D` on touch), standard QWERTY rows, a symbols toggle tab, and arrow navigation pads (`↑`, `↓`, `←`, `→`).

### Fixed
- **App.tsx Code Complexity Reduction**: Refactored `startResizing` and `handleMergeTab` drag/merge logic from `App.tsx` into a custom hook `useLayoutHelpers.ts` to keep the core component under the strict 1000-line ceiling.

## [1.1.9] - 2026-06-27

### Fixed
- **Mobile Touch Input Focus (Android/iOS)**: Added explicit click and touch listeners (`onClick` and `onTouchEnd`) on the pseudo-terminal container to directly trigger `.focus()` on xterm.js's hidden helper textarea inside a user interaction gesture, allowing virtual keyboards on Android and iOS to open reliably when tapping a terminal tab.

## [1.1.8] - 2026-06-27

### Added
- **Active Session Import Offer on Web Access**: Added a notification banner and session importer to let web browser dashboard instances discover and load active pseudo-terminal sessions currently running in the backend (e.g. from the desktop app).
- **Active Terminal Listing Endpoint**: Exposed `/api/terminals/active` on the backend to list running terminal PTY sessions with their details.

## [1.1.7] - 2026-06-27

### Added
- **HTTP Health Verification on Port Collision**: Replaced net socket connection checks in desktop initialization with an HTTP-based health check probing the t-line setup API, avoiding false positives on unrelated services using port 3999.
- **Sequential Git Status Processing**: Implemented sequential worktree status checking to prevent peak CPU and disk I/O bottlenecks in getWorkspaceInfo.

### Fixed
- **Strict 1000-Line Limit Refactoring**: Refactored frontend `App.tsx` from 1364 lines down to 998 lines by extracting `SplitLayoutRenderer`, `WorkspaceList`, and `EmptyDashboard` into separate files.
- **Git Command Injection Vulnerability**: Replaced shell-interpolated child_process `exec` execution in gitManager with parameter-safe `execFile` array argument passing and added a 15-second timeout on all git executions to prevent zombie processes.
- **Secure Bypass Token File Permissions**: Added restricted owner-only file permissions (`mode: 0o600`) when writing the bypass token file.
- **Memory-Efficient Terminal Buffer**: Refactored terminal output buffers in terminalManager to use chunked array of strings instead of continuous string allocation/slicing on every PTY write.

## [1.1.6] - 2026-06-27

### Fixed
- **Terminal Mouse Reporting Support**: Changed the pseudo-terminal spawn options on Windows to use the modern `ConPTY` engine (`useConpty: true`) instead of legacy `winpty`. This enables standard ANSI mouse event reporting (like SGR click and scroll tracking), allowing interactive TUI applications (e.g. `superagent`) running inside `t-line` tabs to natively receive and process mouse clicks.

## [1.1.5] - 2026-06-27

### Added
- **Tiled & Grid Split Terminal Layout**: Rebuilt the split terminal feature to support independent grid/tiled layouts per tab using nested `react-resizable-panels`. Multiple terminal sessions can be split horizontally or vertically in any nested configuration inside a single tab.
- **Floating Action Bar**: Integrated a floating, hover-activated action bar in each terminal pane with buttons to split horizontally/vertically or close individual panes.
- **Drag and Drop Merge Splitting**: Dragging any terminal tab and dropping it onto a split zone (left, right, top, bottom) of another tab merges its terminal session into that tab's split layout.
- **Dynamic Title Synchronization**: Updated active tab titles to dynamically reflect the name of the currently focused terminal pane.

## [1.1.4] - 2026-06-27

### Changed
- **Split Pane Library**: Replaced custom split ratios and drag-resize calculations with the `react-resizable-panels` library for horizontal and vertical splitting.
- **Terminal Resize Observer**: Added a `ResizeObserver` on `TerminalInstance` to automatically refit the active terminal container when dragging split panel layout sizes or collapsing/expanding the sidebar, providing smooth and native-feeling window sizing.

## [1.1.3] - 2026-06-27

### Added
- **Keyboard Shortcuts** (`useKeyboardShortcuts` hook): Ctrl+T buka terminal baru, Ctrl+W tutup tab aktif, Ctrl+Tab/Ctrl+Shift+Tab navigasi tab, Ctrl+1-9 loncat ke tab ke-N, Ctrl+Shift+D/E toggle split pane horizontal/vertikal, Ctrl+=/- zoom in/out.
- **Split Pane Terminal** (`useSplitPane` hook): tampilkan dua terminal secara horizontal (side-by-side) atau vertikal (atas-bawah) dengan resize handle bisa di-drag. Tombol split muncul otomatis di tab bar jika ada ≥2 terminal.
- **Terminal Search Bar**: Ctrl+Shift+F membuka search bar floating di atas terminal (SearchAddon). Fitur: prev/next result, toggle case-sensitive, toggle regex, close (Esc).
- **Unicode11Addon**: dukungan penuh karakter emoji, CJK, dan unicode lebar lainnya di terminal.
- **Output Buffer Replay**: saat WebSocket reconnect, backend mengirim ulang output terminal yang terlewat selama koneksi terputus (buffer 128KB rolling).

### Changed
- **Session Cleanup Timeout**: PTY session detach timeout dari 60 detik → 30 detik.
- **Terminal Auto-Focus**: terminal aktif otomatis mendapat focus saat tab di-switch.
- **Tab Bar**: tombol `+` New Terminal sekarang muncul dengan tooltip `(Ctrl+T)`. Tombol split Columns/Rows muncul hanya saat ada ≥2 terminal aktif.

## [1.1.2] - 2026-06-27

### Added
- **WebLinksAddon**: URL/link yang muncul di terminal sekarang bisa diklik langsung (Ctrl+Click/Click) menggunakan `xterm-addon-web-links@^0.9.0`.
- **Enhanced Scroll Behavior**: Scrollback buffer ditingkatkan ke 10.000 baris (sebelumnya default), `scrollOnUserInput: true` agar terminal otomatis scroll ke bawah saat mengetik, Shift+Scroll untuk fast scroll.
- **Selection Highlight**: Warna selection teks di terminal kini ungu semi-transparan (konsisten dengan tema app) termasuk state inactive selection.
- **Right-Click Select Word**: Klik kanan pada kata langsung men-select kata tersebut untuk kemudahan copy.
- **Font Refinement**: Ditambahkan `Fira Code` sebagai fallback font, `lineHeight: 1.2` untuk keterbacaan yang lebih baik.

## [1.1.1] - 2026-06-27

### Changed
- **Workspace List Full Bleed**: Removed horizontal padding on the workspace list container so cards stretch edge-to-edge (flush kanan kiri) inside the sidebar. Cards now use a bottom border separator instead of individual rounded borders, matching the visual style of Explorer and Changes panels.

## [1.1.0] - 2026-06-27

### Removed
- **Global Shell Concept**: Removed the 'Global Shell' terminal title and button configurations, routing all terminal instances through active workspace scopes under standard 'Shell' naming.

## [1.0.9] - 2026-06-27

### Added
- **Backend Process Name Polling**: Integrated active foreground process tracking on the backend (querying `node-pty` process names every 1,000ms) and dispatching WebSocket `title` events to update client terminal tab titles dynamically, resolving WinPTY/shell limitations on Windows.

## [1.0.8] - 2026-06-27

### Changed
- **Full Bleed Sidebar Panels**: Configured the File Explorer and Git Changes sidebar panels to be full bleed (flush/nempel) to the left, right, and top edges by conditionally removing the sidebar-content padding and gaps.

## [1.0.7] - 2026-06-27

### Added
- **Dynamic Terminal Tab Titles**: Integrated xterm's `onTitleChange` event handler on the frontend to dynamically update tab titles to match the actual shell process or active directory title.
- **Terminal State Hook Extraction**: Refactored all terminal-related React states, LocalStorage sync handlers, zoom functions, and open/close commands out of `App.tsx` into a modular custom hook `useTerminals.ts`. This reduces the complexity of `App.tsx` to 966 lines, keeping it below the strict 1,000-line limit.

## [1.0.6] - 2026-06-27

### Added
- **File Tab Opening**: Clicking a file in the File Explorer now opens it as a dedicated tab in the main editor area alongside terminal tabs, complete with line numbering, custom dark styling, and a Copy button.
- **Workspace Terminal Paths**: Configured new terminals (from the `+` button or the welcome screen) to open automatically in the current active workspace directory rather than the user's home directory.
- **Default Maximize Window**: Programmed the desktop application window to launch maximized by default.
- **Bottom Status Bar (Footer)**: Relocated the Cloudflare Tunnel widget, status indicator, and controls from the sidebar to a new bottom status bar (footer) to free up sidebar space and match standard workspace design layouts.
- **Dynamic Maximize/Restore Icons**: Integrated main process maximize/unmaximize listeners and window state checks to dynamically toggle the window header maximize button between standard maximize (`▢`) and restore (`❐`) icons.
- **Terminal Font Size & Zoom Controls**: Decreased default terminal font size to `12px` and added real-time Zoom In and Zoom Out controls inside the terminal tab bar header with persistent storage.
- **Minimalist Headers**: Streamlined the sidebar logo area (removing card backgrounds, padding, and version badges) and the main top bar connection status display (removing connection status labels, leaving a single status dot with hover details) to create a clean, distraction-free environment.
- **Merged Tab Bar**: Integrated the terminal/file tab bar, font zoom controls, and default shell selector directly into the top window bar header (top-bar) to save vertical screen space and align standard workspace layout design.
- **Full Bleed Terminal View**: Removed container padding, borders, and margins from the active panel area when tabs are open, making the terminal and file viewer panes attach fully (flush/nempel) to all edges.
- **Git Branch Status in Footer**: Embedded the active Git branch name (e.g. `main`, worktrees, or `detached`) directly next to the active workspace path in the bottom status bar, with uncommitted change warnings (yellow pulsing dot) and distinct worktree/main branch coloring.
- **Terminal Zoom & Shell Selector Relocated to Footer**: Shifted the terminal zoom buttons and default shell selector dropdown out of the top window header and embedded them inside a center-aligned dashboard pill in the status bar footer, maximizing header space and layout clarity.
- **Vertical Header Dividers**: Added left and right vertical dividers flanking the integrated tab bar container inside the top window header to cleanly isolate active workspaces from connection status details and system actions.
- **Streamlined Header Spacings**: Restructured the spacing inside the top window bar header (increasing gaps to `16px` for info/actions, adding margins to individual tabs, separating zoom controls, shell selectors, and window buttons) to prevent item clumping and ensure a professional, polished layout.
- **Tunnel Access Control & Device Management**: Integrated an IP rule manager and request logger. Created an 'Access Control' settings interface displaying active device types, IP addresses, and activity timestamps, enabling users to instantly block/unblock client IPs and restrict WebSocket terminal upgrades with a self-blocking fail-safe.

## [1.0.5] - 2026-06-27

### Added
- **Settings Modal**: Added a settings button next to logout that displays system version/details and supports updating the master password.
- **Resizable Panels**: Added a draggable divider handle between the left sidebar and right content panel (allowing customization of the sidebar width, stored in `localStorage`).
- **Sidebar Collapse/Minimize**: Upgraded the sidebar toggle to work on desktop (minimizing sidebar to width `0`) as well as mobile devices.
- **Frameless Header Integration**: Removed the dedicated custom title bar to maximize vertical space. Integrated minimize, maximize, and close buttons on the right side of the main `top-bar` (only visible in Electron), and configured drag regions on headers to support native window dragging.

### Changed
- **Architectural Hook Extraction**: Extracted `useTunnel` and `useWorkspaces` custom hooks from `App.tsx` to new files in `frontend/src/hooks/`. This modularized network fetching, reduced code duplication, and brought `App.tsx` down to 866 lines (conforming to the repository's 1000-line limit).

## [1.0.4] - 2026-06-27

### Added
- **Skip Backend Spawn if Already Running**: Added a TCP port check on port `3999`. If the backend is already running, the desktop wrapper skips spawning a new backend process and connects to it directly.
- **Shared Ephemeral Bypass Token**: The backend now writes its ephemeral bypass token to `~/.tline-bypass-token` on startup and deletes it on exit, letting the desktop wrapper automatically authenticate with the externally running backend.

## [1.0.3] - 2026-06-27

### Added
- **Workspace Navigation UX**: Added a dropdown workspace selector at the top of both the **Explorer** and **Changes** sidebar panels. This allows users to view and switch workspaces directly from these panels.
- **Auto-Select Active Workspace**: Added automatic selection logic. If only one workspace is tracked, it is automatically selected. Switching to **Explorer** or **Changes** tabs auto-selects the first available or first Git-enabled workspace if none was selected, preventing empty/unselected panel states.

## [1.0.2] - 2026-06-27

### Added
- **System Tray Integration**: Added system tray icon and background running capability. The main window now hides to the system tray on close instead of exiting completely, and alerts the user with a cross-platform system notification on the first hide.
- **Backend Process Controls**: Added Start, Stop, and Restart controls for the backend process directly inside the system tray context menu. Included a fallback state page in the main window when the backend is stopped.
- **Premium App Icon**: Added a sleek, high-resolution Obsidian-themed application icon used for both the window icon and the system tray.

### Changed
- **Dependencies Configuration**: Moved the `electron` package from `dependencies` to `devDependencies` in `desktop/package.json` and pinned it to a fixed version as required by `electron-builder`.

## [1.0.1] - 2026-06-27

### Fixed
* **PTY Terminal Directory Cwd Separators**: Normalized the `cwd` directory path on the backend before spawning shells in `terminalManager.ts`. This resolves directory alignment issues on Windows where path separators or slashes could fail to set the terminal folder to the tracked workspace or worktree path.

## [1.0.0] - 2026-06-27

### Added
* **Premium Obsidian Dark Theme**: Implemented a rich dark theme (`#05070c`) featuring glassmorphic panels, mesh lighting accents, subtle radial grid background, hover animations, and pulsing git status indicators.
* **Tailwind CSS v4 Integration**: Added Vite native Tailwind v4 support in the frontend project workspace.
* **Active Tab & Terminal Persistence**: 
  * Terminal tab state, active tab ID, directories (`cwd`), and shell types are saved in `localStorage` in real-time.
  * Backend auto-spawns PTY shells on startup or hot-reloads running sessions gracefully upon browser refresh.
  * System clears local tab settings automatically on logout.
* **Custom Frameless Title Bar**: Configured Electron wrapper with `frame: false` and created a custom title bar in React featuring native Minimize, Maximize, and Close commands via IPC Context Bridge.
* **Local Web Directory Browser**: Implemented fallback folder navigation service endpoint (`/api/fs/list`) enabling web client users to browse drives and host folder structures when native file dialogs are inaccessible.
* **Reusable Form UI Components**: Created modular, styled components (`Input`, `Select`, `TextArea`, `FormField`, `Button`) in `Form.tsx` to handle inputs and dynamic button states with consistent aesthetics.
* **Standalone Executable Compilation**: Configured `electron-builder` in the desktop wrapper and added root script `npm run build:exe` to package the entire workspace stack into a standalone `.exe` installer.

### Changed
* **Architectural Decoupling**: Refactored the core frontend structure, extracting `TerminalInstance`, `AuthForms`, `Modals`, and `websocket` network manager to separate files. This reduced `App.tsx` from 1333 lines down to a clean 880 lines (strictly complying with the 1000-line code limit).

### Security
* **Authentication Bypass**: Implemented local runtime ephemeral tokens to automatically authenticate local Electron clients while enforcing strict Master Password locks on incoming web requests.
