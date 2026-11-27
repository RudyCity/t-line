//! Owned profile identity: marker parsing, CDP fingerprint, and target listing.
//!
//! A debugging port alone never proves ownership. The `DevToolsActivePort`
//! marker is cross-checked against the live `/json/version` identity and the
//! resulting SHA-256 fingerprint is revalidated on every privileged action.
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tauri::Manager;

const MAX_HTTP_BYTES: u64 = 128 * 1024;
const MAX_MARKER_BYTES: u64 = 512;
const MAX_TARGETS: usize = 50;

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrowserTarget {
    pub id: String,
    pub title: String,
    pub url: String,
    pub devtools_url: String,
}

pub fn valid_profile_id(id: &str) -> bool {
    id.len() <= 40
        && !id.is_empty()
        && id.bytes().enumerate().all(|(index, byte)| {
            if index == 0 {
                byte.is_ascii_lowercase() || byte.is_ascii_digit()
            } else {
                byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-' || byte == b'_'
            }
        })
}

/// Profile directories live under the Tauri local app data folder and can never
/// resolve outside it, even through a crafted profile identifier.
pub fn profile_path(app: &tauri::AppHandle, id: &str) -> Result<PathBuf, String> {
    if !valid_profile_id(id) {
        return Err("Invalid browser profile identifier.".into());
    }
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    let profiles = base.join("managed-browser").join("profiles");
    fs::create_dir_all(&profiles).map_err(|error| error.to_string())?;
    let root = profiles.canonicalize().map_err(|error| error.to_string())?;
    let target = root.join(id);
    if target.exists() {
        let canonical = target.canonicalize().map_err(|error| error.to_string())?;
        if !canonical.starts_with(&root) {
            return Err("Browser profile path escapes the authorized directory.".into());
        }
    }
    Ok(target)
}

/// `DevToolsActivePort` holds the live loopback port and the browser-level path.
pub fn read_active_marker(profile: &Path) -> Option<(u16, String)> {
    let path = profile.join("DevToolsActivePort");
    let metadata = fs::symlink_metadata(&path).ok()?;
    if !metadata.file_type().is_file() || metadata.len() > MAX_MARKER_BYTES {
        return None;
    }
    let raw = fs::read_to_string(path).ok()?;
    let mut lines = raw.lines();
    let port: u16 = lines.next()?.trim().parse().ok()?;
    let browser_path = lines.next()?.trim().to_string();
    if port < 1024 || !browser_path.starts_with("/devtools/browser/") {
        return None;
    }
    Some((port, browser_path))
}

fn http_json(port: u16, route: &str, timeout: Duration) -> Result<serde_json::Value, String> {
    if port < 1024 {
        return Err("Invalid local debugging port.".into());
    }
    let response = ureq::get(&format!("http://127.0.0.1:{port}{route}"))
        .timeout(timeout)
        .call()
        .map_err(|_| "Local browser endpoint unavailable.".to_string())?;
    let mut body = String::new();
    response
        .into_reader()
        .take(MAX_HTTP_BYTES)
        .read_to_string(&mut body)
        .map_err(|_| "Cannot read local browser response.".to_string())?;
    serde_json::from_str(&body).map_err(|_| "Invalid local browser response.".to_string())
}

/// Fingerprint of the browser-level CDP identity (`sha256` of its path).
pub fn verified_fingerprint(port: u16, profile: &Path) -> Result<String, String> {
    let (owned_port, expected) = read_active_marker(profile)
        .ok_or("This profile has no active, owned debugging endpoint.")?;
    if owned_port != port {
        return Err("The owned debugging port changed unexpectedly.".into());
    }
    let version = http_json(port, "/json/version", Duration::from_secs(2))?;
    let websocket = version["webSocketDebuggerUrl"]
        .as_str()
        .ok_or("Missing browser identity endpoint.")?;
    let parsed = tauri::Url::parse(websocket).map_err(|_| "Invalid browser identity URL.")?;
    let guid = expected
        .strip_prefix("/devtools/browser/")
        .ok_or("Invalid browser identity path.")?;
    if parsed.scheme() != "ws"
        || parsed.host_str() != Some("127.0.0.1")
        || parsed.port() != Some(port)
        || parsed.path() != expected
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || guid.len() != 36
        || !guid.bytes().all(|byte| byte.is_ascii_hexdigit() || byte == b'-')
    {
        return Err("Browser identity does not match the owned profile.".into());
    }
    let digest = ring::digest::digest(&ring::digest::SHA256, expected.as_bytes());
    Ok(digest
        .as_ref()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect())
}

