# t-line — Premium Workspace Manager & Git Worktree Orchestrator

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> A high-performance, developer-first workspace dashboard. Run GPU-accelerated multi-shell PTY terminals, visualize and manage Git Worktrees, browse and edit code, and securely share your workspace remotely via Cloudflare Tunnel. All inside a sleek Obsidian Dark interface.

![t-line Interface Preview](preview.png)

> [!IMPORTANT]
> **Desktop Migration Notice**: **t-line** is migrating its primary desktop app wrapper from Electron to **Tauri v2** to drastically reduce resource consumption. The new Tauri wrapper lowers memory usage to **under 100MB RAM** (combined frontend and backend), provides a dynamic system tray with terminal session control, and native OS integrations. Electron is currently kept as a legacy option.

---

## ⚡ The Developer's Context-Switching Solution

Modern software engineering requires juggling multiple branches, repositories, and terminals. **t-line** solves the cognitive load of context-switching by combining Git Worktree automation, terminal multiplexing, and remote workspace sharing into a unified, lightweight, local-first application. 

### Why use t-line?
* **Adopt Git Worktrees without CLI friction**: Work on multiple features concurrently in isolated directories without stashing or breaking your flow.
* **Instant, Secure Remote Access**: Share your local environment with clients or team members in one click via built-in Cloudflare Tunnel support.
* **Ultra-Fast Terminals**: Custom GPU-accelerated xterm.js terminals reduce lag and render smooth graphics.
* **Beautiful Obsidian Dark Aesthetic**: Optimized for long coding sessions with an elegant, frameless UI.

---

## 🚀 Key Features & Value Proposition

### 🖥️ GPU-Accelerated Multi-Shell PTY Terminal
* **Concurrent Terminals**: Spawn and manage multiple sessions across PowerShell, CMD, Git Bash, or WSL.
* **GPU Canvas Renderer**: Built-in `@xterm/addon-canvas` rendering delivers lightning-fast scrolling and reduces CPU utilization.
* **Dynamic Process Polling**: Automatically polls background process names to update tab titles dynamically, solving native WinPTY title resolution limits on Windows.
* **Recursive Process Tree Cleanup**: Kills all descendant/child processes (like running AI agents) recursively on terminal close (`taskkill /F /T` on Windows) to prevent background process leaks.
* **Global WS Process & Title Sync**: Automatically synchronizes active process statuses and tab title indicators globally in React state, even when terminal tabs are unmounted from the DOM.
* **Interactive Tooling & Images**: Support for `@xterm/addon-image` allows terminal previews and inline image rendering via sixel/iTerm2.
* **Developer Safety Filters**: Smart paste warnings prevent accidental multi-line executions in active shells.
* **Focus Ring Highlight**: Visually track active panes with a soft glowing purple focus ring.

### 🌿 Visual Git Worktrees Management
* **Real-time Dirty Indexing**: Instantly flags modified or untracked files with glowing amber indicators and uncommitted change badges.
* **Dirty-First Auto-Sorting**: Workspaces with active modifications are automatically floated to the top of the sidebar.
* **Advanced Branch Syncing**: Custom interactive search-to-filter branch selection panel, branch deletion (with force-delete prompts for unmerged changes), and a 3-column repository action layout (Fetch-all-prune, Pull, and Push).
* **Safety Lock Pruning**: Automatically shuts down terminal tabs and file locks associated with a worktree before removal. Falls back to direct file-system removal and manual registry pruning if files are locked.

### 📸 Workspace & Worktree Checkpoints (Snapshots)
* **Zero-Stash Snapshots**: Take instant snapshots of staged/unstaged changes and untracked files saved under Git-isolated references (`refs/tline/checkpoints/*`) to avoid cluttering git stash or status.
* **Visual Diff Comparisons**: View and expand snapshot contents, listing changed files and launching side-by-side Monaco diff viewer tabs directly.

### 📁 Unified Workspace Explorer & Editor
* **Full-Bleed UI**: Clean borderless sidebar layout maximizing screen real estate.
* **Dynamic Sidebar Tab Text Collapse**: Hides tab text labels dynamically when the sidebar is resized under `280px`, keeping the sidebar clean and maximizing the workspace area.
* **Built-in Monaco Editor**: View and modify codebase files directly in editor tabs alongside terminal panes, complete with copy shortcuts and clean formatting.
* **Interactive File Operations**: Create new files, folders, or rename/move existing items inside the explorer pane via header action buttons or right-click context menus.
* **Theme-Aware SVG & Binary Previews**: Live visual vector previews for SVGs using dynamic blob URL regeneration (rendering edits in real-time) and safe warning dialogs for binary files to prevent text-load crashes.
* **Muted Hidden Files**: Automatically dims dot-files and folders (like `.gitignore`, `.env`, `.github`) to keep your primary codebase structure visible.
* **Auto-Focus Selection**: Automatically selects the first active or Git-enabled workspace on switch.

