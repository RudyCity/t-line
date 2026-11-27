use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;
use tauri::Emitter;
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

mod updater;
mod backend_identity;
mod backend_diagnostics;
mod tray_logic;

mod state;
mod browser;
mod tray_menu;
mod system_metrics;

use tray_menu::build_tray_menu;

use backend_identity::{decide_port, verify_local_backend, PortDecision};

use crate::state::{
    app_base_url, app_url_with_token, find_workspace_root, get_bypass_token,
    is_port_active, DesktopState,
};


fn show_dashboard_window<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn is_bun_installed() -> bool {
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
fn available_bun_runtime(app: &tauri::AppHandle) -> Option<PathBuf> {
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

fn show_missing_bun_dialog() {
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

fn http_get(port: u16, path: &str, token: Option<&str>) -> Result<String, String> {
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

fn show_error_page(app_handle: &tauri::AppHandle) {
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

fn spawn_backend(app_handle: tauri::AppHandle) {
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

fn stop_backend(state: &DesktopState) {
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

fn stop_backend_async(app_handle: tauri::AppHandle) {
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

fn restart_backend_async(app_handle: tauri::AppHandle) {
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

fn restart_desktop_app(app_handle: &tauri::AppHandle) {
    // The Tauri-managed restart emits normal Exit events, releases the
    // single-instance lock and preserves OS-native restart lifecycle.
    // Manual spawning before exiting can be captured by our own singleton.
    app_handle.request_restart();
}

fn poll_backend(app_handle: tauri::AppHandle) {
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

#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    let state = app.state::<DesktopState>();
    stop_backend(&state);
    app.exit(0);
}

#[tauri::command]
fn start_backend_command(app: tauri::AppHandle) {
    spawn_backend(app);
}

#[tauri::command]
fn get_app_url() -> Result<String, String> {
    let token = get_bypass_token();
    if verify_local_backend(5779, token.as_deref()) {
        Ok(app_url_with_token(token))
    } else {
        Err("Port 5779 is not an authenticated T-Line backend".to_string())
    }
}

#[tauri::command]
fn open_webview_devtools(app: tauri::AppHandle, label: String) -> Result<(), String> {
    #[cfg(feature = "devtools")]
    {
        if let Some(webview) = app.get_webview(&label) {
            webview.open_devtools();
            Ok(())
        } else if let Some(webview_window) = app.get_webview_window(&label) {
            webview_window.open_devtools();
            Ok(())
        } else {
            Err(format!("Webview with label {} not found", label))
        }
    }
    #[cfg(not(feature = "devtools"))]
    {
        let _ = (app, label);
        Err("Webview DevTools are disabled in this build; enable the explicit devtools feature in a developer-only build".to_string())
    }
}

#[tauri::command]
fn eval_webview_js(app: tauri::AppHandle, label: String, js: String) -> Result<(), String> {
    if let Some(webview) = app.get_webview(&label) {
        webview.eval(&js).map_err(|e| e.to_string())?;
        Ok(())
    } else if let Some(webview_window) = app.get_webview_window(&label) {
        webview_window.eval(&js).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err(format!("Webview with label {} not found", label))
    }
}

#[tauri::command]
fn get_webview_url(app: tauri::AppHandle, label: String) -> Result<String, String> {
    if let Some(webview) = app.get_webview(&label) {
        webview.url().map(|u| u.to_string()).map_err(|e| e.to_string())
    } else if let Some(webview_window) = app.get_webview_window(&label) {
        webview_window.url().map(|u| u.to_string()).map_err(|e| e.to_string())
    } else {
        Err(format!("Webview with label {} not found", label))
    }
}

fn detached_window_url(query: &str) -> String {
    let base_url = app_base_url();
    format!("{}/?{}", base_url, query.trim_start_matches('?'))
}

#[tauri::command]
async fn create_detached_window(app: tauri::AppHandle, label: String, query: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
        return Ok(());
    }

    // Development uses Vite so it can hot-reload. Production loads the exact bundled
    // asset and passes the detached context through an initialization script because
    // WebviewUrl::App accepts a resource path, not a URL query string.
    let webview_url = if cfg!(debug_assertions) {
        let url = detached_window_url(&query);
        let parsed_url = tauri::Url::parse(&url).map_err(|e| e.to_string())?;
        tauri::WebviewUrl::External(parsed_url)
    } else {
        tauri::WebviewUrl::App(PathBuf::from("index.html"))
    };
    let initialization_script = format!(
        "window.__TLINE_DETACHED_QUERY__ = {};",
        serde_json::to_string(query.trim_start_matches('?')).map_err(|e| e.to_string())?
    );
    let win_builder = tauri::WebviewWindowBuilder::new(
        &app,
        &label,
        webview_url
    )
    .title("t-line - Detached Tab")
    .inner_size(900.0, 600.0)
    .resizable(true)
    .decorations(false)
    .initialization_script(&initialization_script);

    let _window = win_builder.build().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn close_detached_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.close();
    }
    Ok(())
}

#[tauri::command]
fn focus_window(app: tauri::AppHandle, label: String) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(&label) {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
    Ok(())
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let backend_child: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));

    let state = DesktopState {
        backend_child: backend_child.clone(),
        status: Arc::new(Mutex::new("stopped".to_string())),
        active_sessions: Arc::new(Mutex::new(serde_json::json!([]))),
        workspaces: Arc::new(Mutex::new(serde_json::json!([]))),
        sync_state: Arc::new(Mutex::new(serde_json::json!({ "tabs": [], "terminalInstances": {}, "savedPrompts": [] }))),
        sys: Mutex::new(sysinfo::System::new()),
    };

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            println!("Another instance was opened with args: {:?} and cwd: {:?}", argv, cwd);
            show_dashboard_window(app);
        }))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(state)
        .manage(browser::BrowserState::default())
        .invoke_handler(tauri::generate_handler![
            browser::commands::browser_engines,
            browser::commands::browser_sessions,
            browser::commands::browser_launch,
            browser::commands::browser_stop,
            browser::commands::browser_targets,
            browser::commands::browser_act,
            browser::commands::browser_dock_bounds,
            browser::commands::browser_dock_visible,
            browser::commands::browser_focus,
            browser::commands::browser_undock,
            browser::commands::browser_pairing,
            browser::commands::browser_bookmarks,
            browser::commands::browser_telemetry,
            system_metrics::get_memory_usage,
            open_webview_devtools,
            eval_webview_js,
            get_webview_url,
            quit_app,
            start_backend_command,
            get_app_url,
            create_detached_window,
            close_detached_window,
            focus_window,
            updater::check_tauri_update,
            updater::install_tauri_update
        ])
        .setup(move |app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_handle = app.handle().clone();
            if available_bun_runtime(&app_handle).is_none() {
                show_missing_bun_dialog();
                return Err("Neither bundled nor system Bun is available for T-Line".into());
            }
            let state_ref = app.state::<DesktopState>();

            let menu = build_tray_menu(&app_handle, state_ref.inner())
                .expect("Failed to build initial tray menu");

            let mut tray_builder = TrayIconBuilder::with_id("main_tray")
                .menu(&menu)
                .on_menu_event(|app_handle: &tauri::AppHandle, event: tauri::menu::MenuEvent| {
                    let id = event.id();
                    let id_str = id.as_ref();
                    
                    if id_str == "quit" {
                        let state = app_handle.state::<DesktopState>();
                        stop_backend(&state);
                        app_handle.exit(0);
                    } else if id_str == "show" {
                        show_dashboard_window(app_handle);
                    } else if id_str == "hide" {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    } else if id_str == "start_backend" {
                        spawn_backend(app_handle.clone());
                    } else if id_str == "stop_backend" {
                        stop_backend_async(app_handle.clone());
                    } else if id_str == "restart_backend" {
                        restart_backend_async(app_handle.clone());
                    } else if id_str == "restart_desktop" {
                        restart_desktop_app(app_handle);
                    } else if id_str.starts_with("pid_") {
                        if let Some(pid_str) = id_str.strip_prefix("pid_") {
                            if let Ok(pid) = pid_str.parse::<u64>() {
                                let state = app_handle.state::<DesktopState>();
                                let sessions = state.active_sessions.lock().unwrap().clone();
                                let mut terminal_id = None;
                                if let Some(sessions_arr) = sessions.as_array() {
                                    for s in sessions_arr {
                                        if s.get("pid").and_then(|v| v.as_u64()) == Some(pid) {
                                            terminal_id = s.get("id").and_then(|v| v.as_str()).map(|s| s.to_string());
                                            break;
                                        }
                                    }
                                }
                                #[derive(Clone, serde::Serialize)]
                                struct SelectTerminalPayload {
                                    pid: u64,
                                    #[serde(rename = "terminalId")]
                                    terminal_id: Option<String>,
                                }
                                app_handle.emit("select-terminal", SelectTerminalPayload { pid, terminal_id }).ok();
                            }
                        }
                        show_dashboard_window(app_handle);
                    } else if id_str.starts_with("focus_tab_") {
                        if let Some(tab_id) = id_str.strip_prefix("focus_tab_") {
                            #[derive(Clone, serde::Serialize)]
                            struct SelectTabPayload {
                                #[serde(rename = "tabId")]
                                tab_id: String,
                            }
                            app_handle.emit("select-tab", SelectTabPayload { tab_id: tab_id.to_string() }).ok();
                            show_dashboard_window(app_handle);
                        }
                    } else if id_str.starts_with("close_tab_") {
                        if let Some(tab_id) = id_str.strip_prefix("close_tab_") {
                            #[derive(Clone, serde::Serialize)]
                            struct CloseTabPayload {
                                #[serde(rename = "tabId")]
                                tab_id: String,
                            }
                            app_handle.emit("close-tab", CloseTabPayload { tab_id: tab_id.to_string() }).ok();
                        }
                    } else if let Some(category) = id_str.strip_prefix("close_bulk_") {
                        let state = app_handle.state::<DesktopState>();
                        let snapshot = state.sync_state.lock().unwrap().clone();
                        let tab_ids = tray_logic::bulk_tab_ids(&snapshot, category);
                        if !tab_ids.is_empty() {
                            #[derive(Clone, serde::Serialize)]
                            struct CloseBulkPayload {
                                #[serde(rename = "tabIds")]
                                tab_ids: Vec<String>,
                            }
                            // Show the confirmation in the main React UI. Bulk
                            // deletion from a hidden tray must not silently
                            // terminate many active sessions.
                            show_dashboard_window(app_handle);
                            app_handle.emit("close-bulk-tabs", CloseBulkPayload { tab_ids }).ok();
                        }
                    }
                })
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event: tauri::tray::TrayIconEvent| {
                    match event {
                        TrayIconEvent::Click { button, button_state, .. } => {
                            if button == MouseButton::Left && button_state == MouseButtonState::Up {
                                show_dashboard_window(tray.app_handle());
                            }
                        }
                        TrayIconEvent::DoubleClick { button, .. } => {
                            if button == MouseButton::Left {
                                show_dashboard_window(tray.app_handle());
                            }
                        }
                        _ => {}
                    }
                });

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            }

            let _tray = tray_builder.build(app)?;

            spawn_backend(app_handle.clone());
            poll_backend(app_handle);

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                if window.label() == "main" {
                    api.prevent_close();
                    let _ = window.hide();
                } else if window.label().starts_with("browser-detached-") {
                    api.prevent_close();
                    let _ = window.destroy();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            // Owned real-browser processes belong to this desktop instance only.
            // Closing to tray is not Exit and must not terminate them.
            let browsers = app_handle.state::<browser::BrowserState>();
            browser::session::shutdown_all(&browsers);
            let state = app_handle.state::<DesktopState>();
            stop_backend(&state);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::detached_window_url;

    #[test]
    fn detached_window_url_preserves_query_params() {
        let url = detached_window_url("token=abc&detachedTabId=tab-1");
        let expected_base = if cfg!(debug_assertions) {
            "http://localhost:5773"
        } else {
            "http://localhost:5779"
        };
        assert_eq!(url, format!("{}/?token=abc&detachedTabId=tab-1", expected_base));
    }

    #[test]
    fn detached_window_url_accepts_leading_question_mark() {
        let url = detached_window_url("?token=abc&detachedTabId=tab-1");
        let expected_base = if cfg!(debug_assertions) {
            "http://localhost:5773"
        } else {
            "http://localhost:5779"
        };
        assert_eq!(url, format!("{}/?token=abc&detachedTabId=tab-1", expected_base));
    }

    #[test]
    fn test_sysinfo_process_removal() {
        use sysinfo::{System, ProcessRefreshKind};
        
        let pid = sysinfo::Pid::from(std::process::id() as usize);
        let mut sys = System::new();
        
        // Verify refresh structures succeed
        let refreshed = sys.refresh_process_specifics(pid, ProcessRefreshKind::new().with_memory());
        assert!(refreshed);
    }
}
