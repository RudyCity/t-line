//! Real installed-browser launch and owned-profile supervision.
//!
//! The embedded surface is a genuine browser process (`--app` window with its
//! own isolated profile). Rendering, input, media, zoom, find-in-page and
//! DevTools all come from that real engine; T-Line never proxies pixels.
use crate::browser::{dock, engine, identity, session::BrowserState, session::OwnedBrowser};
use crate::browser::session::BrowserSessionStatus;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

pub struct LaunchRequest {
    pub engine_id: Option<String>,
    pub profile_id: String,
    pub url: String,
    pub docked: bool,
}

fn profile_arg(profile: &Path) -> String {
    format!("--user-data-dir={}", profile.display())
}

/// Pure, testable argument list. Every value is passed as a separate argument;
/// nothing is ever interpolated into a shell command line.
pub(crate) fn launch_args(profile: &Path, url: &str, docked: bool) -> Vec<String> {
    let mut args = vec![
        profile_arg(profile),
        "--remote-debugging-port=0".to_string(),
        "--remote-debugging-address=127.0.0.1".to_string(),
        "--no-first-run".to_string(),
        "--no-default-browser-check".to_string(),
        "--disable-background-networking".to_string(),
        "--disable-sync".to_string(),
        "--window-size=1280,860".to_string(),
        format!("--app={url}"),
    ];
    if docked {
        // Hidden until the trusted UI reports the real dock bounds.
        args.push("--window-position=-32000,-32000".to_string());
        args.push("--window-size=800,600".to_string());
    } else {
        args.push("--window-position=140,90".to_string());
    }
    args
}

fn spawn(executable: &Path, profile: &Path, url: &str, docked: bool) -> Result<std::process::Child, String> {
    let mut command = Command::new(executable);
    command
        .args(launch_args(profile, url, docked))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command
        .spawn()
        .map_err(|error| format!("Could not launch the installed browser: {error}"))
}

fn find_window(pid: u32) -> Option<isize> {
    let deadline = Instant::now() + Duration::from_secs(6);
    while Instant::now() < deadline {
        if let Some(hwnd) = dock::find_chromium_window(pid) {
            return Some(hwnd);
        }
        std::thread::sleep(Duration::from_millis(120));
    }
    None
}

/// Launches (or returns) the owned browser for one profile.
pub fn launch(
    app: &tauri::AppHandle,
    state: &BrowserState,
    request: LaunchRequest,
    parent: Option<isize>,
) -> Result<BrowserSessionStatus, String> {
    let resolved = engine::resolve(request.engine_id.as_deref())?;
    let profile: PathBuf = identity::profile_path(app, &request.profile_id)?;

    {
        let mut guard = crate::browser::session::lock_state(state)?;
        if let Some(existing) = guard.get_mut(&request.profile_id) {
            if existing.is_alive() {
                return Ok(crate::browser::session_status_of(existing, true));
            }
            guard.remove(&request.profile_id);
        }
    }

    fs::create_dir_all(&profile).map_err(|error| error.to_string())?;
    // A leftover marker means another process may own the profile. Never steal it.
    if profile.join("DevToolsActivePort").exists() {
        return Err(
            "This profile may already be in use by another browser. Stop it or pick a fresh profile."
                .into(),
        );
    }

    let child = spawn(Path::new(&resolved.executable), &profile, &request.url, request.docked)?;
    let pid = child.id();
    let generation = format!(
        "{pid}-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let mut owned = OwnedBrowser {
        child,
        engine_id: resolved.id,
        engine_name: resolved.name,
        profile_id: request.profile_id.clone(),
        generation,
        port: None,
        fingerprint: None,
        profile_path: profile.clone(),
        ever_ready: false,
        docked: false,
        hwnd: None,
    };

    let Some((port, fingerprint)) = crate::browser::session::await_endpoint(&profile, Duration::from_secs(12)) else {
        // Keep the owned handle so the caller can always stop it.
        let status = crate::browser::session_status_of(&owned, true);
        let mut guard = crate::browser::session::lock_state(state)?;
        guard.insert(request.profile_id, owned);
        return Err(format!(
            "Browser started (generation {}) but its verified debugging endpoint did not appear. Stop or retry.",
            status.generation
        ));
    };
    owned.port = Some(port);
    owned.fingerprint = Some(fingerprint);
    owned.ever_ready = true;

    if request.docked {
        let Some(parent_hwnd) = parent else {
            return Err("Embedded browsing is not available in this window.".into());
        };
        let Some(child_hwnd) = find_window(pid) else {
            let mut guard = crate::browser::session::lock_state(state)?;
            guard.insert(request.profile_id, owned);
            return Err(
                "The browser window did not appear in time. Use Stop and relaunch.".into(),
            );
        };
        dock::attach(parent_hwnd, child_hwnd)?;
        owned.docked = true;
        owned.hwnd = Some(child_hwnd);
    }

    let status = crate::browser::session_status_of(&owned, true);
    let mut guard = crate::browser::session::lock_state(state)?;
    guard.insert(request.profile_id, owned);
    Ok(status)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn launch_arguments_are_isolated_and_loopback_only() {
        let profile = Path::new("C:\\profiles\\default-managed");
        let args = launch_args(profile, "https://example.com/?q=1#x", true);
        assert!(args.iter().any(|arg| arg.starts_with("--user-data-dir=")));
        assert!(args.iter().any(|arg| arg == "--remote-debugging-port=0"));
        assert!(args.iter().any(|arg| arg == "--remote-debugging-address=127.0.0.1"));
        assert!(args.iter().any(|arg| arg == "--app=https://example.com/?q=1#x"));
        // The address is one argument, never spliced into a shell string.
        assert!(args.iter().all(|arg| !arg.contains("& ") && !arg.contains("|")));
    }

    #[test]
    fn undocked_launches_are_visible_on_screen() {
        let args = launch_args(Path::new("/tmp/p"), "about:blank", false);
        assert!(args.iter().any(|arg| arg == "--window-position=140,90"));
        assert!(!args.iter().any(|arg| arg == "--window-position=-32000,-32000"));
    }
}
