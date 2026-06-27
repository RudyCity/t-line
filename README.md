# t-line Workspace Manager (v1.0.0)

`t-line` is a modern, premium local developer dashboard designed to simplify the management of workspaces, Git Worktrees, and multiple terminal instances. Built with a gorgeous Obsidian Dark aesthetic, it serves as a lightweight workspace controller for active programmers.

---

## Key Features

* **Git Worktrees Automation**: Track checkout paths, list active worktrees, quickly create new worktree branches, and detect dirty index states with real-time pulsing alerts.
* **PTY Terminal Multiplexer**: Spawn and run local terminal shells (PowerShell, CMD, Git Bash, WSL) in independent tabs.
* **Persistent Tab State**: Active terminals, current working directories (`cwd`), shell types, and the selected active tab persist cleanly across window reloads and backend restarts.
* **Frameless Windows Desktop Client**: Native Electron wrapper featuring custom window controls, borderless frame integration, and automatic token bypass.
* **Security & Remote Tunneling**: Protect your backend workspace using a Master Password. Expose your dashboard remotely using Cloudflare Tunnel options (Quick URL or Custom Tokens) built right into the sidebar.
* **Local Web Directory Browser**: A robust remote file browser that allows users on the web client to browse drive letters and folder structures on the host machine.

---

## Technology Stack

* **Frontend**: React (TypeScript) + Vite + Tailwind CSS v4 + Lucide Icons + xterm.js (terminal renderer)
* **Backend**: Node.js + Express + WebSocket (ws) + node-pty (native pseudo-terminal interface)
* **Desktop Wrapper**: Electron (custom borderless frame & preload bridge integration)
* **Packaging**: electron-builder (compiles to a standalone `.exe` installer or portable client)

---

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed (LTS recommended) and Git configured in your host machine's PATH.

### 1. Install Dependencies
Run from the repository root:
```powershell
npm install
```

### 2. Run in Development Mode
Launches both the backend Express server (port `3999`) and the frontend Vite development server (port `5173`) concurrently:
```powershell
npm run dev
```

### 3. Launch Electron Desktop client
Starts the backend Express server in the background and opens the Electron desktop client with automatic authentication:
```powershell
npm run desktop
```

### 4. Build Standalone Installer (.exe)
Compiles all codebases and packages them into a standalone Windows installer and portable application inside `desktop/dist-exe/`:
```powershell
npm run build:exe
```

---

## Storage & Configuration Data

* **Configurations Database**: Hashed master password, security keys, and tracked workspaces are stored at:
  `C:\Users\<username>\.tline-config.json`
* **Local Terminal Tabs State**: Saved in Chromium/browser's `localStorage` (cleaned automatically upon logout).

---

## License
Private / Proprietary. Developed for local workspace orchestrations.
