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
use tauri::tray::{TrayIconBuilder, TrayIconEvent};

struct DesktopState {
    backend_child: Arc<Mutex<Option<Child>>>,
    status: Arc<Mutex<String>>, // "stopped" | "starting" | "running"
    active_sessions: Arc<Mutex<serde_json::Value>>,
    workspaces: Arc<Mutex<serde_json::Value>>,
}

fn is_port_active(port: u16) -> bool {
    TcpStream::connect(format!("127.0.0.1:{}", port)).is_ok()
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

        if is_port_active(port) {
            println!("[tauri] Backend is already running on port {}. Connecting directly...", port);
        } else {
            println!("[tauri] Backend not running. Spawning backend process...");
            
            let resource_path = app_handle_clone
                .path()
                .resolve("backend/dist/server.js", tauri::path::BaseDirectory::Resource);
            
            match resource_path {
                Ok(script_path) => {
                    if script_path.exists() {
                        println!("[tauri] Spawning node with script: {:?}", script_path);
                        
                        let log_file_path = if let Ok(app_data) = app_handle_clone.path().app_data_dir() {
                            std::fs::create_dir_all(&app_data).ok();
                            app_data.join("backend_run.log")
                        } else {
                            PathBuf::from("backend_run.log")
                        };

                        let child = Command::new("node")
                            .arg("--max-old-space-size=64")
                            .arg("--expose-gc")
                            .arg(&script_path)
                            .env("PORT", port.to_string())
                            .stdout(Stdio::piped())
                            .stderr(Stdio::piped())
                            .spawn();
                        
                        match child {
                            Ok(mut spawned_child) => {
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
                            Err(e) => {
                                eprintln!("[tauri] Failed to spawn node backend process: {}", e);
                            }
                        }
                    } else {
                        eprintln!("[tauri] Backend script not found at path: {:?}", script_path);
                    }
                }
                Err(e) => {
                    eprintln!("[tauri] Failed to resolve resource path: {}", e);
                }
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
            if bypass_token.is_none() {
                for _ in 0..5 {
                    bypass_token = get_bypass_token();
                    if bypass_token.is_some() {
                        break;
                    }
                    thread::sleep(Duration::from_millis(200));
                }
            }

            let base_url = if is_dev {
                "http://localhost:5773"
            } else {
                "http://localhost:5779"
            };

            let url = match bypass_token {
                Some(token) => format!("{}/?token={}", base_url, token),
                None => base_url.to_string(),
            };

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

            if let Some(main_window) = app_handle_clone.get_webview_window("main") {
                let error_html = r#"
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
                            button {
                                background: #6366f1;
                                color: white;
                                border: none;
                                padding: 10px 20px;
                                border-radius: 8px;
                                font-weight: 600;
                                cursor: pointer;
                            }
                            button:hover { background: #818cf8; }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            <h1>Backend Offline</h1>
                            <p>Timeout waiting for the backend server to start on port 5779. Please make sure no other process is using this port, and try restarting the backend from the system tray menu.</p>
                            <button onclick="window.location.reload()">Retry Connection</button>
                        </div>
                    </body>
                    </html>
                "#;
                
                let data_url = format!("data:text/html;charset=utf-8,{}", percent_encode_html(error_html));
                if let Ok(parsed_url) = tauri::Url::parse(&data_url) {
                    main_window.navigate(parsed_url).ok();
                }
                main_window.show().ok();
            }
        }
    });
}

fn stop_backend(state: &DesktopState) {
    let mut guard = state.backend_child.lock().unwrap();
    if let Some(child) = guard.take() {
        println!("[tauri] Terminating backend process...");
        #[cfg(windows)]
        {
            let pid = child.id();
            Command::new("taskkill")
                .args(&["/pid", &pid.to_string(), "/f", "/t"])
                .spawn()
                .ok();
        }
        #[cfg(not(windows))]
        {
            let mut c = child;
            c.kill().ok();
        }
    }
    
    {
        let mut status_guard = state.status.lock().unwrap();
        *status_guard = "stopped".to_string();
    }
}

fn restart_backend(app_handle: &tauri::AppHandle) {
    let state = app_handle.state::<DesktopState>();
    stop_backend(&state);
    spawn_backend(app_handle.clone());
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
            } else {
                new_status
            };

            if status_to_apply != current_status {
                let mut status_guard = state.status.lock().unwrap();
                *status_guard = status_to_apply.clone();
                status_changed = true;
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
        .invoke_handler(tauri::generate_handler![get_memory_usage])
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
                        let state = app_handle.state::<DesktopState>();
                        stop_backend(&state);
                    } else if id_str == "restart_backend" {
                        restart_backend(app_handle);
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
                .on_tray_icon_event(|tray: &tauri::tray::TrayIcon, event: tauri::tray::TrayIconEvent| {
                    if let TrayIconEvent::Click { .. } = event {
                        if let Some(window) = tray.app_handle().get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.unminimize();
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
