//! Installed Chromium-family engine discovery and browser URL policy.
//!
//! Only engines that expose the Chrome DevTools Protocol are accepted so the
//! SuperAgent CDP toolchain can drive the very same window the user sees.
use std::path::PathBuf;

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BrowserEngine {
    pub id: String,
    pub name: String,
    pub family: &'static str,
    pub executable: String,
}

struct Candidate {
    id: &'static str,
    name: &'static str,
    paths: Vec<PathBuf>,
}

fn env_path(var: &str) -> Option<PathBuf> {
    std::env::var_os(var).map(PathBuf::from)
}

#[cfg(windows)]
fn candidates() -> Vec<Candidate> {
    let mut list: Vec<Candidate> = Vec::new();
    let mut push = |id: &'static str, name: &'static str, rel: &[&str]| {
        let mut paths = Vec::new();
        for root in ["PROGRAMFILES", "PROGRAMFILES(X86)", "LOCALAPPDATA"] {
            if let Some(base) = env_path(root) {
                let mut path = base;
                for part in rel {
                    path = path.join(part);
                }
                paths.push(path);
            }
        }
        list.push(Candidate { id, name, paths });
    };
    push(
        "chrome",
        "Google Chrome",
        &["Google", "Chrome", "Application", "chrome.exe"],
    );
    push(
        "edge",
        "Microsoft Edge",
        &["Microsoft", "Edge", "Application", "msedge.exe"],
    );
    push(
        "brave",
        "Brave",
        &["BraveSoftware", "Brave-Browser", "Application", "brave.exe"],
    );
    push(
        "chromium",
        "Chromium",
        &["Chromium", "Application", "chrome.exe"],
    );
    list
}

#[cfg(target_os = "macos")]
fn candidates() -> Vec<Candidate> {
    const APPS: [(&str, &str, &str); 4] = [
        (
            "chrome",
            "Google Chrome",
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        ),
        (
            "edge",
            "Microsoft Edge",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ),
        (
            "brave",
            "Brave",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        ),
        (
            "chromium",
            "Chromium",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ),
    ];
    APPS.iter()
        .map(|(id, name, path)| Candidate {
            id,
            name,
            paths: vec![PathBuf::from(path)],
        })
        .collect()
}

#[cfg(all(unix, not(target_os = "macos")))]
fn candidates() -> Vec<Candidate> {
    const ENGINES: [(&str, &str, &[&str]); 4] = [
        (
            "chrome",
            "Google Chrome",
            &["google-chrome", "google-chrome-stable"],
        ),
        ("edge", "Microsoft Edge", &["microsoft-edge", "microsoft-edge-stable"]),
        ("brave", "Brave", &["brave-browser"]),
        ("chromium", "Chromium", &["chromium", "chromium-browser"]),
    ];
    const DIRS: [&str; 5] = ["/usr/bin", "/usr/local/bin", "/snap/bin", "/bin", "/opt/google/chrome"];
    ENGINES
        .iter()
        .map(|(id, name, names)| {
            let mut paths = Vec::new();
            for dir in DIRS {
                for binary in *names {
                    paths.push(PathBuf::from(dir).join(binary));
                }
            }
            Candidate { id, name, paths }
        })
        .collect()
}

/// Deterministic discovery of every installed engine, de-duplicated by the
/// canonical executable path so aliases never appear twice.
pub fn discover() -> Vec<BrowserEngine> {
    let mut found: Vec<BrowserEngine> = Vec::new();
    for candidate in candidates() {
        let Some(path) = candidate.paths.iter().find(|path| path.is_file()) else {
            continue;
        };
        let Ok(canonical) = path.canonicalize() else {
            continue;
        };
        let executable = canonical.to_string_lossy().into_owned();
        if found.iter().any(|engine| engine.executable == executable) {
            continue;
        }
        found.push(BrowserEngine {
            id: candidate.id.to_string(),
            name: candidate.name.to_string(),
            family: "chromium",
            executable,
        });
    }
    found
}

/// Resolves the requested engine or falls back to the first installed engine.
pub fn resolve(engine_id: Option<&str>) -> Result<BrowserEngine, String> {
    let engines = discover();
    if engines.is_empty() {
        return Err(
            "No installed Chromium-family browser was found. Install Chrome, Edge, Brave, or Chromium."
                .into(),
        );
    }
    match engine_id.filter(|id| !id.is_empty()) {
        Some(id) => engines
            .into_iter()
            .find(|engine| engine.id == id)
            .ok_or_else(|| "The selected browser is no longer installed.".to_string()),
        None => engines
            .into_iter()
            .next()
            .ok_or_else(|| "No installed Chromium-family browser was found.".to_string()),
    }
}

/// Browser navigation policy: keep deep-link parameters, never carry credentials.
pub const MAX_URL_CHARS: usize = 4096;

pub fn sanitized_url(raw: Option<&str>) -> Result<String, String> {
    let url = raw.unwrap_or("about:blank");
    if url == "about:blank" {
        return Ok(url.to_string());
    }
    if url.len() > MAX_URL_CHARS || url.chars().any(char::is_control) {
        return Err("Invalid browser address.".into());
    }
    let parsed = tauri::Url::parse(url).map_err(|_| "Invalid browser address.".to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("Only HTTP(S) addresses are supported.".into());
    }
    if !parsed.username().is_empty() || parsed.password().is_some() {
        return Err("Addresses with embedded credentials are not allowed.".into());
    }
    Ok(parsed.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_deep_link_parameters_and_fragments() {
        assert_eq!(
            sanitized_url(Some("https://example.com/search?q=rust#section")).unwrap(),
            "https://example.com/search?q=rust#section"
        );
        assert_eq!(sanitized_url(None).unwrap(), "about:blank");
    }

    #[test]
    fn rejects_credentials_and_non_http_schemes() {
        assert!(sanitized_url(Some("https://user:pass@example.com/")).is_err());
        assert!(sanitized_url(Some("javascript:alert(1)")).is_err());
        assert!(sanitized_url(Some("file:///C:/Windows")).is_err());
        assert!(sanitized_url(Some("devtools://devtools/bundled/x.html")).is_err());
    }

    #[test]
    fn rejects_oversized_or_control_character_addresses() {
        let long = format!("https://example.com/{}", "a".repeat(MAX_URL_CHARS));
        assert!(sanitized_url(Some(&long)).is_err());
        assert!(sanitized_url(Some("https://example.com/\u{7}")).is_err());
    }
}