fn public_url(raw: &str) -> String {
    tauri::Url::parse(raw)
        .ok()
        .and_then(|mut url| {
            if !matches!(url.scheme(), "http" | "https") {
                return None;
            }
            let _ = url.set_username("");
            let _ = url.set_password(None);
            Some(url.to_string())
        })
        .unwrap_or_else(|| "about:blank".to_string())
}

fn valid_target_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
}

/// Live page targets for one owned browser. Titles are bounded, URLs keep
/// deep-link parameters but never credentials.
pub fn list_targets(port: u16) -> Result<Vec<BrowserTarget>, String> {
    let pages = http_json(port, "/json/list", Duration::from_secs(2))?;
    let entries = pages
        .as_array()
        .ok_or("Invalid local browser target list.")?;
    Ok(entries
        .iter()
        .filter(|entry| entry["type"] == "page")
        .take(MAX_TARGETS)
        .filter_map(|entry| {
            let id = entry["id"].as_str()?;
            if !valid_target_id(id) {
                return None;
            }
            let title: String = entry["title"].as_str().unwrap_or("").chars().take(120).collect();
            Some(BrowserTarget {
                id: id.to_string(),
                title,
                url: public_url(entry["url"].as_str().unwrap_or("")),
                devtools_url: format!(
                    "http://127.0.0.1:{port}/devtools/inspector.html?ws=127.0.0.1:{port}/devtools/page/{id}"
                ),
            })
        })
        .collect())
}

/// Removes only a marker that still points at the exact browser we owned.
pub fn retire_marker(
    profile: &Path,
    port: u16,
    expected_fingerprint: &str,
) -> Result<bool, String> {
    let Some((marker_port, browser_path)) = read_active_marker(profile) else {
        return Ok(false);
    };
    if marker_port != port {
        return Ok(false);
    }
    let digest = ring::digest::digest(&ring::digest::SHA256, browser_path.as_bytes());
    let fingerprint: String = digest
        .as_ref()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    if fingerprint != expected_fingerprint {
        return Ok(false);
    }
    if verified_fingerprint(port, profile).is_ok() {
        return Ok(false);
    }
    fs::remove_file(profile.join("DevToolsActivePort")).map_err(|error| error.to_string())?;
    Ok(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_ids_are_single_directory_components() {
        for invalid in ["", "../user", "a/b", "a\\b", ".hidden", "UPPER", "with space"] {
            assert!(!valid_profile_id(invalid), "accepted {invalid}");
        }
        assert!(valid_profile_id("default-managed"));
        assert!(valid_profile_id("research_2"));
    }

    #[test]
    fn target_ids_and_public_urls_are_bounded() {
        assert!(valid_target_id("A1B2-c3_d"));
        assert!(!valid_target_id("../escape"));
        assert_eq!(
            public_url("https://example.com/path?token=secret#frag"),
            "https://example.com/path?token=secret#frag"
        );
        assert_eq!(
            public_url("https://user:pass@example.com/x"),
            "https://example.com/x"
        );
        assert_eq!(public_url("file:///C:/secret"), "about:blank");
    }

    #[test]
    fn marker_requires_loopback_browser_path() {
        let dir = std::env::temp_dir().join(format!("tline-marker-{}", std::process::id()));
        let _ = fs::create_dir_all(&dir);
        fs::write(dir.join("DevToolsActivePort"), "1234\n/devtools/page/abc\n").unwrap();
        assert!(read_active_marker(&dir).is_none());
        fs::write(dir.join("DevToolsActivePort"), "0\n/devtools/browser/abc\n").unwrap();
        assert!(read_active_marker(&dir).is_none());
        fs::write(
            dir.join("DevToolsActivePort"),
            "53331\n/devtools/browser/01234567-89ab-cdef-0123-456789abcdef\n",
        )
        .unwrap();
        assert_eq!(
            read_active_marker(&dir),
            Some((
                53331,
                "/devtools/browser/01234567-89ab-cdef-0123-456789abcdef".to_string()
            ))
        );
        let _ = fs::remove_dir_all(&dir);
    }
}
