# t-line — Workspace Manager `v1.3.67`

> A modern, premium local developer dashboard for managing workspaces, Git Worktrees, and multiple terminal instances — built with an Obsidian Dark aesthetic.

---

## Features

### 🖥️ PTY Terminal Multiplexer
- Spawn and manage multiple terminal tabs (PowerShell, CMD, Git Bash, WSL) as independent pseudo-terminal sessions.
- Terminals auto-open in the active workspace directory.
- **Dynamic tab titles** — tab names update in real-time to reflect the active foreground process via backend process-name polling (every 1,000ms), working around WinPTY limitations on Windows.
- **Zoom controls** — in/out font size with persistent storage, docked in the status bar footer.
- **Default shell selector** — choose your preferred shell, persisted across sessions.
- **Compact tab bar** — tabs shrink gracefully; close button is hidden on small inactive tabs to prevent accidental closure (mirrors Chrome tab UX).
- **Custom tooltips** — hovering a narrow tab shows the full tab title; tooltips are properly cleaned up on tab close or context menu open.

### 💾 Persistent Tab State
- Terminal tabs, active tab ID, working directories (`cwd`), and shell types are saved in `localStorage` and restored across window reloads and backend restarts.
- State is automatically cleared on logout.

### 🌿 Git Worktrees Automation
- Track and list active Git worktrees with their checkout paths.
- Quickly create new worktree branches from the UI.
- Real-time **dirty index detection** with pulsing alerts.
- **Dirty file count badge** — shows exact count of uncommitted changes/untracked files next to each dirty branch in the sidebar.
- **Git branch status in footer** — shows active branch (or worktree name), with uncommitted change warnings.
- **Safe worktree deletion** — auto-closes all terminal and file tabs inside the worktree before deleting; falls back to `fs.rmSync` + `git worktree prune` if Git cannot acquire the file lock (e.g. antivirus hold).

### 📁 File Explorer & Editor Tabs
- Browse host drive letters and folder structures directly in the sidebar.
- Click any file to open it as a dedicated **editor tab** alongside terminal tabs, with line numbering, dark styling, and a Copy button.
- Explorer and Changes panels feature **full-bleed layout** — flush to all edges.
- **Auto-selects workspace** — if only one workspace is tracked, it is automatically selected. Switching panels auto-selects the first available or Git-enabled workspace.

### 🗂️ Workspace Actions Dropdown
- All workspace action buttons (rename, delete, open in Explorer, etc.) are collapsed into a **three-dot (⋮) dropdown menu** on all screen sizes for a cleaner card layout.
- Dropdown is rendered in a **portal** to escape parent `overflow: hidden` containers.
- **Click workspace path in footer** to instantly open that directory in Windows Explorer.
- **Full path tooltip** on the workspace path text for quick reference.

### 🔐 Security & Authentication
- Protect your backend with a **Master Password** (bcrypt-hashed, stored in `~/.tline-config.json`).
- **Ephemeral bypass token** — written to `~/.tline-bypass-token` on startup, deleted on exit. Lets the Electron desktop client authenticate automatically without requiring the master password.
- **Tunnel Access Control** — IP rule manager and request logger. Block/unblock client IPs and restrict WebSocket terminal upgrades. Includes a self-blocking fail-safe to prevent accidental lockout.

### 🌐 Remote Tunneling (Cloudflare)
- Expose your dashboard remotely via **Cloudflare Tunnel** — supports Quick URL or Custom Token modes, docked in the bottom status bar.

### 🖱️ System Tray Integration
- The desktop app hides to the system tray on close instead of exiting.
- System tray context menu supports **Start / Stop / Restart backend** process controls.
- Notifies the user (cross-platform) on first hide.
- Shows a fallback state page in the main window when the backend is stopped.

### 🪟 Frameless Electron Desktop Client
- Custom borderless window with native Minimize, Maximize, and Close via IPC bridge.
- Window **launches maximized** by default.
- **Dynamic Maximize/Restore icon** — toggles between `▢` and `❐` based on actual window state.
- Draggable header region for native window movement.
- Electron controls are only visible when running inside Electron (hidden in browser).
- **Custom T+ brand logo** — unified SVG/PNG icon used in sidebar header, system tray, and taskbar with a dark indigo background for clean Windows rendering.

### ⚙️ Smart Backend Detection
- On desktop launch, a TCP port check on `3999` determines if the backend is already running.
- If already running, skips spawning a new process and connects directly — prevents port conflicts.

### 📐 Resizable & Collapsible Layout
- Draggable divider between sidebar and main content panel — width stored in `localStorage`.
- Sidebar can be fully collapsed (to width `0`) on both desktop and mobile.
- **Merged Tab Bar** — terminal tabs, zoom controls, and shell selector are integrated into the top window header to maximize vertical space.
- **Vertical header dividers** cleanly isolate the tab bar from status details and window controls.

### ⚙️ Settings Modal
- View system version and details.
- Update the master password directly from the UI.

---

## Technology Stack

| Layer | Technology |
|---|---|
| **Frontend** | React (TypeScript) + Vite + Tailwind CSS v4 + xterm.js + Lucide Icons |
| **Backend** | Node.js + Express + WebSocket (`ws`) + `node-pty` |
| **Desktop** | Electron (custom borderless frame + preload IPC bridge) |
| **Packaging** | `electron-builder` → standalone `.exe` installer / portable |

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) LTS
- Git configured in your system PATH
- Windows (primary target; WSL supported for terminal sessions)

### 1. Install Dependencies
Run from the repository root:
```powershell
npm install
```

### 2. Development Mode
Launches the backend Express server (port `3999`) and the Vite frontend dev server (port `5173`) concurrently:
```powershell
npm run dev
```

### 3. Electron Desktop Client
Starts the backend and opens the Electron window with automatic authentication. Skips backend spawn if already running on port `3999`:
```powershell
npm run desktop
```

### 4. Build Standalone Installer (`.exe`)
Compiles all packages and produces a Windows installer + portable app inside `desktop/dist-exe/`:
```powershell
npm run build:exe
```

---

## Workspace Scripts Reference

| Script | Description |
|---|---|
| `npm run dev` | Start backend + frontend in watch mode |
| `npm run dev:backend` | Start backend only |
| `npm run dev:frontend` | Start frontend only |
| `npm run desktop` | Launch Electron desktop client |
| `npm run build:exe` | Build full standalone `.exe` package |

---

## Storage & Configuration

| Data | Location |
|---|---|
| Master password hash, security keys, tracked workspaces | `C:\Users\<username>\.tline-config.json` |
| Ephemeral desktop bypass token | `C:\Users\<username>\.tline-bypass-token` *(auto-deleted on exit)* |
| Terminal tabs state (cwd, shell type, active tab) | Browser / Chromium `localStorage` |
| Sidebar width, terminal font size | Browser / Chromium `localStorage` |

---

## Architecture Overview

```
t-line/
├── backend/          # Express + node-pty server (port 3999)
├── frontend/         # React + Vite SPA
│   └── src/
│       ├── hooks/    # Custom React hooks (useTerminals, useTunnel, useWorkspaces)
│       └── components/
├── desktop/          # Electron wrapper + system tray + electron-builder config
└── package.json      # Root npm workspaces config
```

> **Code quality rule**: No source file may exceed **1,000 lines**. All oversized files are refactored into modular sub-components or hooks.

---

## License

Private / Proprietary. Developed for local workspace orchestration.
