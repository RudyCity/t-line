//! Bundled backend process supervision, extracted from `lib.rs`.
//! Owns spawning, health polling, restart, and shutdown of the local Bun backend.
use crate::backend_diagnostics;
use crate::backend_identity::{decide_port, verify_local_backend, PortDecision};
use crate::state::{
    app_url_with_token, find_workspace_root, get_bypass_token, is_port_active,
    DesktopState,
};
use crate::tray_menu::build_tray_menu;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub(crate) fn is_bun_installed() -> bool {
    let mut command = Command::new("bun");
    command.arg("--version").stdout(Stdio::null()).stderr(Stdio::null());
    #[cfg(windows)]
    {
        command.creation_flags(0x08000000);
    }
    command.status().is_ok_and(|result| result.success())
}

/// Prefer the Bun runtime bundled with the application. Global Bun is
/// supported for development but not required for installed Windows builds.
pub(crate) fn available_bun_runtime(app: &tauri::AppHandle) -> Option<PathBuf> {
    #[cfg(windows)]
    let binary = "bun-runtime/bun.exe";
    #[cfg(not(windows))]
    let binary = "bun-runtime/bun";
    for resource in [binary.to_owned(), format!("_up_/{}", binary)] {
        if let Ok(candidate) = app.path().resolve(&resource, tauri::path::BaseDirectory::Resource) {
            if candidate.is_file() { return Some(candidate); }
        }
    }
    if let Some(home) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) {
        let candidate = PathBuf::from(home).join(".bun").join("bin")
            .join(if cfg!(windows) { "bun.exe" } else { "bun" });
        if candidate.is_file() { return Some(candidate); }
    }
    if is_bun_installed() { Some(PathBuf::from("bun")) } else { None }
}

pub(crate) fn show_missing_bun_dialog() {
    #[cfg(windows)]
    {
        let _ = Command::new("powershell")
            .args([
                "-NoProfile", "-Command",
                "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Bun runtime is missing. Install Bun or reinstall T-Line with bundled Bun.', 'Bun Required', 'OK', 'Error')"
            ])
            .creation_flags(0x08000000)
            .status();
    }
    #[cfg(target_os = "macos")]
    {
        let _ = Command::new("osascript")
            .args(["-e", "display dialog \"Bun is required to run T-Line.\" buttons {\"OK\"}"])
            .status();
    }
    #[cfg(target_os = "linux")]
    {
        let _ = Command::new("zenity")
            .args(["--error", "--text", "Bun runtime is required to run T-Line"])
            .status();
    }
}

pub(crate) fn http_get(port: u16, path: &str, token: Option<&str>) -> Result<String, String> {
    // ureq is a small synchronous HTTP client. No async runtime overhead, no
    // tokio dependency. Returns the response body on 2xx, error string otherwise.
    let url = format!("http://127.0.0.1:{}{}", port, path);
    let mut req = ureq::get(&url).timeout(Duration::from_millis(800));
    if let Some(t) = token {
        req = req.set("Authorization", &format!("Bearer {}", t));
    }

    match req.call() {
        Ok(response) => response.into_string().map_err(|e| e.to_string()),
        Err(ureq::Error::Status(code, _)) => Err(format!("HTTP error: {}", code)),
        Err(ureq::Error::Transport(t)) => Err(t.to_string()),
    }
}

pub(crate) fn show_error_page(app_handle: &tauri::AppHandle) {
    if let Some(main_window) = app_handle.get_webview_window("main") {
        let base_url = if cfg!(debug_assertions) {
            "http://localhost:5773"
        } else if cfg!(windows) {
            "http://tauri.localhost"
        } else {
            "tauri://localhost"
        };

        let error_url = format!("{}/error.html", base_url);
        if let Ok(parsed_url) = tauri::Url::parse(&error_url) {
            main_window.navigate(parsed_url).ok();
        }
        main_window.show().ok();
    }
}

