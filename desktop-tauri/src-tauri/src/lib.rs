use std::fs::File;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;
use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};

struct DesktopState {
    backend_child: Arc<Mutex<Option<Child>>>,
    status: Arc<Mutex<String>>, // "stopped" | "starting" | "running"
    active_sessions: Arc<Mutex<serde_json::Value>>,
    workspaces: Arc<Mutex<serde_json::Value>>,
}

fn is_port_active(port: u16) -> bool {
    TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok()
}

fn find_workspace_root() -> Option<PathBuf> {
    let exe_path = std::env::current_exe().ok()?;
    let mut path = exe_path.as_path();
    while let Some(parent) = path.parent() {
        if parent.join("package.json").exists() && parent.join("backend").exists() && parent.join("desktop-tauri").exists() {
            return Some(parent.to_path_buf());
        }
        path = parent;
    }
    None
}

fn kill_port_process(port: u16) {
    #[cfg(windows)]
    {
        let cmd = format!(
            "Get-NetTCPConnection -LocalPort {} -State Listen -ErrorAction SilentlyContinue | Foreach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}"
        , port);
        Command::new("powershell")
            .args(&["-NoProfile", "-Command", &cmd])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .ok();
    }
    #[cfg(not(windows))]
    {
        let cmd = format!("lsof -t -i:{} | xargs kill -9", port);
        Command::new("sh")
            .args(&["-c", &cmd])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .ok();
    }
}

fn get_bypass_token() -> Option<String> {
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

fn app_base_url() -> &'static str {
    if cfg!(debug_assertions) {
        "http://localhost:5773"
    } else {
        "http://localhost:5779"
    }
}

fn app_url_with_token(token: Option<String>) -> String {
    let base_url = app_base_url();
    match token {
        Some(token) if !token.is_empty() => format!("{}/?token={}", base_url, token),
        _ => base_url.to_string(),
    }
}

fn current_app_url() -> String {
    app_url_with_token(get_bypass_token())
}

