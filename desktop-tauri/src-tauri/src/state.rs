//! Application state and platform utilities.
//!
//! Extracted from `lib.rs` to keep that file under the AGENTS.md 1000-line
//! guideline. This module holds:
//!   - The shared `DesktopState` struct
//!   - Port / workspace detection helpers
//!   - Bypass-token and URL helpers
//!
//! All items are crate-private (`pub(super)` not used) — only the parent
//! `lib.rs` references them.

use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::Child;
use std::sync::{Arc, Mutex};

/// Shared application state held by Tauri. Every Tauri command takes
/// `tauri::State<'_, DesktopState>` and reads/writes fields through the
/// interior-mutability wrappers.
pub struct DesktopState {
    /// Handle to the bundled Bun backend process. Killed on Tauri exit.
    pub backend_child: Arc<Mutex<Option<Child>>>,
    /// Lifecycle state: "stopped" | "starting" | "running" (owned) | "connected" (external) | "error".
    pub status: Arc<Mutex<String>>,
    /// Cached snapshot of active terminal sessions, mirrored from the backend.
    pub active_sessions: Arc<Mutex<serde_json::Value>>,
    /// Cached snapshot of workspaces, mirrored from the backend.
    pub workspaces: Arc<Mutex<serde_json::Value>>,
    /// Cached snapshot of the sync state, mirrored from the backend.
    pub sync_state: Arc<Mutex<serde_json::Value>>,
    /// `sysinfo::System` handle used by the `get_memory_usage` command.
    pub sys: Mutex<sysinfo::System>,
}

/// Returns true if anything is already listening on the given TCP port
/// (on either IPv4 or IPv6 loopback).
pub fn is_port_active(port: u16) -> bool {
    TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok()
        || TcpStream::connect(format!("[::1]:{}", port)).is_ok()
}

/// Walks up the directory tree from the current executable looking for the
/// monorepo root (the directory containing `package.json`, `backend/`, and
/// `desktop-tauri/`). Returns `None` if the executable is launched outside
/// the t-line project (e.g. a global install).
pub fn find_workspace_root() -> Option<PathBuf> {
    let exe_path = std::env::current_exe().ok()?;
    let mut path = exe_path.as_path();
    while let Some(parent) = path.parent() {
        if parent.join("package.json").exists()
            && parent.join("backend").exists()
            && parent.join("desktop-tauri").exists()
        {
            return Some(parent.to_path_buf());
        }
        path = parent;
    }
    None
}

/// Reads the per-machine bypass token from `~/.tline-bypass-token`. This
/// token lets the WebView skip the login screen when the backend is already
/// running on the user's machine. It is rotated on every backend start.
pub fn get_bypass_token() -> Option<String> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()?;
    let token_path = Path::new(&home).join(".tline-bypass-token");
    if token_path.exists() {
        std::fs::read_to_string(token_path)
            .map(|s| s.trim().to_string())
            .ok()
    } else {
        None
    }
}

/// Base URL of the frontend. Vite dev server runs on 5773; the production
/// Express server uses 5779. The `cfg!(debug_assertions)` check picks
/// whichever is appropriate for the current build profile.
pub fn app_base_url() -> &'static str {
    if cfg!(debug_assertions) {
        "http://localhost:5773"
    } else {
        "http://localhost:5779"
    }
}

/// Returns the frontend URL with the bypass token (if any) appended as a
/// query string. The WebView is loaded with this URL so the backend can
/// identify the request as coming from a local Tauri shell.
pub fn app_url_with_token(token: Option<String>) -> String {
    let base_url = app_base_url();
    match token {
        Some(token) if !token.is_empty() => format!("{}/?token={}", base_url, token),
        _ => base_url.to_string(),
    }
}