### 🔗 SSH/SFTP Remote Workspace Support
* **Secure Remote Mounts**: Connect to remote workspaces using standard `ssh://user@host:port/path` directory schemes.
* **Native OpenSSH Engine**: Runs directory listing (`ls -F -A`), remote file read/write operations (`cat`), and git commands on remote environments using system OpenSSH binaries.
* **Integrated Interactive Terminals**: Automatically spawns remote SSH terminal sessions using `ssh -t` directly integrated into the tab bar layout when accessing remote paths.
* **Remote Checkpoints**: Persists snapshot configuration metadata (`tline-checkpoints.json`) in the remote `.git` common directory to maintain working states across machines.

### 🌐 Secure Cloudflare Tunneling & ACL
* **One-Click Share**: Instantly expose the dashboard using Quick URL or a Custom Tunnel token.
* **Access Control List (ACL)**: Detailed connection loggers let you monitor incoming requests, block specific IPs, or restrict WebSocket terminal access with built-in lockout protection.

### 🪟 Desktop Integration (Tauri v2 & Electron)
* **Lightweight Tauri v2 Desktop Wrapper (Recommended)**: Dramatically optimizes system resources, reducing total idle RAM footprint (combined frontend and backend processes) to **under 100MB**.
* **Dynamic System Tray Menu**: Native system tray icon offering dashboard toggles, backend controls (Start, Stop, Restart), and active terminal session listings grouped by workspace.
* **Close-to-Tray**: Runs background AI processes and terminal sessions continuously by hiding the main window on close.
* **Single Instance Lock**: Powered by `tauri-plugin-single-instance` to prevent port binding and database conflicts.
* **Startup Diagnostics**: Automatically checks for Node.js installation at startup with native dialog warnings.
* **Frameless App**: Draggable borderless UI with custom window control systems (Minimize, Maximize, Close) and `data-tauri-drag-region` title bar areas.

---

## 🛠️ Technology Stack

| Layer | Technologies Used |
| :--- | :--- |
| **Frontend** | React (TS), Vite, Tailwind CSS v4, Monaco Editor, xterm.js + Canvas / WebLinks / Image addons |
| **Backend** | Node.js, Express, WebSocket (`ws`), `node-pty`, `bcryptjs`, OpenSSH CLI |
| **Desktop** | **Tauri v2 (Rust)** [Recommended], Electron [Legacy] |

---

## 🏃 Quick Start

### Prerequisites
* [Node.js](https://nodejs.org/) (LTS recommended)
* Git configured in your system PATH
* Windows 10/11 (Primary target OS)
* Rust & Cargo (Required for Tauri desktop build)

### 1. Install Project Dependencies
Run from the root directory:
```powershell
npm install
```

### 2. Run in Development Mode
Launches the Express backend and Vite frontend concurrently with hot reloading:
```powershell
npm run dev
```

### 3. Launch Tauri Desktop Client (Recommended)
Launches the app using the lightweight Tauri v2 wrapper:
```powershell
npm run tauri
```

### 4. Build Standalone Tauri Installer
Compiles assets and packages the app using Tauri:
```powershell
npm run build:tauri
```

### 5. Launch Legacy Electron Client
Runs the legacy Electron wrapper:
```powershell
npm run desktop
```

### 6. Build Legacy Electron Installer (`.exe`)
Compiles frontend assets and packages the app using `electron-builder` inside `desktop/dist-exe/`:
```powershell
npm run build:exe
```

---

## 📂 Architecture Directory

```
t-line/
├── backend/          # Express + WebSockets + node-pty server (Port 3999 / Tauri uses 5779)
├── frontend/         # React + Vite SPA (Vite + Tailwind CSS v4)
│   └── src/
│       ├── hooks/    # Custom React hooks (useTerminals, useTunnel, useWorkspaces)
│       └── components/
├── desktop-tauri/    # Tauri v2 (Rust) wrapper (Recommended desktop wrapper)
├── desktop/          # Legacy Electron wrapper, IPC bridge, Tray, & build configs
├── preview.png       # Desktop application preview image
└── package.json      # Root monorepo workspace configuration
```

> [!IMPORTANT]
> **Code Quality Constraint**: To maintain high maintainability, no source code file in this repository is allowed to exceed **1,000 lines**. Oversized files are refactored into modular hooks or sub-components.

---

## 📄 License & Attribution

Distributed under the MIT License. See [LICENSE](LICENSE) for details.

Copyright © 2026 [Rudy H.](mailto:hrudy715@gmail.com)