fn is_node_installed() -> bool {
    Command::new("node")
        .arg("--version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn show_missing_node_dialog() {
    #[cfg(target_os = "windows")]
    {
        Command::new("powershell")
            .args(&[
                "-Command",
                "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('Node.js is not installed. Please install Node.js (LTS version) to run t-line.', 'Node.js Required', 'OK', 'Error')"
            ])
            .status()
            .ok();
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("osascript")
            .args(&[
                "-e",
                "display dialog \"Node.js is not installed. Please install Node.js to run t-line.\" with title \"Node.js Required\" buttons {\"OK\"} default button \"OK\" with icon stop"
            ])
            .status()
            .ok();
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("zenity")
            .args(&[
                "--error",
                "--text", "Node.js is not installed. Please install Node.js to run t-line.",
                "--title", "Node.js Required"
            ])
            .status()
            .ok();
    }
}

fn http_get(port: u16, path: &str, token: Option<&str>) -> Result<String, String> {
    let client = reqwest::blocking::Client::builder()
        .timeout(Duration::from_millis(800))
        .build()
        .map_err(|e| e.to_string())?;
        
    let url = format!("http://127.0.0.1:{}{}", port, path);
    let mut req = client.get(&url);
    if let Some(t) = token {
        req = req.header("Authorization", format!("Bearer {}", t));
    }
    
    let res = req.send().map_err(|e| e.to_string())?;
    if res.status().is_success() {
        res.text().map_err(|e| e.to_string())
    } else {
        Err(format!("HTTP error: {}", res.status()))
    }
}

fn is_path_under_workspace(path: &str, ws_path: &str) -> bool {
    let p1 = path.replace("\\", "/").to_lowercase();
    let p2 = ws_path.replace("\\", "/").to_lowercase();
    p1 == p2 || p1.starts_with(&format!("{}/", p2))
}

fn is_paths_equal(path1: &str, path2: &str) -> bool {
    path1.replace("\\", "/").to_lowercase() == path2.replace("\\", "/").to_lowercase()
}

fn get_folder_name(path: &str) -> String {
    let p = path.replace("\\", "/");
    p.split('/').last().unwrap_or("").to_string()
}

fn percent_encode_html(html: &str) -> String {
    html.replace("%", "%25")
        .replace("#", "%23")
        .replace(" ", "%20")
        .replace("\n", "%0A")
        .replace("\"", "%22")
        .replace("<", "%3C")
        .replace(">", "%3E")
}

fn build_tray_menu<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>, state: &DesktopState) -> Result<Menu<R>, tauri::Error> {
    let status = state.status.lock().unwrap().clone();
    let status_label = format!("t-line: {}", match status.as_str() {
        "running" => "Running",
        "starting" => "Starting...",
        "stopping" => "Stopping...",
        _ => "Stopped",
    });

    let menu = Menu::new(app_handle)?;
    
    // Status item (disabled)
    let status_item = MenuItemBuilder::with_id("status", &status_label)
        .enabled(false)
        .build(app_handle)?;
    menu.append(&status_item)?;
    
    menu.append(&PredefinedMenuItem::separator(app_handle)?)?;

    // Show Dashboard
    let show_item = MenuItemBuilder::with_id("show", "Show Dashboard").build(app_handle)?;
    menu.append(&show_item)?;

    menu.append(&PredefinedMenuItem::separator(app_handle)?)?;

    // Start / Stop / Restart Backend
    let start_enabled = status == "stopped";
    let running_enabled = status == "running";

    let start_item = MenuItemBuilder::with_id("start_backend", "Start Backend")
        .enabled(start_enabled)
        .build(app_handle)?;
    menu.append(&start_item)?;

    let stop_item = MenuItemBuilder::with_id("stop_backend", "Stop Backend")
        .enabled(running_enabled)
        .build(app_handle)?;
    menu.append(&stop_item)?;

    let restart_item = MenuItemBuilder::with_id("restart_backend", "Restart Backend")
        .enabled(running_enabled)
        .build(app_handle)?;
    menu.append(&restart_item)?;

    // Add active sessions if running
    if status == "running" {
        let sessions = state.active_sessions.lock().unwrap().clone();
        let workspaces_val = state.workspaces.lock().unwrap().clone();

        if let (Some(sessions_arr), Some(workspaces_arr)) = (sessions.as_array(), workspaces_val.as_array()) {
            if !sessions_arr.is_empty() {
                menu.append(&PredefinedMenuItem::separator(app_handle)?)?;
                
                let active_label = MenuItemBuilder::with_id("sessions_header", "Active PTY Sessions:")
                    .enabled(false)
                    .build(app_handle)?;
                menu.append(&active_label)?;

                // Map workspaces to their paths for lookup
                for ws in workspaces_arr {
                    let ws_name = ws.get("name").and_then(|v| v.as_str()).unwrap_or("Unnamed Workspace");
                    let ws_path = ws.get("path").and_then(|v| v.as_str()).unwrap_or("");
                    if ws_path.is_empty() {
                        continue;
                    }

                    // Find terminal sessions belonging to this workspace
                    let mut ws_terms = Vec::new();
                    for t in sessions_arr {
                        let t_cwd = t.get("cwd").and_then(|v| v.as_str()).unwrap_or("");
                        if is_path_under_workspace(t_cwd, ws_path) {
                            ws_terms.push(t);
                        }
                    }

                    if !ws_terms.is_empty() {
                        let mut submenu_builder = SubmenuBuilder::new(app_handle, format!("{} ({})", ws_name, ws_terms.len()));
                        
                        for t in ws_terms {
                            let pid = t.get("pid").and_then(|v| v.as_u64()).unwrap_or(0);
                            let shell_type = t.get("shellType").and_then(|v| v.as_str()).unwrap_or("terminal");
                            let cwd = t.get("cwd").and_then(|v| v.as_str()).unwrap_or("");
                            
                            let mut label_suffix = get_folder_name(cwd);
                            if let Some(worktrees) = ws.get("worktrees").and_then(|v| v.as_array()) {
                                for wt in worktrees {
                                    if let Some(wt_path) = wt.get("path").and_then(|v| v.as_str()) {
                                        if is_paths_equal(cwd, wt_path) {
                                            if let Some(branch) = wt.get("branch").and_then(|v| v.as_str()) {
                                                label_suffix = format!("wt: {}", branch);
                                            }
                                        }
                                    }
                                }
                            }

                            let item_id = format!("pid_{}", pid);
                            let label = format!("[PID {}] {} ({})", pid, shell_type, label_suffix);
                            let sub_item = MenuItemBuilder::with_id(item_id, label).build(app_handle)?;
                            submenu_builder = submenu_builder.item(&sub_item);
                        }

                        let submenu = submenu_builder.build()?;
                        menu.append(&submenu)?;
                    }
                }

                // Orphan/Other sessions
                let mut orphan_terms = Vec::new();
                for t in sessions_arr {
                    let t_cwd = t.get("cwd").and_then(|v| v.as_str()).unwrap_or("");
                    let mut has_ws = false;
                    for ws in workspaces_arr {
                        let ws_path = ws.get("path").and_then(|v| v.as_str()).unwrap_or("");
                        if !ws_path.is_empty() && is_path_under_workspace(t_cwd, ws_path) {
                            has_ws = true;
                            break;
                        }
                    }
                    if !has_ws {
                        orphan_terms.push(t);
                    }
                }

                if !orphan_terms.is_empty() {
                    let mut submenu_builder = SubmenuBuilder::new(app_handle, format!("Other Sessions ({})", orphan_terms.len()));
                    for t in orphan_terms {
                        let pid = t.get("pid").and_then(|v| v.as_u64()).unwrap_or(0);
                        let shell_type = t.get("shellType").and_then(|v| v.as_str()).unwrap_or("terminal");
                        let item_id = format!("pid_{}", pid);
                        let label = format!("[PID {}] {}", pid, shell_type);
                        let sub_item = MenuItemBuilder::with_id(item_id, label).build(app_handle)?;
                        submenu_builder = submenu_builder.item(&sub_item);
                    }
                    let submenu = submenu_builder.build()?;
                    menu.append(&submenu)?;
                }
            }
        }
    }

    menu.append(&PredefinedMenuItem::separator(app_handle)?)?;

    // Restart Desktop
    let restart_desktop_item = MenuItemBuilder::with_id("restart_desktop", "Restart Desktop").build(app_handle)?;
    menu.append(&restart_desktop_item)?;

    // Quit
    let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app_handle)?;
    menu.append(&quit_item)?;

    Ok(menu)
}

