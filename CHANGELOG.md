# Changelog

All notable changes to the **t-line** workspace manager project will be documented in this file.

---

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
