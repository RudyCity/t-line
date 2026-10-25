//! Managed browser runtime. Only the primary T-Line UI may invoke these commands.
use std::collections::HashMap;
use std::fs;

#[cfg(windows)]
use std::os::windows::process::CommandExt;
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
    profile_path: PathBuf,
    ever_ready: bool,
    fingerprint: Option<String>,
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
        lifecycle: if !alive {
            "exited"
        } else if owned.port.is_some() {
            "ready"
        } else if owned.ever_ready {
            "disconnected"
        } else {
            "starting"
        },
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
        if alive {
            // Recheck the browser identity before reporting readiness. A port
            // alone is not proof that Chrome still belongs to this profile.
            match browser_port(&owned.profile_path) {
                Some((port, fingerprint))
                    if (owned.port.is_none() || owned.port == Some(port))
                        && owned
                            .fingerprint
                            .as_ref()
                            .map_or(true, |prior| prior == &fingerprint) =>
                {
                    owned.port = Some(port);
                    owned.fingerprint = Some(fingerprint);
                    owned.ever_ready = true;
                }
                _ => owned.port = None,
            }
        }
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
fn browser_port(profile: &std::path::Path) -> Option<(u16, String)> {
    let raw = fs::read_to_string(profile.join("DevToolsActivePort")).ok()?;
    let port: u16 = raw.lines().next()?.trim().parse().ok()?;
    if port < 1024 {
        return None;
    }
    // Only the matching live browser instance is considered ready. Another
    // process could reuse a port formerly owned by this profile.
    let fingerprint = verified_browser_fingerprint(port, profile).ok()?;
    Some((port, fingerprint))
}
fn verified_owned_port(entry: &mut OwnedBrowser) -> Result<u16, String> {
    if !is_alive(entry) {
        return Err("Owned Chrome process has exited.".into());
    }
    let (port, fingerprint) =
        browser_port(&entry.profile_path).ok_or("Owned Chrome CDP connection is unavailable.")?;
    if entry.port != Some(port) || entry.fingerprint.as_deref() != Some(fingerprint.as_str()) {
        return Err("Managed browser identity changed. Start a fresh verified session.".into());
    }
    Ok(port)
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
fn spawn_owned_chrome(
    executable: &std::path::Path,
    profile: &std::path::Path,
    id: String,
    url: String,
    headless_test: bool,
) -> Result<OwnedBrowser, String> {
    // This executable is selected by installed-browser discovery, never by the
    // renderer or a browser page. Tests use an isolated temporary directory.
    let mut command = Command::new(executable);
    command
        .arg(format!("--user-data-dir={}", profile.display()))
        .arg("--remote-debugging-port=0")
        .arg("--remote-debugging-address=127.0.0.1")
        .arg("--no-first-run")
        .arg("--no-default-browser-check");
    if headless_test {
        command.arg("--headless=new").arg("--disable-extensions");
    } else {
        command.arg("--new-window");
    }
    let child = command
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
    Ok(OwnedBrowser {
        child,
        profile_id: id,
        generation,
        port: None,
        profile_path: profile.to_path_buf(),
        ever_ready: false,
        fingerprint: None,
    })
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
            if verified_owned_port(existing).is_err() {
                existing.port = None;
            }
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
    let mut entry = spawn_owned_chrome(&executable, &profile, id.clone(), url, false)?;
    let deadline = Instant::now() + Duration::from_secs(8);
    while Instant::now() < deadline {
        if !is_alive(&mut entry) {
            return Err("Browser exited before a verified debugging endpoint was ready.".into());
        }
        if let Some((port, fingerprint)) = browser_port(&profile) {
            entry.port = Some(port);
            entry.fingerprint = Some(fingerprint);
            entry.ever_ready = true;
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
fn stop_owned_process(entry: &mut OwnedBrowser) -> Result<(), String> {
    if !is_alive(entry) {
        return Ok(());
    }
    // Only use the PID from the retained live Child handle, never from a UI
    // argument or a scan of the user's existing Chrome processes.
    #[cfg(windows)]
    {
        if let Some(root) = std::env::var_os("SystemRoot") {
            let tool = PathBuf::from(root).join("System32").join("taskkill.exe");
            if tool.is_file() {
                let stopped_tree = Command::new(tool)
                    .args(["/PID", &entry.child.id().to_string(), "/T", "/F"])
                    .creation_flags(0x08000000)
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .status()
                    .is_ok_and(|status| status.success());
                if stopped_tree {
                    let _ = entry.child.wait();
                    return Ok(());
                }
            }
        }
        if !is_alive(entry) {
            return Ok(());
        }
    }
    entry
        .child
        .kill()
        .map_err(|e| format!("Could not stop owned browser: {e}"))?;
    let _ = entry.child.wait();
    Ok(())
}
fn retire_owned_port_file(
    profile: &std::path::Path,
    port: u16,
    expected_fingerprint: &str,
) -> Result<bool, String> {
    let path = profile.join("DevToolsActivePort");
    let meta = match fs::symlink_metadata(&path) {
        Ok(meta) => meta,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(e) => return Err(e.to_string()),
    };
    if !meta.file_type().is_file() || meta.len() > 512 {
        return Err("Unsafe browser endpoint marker was not removed.".into());
    }
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let mut lines = content.lines();
    if lines.next().and_then(|p| p.parse::<u16>().ok()) != Some(port) {
        return Ok(false);
    }
    let id = lines.next().unwrap_or("");
    let digest = ring::digest::digest(&ring::digest::SHA256, id.as_bytes());
    let fingerprint: String = digest.as_ref().iter().map(|b| format!("{b:02x}")).collect();
    if fingerprint != expected_fingerprint || browser_port(profile).is_some() {
        return Ok(false);
    }
    fs::remove_file(path).map_err(|e| e.to_string())?;
    Ok(true)
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
    stop_owned_process(entry)?;
    // Only remove a marker matching the exact browser this desktop launched;
    // crash leftovers from unrelated live browsers are never silently erased.
    if let (Some(port), Some(fingerprint)) = (entry.port, entry.fingerprint.as_deref()) {
        let _ = retire_owned_port_file(&entry.profile_path, port, fingerprint);
    }
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
/// Debugging port is shared only after an explicit operator pairing request.
/// It is *not* a credential; access to loopback CDP must remain local and protected.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GatewayPairing {
    profile_id: String,
    generation: String,
    port: u16,
    target_id: String,
    transport: &'static str,
}
fn target_url(raw: &str) -> String {
    tauri::Url::parse(raw)
        .ok()
        .and_then(|mut url| {
            if !matches!(url.scheme(), "http" | "https") {
                return None;
            }
            let _ = url.set_username("");
            let _ = url.set_password(None);
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
    if entry.generation != generation {
        return Err("Browser session is not owned or is stale.".into());
    }
    let port = verified_owned_port(entry)?;
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
/// Strict browser + generation + *real page target* pairing. A tab title or a
/// caller-selected port is never used as proof that the desktop owns Chrome.
#[tauri::command]
pub fn managed_browser_gateway_pairing(
    webview: tauri::Webview,
    state: tauri::State<'_, ManagedBrowserState>,
    profile_id: String,
    generation: String,
    target_id: String,
) -> Result<GatewayPairing, String> {
    primary_ui(&webview)?;
    if target_id.len() > 128
        || target_id.is_empty()
        || !target_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_' || b == b'-')
    {
        return Err("Invalid target identifier.".into());
    }
    let mut guard = state
        .children
        .lock()
        .map_err(|_| "Browser state unavailable.")?;
    let entry = guard
        .get_mut(&profile_id)
        .ok_or("No owned browser matches the profile.")?;
    if entry.generation != generation {
        return Err("Browser runtime changed; refresh before pairing.".into());
    }
    let port = verified_owned_port(entry)?;
    let response = ureq::get(&format!("http://127.0.0.1:{port}/json/list"))
        .timeout(Duration::from_secs(2))
        .call()
        .map_err(|_| "CDP discovery unavailable.")?;
    use std::io::Read;
    let mut body = String::new();
    response
        .into_reader()
        .take(128 * 1024)
        .read_to_string(&mut body)
        .map_err(|_| "Cannot read managed browser targets.")?;
    let json: serde_json::Value =
        serde_json::from_str(&body).map_err(|_| "Invalid CDP response.")?;
    if !json.as_array().is_some_and(|pages| {
        pages
            .iter()
            .any(|page| page["type"] == "page" && page["id"].as_str() == Some(target_id.as_str()))
    }) {
        return Err("Target is no longer present in this owned browser.".into());
    }
    Ok(GatewayPairing {
        profile_id,
        generation,
        port,
        target_id,
        transport: "superagent_browser_gateway",
    })
}
/// Register a verified, currently-owned browser target directly from Rust.
/// The local Core service credential is never returned to React.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrationReceipt {
    registered: bool,
    expires_at: u64,
}
fn local_core_token() -> Result<String, String> {
    let home = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .ok_or("User home directory unavailable.")?;
    let info_path = std::path::PathBuf::from(home)
        .join(".superagent-r")
        .join("server-info-7888.json");
    let metadata =
        fs::symlink_metadata(&info_path).map_err(|_| "Core service information unavailable.")?;
    if !metadata.file_type().is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() > 16_384
    {
        return Err("Untrusted Core service information file.".into());
    }
    let contents =
        fs::read_to_string(info_path).map_err(|_| "Core service information unreadable.")?;
    let data: serde_json::Value =
        serde_json::from_str(&contents).map_err(|_| "Invalid Core service information.")?;
    if data["port"] != 7888 {
        return Err("Core service port is not the expected local port.".into());
    }
    let token = data["authToken"]
        .as_str()
        .ok_or("Core service credential unavailable.")?;
    if token.len() != 48 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("Invalid Core service credential format.".into());
    }
    Ok(token.to_string())
}
fn owned_browser_fingerprint(
    port: u16,
    owned_port: u16,
    expected: &str,
    websocket: &str,
) -> Result<String, String> {
    if owned_port != port {
        return Err("Owned browser debugging port changed.".into());
    }
    let guid = expected
        .strip_prefix("/devtools/browser/")
        .ok_or("Invalid owned browser identity path.")?;
    if guid.len() != 36 || !guid.bytes().all(|b| b.is_ascii_hexdigit() || b == b'-') {
        return Err("Invalid owned browser identity path.".into());
    }
    let url = tauri::Url::parse(websocket).map_err(|_| "Invalid browser identity URL.")?;
    if url.scheme() != "ws"
        || url.host_str() != Some("127.0.0.1")
        || url.port() != Some(port)
        || url.path() != expected
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Managed browser identity does not match the owned profile.".into());
    }
    let fingerprint = ring::digest::digest(&ring::digest::SHA256, expected.as_bytes());
    Ok(fingerprint
        .as_ref()
        .iter()
        .map(|b| format!("{b:02x}"))
        .collect())
}
fn verified_browser_fingerprint(port: u16, profile: &std::path::Path) -> Result<String, String> {
    let active = fs::read_to_string(profile.join("DevToolsActivePort"))
        .map_err(|_| "Managed browser no longer has an active profile endpoint.")?;
    let mut lines = active.lines();
    let owned_port = lines
        .next()
        .unwrap_or("")
        .trim()
        .parse::<u16>()
        .map_err(|_| "Invalid owned browser debugging port.")?;
    let expected = lines.next().unwrap_or("").trim();
    let response = ureq::get(&format!("http://127.0.0.1:{port}/json/version"))
        .timeout(Duration::from_secs(2))
        .call()
        .map_err(|_| "Browser identity endpoint unavailable.")?;
    use std::io::Read;
    let mut body = String::new();
    response
        .into_reader()
        .take(8192)
        .read_to_string(&mut body)
        .map_err(|_| "Cannot inspect browser identity.")?;
    let data: serde_json::Value =
        serde_json::from_str(&body).map_err(|_| "Invalid browser identity response.")?;
    let websocket = data["webSocketDebuggerUrl"]
        .as_str()
        .ok_or("Missing CDP browser identity.")?;
    owned_browser_fingerprint(port, owned_port, expected, websocket)
}
fn register_with_core(
    pair: GatewayPairing,
    profile: PathBuf,
) -> Result<RegistrationReceipt, String> {
    let fingerprint = verified_browser_fingerprint(pair.port, &profile)?;
    let token = local_core_token()?;
    let payload = serde_json::json!({
        "profileId": pair.profile_id, "generation": pair.generation,
        "port": pair.port, "targetId": pair.target_id, "browserFingerprint": fingerprint
    });
    let response = ureq::post("http://127.0.0.1:7888/api/browser/managed/register")
        .set("Authorization", &format!("Bearer {token}"))
        .set("Content-Type", "application/json")
        .timeout(Duration::from_secs(4))
        .send_string(&payload.to_string())
        .map_err(|_| "Authenticated local Core browser registration unavailable.")?;
    use std::io::Read;
    let mut body = String::new();
    response
        .into_reader()
        .take(4096)
        .read_to_string(&mut body)
        .map_err(|_| "Could not read local Core registration response.")?;
    let result: serde_json::Value =
        serde_json::from_str(&body).map_err(|_| "Invalid Core registration response.")?;
    let expires = result["registration"]["expiresAt"]
        .as_u64()
        .ok_or("Core response did not confirm registration expiry.")?;
    if result["success"] != true {
        return Err("Core did not confirm target registration.".into());
    }
    Ok(RegistrationReceipt {
        registered: true,
        expires_at: expires,
    })
}
#[tauri::command]
pub async fn managed_browser_gateway_register(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    state: tauri::State<'_, ManagedBrowserState>,
    profile_id: String,
    generation: String,
    target_id: String,
) -> Result<RegistrationReceipt, String> {
    let verified =
        managed_browser_gateway_pairing(webview, state, profile_id, generation, target_id)?;
    let profile = profile_path(&app, &verified.profile_id)?;
    tauri::async_runtime::spawn_blocking(move || register_with_core(verified, profile))
        .await
        .map_err(|_| "Local Core registration worker failed.".to_string())?
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
        assert_eq!(
            target_url("https://person:password@example.com/items?key=secret"),
            "https://example.com/items"
        );
    }
    #[test]
    fn rejects_reused_or_untrusted_browser_identity() {
        let path = "/devtools/browser/01234567-89ab-cdef-0123-456789abcdef";
        let valid = "ws://127.0.0.1:53331/devtools/browser/01234567-89ab-cdef-0123-456789abcdef";
        let fingerprint = owned_browser_fingerprint(53331, 53331, path, valid).unwrap();
        assert_eq!(fingerprint.len(), 64);
        for (owned_port, url) in [
            (53332, valid),
            (
                53331,
                "ws://127.0.0.1:53332/devtools/browser/01234567-89ab-cdef-0123-456789abcdef",
            ),
            (
                53331,
                "ws://evil.example:53331/devtools/browser/01234567-89ab-cdef-0123-456789abcdef",
            ),
            (
                53331,
                "ws://127.0.0.1:53331/devtools/browser/ffffffff-ffff-ffff-ffff-ffffffffffff",
            ),
        ] {
            assert!(owned_browser_fingerprint(53331, owned_port, path, url).is_err());
        }
    }
    #[test]
    #[cfg(windows)]
    #[ignore = "Opt-in installed Windows Chrome native process smoke"]
    fn real_owned_chrome_lifecycle_smoke() {
        let executable = discover_executable().expect("Installed Chrome required");
        let unique = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let profile = std::env::temp_dir().join(format!(
            "tline-native-browser-smoke-{}-{unique}",
            std::process::id()
        ));
        fs::create_dir(&profile).expect("isolated temporary profile");
        struct Cleanup {
            profile: PathBuf,
            browser: Option<OwnedBrowser>,
        }
        impl Drop for Cleanup {
            fn drop(&mut self) {
                if let Some(browser) = self.browser.as_mut() {
                    let _ = stop_owned_process(browser);
                }
                for _ in 0..15 {
                    if fs::remove_dir_all(&self.profile).is_ok() || !self.profile.exists() {
                        break;
                    }
                    thread::sleep(Duration::from_millis(150));
                }
            }
        }
        let mut cleanup = Cleanup {
            profile: profile.clone(),
            browser: None,
        };
        cleanup.browser = Some(
            spawn_owned_chrome(
                &executable,
                &profile,
                "native-smoke".to_string(),
                "about:blank".to_string(),
                true,
            )
            .expect("start isolated owned Chrome"),
        );
        let deadline = Instant::now() + Duration::from_secs(15);
        let (port, fingerprint) = loop {
            let entry = cleanup.browser.as_mut().unwrap();
            assert!(is_alive(entry), "owned Chrome exited during startup");
            if let Some((port, fingerprint)) = browser_port(&profile) {
                break (port, fingerprint);
            }
            assert!(Instant::now() < deadline, "Chrome CDP never became ready");
            thread::sleep(Duration::from_millis(180));
        };
        {
            let entry = cleanup.browser.as_mut().unwrap();
            entry.port = Some(port);
            entry.fingerprint = Some(fingerprint.clone());
            entry.ever_ready = true;
            assert_eq!(verified_owned_port(entry).unwrap(), port);
            assert_eq!(status_of(entry, true).lifecycle, "ready");
        }
        assert!(
            !retire_owned_port_file(&profile, port, &fingerprint).unwrap(),
            "must never remove an active profile endpoint"
        );
        stop_owned_process(cleanup.browser.as_mut().unwrap()).expect("stop only spawned Chrome");
        let closed = Instant::now() + Duration::from_secs(6);
        while browser_port(&profile).is_some() && Instant::now() < closed {
            thread::sleep(Duration::from_millis(180));
        }
        assert!(
            browser_port(&profile).is_none(),
            "owned Chrome tree left CDP active after stop"
        );
        let _ = retire_owned_port_file(&profile, port, &fingerprint);
        assert!(
            !profile.join("DevToolsActivePort").exists(),
            "only the confirmed stopped profile marker should be retired"
        );
    }
    #[test]
    fn stale_profile_marker_cleanup_requires_exact_owned_identity() {
        let name = format!("tline-native-marker-{}", std::process::id());
        let profile = std::env::temp_dir().join(name);
        fs::create_dir_all(&profile).unwrap();
        let file = profile.join("DevToolsActivePort");
        let browser_path = "/devtools/browser/01234567-89ab-cdef-0123-456789abcdef";
        fs::write(&file, format!("54321\n{browser_path}\n")).unwrap();
        assert!(!retire_owned_port_file(&profile, 54321, &"0".repeat(64)).unwrap());
        assert!(file.exists(), "unowned profile marker must stay intact");
        let hash = ring::digest::digest(&ring::digest::SHA256, browser_path.as_bytes());
        let fingerprint: String = hash
            .as_ref()
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect();
        // No matching browser responds at this test marker, so removing it is
        // allowed *only* when the caller provides the exact prior identity.
        assert!(retire_owned_port_file(&profile, 54321, &fingerprint).unwrap());
        assert!(!file.exists());
        let _ = fs::remove_dir_all(profile);
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
