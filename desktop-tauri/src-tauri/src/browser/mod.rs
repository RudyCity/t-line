//! T-Line owned real-browser module.
//!
//! Architecture: T-Line owns the process lifecycle, the isolated profile, the
//! embedded window surface, and the verified handoff to SuperAgent's CDP
//! gateway. The browser owns rendering, input, media, and the CDP endpoint.
//! Pixels are never streamed through T-Line.
pub mod cdp;
pub mod commands;
pub mod dock;
pub mod engine;
pub mod identity;
pub mod launch;
pub mod session;

pub use session::{BrowserSessionStatus, BrowserState, OwnedBrowser};

/// Only the primary, trusted application WebView may drive browser commands.
/// A page loaded inside the browser itself can never reach these commands.
pub(crate) fn primary_ui(webview: &tauri::Webview) -> Result<(), String> {
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

pub(crate) fn session_status_of(owned: &OwnedBrowser, alive: bool) -> BrowserSessionStatus {
    session::status_of(owned, alive)
}

/// Verified loopback endpoint plus target check for one owned generation.
pub(crate) fn verified_target(
    state: &BrowserState,
    profile_id: &str,
    generation: &str,
    target_id: &str,
) -> Result<u16, String> {
    if target_id.is_empty() || target_id.len() > 128 {
        return Err("Invalid browser target identifier.".into());
    }
    if !target_id
        .bytes()
        .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("Invalid browser target identifier.".into());
    }
    let (port, _) = session::verified_port(state, profile_id, generation)?;
    let live = identity::list_targets(port)?;
    if !live.iter().any(|target| target.id == target_id) {
        return Err("That browser tab is no longer open.".into());
    }
    Ok(port)
}
