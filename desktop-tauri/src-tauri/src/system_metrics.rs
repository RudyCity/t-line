//! Desktop memory telemetry command, extracted from `lib.rs`.
use crate::state::DesktopState;

#[tauri::command]
pub fn get_memory_usage(state: tauri::State<'_, DesktopState>) -> Result<serde_json::Value, String> {
    use sysinfo::{Pid, ProcessRefreshKind};

    let mut sys = state.sys.lock().unwrap();
    // Refresh the process list structure (no memory info) to add/remove processes
    sys.refresh_processes_specifics(ProcessRefreshKind::new());

    let current_pid = Pid::from(std::process::id() as usize);

    let mut backend_pid_val = None;
    if let Some(child) = &*state.backend_child.lock().unwrap() {
        backend_pid_val = Some(Pid::from(child.id() as usize));
    }

    // Pre-allocate map with expected capacity to minimize re-allocations
    let processes = sys.processes();
    let mut parent_to_children: std::collections::HashMap<Pid, Vec<Pid>> = std::collections::HashMap::with_capacity(processes.len() / 2);
    for (&pid, process) in processes {
        if let Some(parent) = process.parent() {
            parent_to_children.entry(parent).or_default().push(pid);
        }
    }

    // Pre-allocate tracking collections to reduce overhead
    let mut webview_pids = std::collections::HashSet::with_capacity(32);
    let mut stack = Vec::with_capacity(32);
    let mut visited = std::collections::HashSet::with_capacity(32);

    stack.push(current_pid);
    visited.insert(current_pid);

    while let Some(current) = stack.pop() {
        if let Some(children) = parent_to_children.get(&current) {
            for &child in children {
                if let Some(backend_pid) = backend_pid_val {
                    if child == backend_pid {
                        continue;
                    }
                }
                if visited.insert(child) {
                    webview_pids.insert(child);
                    stack.push(child);
                }
            }
        }
    }

    // Refresh memory specifically only for the targeted processes we care about
    sys.refresh_process_specifics(current_pid, ProcessRefreshKind::new().with_memory());
    let mut main_memory: u64 = 0;
    if let Some(process) = sys.process(current_pid) {
        main_memory = process.memory();
    }

    let mut webview_memory: u64 = 0;
    for pid in &webview_pids {
        sys.refresh_process_specifics(*pid, ProcessRefreshKind::new().with_memory());
        if let Some(process) = sys.process(*pid) {
            webview_memory += process.memory();
        }
    }

    Ok(serde_json::json!({
        "desktopRss": main_memory,
        "webviewTotal": webview_memory,
        "desktopTotal": main_memory + webview_memory
    }))
}
