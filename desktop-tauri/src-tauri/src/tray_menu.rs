//! System tray menu construction, extracted from `lib.rs` to keep that file
//! small and focused. Pure presentation over `DesktopState` plus tray helpers.
use crate::state::DesktopState;
use crate::tray_logic;
use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

fn is_paths_equal(path1: &str, path2: &str) -> bool {
    path1.replace("\\", "/").to_lowercase() == path2.replace("\\", "/").to_lowercase()
}

fn get_folder_name(path: &str) -> String {
    let p = path.replace("\\", "/");
    p.split('/').last().unwrap_or("").to_string()
}

#[allow(dead_code)]
fn percent_encode_html(html: &str) -> String {
    html.replace("%", "%25")
        .replace("#", "%23")
        .replace(" ", "%20")
        .replace("\n", "%0A")
        .replace("\"", "%22")
        .replace("<", "%3C")
        .replace(">", "%3E")
}


pub(crate) fn build_tray_menu<R: tauri::Runtime>(app_handle: &tauri::AppHandle<R>, state: &DesktopState) -> Result<Menu<R>, tauri::Error> {
    let status = state.status.lock().unwrap().clone();
    let status_label = format!("t-line: {}", match status.as_str() {
        "running" => "Running",
        "connected" => "Connected (external backend)",
        "error" => "Port conflict / Error",
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
    let hide_item = MenuItemBuilder::with_id("hide", "Hide Dashboard").build(app_handle)?;
    menu.append(&hide_item)?;

    menu.append(&PredefinedMenuItem::separator(app_handle)?)?;

    // Start / Stop / Restart Backend
    let start_enabled = status == "stopped" || status == "error";
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
    if status == "running" || status == "connected" {
        let sessions = state.active_sessions.lock().unwrap().clone();
        let workspaces_val = state.workspaces.lock().unwrap().clone();

        if let (Some(sessions_arr), Some(workspaces_arr)) = (sessions.as_array(), workspaces_val.as_array()) {
            let visible_sessions = tray_logic::displayed_sessions(sessions_arr);
            if !visible_sessions.is_empty() {
                menu.append(&PredefinedMenuItem::separator(app_handle)?)?;
                
                let active_label = MenuItemBuilder::with_id("sessions_header", "Active PTY Sessions:")
                    .enabled(false)
                    .build(app_handle)?;
                menu.append(&active_label)?;

                // Map workspaces to their paths for lookup
                for (ws_index, ws) in workspaces_arr.iter().enumerate() {
                    let ws_name = ws.get("name").and_then(|v| v.as_str()).unwrap_or("Unnamed Workspace");
                    let ws_path = ws.get("path").and_then(|v| v.as_str()).unwrap_or("");
                    if ws_path.is_empty() {
                        continue;
                    }

                    // Find terminal sessions belonging to this workspace
                    let mut ws_terms = Vec::new();
                    for t in &visible_sessions {
                        let t_cwd = t.get("cwd").and_then(|v| v.as_str()).unwrap_or("");
                        if tray_logic::best_workspace_index(t_cwd, workspaces_arr) == Some(ws_index) {
                            ws_terms.push(*t);
                        }
                    }

                    if !ws_terms.is_empty() {
                        let ws_name_display: String = ws_name.chars().filter(|c| !c.is_control()).take(44).collect();
                        let mut submenu_builder = SubmenuBuilder::new(app_handle, format!("{} ({})", ws_name_display, ws_terms.len()));
                        
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

                // Sessions without a matching project only; nested workspaces
                // are already assigned to their closest matching root.
                let orphan_terms: Vec<_> = visible_sessions.iter().copied()
                    .filter(|t| {
                        let cwd = t.get("cwd").and_then(|v| v.as_str()).unwrap_or("");
                        tray_logic::best_workspace_index(cwd, workspaces_arr).is_none()
                    })
                    .collect();

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
                if sessions_arr.len() > visible_sessions.len() {
                    let omitted = sessions_arr.len() - visible_sessions.len();
                    menu.append(&MenuItemBuilder::with_id(
                        "more_sessions", format!("{} additional/duplicate sessions: open Dashboard", omitted)
                    ).enabled(false).build(app_handle)?)?;
                }
            }
        }

        // Active Tabs Listing
        let sync_state = state.sync_state.lock().unwrap().clone();
        if let Some(tabs_arr) = sync_state.get("tabs").and_then(|v| v.as_array()) {
            if !tabs_arr.is_empty() {
                let mut agent_tabs = Vec::new();
                let mut browser_tabs = Vec::new();
                let mut terminal_tabs = Vec::new();
                let mut other_tabs = Vec::new();

                let mut agent_ids = Vec::new();
                let mut browser_ids = Vec::new();
                let mut terminal_ids = Vec::new();
                let mut other_ids = Vec::new();
                let mut all_ids = Vec::new();

                for tab in tabs_arr {
                    let id = tab.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    if id.is_empty() {
                        continue;
                    }
                    all_ids.push(id.to_string());

                    let tab_type = tab.get("type").and_then(|v| v.as_str()).unwrap_or("");
                    match tab_type {
                        "agent" => {
                            agent_ids.push(id.to_string());
                            agent_tabs.push(tab);
                        }
                        "browser" => {
                            browser_ids.push(id.to_string());
                            browser_tabs.push(tab);
                        }
                        "terminal" | "grid" => {
                            terminal_ids.push(id.to_string());
                            terminal_tabs.push(tab);
                        }
                        _ => {
                            other_ids.push(id.to_string());
                            other_tabs.push(tab);
                        }
                    }
                }

                let build_tab_submenu = |app_handle: &tauri::AppHandle<R>, tab: &serde_json::Value, emoji: &str| -> Result<tauri::menu::Submenu<R>, tauri::Error> {
                    let id = tab.get("id").and_then(|v| v.as_str()).unwrap_or("");
                    let name = tab.get("name").and_then(|v| v.as_str()).unwrap_or("Unnamed Tab");
                    let truncated: String = name.chars().filter(|c| !c.is_control()).take(54).collect();
                    let submenu_title = format!("{} {}", emoji, truncated);
                    
                    SubmenuBuilder::new(app_handle, submenu_title)
                        .item(&MenuItemBuilder::with_id(format!("focus_tab_{}", id), "Focus Tab").build(app_handle)?)
                        .item(&MenuItemBuilder::with_id(format!("close_tab_{}", id), "Close Tab").build(app_handle)?)
                        .build()
                };

                let active_tabs_submenu = SubmenuBuilder::new(app_handle, "Ã°Å¸â€œâ€š Active Tabs").build()?;

                if !agent_tabs.is_empty() {
                    let mut cat_builder = SubmenuBuilder::new(app_handle, format!("Ã°Å¸Â¤â€“ Agents ({})", agent_tabs.len()));
                    for tab in agent_tabs.iter().take(tray_logic::MAX_VISIBLE_TABS_PER_CATEGORY) {
                        if let Ok(sub) = build_tab_submenu(app_handle, tab, "Ã°Å¸Â¤â€“") {
                            cat_builder = cat_builder.item(&sub);
                        }
                    }
                    if agent_ids.len() > tray_logic::MAX_VISIBLE_TABS_PER_CATEGORY {
                        let omitted = agent_ids.len() - tray_logic::MAX_VISIBLE_TABS_PER_CATEGORY;
                        cat_builder = cat_builder.item(
                            &MenuItemBuilder::with_id("more_agent_tabs",
                                format!("{} more tabs: open Dashboard", omitted))
                                .enabled(false).build(app_handle)?
                        );
                    }
                    if agent_ids.len() > 1 {
                        let bulk_id = "close_bulk_agents";
                        cat_builder = cat_builder.separator();
                        if let Ok(bulk_item) = MenuItemBuilder::with_id(bulk_id, "Ã¢ÂÅ’ Close All Agents").build(app_handle) {
                            cat_builder = cat_builder.item(&bulk_item);
                        }
                    }
                    if let Ok(cat_submenu) = cat_builder.build() {
                        active_tabs_submenu.append(&cat_submenu)?;
                    }
                }

                if !browser_tabs.is_empty() {
                    let mut cat_builder = SubmenuBuilder::new(app_handle, format!("Ã°Å¸Å’Â Browsers ({})", browser_tabs.len()));
                    for tab in browser_tabs.iter().take(tray_logic::MAX_VISIBLE_TABS_PER_CATEGORY) {
                        if let Ok(sub) = build_tab_submenu(app_handle, tab, "Ã°Å¸Å’Â") {
                            cat_builder = cat_builder.item(&sub);
                        }
                    }
                    if browser_ids.len() > tray_logic::MAX_VISIBLE_TABS_PER_CATEGORY {
                        let omitted = browser_ids.len() - tray_logic::MAX_VISIBLE_TABS_PER_CATEGORY;
                        cat_builder = cat_builder.item(
                            &MenuItemBuilder::with_id("more_browser_tabs",
                                format!("{} more tabs: open Dashboard", omitted))
                                .enabled(false).build(app_handle)?
                        );
                    }
                    if browser_ids.len() > 1 {
                        let bulk_id = "close_bulk_browsers";
                        cat_builder = cat_builder.separator();
                        if let Ok(bulk_item) = MenuItemBuilder::with_id(bulk_id, "Ã¢ÂÅ’ Close All Browsers").build(app_handle) {
                            cat_builder = cat_builder.item(&bulk_item);
                        }
                    }
                    if let Ok(cat_submenu) = cat_builder.build() {
                        active_tabs_submenu.append(&cat_submenu)?;
                    }
                }

                if !terminal_tabs.is_empty() {
                    let mut cat_builder = SubmenuBuilder::new(app_handle, format!("Ã°Å¸â€™Â» Terminals ({})", terminal_tabs.len()));
                    for tab in terminal_tabs.iter().take(tray_logic::MAX_VISIBLE_TABS_PER_CATEGORY) {
                        if let Ok(sub) = build_tab_submenu(app_handle, tab, "Ã°Å¸â€™Â»") {
                            cat_builder = cat_builder.item(&sub);
                        }
                    }
                    if terminal_ids.len() > tray_logic::MAX_VISIBLE_TABS_PER_CATEGORY {
                        let omitted = terminal_ids.len() - tray_logic::MAX_VISIBLE_TABS_PER_CATEGORY;
                        cat_builder = cat_builder.item(
                            &MenuItemBuilder::with_id("more_terminal_tabs",
                                format!("{} more tabs: open Dashboard", omitted))
                                .enabled(false).build(app_handle)?
                        );
                    }
                    if terminal_ids.len() > 1 {
                        let bulk_id = "close_bulk_terminals";
                        cat_builder = cat_builder.separator();
                        if let Ok(bulk_item) = MenuItemBuilder::with_id(bulk_id, "Ã¢ÂÅ’ Close All Terminals").build(app_handle) {
                            cat_builder = cat_builder.item(&bulk_item);
                        }
                    }
                    if let Ok(cat_submenu) = cat_builder.build() {
                        active_tabs_submenu.append(&cat_submenu)?;
                    }
                }

                if !other_tabs.is_empty() {
                    let mut cat_builder = SubmenuBuilder::new(app_handle, format!("Ã°Å¸â€œâ€ž Files & Diffs ({})", other_tabs.len()));
                    for tab in other_tabs.iter().take(tray_logic::MAX_VISIBLE_TABS_PER_CATEGORY) {
                        if let Ok(sub) = build_tab_submenu(app_handle, tab, "Ã°Å¸â€œâ€ž") {
                            cat_builder = cat_builder.item(&sub);
                        }
                    }
                    if other_ids.len() > tray_logic::MAX_VISIBLE_TABS_PER_CATEGORY {
                        let omitted = other_ids.len() - tray_logic::MAX_VISIBLE_TABS_PER_CATEGORY;
                        cat_builder = cat_builder.item(
                            &MenuItemBuilder::with_id("more_other_tabs",
                                format!("{} more tabs: open Dashboard", omitted))
                                .enabled(false).build(app_handle)?
                        );
                    }
                    if other_ids.len() > 1 {
                        let bulk_id = "close_bulk_other";
                        cat_builder = cat_builder.separator();
                        if let Ok(bulk_item) = MenuItemBuilder::with_id(bulk_id, "Ã¢ÂÅ’ Close All Files").build(app_handle) {
                            cat_builder = cat_builder.item(&bulk_item);
                        }
                    }
                    if let Ok(cat_submenu) = cat_builder.build() {
                        active_tabs_submenu.append(&cat_submenu)?;
                    }
                }

                if all_ids.len() > 1 {
                    let bulk_id = "close_bulk_all";
                    active_tabs_submenu.append(&PredefinedMenuItem::separator(app_handle)?)?;
                    active_tabs_submenu.append(&MenuItemBuilder::with_id(bulk_id, "Ã¢ÂÅ’ Close All Tabs").build(app_handle)?)?;
                }

                menu.append(&PredefinedMenuItem::separator(app_handle)?)?;
                menu.append(&active_tabs_submenu)?;
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
