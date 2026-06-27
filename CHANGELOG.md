# Changelog

All notable changes to the **t-line** workspace manager project will be documented in this file.

---

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
