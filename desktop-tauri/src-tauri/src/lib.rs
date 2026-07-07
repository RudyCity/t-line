use std::fs::File;
use std::io::{BufRead, BufReader, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;

// Store the child process so we can gracefully terminate it on app exit
#[allow(dead_code)]
struct BackendProcessState(Arc<Mutex<Option<Child>>>);

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

#[tauri::command]
fn get_memory_usage() -> Result<serde_json::Value, String> {
    use sysinfo::{Pid, System};
    
    let mut sys = System::new();
    sys.refresh_processes();

    let current_pid = Pid::from(std::process::id() as usize);
    let mut total_memory = 0u64;
    let mut main_memory = 0u64;

    for (pid, process) in sys.processes() {
        if *pid == current_pid {
            main_memory = process.memory();
            total_memory += process.memory();
        } else if process.parent() == Some(current_pid) {
            total_memory += process.memory();
        }
    }

    Ok(serde_json::json!({
        "desktopRss": main_memory,
        "desktopTotal": total_memory
    }))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let backend_child: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(None));
    let backend_child_clone = backend_child.clone();

    let app = tauri::Builder::default()
        .manage(BackendProcessState(backend_child.clone()))
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
            let backend_child_thread = backend_child_clone.clone();

            // Run process checking and spawning in a background thread to prevent blocking UI thread
            thread::spawn(move || {
                let port = 5779;
                let is_dev = cfg!(debug_assertions);
                
                let mut bypass_token = get_bypass_token();

                if is_port_active(port) {
                    println!("[tauri] Backend is already running on port {}. Connecting directly...", port);
                } else {
                    println!("[tauri] Backend not running. Spawning backend process...");
                    
                    // Resolve path to resources/backend/dist/server.js
                    let resource_path = app_handle
                        .path()
                        .resolve("backend/dist/server.js", tauri::path::BaseDirectory::Resource);
                    
                    match resource_path {
                        Ok(script_path) => {
                            if script_path.exists() {
                                println!("[tauri] Spawning node with script: {:?}", script_path);
                                
                                // Get app data dir for logging
                                let log_file_path = if let Ok(app_data) = app_handle.path().app_data_dir() {
                                    std::fs::create_dir_all(&app_data).ok();
                                    app_data.join("backend_run.log")
                                } else {
                                    PathBuf::from("backend_run.log")
                                };

                                // Spawn node backend/dist/server.js
                                let child = Command::new("node")
                                    .arg(&script_path)
                                    .env("PORT", port.to_string())
                                    .stdout(Stdio::piped())
                                    .stderr(Stdio::piped())
                                    .spawn();
                                
                                match child {
                                    Ok(mut spawned_child) => {
                                        let stdout = spawned_child.stdout.take().expect("failed to get stdout");
                                        let stderr = spawned_child.stderr.take().expect("failed to get stderr");
                                        
                                        // Store child process handle
                                        {
                                            let mut guard = backend_child_thread.lock().unwrap();
                                            *guard = Some(spawned_child);
                                        }

                                        // Pipe stdout to log file
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

                                        // Pipe stderr to log
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

                // Poll port until active or timeout (15 seconds)
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
                    // Try to get token again
                    if bypass_token.is_none() {
                        for _ in 0..5 {
                            bypass_token = get_bypass_token();
                            if bypass_token.is_some() {
                                break;
                            }
                            thread::sleep(Duration::from_millis(200));
                        }
                    }

                    // Load URL
                    let base_url = if is_dev {
                        "http://localhost:5773" // Vite dev server
                    } else {
                        "http://localhost:5779" // Production express server
                    };

                    let url = match bypass_token {
                        Some(token) => format!("{}/?token={}", base_url, token),
                        None => base_url.to_string(),
                    };

                    println!("[tauri] Server ready. Loading URL: {}", url);

                    // Show and navigate main window
                    if let Some(main_window) = app_handle.get_webview_window("main") {
                        main_window.navigate(tauri::Url::parse(&url).unwrap()).ok();
                        
                        thread::sleep(Duration::from_millis(300));
                        main_window.maximize().ok();
                        main_window.show().ok();
                    }
                } else {
                    eprintln!("[tauri] Timeout waiting for backend server to start.");
                    if let Some(main_window) = app_handle.get_webview_window("main") {
                        main_window.show().ok();
                    }
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            // Gracefully kill backend process tree when Tauri app exits
            let mut guard = backend_child.lock().unwrap();
            if let Some(child) = guard.take() {
                println!("[tauri] Terminating backend process on app exit...");
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
                    child.kill().ok();
                }
            }
        }
    });
}