fn build_error_page_html(app_url: &str) -> String {
    r#"
            <!DOCTYPE html>
            <html>
            <head>
                <title>t-line Connection Error</title>
                <style>
                    body {
                        background-color: #05070c;
                        color: #f8fafc;
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        height: 100vh;
                        margin: 0;
                    }
                    .card {
                        background: rgba(17, 24, 39, 0.45);
                        border: 1px solid rgba(255, 255, 255, 0.06);
                        border-radius: 16px;
                        padding: 40px;
                        text-align: center;
                        max-width: 500px;
                    }
                    h1 { color: #f59e0b; margin-bottom: 16px; }
                    p { color: #94a3b8; line-height: 1.6; margin-bottom: 24px; }
                    .btn-group {
                        display: flex;
                        gap: 12px;
                        justify-content: center;
                    }
                    button {
                        padding: 10px 20px;
                        border-radius: 8px;
                        font-weight: 600;
                        cursor: pointer;
                        border: none;
                        transition: all 0.2s;
                    }
                    .btn-primary {
                        background: #6366f1;
                        color: white;
                    }
                    .btn-primary:hover:not(:disabled) { background: #818cf8; }
                    .btn-secondary {
                        background: rgba(255, 255, 255, 0.08);
                        color: #e2e8f0;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                    }
                    .btn-secondary:hover:not(:disabled) { background: rgba(255, 255, 255, 0.15); }
                    .btn-danger {
                        background: #ef4444;
                        color: white;
                    }
                    .btn-danger:hover:not(:disabled) { background: #f87171; }
                    button:disabled {
                        opacity: 0.5;
                        cursor: not-allowed;
                    }
                    .titlebar {
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        height: 32px;
                        display: flex;
                        justify-content: flex-end;
                        align-items: center;
                        padding-right: 8px;
                        user-select: none;
                        background: transparent;
                        z-index: 1000;
                    }
                    .titlebar-btn {
                        display: inline-flex;
                        justify-content: center;
                        align-items: center;
                        width: 28px;
                        height: 28px;
                        cursor: pointer;
                        transition: background-color 0.15s ease, color 0.15s ease;
                        color: #94a3b8;
                        font-size: 10px;
                        font-weight: bold;
                        border-radius: 4px;
                    }
                    .titlebar-btn:hover {
                        background-color: rgba(255, 255, 255, 0.08);
                        color: #f8fafc;
                    }
                    .titlebar-btn-close:hover {
                        background-color: #ef4444;
                        color: white;
                    }
                </style>
            </head>
            <body>
                <div class="titlebar" data-tauri-drag-region style="-webkit-app-region: drag;">
                    <div class="titlebar-btn" onclick="minimizeWindow()" title="Minimize" style="-webkit-app-region: no-drag;">—</div>
                    <div class="titlebar-btn" id="btn-maximize" onclick="maximizeWindow()" title="Maximize" style="-webkit-app-region: no-drag;">▢</div>
                    <div class="titlebar-btn titlebar-btn-close" onclick="closeWindow()" title="Close" style="-webkit-app-region: no-drag;">✕</div>
                </div>
                <div class="card">
                    <h1>Backend Offline</h1>
                    <p id="status-text">Timeout waiting for the backend server to start on port 5779. Please make sure no other process is using this port, and try starting the backend.</p>
                    <div class="btn-group">
                        <button id="btn-start" class="btn-primary" onclick="startBackend()">Start Backend</button>
                        <button id="btn-retry" class="btn-secondary" onclick="retryConnection()">Retry Connection</button>
                    </div>
                </div>
                <script>
                    const APP_URL = '__APP_URL__';

                    async function minimizeWindow() {
                        try {
                            const { getCurrentWindow } = window.__TAURI__.window;
                            await getCurrentWindow().minimize();
                        } catch (err) {
                            console.error(err);
                        }
                    }

                    async function maximizeWindow() {
                        try {
                            const { getCurrentWindow } = window.__TAURI__.window;
                            await getCurrentWindow().toggleMaximize();
                        } catch (err) {
                            console.error(err);
                        }
                    }

                    async function closeWindow() {
                        try {
                            const { getCurrentWindow } = window.__TAURI__.window;
                            await getCurrentWindow().close();
                        } catch (err) {
                            console.error(err);
                        }
                    }

                    async function updateMaximizeIcon() {
                        try {
                            const { getCurrentWindow } = window.__TAURI__.window;
                            const isMax = await getCurrentWindow().isMaximized();
                            document.getElementById('btn-maximize').innerText = isMax ? '❐' : '▢';
                        } catch (err) {
                            console.error(err);
                        }
                    }

                    window.addEventListener('resize', updateMaximizeIcon);
                    window.addEventListener('DOMContentLoaded', updateMaximizeIcon);

                    function setStatus(message) {
                        document.getElementById('status-text').innerText = message;
                    }

                    function setButtonsDisabled(disabled) {
                        document.getElementById('btn-start').disabled = disabled;
                        document.getElementById('btn-retry').disabled = disabled;
                    }

                    function checkBackendHealth() {
                        return fetch('http://127.0.0.1:5779/api/health', { cache: 'no-store' })
                            .then(res => {
                                if (!res.ok) {
                                    throw new Error('Backend returned ' + res.status);
                                }
                                return true;
                            });
                    }

                    async function loadApp() {
                        try {
                            const appUrl = await window.__TAURI__.core.invoke('get_app_url');
                            window.location.href = appUrl || APP_URL;
                        } catch (err) {
                            console.error(err);
                            window.location.href = APP_URL;
                        }
                    }

                    function retryConnection() {
                        setButtonsDisabled(true);
                        setStatus('Checking backend connection...');

                        checkBackendHealth()
                            .then(loadApp)
                            .catch(() => {
                                setStatus('Backend is still offline. Start it or try again in a moment.');
                                setButtonsDisabled(false);
                            });
                    }

                    function waitForBackend() {
                        let attempts = 0;
                        const interval = setInterval(() => {
                            attempts += 1;
                            checkBackendHealth()
                                .then(() => {
                                    clearInterval(interval);
                                    loadApp();
                                })
                                .catch(() => {
                                    if (attempts >= 20) {
                                        clearInterval(interval);
                                        setStatus('Backend did not become ready. Check the tray menu or backend log, then try again.');
                                        setButtonsDisabled(false);
                                        document.getElementById('btn-start').innerText = 'Start Backend';
                                    }
                                });
                        }, 1000);
                    }

                    async function startBackend() {
                        setStatus('Starting backend, please wait...');
                        setButtonsDisabled(true);
                        document.getElementById('btn-start').innerText = 'Starting...';

                        try {
                            await window.__TAURI__.core.invoke('start_backend_command');
                            waitForBackend();
                        } catch (err) {
                            console.error('start_backend_command failed', err);
                            setStatus('Failed to start backend: ' + err);
                            setButtonsDisabled(false);
                            document.getElementById('btn-start').innerText = 'Start Backend';
                        }
                    }

                </script>
            </body>
            </html>
        "#.replace("__APP_URL__", app_url)
}

fn show_error_page(app_handle: &tauri::AppHandle) {
    if let Some(main_window) = app_handle.get_webview_window("main") {
        let app_url = current_app_url();
        let error_html = build_error_page_html(&app_url);

        let data_url = format!(
            "data:text/html;charset=utf-8,{}",
            percent_encode_html(&error_html)
        );
        if let Ok(parsed_url) = tauri::Url::parse(&data_url) {
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
        let mut status_guard = state.status.lock().unwrap();
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

        let mut backend_verified = false;
        if is_port_active(port) {
            if let Some(ref token) = bypass_token {
                if http_get(port, "/api/workspaces", Some(token)).is_ok() {
                    backend_verified = true;
                }
            }
        }

        if backend_verified {
            println!("[tauri] Backend is already running and authenticated on port {}. Connecting directly...", port);
        } else {
            if is_port_active(port) {
                println!("[tauri] Port {} is active but backend is unauthenticated or unresponsive. Killing existing process...", port);
                kill_port_process(port);
                thread::sleep(Duration::from_millis(500));
            }
            println!("[tauri] Spawning backend process...");
            
            let log_file_path = if let Ok(app_data) = app_handle_clone.path().app_data_dir() {
                std::fs::create_dir_all(&app_data).ok();
                app_data.join("backend_run.log")
            } else {
                PathBuf::from("backend_run.log")
            };

            let mut child = None;

            if is_dev {
                if let Some(ws_root) = find_workspace_root() {
                    println!("[tauri] Dev mode: Spawning dev backend from workspace root: {:?}", ws_root);
                    #[cfg(windows)]
                    {
                        child = Command::new("cmd")
                            .args(&["/c", "npm run dev:backend"])
                            .current_dir(&ws_root)
                            .stdout(Stdio::piped())
                            .stderr(Stdio::piped())
                            .spawn()
                            .ok();
                    }
                    #[cfg(not(windows))]
                    {
                        child = Command::new("npm")
                            .args(&["run", "dev:backend"])
                            .current_dir(&ws_root)
                            .stdout(Stdio::piped())
                            .stderr(Stdio::piped())
                            .spawn()
                            .ok();
                    }
                }
            }

            if child.is_none() {
                let resource_path = app_handle_clone
                    .path()
                    .resolve("backend/dist/server.js", tauri::path::BaseDirectory::Resource);
                
                match resource_path {
                    Ok(script_path) => {
                        if script_path.exists() {
                            println!("[tauri] Spawning node with script: {:?}", script_path);
                            child = Command::new("node")
                                .arg("--max-old-space-size=64")
                                .arg("--expose-gc")
                                .arg(&script_path)
                                .env("PORT", port.to_string())
                                .stdout(Stdio::piped())
                                .stderr(Stdio::piped())
                                .spawn()
                                .ok();
                        } else {
                            eprintln!("[tauri] Backend script not found at path: {:?}", script_path);
                        }
                    }
                    Err(e) => {
                        eprintln!("[tauri] Failed to resolve resource path: {}", e);
                    }
                }
            }

            match child {
                Some(mut spawned_child) => {
                    let stdout = spawned_child.stdout.take().expect("failed to get stdout");
                    let stderr = spawned_child.stderr.take().expect("failed to get stderr");
                    
                    {
                        let mut guard = backend_child_thread.lock().unwrap();
                        *guard = Some(spawned_child);
                    }

                    let log_file_clone = log_file_path.clone();
                    thread::spawn(move || {
                        if let Ok(mut log_file) = File::create(&log_file_clone) {
                            let reader = BufReader::new(stdout);
                            for line in reader.lines() {
                                if let Ok(l) = line {
                                    writeln!(log_file, "[stdout] {}", l).ok();
                                    log_file.flush().ok();
                                }
                            }
                        }
                    });

                    thread::spawn(move || {
                        if let Ok(mut log_file) = File::options().append(true).open(&log_file_path) {
                            let reader = BufReader::new(stderr);
                            for line in reader.lines() {
                                if let Ok(l) = line {
                                    writeln!(log_file, "[stderr] {}", l).ok();
                                    log_file.flush().ok();
                                }
                            }
                        }
                    });
                }
                None => {
                    eprintln!("[tauri] Failed to spawn backend process.");
                }
            }
        }

        // In dev mode the webview navigates to Vite (port 5773). spawn_backend
        // only started the Node backend on 5779, leaving 5773 dead and the
        // webview blank. Launch the Vite dev server here and wait for it.
        if is_dev {
            if !is_port_active(5773) {
                if let Some(ws_root) = find_workspace_root() {
                    println!("[tauri] Dev mode: Spawning Vite dev server from workspace root: {:?}", ws_root);
                    #[cfg(windows)]
                    {
                        let _ = Command::new("cmd")
                            .args(&["/c", "npm", "run", "dev:frontend"])
                            .current_dir(&ws_root)
                            .stdout(Stdio::null())
                            .stderr(Stdio::null())
                            .spawn();
                    }
                    #[cfg(not(windows))]
                    {
                        let _ = Command::new("npm")
                            .args(&["run", "dev:frontend"])
                            .current_dir(&ws_root)
                            .stdout(Stdio::null())
                            .stderr(Stdio::null())
                            .spawn();
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
            if is_port_active(port) {
                server_ready = true;
                break;
            }
            thread::sleep(Duration::from_millis(200));
        }

        if server_ready {
            {
                let state = app_handle_clone.state::<DesktopState>();
                let mut status_guard = state.status.lock().unwrap();
                *status_guard = "running".to_string();
            }
            if let Some(tray) = app_handle_clone.tray_by_id("main_tray") {
                let state = app_handle_clone.state::<DesktopState>();
                if let Ok(menu) = build_tray_menu(&app_handle_clone, &state) {
                    let _ = tray.set_menu(Some(menu));
                }
            }

            if bypass_token.is_none() {
                for _ in 0..5 {
                    bypass_token = get_bypass_token();
                    if bypass_token.is_some() {
                        break;
                    }
                    thread::sleep(Duration::from_millis(200));
                }
            }

            let url = app_url_with_token(bypass_token);

            println!("[tauri] Server ready. Loading URL: {}", url);

            if let Some(main_window) = app_handle_clone.get_webview_window("main") {
                main_window.navigate(tauri::Url::parse(&url).unwrap()).ok();
                thread::sleep(Duration::from_millis(300));
                main_window.maximize().ok();
                main_window.show().ok();
            }
        } else {
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
    if let Some(child) = guard.take() {
        println!("[tauri] Terminating backend process tree...");
        #[cfg(windows)]
        {
            let pid = child.id();
            if let Ok(mut cmd) = Command::new("taskkill")
                .args(&["/pid", &pid.to_string(), "/f", "/t"])
                .spawn()
            {
                let _ = cmd.wait();
            }
        }
        #[cfg(not(windows))]
        {
            let mut c = child;
            let _ = c.kill();
            let _ = c.wait();
        }
    }

    // Fallback: make sure the port is actually free
    if is_port_active(5779) {
        println!("[tauri] Port 5779 is still active. Killing any process on port 5779...");
        kill_port_process(5779);
    }

    // Wait up to 2 seconds for port 5779 to be freed
    let start = Instant::now();
    while start.elapsed() < Duration::from_secs(2) {
        if !is_port_active(5779) {
            break;
        }
        thread::sleep(Duration::from_millis(100));
    }
    
    {
        let mut status_guard = state.status.lock().unwrap();
        *status_guard = "stopped".to_string();
    }
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

fn restart_desktop_app() {
    if let Ok(current_exe) = std::env::current_exe() {
        Command::new(current_exe).spawn().ok();
        std::process::exit(0);
    }
}

fn poll_backend(app_handle: tauri::AppHandle) {
    let port = 5779;
    thread::spawn(move || {
        let state = app_handle.state::<DesktopState>();
        let mut last_state_str = String::new();
        
        loop {
            thread::sleep(Duration::from_secs(3));
            
            let token = get_bypass_token();
            let running = is_port_active(port);
            
            let mut status_changed = false;
            let mut sessions_changed = false;
            
            let new_status = if running {
                "running".to_string()
            } else {
                "stopped".to_string()
            };
            
            let current_status = {
                let status_guard = state.status.lock().unwrap();
                status_guard.clone()
            };
            
            let status_to_apply = if current_status == "starting" {
                if running {
                    "running".to_string()
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

            if status_to_apply == "running" {
                let token_str = token.as_deref();
                let sessions_res = http_get(port, "/api/terminals/active", token_str);
                let workspaces_res = http_get(port, "/api/workspaces", token_str);
                
                if let (Ok(sessions_body), Ok(workspaces_body)) = (sessions_res, workspaces_res) {
                    if let (Ok(sessions_json), Ok(workspaces_json)) = (serde_json::from_str::<serde_json::Value>(&sessions_body), serde_json::from_str::<serde_json::Value>(&workspaces_body)) {
                        
                        let current_state_str = format!("{}{}", sessions_body, workspaces_body);
                        if current_state_str != last_state_str {
                            last_state_str = current_state_str;
                            
                            {
                                let mut sessions_guard = state.active_sessions.lock().unwrap();
                                *sessions_guard = sessions_json;
                            }
                            {
                                let mut workspaces_guard = state.workspaces.lock().unwrap();
                                *workspaces_guard = workspaces_json;
                            }
                            sessions_changed = true;
                        }
                    }
                }
            } else {
                let mut sessions_guard = state.active_sessions.lock().unwrap();
                let mut workspaces_guard = state.workspaces.lock().unwrap();
                if !sessions_guard.as_array().map_or(true, |a| a.is_empty()) || !workspaces_guard.as_array().map_or(true, |a| a.is_empty()) {
                    *sessions_guard = serde_json::json!([]);
                    *workspaces_guard = serde_json::json!([]);
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
fn get_app_url() -> String {
    current_app_url()
}

#[tauri::command]
fn open_webview_devtools(app: tauri::AppHandle, label: String) -> Result<(), String> {
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

#[tauri::command]
fn get_memory_usage(state: tauri::State<'_, DesktopState>) -> Result<serde_json::Value, String> {
    use sysinfo::{Pid, System};
    
    let mut sys = System::new();
    sys.refresh_processes();

    let current_pid = Pid::from(std::process::id() as usize);
    
    let mut backend_pid_val = None;
    if let Some(child) = &*state.backend_child.lock().unwrap() {
        backend_pid_val = Some(Pid::from(child.id() as usize));
    }

    let mut total_memory = 0u64;
    let mut main_memory = 0u64;

    for (pid, process) in sys.processes() {
        if *pid == current_pid {
            main_memory = process.memory();
            total_memory += process.memory();
        } else if process.parent() == Some(current_pid) {
            if Some(*pid) != backend_pid_val {
                total_memory += process.memory();
            }
        }
    }

    Ok(serde_json::json!({
        "desktopRss": main_memory,
        "desktopTotal": total_memory
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if !is_node_installed() {
        show_missing_node_dialog();
        std::process::exit(1);
    }

    let backend_child: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));

    let state = DesktopState {
        backend_child: backend_child.clone(),
        status: Arc::new(Mutex::new("stopped".to_string())),
        active_sessions: Arc::new(Mutex::new(serde_json::json!([]))),
        workspaces: Arc::new(Mutex::new(serde_json::json!([]))),
    };

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            println!("Another instance was opened with args: {:?} and cwd: {:?}", argv, cwd);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            get_memory_usage,
            open_webview_devtools,
            quit_app,
            start_backend_command,
            get_app_url
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
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    } else if id_str == "start_backend" {
                        spawn_backend(app_handle.clone());
                    } else if id_str == "stop_backend" {
                        stop_backend_async(app_handle.clone());
                    } else if id_str == "restart_backend" {
                        restart_backend_async(app_handle.clone());
                    } else if id_str == "restart_desktop" {
                        let state = app_handle.state::<DesktopState>();
                        stop_backend(&state);
                        restart_desktop_app();
                    } else if id_str.starts_with("pid_") {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
                        }
                    }
                })
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event: tauri::tray::TrayIconEvent| {
                    if let TrayIconEvent::Click { button, button_state, .. } = event {
                        if button == MouseButton::Left && button_state == MouseButtonState::Up {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.unminimize();
                            }
                        }
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
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            let state = app_handle.state::<DesktopState>();
            stop_backend(&state);
        }
    });
}

#[cfg(test)]
mod tests {
    use super::build_error_page_html;

    #[test]
    fn error_page_start_backend_uses_invoke() {
        let html = build_error_page_html("http://localhost:5779");

        assert!(html.contains("__TAURI__.core.invoke('start_backend_command')"));
        assert!(!html.contains("document.title = \"action:start_backend\""));
    }

    #[test]
    fn error_page_retry_loads_backend_after_health_check() {
        let html = build_error_page_html("http://localhost:5779");

        assert!(html.contains("function retryConnection()"));
        assert!(html.contains("fetch('http://127.0.0.1:5779/api/health'"));
        assert!(html.contains("const APP_URL = 'http://localhost:5779'"));
        assert!(html.contains("window.location.href = APP_URL"));
    }

    #[test]
    fn error_page_load_app_requests_current_url_from_tauri() {
        let html = build_error_page_html("http://localhost:5779");

        assert!(html.contains("__TAURI__.core.invoke('get_app_url')"));
        assert!(html.contains("window.location.href = appUrl || APP_URL"));
    }

}