pub(crate) fn spawn_backend(app_handle: tauri::AppHandle) {
    let port = 5779;
    let is_dev = cfg!(debug_assertions);
    let state = app_handle.state::<DesktopState>();
    {
        let mut guard = state.backend_child.lock().unwrap();
        if let Some(child) = guard.as_mut() {
            match child.try_wait() {
                Ok(Some(_)) => { guard.take(); }
                _ => {
                    println!("[tauri] An owned backend child is already active; refusing duplicate spawn.");
                    return;
                }
            }
        }
    }

    {
        let mut status_guard = state.status.lock().unwrap();
        if matches!(status_guard.as_str(), "starting" | "running" | "connected" | "stopping") {
            println!("[tauri] Backend lifecycle already active; refusing duplicate start.");
            return;
        }
        *status_guard = "starting".to_string();
    }
    
    if let Some(tray) = app_handle.tray_by_id("main_tray") {
        if let Ok(menu) = build_tray_menu(&app_handle, &state) {
            let _ = tray.set_menu(Some(menu));
        }
    }

    let backend_child_thread = state.backend_child.clone();
    let app_handle_clone = app_handle.clone();
    
    thread::spawn(move || {
        let mut bypass_token = get_bypass_token();
        let log_dir = app_handle_clone.path().app_data_dir()
            .unwrap_or_else(|_| std::env::temp_dir().join("tline"));
        backend_diagnostics::record_backend_event(&log_dir, "start_attempt", None, "desktop_backend");

        // Authenticate with a nonce HMAC; do not send bearer credentials
        // to an arbitrary process merely because it listens on this port.
        let occupied = is_port_active(port);
        let backend_verified = occupied && verify_local_backend(port, bypass_token.as_deref());
        if decide_port(occupied, backend_verified) == PortDecision::RefuseOccupied {
            backend_diagnostics::record_backend_event(&log_dir, "start_refused", None, "unverified_port_owner");
            eprintln!("[tauri] Port {} is occupied by an unverified process; refusing to terminate it.", port);
            let state = app_handle_clone.state::<DesktopState>();
            *state.status.lock().unwrap() = "error".to_string();
            if let Some(tray) = app_handle_clone.tray_by_id("main_tray") {
                if let Ok(menu) = build_tray_menu(&app_handle_clone, &state) {
                    let _ = tray.set_menu(Some(menu));
                }
            }
            show_error_page(&app_handle_clone);
            return;
        }
        if backend_verified {
            backend_diagnostics::record_backend_event(&log_dir, "attach", None, "verified_external_backend");
            println!("[tauri] Verified existing T-Line backend on port {}; attaching without ownership.", port);
        } else {
            println!("[tauri] Spawning Bun backend process...");

            // Append across launches instead of recreating/truncating the
            // previous run's last stderr just when the user needs it.
            let log_file_path = log_dir.join("backend_run.log");
            let mut child = None;

            if is_dev {
                if let Some(ws_root) = find_workspace_root() {
                    println!("[tauri] Dev mode: Spawning dev backend from workspace root: {:?}", ws_root);
                    if let Some(bun_runtime) = available_bun_runtime(&app_handle_clone) {
                        let mut command = Command::new(bun_runtime);
                        command.args(["--cwd", "backend", "run", "dev"])
                            .current_dir(&ws_root)
                            .stdout(Stdio::piped())
                            .stderr(Stdio::piped());
                        #[cfg(windows)]
                        {
                            command.creation_flags(0x08000000);
                        }
                        match command.spawn() {
                            Ok(process) => child = Some(process),
                            Err(err) => backend_diagnostics::record_backend_event(
                                &log_dir, "dev_spawn_error", None, &format!("error_kind={:?}", err.kind())),
                        }
                    }
                }
            }

            if child.is_none() {
                let mut script_path = None;
                
                // Try resolving via "_up_" prefix first (since tauri bundles resources relative to src-tauri,
                // and "../backend" gets bundled as "_up_/backend")
                if let Ok(path) = app_handle_clone.path().resolve("_up_/backend/dist/server.js", tauri::path::BaseDirectory::Resource) {
                    if path.exists() {
                        script_path = Some(path);
                    }
                }
                
                // Fallback to direct resolution
                if script_path.is_none() {
                    if let Ok(path) = app_handle_clone.path().resolve("backend/dist/server.js", tauri::path::BaseDirectory::Resource) {
                        if path.exists() {
                            script_path = Some(path);
                        }
                    }
                }

                match script_path {
                    Some(path) => {
                        let path_str = path.to_string_lossy();
                        let clean_path = path_str.strip_prefix(r"\\?\").unwrap_or(&path_str);
                        println!("[tauri] Spawning Bun backend with script: {}", clean_path);
                        let Some(bun_runtime) = available_bun_runtime(&app_handle_clone) else {
                            backend_diagnostics::record_backend_event(&log_dir, "spawn_failed", None, "bun_runtime_missing");
                            eprintln!("[tauri] Neither bundled nor system Bun is available.");
                            return;
                        };
                        let mut cmd = Command::new(&bun_runtime);
                        // Start Menu and updater launches may inherit System32
                        // or an arbitrary cwd. Use the bundled backend root.
                        let packaged_backend_dir = path.parent()
                            .and_then(|dist_dir| dist_dir.parent());
                        if let Some(package_dir) = packaged_backend_dir {
                            if package_dir.is_dir() {
                                cmd.current_dir(package_dir);
                            }
                        }
                        cmd.arg(clean_path)
                            .env("PORT", port.to_string())
                            .env("TLINE_BUN_RUNTIME", bun_runtime.as_os_str())
                            .stdout(Stdio::piped())
                            .stderr(Stdio::piped());
                        #[cfg(windows)]
                        {
                            cmd.creation_flags(0x08000000);
                        }
                        match cmd.spawn() {
                            Ok(process) => child = Some(process),
                            Err(err) => backend_diagnostics::record_backend_event(
                                &log_dir, "spawn_error", None, &format!("error_kind={:?}", err.kind())),
                        }
                    }
                    None => {
                        backend_diagnostics::record_backend_event(&log_dir, "spawn_failed", None, "backend_script_missing");
                        eprintln!("[tauri] Backend script not found in resource paths.");
                    }
                }
            }

            match child {
                Some(mut spawned_child) => {
                    let pid = spawned_child.id();
                    let stdout = spawned_child.stdout.take().expect("failed to get stdout");
                    let stderr = spawned_child.stderr.take().expect("failed to get stderr");
                    backend_diagnostics::record_backend_event(&log_dir, "spawned", Some(pid), "owned_backend");
                    let writer = backend_diagnostics::BackendRunLog::open(&log_file_path)
                        .ok().map(Arc::new);
                    if let Some(ref log) = writer {
                        log.line("lifecycle", &format!("Backend launched pid={pid}"));
                    }
                    {
                        let mut guard = backend_child_thread.lock().unwrap();
                        *guard = Some(spawned_child);
                    }

                    let stdout_writer = writer.clone();
                    thread::spawn(move || {
                        // Always drain the pipe, even if log storage is unavailable.
                        for line in BufReader::new(stdout).lines() {
                            if let (Ok(text), Some(ref log)) = (line, &stdout_writer) {
                                log.line("stdout", &text);
                            }
                        }
                    });

                    thread::spawn(move || {
                        for line in BufReader::new(stderr).lines() {
                            if let (Ok(text), Some(ref log)) = (line, &writer) {
                                log.line("stderr", &text);
                            }
                        }
                    });
                }
                None => {
                    backend_diagnostics::record_backend_event(&log_dir, "spawn_failed", None, "backend_process_not_created");
                    eprintln!("[tauri] Failed to spawn backend process.");
                }
            }
        }

        // In dev mode the webview navigates to Vite (port 5773). spawn_backend
        // only started the Bun backend on 5779, leaving 5773 dead and the
        // webview blank. Launch the Vite dev server here and wait for it.
        if is_dev {
            // Wait up to 3 seconds for Vite to start if it was spawned by dev.js
            let check_start = Instant::now();
            let mut vite_active = false;
            while check_start.elapsed() < Duration::from_secs(3) {
                if is_port_active(5773) {
                    vite_active = true;
                    break;
                }
                thread::sleep(Duration::from_millis(200));
            }

            if !vite_active {
                if let Some(ws_root) = find_workspace_root() {
                    println!("[tauri] Dev mode: Spawning Vite dev server from workspace root: {:?}", ws_root);
                    if let Some(bun_runtime) = available_bun_runtime(&app_handle_clone) {
                        let mut command = Command::new(bun_runtime);
                        command.args(["--cwd", "frontend", "run", "dev"])
                            .current_dir(&ws_root)
                            .stdout(Stdio::null())
                            .stderr(Stdio::null());
                        #[cfg(windows)]
                        {
                            command.creation_flags(0x08000000);
                        }
                        let _ = command.spawn();
                    }
                } else {
                    eprintln!("[tauri] Dev mode: could not locate workspace root; skipping Vite spawn.");
                }
            } else {
                println!("[tauri] Dev mode: Vite already running on port 5773.");
            }

            let vite_start = Instant::now();
            while vite_start.elapsed() < Duration::from_secs(30) {
                if is_port_active(5773) {
                    break;
                }
                thread::sleep(Duration::from_millis(250));
            }
            if !is_port_active(5773) {
                eprintln!("[tauri] Dev mode: Vite dev server did not become ready on port 5773 within 30s.");
            }
        }

        let start_time = Instant::now();
        let mut server_ready = false;
        while start_time.elapsed() < Duration::from_secs(15) {
            bypass_token = get_bypass_token();
            if verify_local_backend(port, bypass_token.as_deref()) {
                server_ready = true;
                break;
            }
            thread::sleep(Duration::from_millis(200));
        }

        if server_ready {
            {
                let state = app_handle_clone.state::<DesktopState>();
                let owned = state.backend_child.lock().unwrap().is_some();
                *state.status.lock().unwrap() = if owned { "running" } else { "connected" }.to_string();
            }
            if let Some(tray) = app_handle_clone.tray_by_id("main_tray") {
                let state = app_handle_clone.state::<DesktopState>();
                if let Ok(menu) = build_tray_menu(&app_handle_clone, &state) {
                    let _ = tray.set_menu(Some(menu));
                }
            }

            let url = app_url_with_token(bypass_token);

            // Never print the URL: it contains the ephemeral bypass token.
            println!("[tauri] Verified backend ready; loading authenticated desktop view.");

            if let Some(main_window) = app_handle_clone.get_webview_window("main") {
                main_window.navigate(tauri::Url::parse(&url).unwrap()).ok();
                thread::sleep(Duration::from_millis(300));
                main_window.show().ok();
                main_window.maximize().ok();
                main_window.set_focus().ok();
            }
        } else {
            backend_diagnostics::record_backend_event(&log_dir, "startup_timeout", None, "backend_not_authenticated_within_15s");
            eprintln!("[tauri] Timeout waiting for backend server to start.");
            {
                let state = app_handle_clone.state::<DesktopState>();
                let mut status_guard = state.status.lock().unwrap();
                *status_guard = "stopped".to_string();
            }
            
            if let Some(tray) = app_handle_clone.tray_by_id("main_tray") {
                let state = app_handle_clone.state::<DesktopState>();
                if let Ok(menu) = build_tray_menu(&app_handle_clone, &state) {
                    let _ = tray.set_menu(Some(menu));
                }
            }

            show_error_page(&app_handle_clone);
        }
    });
}

pub(crate) fn stop_backend(state: &DesktopState) {
    let mut guard = state.backend_child.lock().unwrap();
    if let Some(mut child) = guard.take() {
        // Only a child handle retained by this Tauri instance may be stopped.
        #[cfg(windows)]
        {
            if matches!(child.try_wait(), Ok(None)) {
                let pid = child.id();
                let tree_stopped = Command::new("taskkill")
                    .args(&["/pid", &pid.to_string(), "/f", "/t"])
                    .creation_flags(0x08000000)
                    .status()
                    .is_ok_and(|status| status.success());
                if !tree_stopped {
                    // Fallback still operates on the owned child handle only.
                    let _ = child.kill();
                }
                let _ = child.wait();
            }
        }
        #[cfg(not(windows))]
        {
            if matches!(child.try_wait(), Ok(None)) {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    } else {
        println!("[tauri] No owned backend process; attached/external backend was not touched.");
    }
    *state.status.lock().unwrap() = "stopped".to_string();
}

pub(crate) fn stop_backend_async(app_handle: tauri::AppHandle) {
    let state = app_handle.state::<DesktopState>();
    {
        let mut status_guard = state.status.lock().unwrap();
        *status_guard = "stopping".to_string();
    }
    if let Some(tray) = app_handle.tray_by_id("main_tray") {
        if let Ok(menu) = build_tray_menu(&app_handle, &state) {
            let _ = tray.set_menu(Some(menu));
        }
    }
    let app_handle_clone = app_handle.clone();
    thread::spawn(move || {
        let state = app_handle_clone.state::<DesktopState>();
        stop_backend(&state);
        if let Some(tray) = app_handle_clone.tray_by_id("main_tray") {
            if let Ok(menu) = build_tray_menu(&app_handle_clone, &state) {
                let _ = tray.set_menu(Some(menu));
            }
        }
        show_error_page(&app_handle_clone);
    });
}

pub(crate) fn restart_backend_async(app_handle: tauri::AppHandle) {
    let state = app_handle.state::<DesktopState>();
    {
        let mut status_guard = state.status.lock().unwrap();
        *status_guard = "stopping".to_string();
    }
    if let Some(tray) = app_handle.tray_by_id("main_tray") {
        if let Ok(menu) = build_tray_menu(&app_handle, &state) {
            let _ = tray.set_menu(Some(menu));
        }
    }
    let app_handle_clone = app_handle.clone();
    thread::spawn(move || {
        let state = app_handle_clone.state::<DesktopState>();
        stop_backend(&state);
        spawn_backend(app_handle_clone);
    });
}

pub(crate) fn restart_desktop_app(app_handle: &tauri::AppHandle) {
    // The Tauri-managed restart emits normal Exit events, releases the
    // single-instance lock and preserves OS-native restart lifecycle.
    // Manual spawning before exiting can be captured by our own singleton.
    app_handle.request_restart();
}

pub(crate) fn poll_backend(app_handle: tauri::AppHandle) {
    let port = 5779;
    thread::spawn(move || {
        let state = app_handle.state::<DesktopState>();
        let mut last_sessions = String::new();
        let mut last_workspaces = String::new();
        let mut last_sync = String::new();
        let mut next_workspace_refresh = Instant::now();
        
        loop {
            thread::sleep(Duration::from_secs(3));

            // The child may disappear without executing JS signal/exit hooks
            // (OOM, native crash, OS termination). Record the kernel exit code
            // before dropping the owned process handle. Never inspect or stop
            // an attached external backend here.
            let exited_child = {
                let mut guard = state.backend_child.lock().unwrap();
                if let Some(child) = guard.as_mut() {
                    match child.try_wait() {
                        Ok(Some(exit)) => {
                            let pid = child.id();
                            guard.take();
                            Some((pid, exit.to_string()))
                        }
                        _ => None,
                    }
                } else {
                    None
                }
            };
            if let Some((pid, exit)) = exited_child {
                let log_dir = app_handle.path().app_data_dir()
                    .unwrap_or_else(|_| std::env::temp_dir().join("tline"));
                backend_diagnostics::record_backend_event(&log_dir, "unexpected_exit", Some(pid), &exit);
                eprintln!("[tauri] Owned backend pid={pid} exited unexpectedly: {exit}. Diagnostics saved.");
            }

            let token = get_bypass_token();
            let running = verify_local_backend(port, token.as_deref());
            let owned = state.backend_child.lock().unwrap().is_some();
            
            let mut status_changed = false;
            let mut sessions_changed = false;
            
            let new_status = if running {
                if owned { "running" } else { "connected" }.to_string()
            } else if is_port_active(port) {
                "error".to_string()
            } else {
                "stopped".to_string()
            };
            
            let current_status = {
                let status_guard = state.status.lock().unwrap();
                status_guard.clone()
            };
            
            let status_to_apply = if current_status == "starting" {
                if running {
                    new_status.clone()
                } else {
                    "starting".to_string()
                }
            } else if current_status == "stopping" {
                if running {
                    "stopping".to_string()
                } else {
                    "stopped".to_string()
                }
            } else {
                new_status
            };

            if status_to_apply != current_status {
                let mut status_guard = state.status.lock().unwrap();
                *status_guard = status_to_apply.clone();
                status_changed = true;
                
                if status_to_apply == "stopped" {
                    show_error_page(&app_handle);
                }
            }

            if status_to_apply == "running" || status_to_apply == "connected" {
                // PTY sessions and tab selection are cheap and change often.
                // Workspace metadata may spawn numerous Git commands: fetching
                // all projects every three seconds made the tray a major CPU
                // and disk I/O contributor, even while the main window hid.
                let token_str = token.as_deref();
                if let Ok(body) = http_get(port, "/api/terminals/active", token_str) {
                    if body != last_sessions {
                        if let Ok(snapshot) = serde_json::from_str::<serde_json::Value>(&body) {
                            if snapshot.is_array() {
                                *state.active_sessions.lock().unwrap() = snapshot;
                                last_sessions = body;
                                sessions_changed = true;
                            }
                        }
                    }
                }
                if let Ok(body) = http_get(port, "/api/sync/state", token_str) {
                    if body != last_sync {
                        if let Ok(snapshot) = serde_json::from_str::<serde_json::Value>(&body) {
                            if snapshot.get("tabs").is_some_and(|value| value.is_array()) {
                                *state.sync_state.lock().unwrap() = snapshot;
                                last_sync = body;
                                sessions_changed = true;
                            }
                        }
                    }
                }
                if Instant::now() >= next_workspace_refresh {
                    let mut valid_snapshot = false;
                    if let Ok(body) = http_get(port, "/api/workspaces", token_str) {
                        if let Ok(snapshot) = serde_json::from_str::<serde_json::Value>(&body) {
                            if snapshot.is_array() {
                                valid_snapshot = true;
                                if body != last_workspaces {
                                    *state.workspaces.lock().unwrap() = snapshot;
                                    last_workspaces = body;
                                    sessions_changed = true;
                                }
                            }
                        }
                    }
                    // Retry quickly after transient HTTP/JSON errors; defer
                    // expensive Git-backed workspace scans only on success.
                    next_workspace_refresh = Instant::now() +
                        Duration::from_secs(if valid_snapshot { 21 } else { 3 });
                }
            } else {
                // A fresh backend must not inherit menu snapshots from a
                // previous process. Retry workspace fetch immediately after
                // the next successfully authenticated connection.
                last_sessions.clear();
                last_sync.clear();
                last_workspaces.clear();
                next_workspace_refresh = Instant::now();
                let mut sessions_guard = state.active_sessions.lock().unwrap();
                let mut workspaces_guard = state.workspaces.lock().unwrap();
                let mut sync_guard = state.sync_state.lock().unwrap();
                if !sessions_guard.as_array().map_or(true, |a| a.is_empty()) 
                   || !workspaces_guard.as_array().map_or(true, |a| a.is_empty())
                   || !sync_guard.get("tabs").and_then(|t| t.as_array()).map_or(true, |a| a.is_empty()) {
                    *sessions_guard = serde_json::json!([]);
                    *workspaces_guard = serde_json::json!([]);
                    *sync_guard = serde_json::json!({ "tabs": [], "terminalInstances": {}, "savedPrompts": [] });
                    sessions_changed = true;
                }
            }
            
            if status_changed || sessions_changed {
                if let Some(tray) = app_handle.tray_by_id("main_tray") {
                    if let Ok(menu) = build_tray_menu(&app_handle, &state) {
                        let _ = tray.set_menu(Some(menu));
                    }
                }
            }
        }
    });
}

