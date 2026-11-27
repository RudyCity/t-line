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

#[cfg(all(test, windows))]
mod live_tests {
    use super::{cdp, engine, identity, launch, session};
    use std::process::{Command, Stdio};
    use std::time::{Duration, Instant};

    /// Opt-in live check of the real-browser pipeline on this machine:
    /// installed engine -> isolated profile -> verified CDP endpoint ->
    /// target discovery -> navigation -> process cleanup.
    /// Run with: cargo test --lib -- --ignored real_engine_launch
    #[test]
    #[ignore = "spawns the installed Chromium-family browser"]
    fn real_engine_launch_cdp_navigate_and_cleanup() {
        let engines = engine::discover();
        assert!(
            !engines.is_empty(),
            "no installed Chromium-family browser found on this machine"
        );
        let engine = &engines[0];
        let profile = std::env::temp_dir().join(format!("tline-live-browser-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&profile);
        std::fs::create_dir_all(&profile).expect("create isolated profile");

        let args = launch::launch_args(&profile, "about:blank", true);
        let mut child = Command::new(&engine.executable)
            .args(&args)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .expect("spawn the installed browser");
        let pid = child.id();

        let (port, fingerprint) = session::await_endpoint(&profile, Duration::from_secs(25))
            .expect("verified loopback CDP endpoint");
        assert_eq!(fingerprint.len(), 64);

        let targets = identity::list_targets(port).expect("list live page targets");
        assert!(!targets.is_empty(), "expected at least one page target");
        let page = targets[0].clone();

        cdp::apply_action(
            port,
            &page.id,
            cdp::PageAction::Navigate,
            Some("https://example.com/"),
        )
        .expect("navigate the live target");

        let deadline = Instant::now() + Duration::from_secs(20);
        let mut reached = false;
        while Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(300));
            if let Ok(list) = identity::list_targets(port) {
                if list.iter().any(|target| target.url.contains("example.com")) {
                    reached = true;
                    break;
                }
            }
        }

        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status();
        let _ = child.wait();
        std::thread::sleep(Duration::from_millis(400));
        let _ = std::fs::remove_dir_all(&profile);

        assert!(reached, "navigated URL never appeared in the live target list");
    }
}