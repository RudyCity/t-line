//! Owned Chromium-family process registry and lifecycle.
//!
//! Exactly one process per profile is owned by this desktop instance. The
//! retained `Child` handle is the only authority used to stop a browser; the
//! user's own browsers are never scanned, adopted, or killed.
use crate::browser::identity;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

pub struct OwnedBrowser {
    pub child: Child,
    pub engine_id: String,
    pub engine_name: String,
    pub profile_id: String,
    pub generation: String,
    pub port: Option<u16>,
    pub fingerprint: Option<String>,
    pub profile_path: PathBuf,
    pub ever_ready: bool,
    pub docked: bool,
    pub hwnd: Option<isize>,
}

#[derive(Default, Clone)]
pub struct BrowserState {
    pub(crate) sessions: Arc<Mutex<HashMap<String, OwnedBrowser>>>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserSessionStatus {
    pub profile_id: String,
    pub generation: String,
    pub lifecycle: &'static str,
    pub debugging_available: bool,
    pub engine_id: String,
    pub engine_name: String,
    pub docked: bool,
}

impl OwnedBrowser {
    pub fn is_alive(&mut self) -> bool {
        self.child
            .try_wait()
            .map(|status| status.is_none())
            .unwrap_or(false)
    }
}

fn lifecycle_label(alive: bool, port: Option<u16>, ever_ready: bool) -> &'static str {
    if !alive {
        "exited"
    } else if port.is_some() {
        "ready"
    } else if ever_ready {
        "disconnected"
    } else {
        "starting"
    }
}

pub(crate) fn status_of(owned: &OwnedBrowser, alive: bool) -> BrowserSessionStatus {
    BrowserSessionStatus {
        profile_id: owned.profile_id.clone(),
        generation: owned.generation.clone(),
        lifecycle: lifecycle_label(alive, owned.port, owned.ever_ready),
        debugging_available: alive && owned.port.is_some(),
        engine_id: owned.engine_id.clone(),
        engine_name: owned.engine_name.clone(),
        docked: owned.docked,
    }
}

pub fn lock_state(
    state: &BrowserState,
) -> Result<std::sync::MutexGuard<'_, HashMap<String, OwnedBrowser>>, String> {
    state
        .sessions
        .lock()
        .map_err(|_| "Browser state is unavailable.".to_string())
}

/// Revalidates every live entry and retires only markers that still belong to us.
pub fn snapshot(state: &BrowserState) -> Result<Vec<BrowserSessionStatus>, String> {
    let mut guard = lock_state(state)?;
    let mut results = Vec::new();
    let mut retired = Vec::new();
    for (id, owned) in guard.iter_mut() {
        let alive = owned.is_alive();
        if alive {
            match identity::read_active_marker(&owned.profile_path) {
                Some((port, _)) if owned.port.is_none() || owned.port == Some(port) => {
                    match identity::verified_fingerprint(port, &owned.profile_path) {
                        Ok(fingerprint)
                            if owned
                                .fingerprint
                                .as_deref()
                                .map_or(true, |previous| previous == fingerprint) =>
                        {
                            owned.port = Some(port);
                            owned.fingerprint = Some(fingerprint);
                            owned.ever_ready = true;
                        }
                        _ => owned.port = None,
                    }
                }
                _ => owned.port = None,
            }
        }
        results.push(status_of(owned, alive));
        if !alive {
            retired.push(id.clone());
        }
    }
    for id in retired {
        if let Some(owned) = guard.remove(&id) {
            if let (Some(port), Some(fingerprint)) = (owned.port, owned.fingerprint.clone()) {
                let _ = identity::retire_marker(&owned.profile_path, port, &fingerprint);
            }
        }
    }
    Ok(results)
}

/// The exact loopback port for an owned generation, cross-checked every call.
pub fn verified_port(
    state: &BrowserState,
    profile_id: &str,
    generation: &str,
) -> Result<(u16, String), String> {
    let mut guard = lock_state(state)?;
    let owned = guard
        .get_mut(profile_id)
        .ok_or("No owned browser matches this profile.")?;
    if owned.generation != generation {
        return Err("Browser runtime changed; refresh before continuing.".into());
    }
    if !owned.is_alive() {
        return Err("The owned browser process has exited.".into());
    }
    let (port, _) = identity::read_active_marker(&owned.profile_path)
        .ok_or("The owned browser debugging endpoint is unavailable.")?;
    let fingerprint = identity::verified_fingerprint(port, &owned.profile_path)?;
    if owned.port != Some(port) || owned.fingerprint.as_deref() != Some(fingerprint.as_str()) {
        return Err("Browser identity changed. Start a fresh verified session.".into());
    }
    Ok((port, fingerprint))
}

