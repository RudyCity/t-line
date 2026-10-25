//! Managed browser runtime. Only the primary T-Line UI may invoke these commands.
use std::collections::HashMap;
use std::fs;
use std::net::TcpStream;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};
use tauri::Manager;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserAvailability {
    available: bool,
    engine: &'static str,
    executable: Option<String>,
}

fn primary_ui(webview: &tauri::Webview) -> Result<(), String> {
    if webview.label() != "main" {
        return Err("Browser management is restricted to the primary application UI.".into());
    }
    let origin = webview.url().map_err(|_| "Cannot identify UI origin.")?;
    let trusted = match (origin.scheme(), origin.host_str(), origin.port()) {
        ("http", Some("localhost" | "127.0.0.1"), Some(5773 | 5779)) => true,
        ("https", Some("tauri.localhost"), None) => true,
        ("tauri", Some("localhost"), None) => true,
        _ => false,
    };
    if !trusted {
        return Err("Untrusted UI origin.".into());
    }
    Ok(())
}
pub fn valid_profile_id(id: &str) -> bool {
    id.len() <= 40
        && !id.is_empty()
        && id.bytes().enumerate().all(|(i, b)| {
            if i == 0 {
                b.is_ascii_lowercase() || b.is_ascii_digit()
            } else {
                b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-' || b == b'_'
            }
        })
}
fn discover_executable() -> Option<PathBuf> {
    if !cfg!(windows) {
        return None;
    }
    for root in ["PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"] {
        if let Some(base) = std::env::var_os(root) {
            let p = PathBuf::from(base)
                .join("Google")
                .join("Chrome")
                .join("Application")
                .join("chrome.exe");
            if p.is_file() && p.canonicalize().is_ok() {
                return Some(p);
            }
        }
    }
    None
}
fn profile_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    if !valid_profile_id(id) {
        return Err("Invalid managed profile ID.".into());
    }
    let base = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    let profiles = base.join("managed-browser").join("profiles");
    std::fs::create_dir_all(&profiles).map_err(|e| e.to_string())?;
    let root = profiles.canonicalize().map_err(|e| e.to_string())?;
    let target = root.join(id);
    if target.exists()
        && !target
            .canonicalize()
            .map_err(|e| e.to_string())?
            .starts_with(&root)
    {
        return Err("Managed browser path escapes the authorized profile directory.".into());
    }
    Ok(target)
}
#[tauri::command]
pub fn managed_browser_discover(webview: tauri::Webview) -> Result<BrowserAvailability, String> {
    primary_ui(&webview)?;
    let executable = discover_executable();
    Ok(BrowserAvailability {
        available: executable.is_some(),
        engine: "system-chrome",
        executable: executable.map(|p| p.to_string_lossy().into_owned()),
    })
}
#[derive(Default)]
pub struct ManagedBrowserState {
    children: Arc<Mutex<HashMap<String, OwnedBrowser>>>,
}
struct OwnedBrowser {
    child: Child,
    profile_id: String,
    generation: String,
    port: Option<u16>,
}
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserStatus {
    profile_id: String,
    generation: String,
    lifecycle: &'static str,
    debugging_available: bool,
    engine: &'static str,
}
fn status_of(owned: &OwnedBrowser, alive: bool) -> BrowserStatus {
    BrowserStatus {
        profile_id: owned.profile_id.clone(),
        generation: owned.generation.clone(),
        lifecycle: if alive { "ready" } else { "exited" },
        debugging_available: alive && owned.port.is_some(),
        engine: "system-chrome",
    }
}
fn is_alive(owned: &mut OwnedBrowser) -> bool {
    owned.child.try_wait().map(|s| s.is_none()).unwrap_or(false)
}
fn current_status(map: &mut HashMap<String, OwnedBrowser>) -> Vec<BrowserStatus> {
    let mut stopped = Vec::new();
    let mut results = Vec::new();
    for (id, owned) in map.iter_mut() {
        let alive = is_alive(owned);
        results.push(status_of(owned, alive));
        if !alive {
            stopped.push(id.clone());
        }
    }
    for id in stopped {
        map.remove(&id);
    }
    results
}
fn browser_port(profile: &std::path::Path) -> Option<u16> {
    let raw = fs::read_to_string(profile.join("DevToolsActivePort")).ok()?;
    let port: u16 = raw.lines().next()?.trim().parse().ok()?;
    if port < 1024 {
        return None;
    }
    let address = format!("127.0.0.1:{port}").parse().ok()?;
    TcpStream::connect_timeout(&address, Duration::from_millis(200)).ok()?;
    Some(port)
}
#[tauri::command]
pub fn managed_browser_status(
    webview: tauri::Webview,
    state: tauri::State<'_, ManagedBrowserState>,
) -> Result<Vec<BrowserStatus>, String> {
    primary_ui(&webview)?;
    let mut guard = state
        .children
        .lock()
        .map_err(|_| "Browser state unavailable.")?;
    Ok(current_status(&mut guard))
}
fn checked_url(url: Option<String>) -> Result<String, String> {
    let url = url.unwrap_or_else(|| "about:blank".into());
    if url == "about:blank" {
        return Ok(url);
    }
    if url.len() > 2048 || url.chars().any(char::is_control) {
        return Err("Invalid URL.".into());
    }
    let parsed = tauri::Url::parse(&url).map_err(|_| "Invalid URL.")?;
    if !matches!(parsed.scheme(), "http" | "https")
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err(
            "Only plain HTTP(S) URLs without credentials/query/fragment are supported.".into(),
        );
    }
    Ok(url)
}
fn launch_owned(
    app: tauri::AppHandle,
    registry: Arc<Mutex<HashMap<String, OwnedBrowser>>>,
    id: String,
    url: String,
) -> Result<BrowserStatus, String> {
    let executable = discover_executable().ok_or("Installed Chrome is not available.")?;
    let profile = profile_path(&app, &id)?;
    let mut map = registry.lock().map_err(|_| "Browser state unavailable.")?;
    if let Some(existing) = map.get_mut(&id) {
        if is_alive(existing) {
            return Ok(status_of(existing, true));
        }
        map.remove(&id);
    }
    fs::create_dir_all(&profile).map_err(|e| e.to_string())?;
    // A left-over debugging file may indicate a browser managed by another
    // desktop instance. Do not steal/rebind a profile by trusting stale data.
    if profile.join("DevToolsActivePort").exists() {
        return Err(
            "Profile may already be in use. Existing browser ownership cannot be verified.".into(),
        );
    }
    let child = Command::new(executable)
        .arg(format!("--user-data-dir={}", profile.display()))
        .arg("--remote-debugging-port=0")
        .arg("--remote-debugging-address=127.0.0.1")
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .arg("--new-window")
        .arg(url)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Could not launch owned browser: {e}"))?;
    let generation = format!(
        "{}-{}",
        child.id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    );
    let mut entry = OwnedBrowser {
        child,
        profile_id: id.clone(),
        generation,
        port: None,
    };
    let deadline = Instant::now() + Duration::from_secs(8);
    while Instant::now() < deadline {
        if !is_alive(&mut entry) {
            return Err("Browser exited before a verified debugging endpoint was ready.".into());
        }
        if let Some(port) = browser_port(&profile) {
            entry.port = Some(port);
            let result = status_of(&entry, true);
            map.insert(id, entry);
            return Ok(result);
        }
        thread::sleep(Duration::from_millis(150));
    }
    // Retain the owned Child handle so Stop remains available after a timeout.
    let info = status_of(&entry, true);
    map.insert(id, entry);
    Err(format!(
        "Browser started (generation {}) but debugging is not ready. Refresh or Stop.",
        info.generation
    ))
}
#[tauri::command]
pub async fn managed_browser_launch(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    state: tauri::State<'_, ManagedBrowserState>,
    profile_id: String,
    initial_url: Option<String>,
) -> Result<BrowserStatus, String> {
    primary_ui(&webview)?;
    if !valid_profile_id(&profile_id) {
        return Err("Invalid managed profile ID.".into());
    }
    let url = checked_url(initial_url)?;
    let registry = state.children.clone();
    tauri::async_runtime::spawn_blocking(move || launch_owned(app, registry, profile_id, url))
        .await
        .map_err(|_| "Browser supervisor did not return.".to_string())?
}
#[tauri::command]
pub fn managed_browser_stop(
    webview: tauri::Webview,
    state: tauri::State<'_, ManagedBrowserState>,
    profile_id: String,
    generation: String,
) -> Result<(), String> {
    primary_ui(&webview)?;
    let mut map = state
        .children
        .lock()
        .map_err(|_| "Browser state unavailable.")?;
    let entry = map
        .get_mut(&profile_id)
        .ok_or("No owned browser matches this profile.")?;
    if entry.generation != generation {
        return Err("Stale browser generation.".into());
    }
    if !is_alive(entry) {
        map.remove(&profile_id);
        return Ok(());
    }
    // An owned Child handle, never a PID supplied by the UI.
    entry
        .child
        .kill()
        .map_err(|e| format!("Could not stop owned browser: {e}"))?;
    let _ = entry.child.wait();
    map.remove(&profile_id);
    Ok(())
}
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedTarget {
    id: String,
    title: String,
    url: String,
}
fn target_url(raw: &str) -> String {
    tauri::Url::parse(raw)
        .ok()
        .and_then(|mut url| {
            if !matches!(url.scheme(), "http" | "https") {
                return None;
            }
            let _ = url.set_query(None);
            url.set_fragment(None);
            Some(url.to_string())
        })
        .unwrap_or_else(|| "about:blank".to_string())
}
#[tauri::command]
pub fn managed_browser_targets(
    webview: tauri::Webview,
    state: tauri::State<'_, ManagedBrowserState>,
    profile_id: String,
    generation: String,
) -> Result<Vec<ManagedTarget>, String> {
    primary_ui(&webview)?;
    let mut guard = state
        .children
        .lock()
        .map_err(|_| "Browser state unavailable.")?;
    let entry = guard
        .get_mut(&profile_id)
        .ok_or("Managed browser not found.")?;
    if entry.generation != generation || !is_alive(entry) {
        return Err("Browser session is not owned or is stale.".into());
    }
    let port = entry.port.ok_or("Debugging endpoint not ready.")?;
    let response = ureq::get(&format!("http://127.0.0.1:{port}/json/list"))
        .timeout(Duration::from_secs(2))
        .call()
        .map_err(|_| "Browser target discovery unavailable.")?;
    use std::io::Read;
    let mut bounded = String::new();
    response
        .into_reader()
        .take(128 * 1024)
        .read_to_string(&mut bounded)
        .map_err(|_| "Cannot read browser target response.")?;
    let json: serde_json::Value =
        serde_json::from_str(&bounded).map_err(|_| "Invalid browser target response.")?;
    let entries = json.as_array().ok_or("Invalid browser target list.")?;
    Ok(entries
        .iter()
        .filter(|v| v["type"] == "page")
        .take(50)
        .filter_map(|v| {
            let id = v["id"].as_str()?;
            if id.len() > 128
                || !id
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || ch == '-' || ch == '_')
            {
                return None;
            }
            let title = v["title"]
                .as_str()
                .unwrap_or("")
                .chars()
                .take(120)
                .collect();
            Some(ManagedTarget {
                id: id.to_string(),
                title,
                url: target_url(v["url"].as_str().unwrap_or("")),
            })
        })
        .collect())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn profiles_are_always_directory_components() {
        for p in ["", "../user", "a/b", "a\\b", ".hidden", "UPPER"] {
            assert!(!valid_profile_id(p));
        }
        assert!(valid_profile_id("default-managed"));
        assert!(valid_profile_id("research_2"));
    }
    #[test]
    fn redacts_private_url_details() {
        assert_eq!(
            target_url("https://example.com/path?token=secret#private"),
            "https://example.com/path"
        );
        assert_eq!(target_url("file:///private/data"), "about:blank");
    }
    #[test]
    fn refuses_unsafe_launch_urls() {
        assert!(checked_url(Some("https://example.com/".into())).is_ok());
        for url in [
            "file:///C:/private",
            "https://a:secret@b.com",
            "https://b.com/?token=abc",
            "javascript:alert(1)",
        ] {
            assert!(checked_url(Some(url.into())).is_err());
        }
    }
}
