use std::process::Child;
#[allow(unused_imports)] // used when the detached window falls back to the bundled asset
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::Manager;
use tauri::Emitter;
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState};


mod updater;
mod backend_identity;
mod backend_diagnostics;
mod tray_logic;

mod state;
mod browser;
mod tray_menu;
mod system_metrics;
mod backend_process;

use tray_menu::build_tray_menu;
use backend_process::{available_bun_runtime, poll_backend, restart_backend_async, restart_desktop_app, show_missing_bun_dialog, spawn_backend, stop_backend, stop_backend_async};

use backend_identity::verify_local_backend;

use crate::state::{
    app_base_url, app_url_with_token, get_bypass_token,
    DesktopState,
};


fn show_dashboard_window<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
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