pub fn set_docked(
    state: &BrowserState,
    profile_id: &str,
    generation: &str,
    docked: bool,
    hwnd: Option<isize>,
) -> Result<(), String> {
    let mut guard = lock_state(state)?;
    let owned = guard
        .get_mut(profile_id)
        .ok_or("No owned browser matches this profile.")?;
    if owned.generation != generation {
        return Err("Browser runtime changed.".into());
    }
    owned.docked = docked;
    owned.hwnd = hwnd;
    Ok(())
}

pub fn owned_hwnd(
    state: &BrowserState,
    profile_id: &str,
    generation: &str,
) -> Result<Option<isize>, String> {
    let guard = lock_state(state)?;
    let owned = guard
        .get(profile_id)
        .ok_or("No owned browser matches this profile.")?;
    if owned.generation != generation {
        return Err("Browser runtime changed.".into());
    }
    Ok(owned.hwnd)
}

fn stop_process(owned: &mut OwnedBrowser) -> Result<(), String> {
    if !owned.is_alive() {
        return Ok(());
    }
    #[cfg(windows)]
    {
        if let Some(root) = std::env::var_os("SystemRoot") {
            let tool = PathBuf::from(root).join("System32").join("taskkill.exe");
            if tool.is_file() {
                use std::os::windows::process::CommandExt;
                let mut command = Command::new(tool);
                command
                    .args(["/PID", &owned.child.id().to_string(), "/T", "/F"])
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .creation_flags(0x08000000);
                if command.status().is_ok_and(|status| status.success()) {
                    let _ = owned.child.wait();
                    return Ok(());
                }
            }
        }
    }
    owned
        .child
        .kill()
        .map_err(|error| format!("Could not stop the owned browser: {error}"))?;
    let _ = owned.child.wait();
    Ok(())
}

pub fn stop(state: &BrowserState, profile_id: &str, generation: &str) -> Result<(), String> {
    let mut guard = lock_state(state)?;
    let entry = guard
        .get_mut(profile_id)
        .ok_or("No owned browser matches this profile.")?;
    if entry.generation != generation {
        return Err("Stale browser generation.".into());
    }
    if let Some(hwnd) = entry.hwnd.take() {
        crate::browser::dock::detach(hwnd);
    }
    stop_process(entry)?;
    if let (Some(port), Some(fingerprint)) = (entry.port, entry.fingerprint.clone()) {
        let _ = identity::retire_marker(&entry.profile_path, port, &fingerprint);
    }
    guard.remove(profile_id);
    Ok(())
}

/// App-exit cleanup applies only to Child handles created by this instance.
pub fn shutdown_all(state: &BrowserState) {
    let Ok(mut guard) = state.sessions.lock() else {
        return;
    };
    for owned in guard.values_mut() {
        if let Some(hwnd) = owned.hwnd.take() {
            crate::browser::dock::detach(hwnd);
        }
        let _ = stop_process(owned);
        if let (Some(port), Some(fingerprint)) = (owned.port, owned.fingerprint.clone()) {
            let _ = identity::retire_marker(&owned.profile_path, port, &fingerprint);
        }
    }
    guard.clear();
}

/// Waits for a freshly spawned browser to publish a verified loopback endpoint.
pub fn await_endpoint(profile: &std::path::Path, timeout: Duration) -> Option<(u16, String)> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if let Some((port, _)) = identity::read_active_marker(profile) {
            if let Ok(fingerprint) = identity::verified_fingerprint(port, profile) {
                return Some((port, fingerprint));
            }
        }
        thread::sleep(Duration::from_millis(120));
    }
    None
}

#[cfg(test)]
mod tests {
    use super::lifecycle_label;

    #[test]
    fn lifecycle_labels_cover_all_states() {
        assert_eq!(lifecycle_label(true, None, false), "starting");
        assert_eq!(lifecycle_label(true, None, true), "disconnected");
        assert_eq!(lifecycle_label(true, Some(9222), false), "ready");
        assert_eq!(lifecycle_label(false, Some(9222), true), "exited");
    }
}

#[derive(serde::Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct BrowserTelemetry {
    pub pid: u32,
    pub rss_bytes: u64,
    pub cpu_percent: f32,
}

/// Memory and CPU for the exact owned browser process. Read-only sampling.
pub fn process_telemetry(state: &BrowserState, profile_id: &str) -> Result<Option<BrowserTelemetry>, String> {
    let mut guard = lock_state(state)?;
    let Some(owned) = guard.get_mut(profile_id) else {
        return Ok(None);
    };
    if !owned.is_alive() {
        return Ok(None);
    }
    let pid = owned.child.id();
    let mut system = sysinfo::System::new();
    system.refresh_process_specifics(
        sysinfo::Pid::from(pid as usize),
        sysinfo::ProcessRefreshKind::new().with_memory().with_cpu(),
    );
    Ok(system.process(sysinfo::Pid::from(pid as usize)).map(|process| BrowserTelemetry {
        pid,
        rss_bytes: process.memory(),
        cpu_percent: process.cpu_usage(),
    }))
}