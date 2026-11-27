//! Tauri command surface for the embedded real browser.
//!
//! Every command is gated to the trusted primary UI, validates the owned
//! browser generation, and re-verifies the loopback CDP identity before it
//! performs any privileged action.
use crate::browser::{
    cdp, dock, engine, identity, launch, primary_ui, session, verified_target,
    BrowserSessionStatus, BrowserState,
};

#[tauri::command]
pub fn browser_engines(webview: tauri::Webview) -> Result<Vec<engine::BrowserEngine>, String> {
    primary_ui(&webview)?;
    Ok(engine::discover())
}

#[tauri::command]
pub fn browser_sessions(
    webview: tauri::Webview,
    state: tauri::State<'_, BrowserState>,
) -> Result<Vec<BrowserSessionStatus>, String> {
    primary_ui(&webview)?;
    session::snapshot(&state)
}

#[tauri::command]
pub fn browser_launch(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    state: tauri::State<'_, BrowserState>,
    engine_id: Option<String>,
    profile_id: String,
    url: Option<String>,
    docked: Option<bool>,
) -> Result<BrowserSessionStatus, String> {
    primary_ui(&webview)?;
    let address = engine::sanitized_url(url.as_deref())?;
    let docked = docked.unwrap_or(true);
    let parent = if docked {
        Some(dock::parent_handle(&webview)?)
    } else {
        None
    };
    launch::launch(
        &app,
        &state,
        launch::LaunchRequest {
            engine_id,
            profile_id,
            url: address,
            docked,
        },
        parent,
    )
}

#[tauri::command]
pub fn browser_stop(
    webview: tauri::Webview,
    state: tauri::State<'_, BrowserState>,
    profile_id: String,
    generation: String,
) -> Result<(), String> {
    primary_ui(&webview)?;
    session::stop(&state, &profile_id, &generation)
}

#[tauri::command]
pub fn browser_targets(
    webview: tauri::Webview,
    state: tauri::State<'_, BrowserState>,
    profile_id: String,
    generation: String,
) -> Result<Vec<identity::BrowserTarget>, String> {
    primary_ui(&webview)?;
    let (port, _) = session::verified_port(&state, &profile_id, &generation)?;
    identity::list_targets(port)
}

/// Explicit toolbar action on one verified tab. Not a generic CDP proxy.
#[tauri::command]
pub fn browser_act(
    webview: tauri::Webview,
    state: tauri::State<'_, BrowserState>,
    profile_id: String,
    generation: String,
    target_id: String,
    action: String,
    url: Option<String>,
) -> Result<serde_json::Value, String> {
    primary_ui(&webview)?;
    let parsed = cdp::parse_action(&action)?;
    let port = verified_target(&state, &profile_id, &generation, &target_id)?;
    cdp::apply_action(port, &target_id, parsed, url.as_deref())
}

#[tauri::command]
pub fn browser_dock_bounds(
    webview: tauri::Webview,
    state: tauri::State<'_, BrowserState>,
    profile_id: String,
    generation: String,
    bounds: dock::DockBounds,
) -> Result<(), String> {
    primary_ui(&webview)?;
    let Some(hwnd) = session::owned_hwnd(&state, &profile_id, &generation)? else {
        return Ok(());
    };
    let scale = webview.window().scale_factor().unwrap_or(1.0);
    dock::set_bounds(hwnd, bounds, scale)
}

#[tauri::command]
pub fn browser_dock_visible(
    webview: tauri::Webview,
    state: tauri::State<'_, BrowserState>,
    profile_id: String,
    generation: String,
    visible: bool,
) -> Result<(), String> {
    primary_ui(&webview)?;
    if let Some(hwnd) = session::owned_hwnd(&state, &profile_id, &generation)? {
        dock::set_visible(hwnd, visible);
    }
    Ok(())
}

#[tauri::command]
pub fn browser_focus(
    webview: tauri::Webview,
    state: tauri::State<'_, BrowserState>,
    profile_id: String,
    generation: String,
) -> Result<(), String> {
    primary_ui(&webview)?;
    if let Some(hwnd) = session::owned_hwnd(&state, &profile_id, &generation)? {
        let docked = session::snapshot(&state)?
            .into_iter()
            .any(|item| item.profile_id == profile_id && item.docked);
        if docked {
            dock::focus(hwnd);
        } else {
            dock::focus_top_level(hwnd);
        }
    }
    Ok(())
}

/// Moves the browser back to a standalone window (docking escape hatch).
#[tauri::command]
pub fn browser_undock(
    webview: tauri::Webview,
    state: tauri::State<'_, BrowserState>,
    profile_id: String,
    generation: String,
) -> Result<(), String> {
    primary_ui(&webview)?;
    if let Some(hwnd) = session::owned_hwnd(&state, &profile_id, &generation)? {
        dock::detach(hwnd);
        session::set_docked(&state, &profile_id, &generation, false, None)?;
    }
    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserPairing {
    pub profile_id: String,
    pub generation: String,
    pub port: u16,
    pub target_id: String,
    pub engine_id: String,
}

/// Verified pairing descriptor. The Core credential is never present here:
/// the T-Line backend performs the authenticated Core registration.
#[tauri::command]
pub fn browser_pairing(
    webview: tauri::Webview,
    state: tauri::State<'_, BrowserState>,
    profile_id: String,
    generation: String,
    target_id: String,
) -> Result<BrowserPairing, String> {
    primary_ui(&webview)?;
    let port = verified_target(&state, &profile_id, &generation, &target_id)?;
    let engine_id = session::snapshot(&state)?
        .into_iter()
        .find(|item| item.profile_id == profile_id)
        .map(|item| item.engine_id)
        .unwrap_or_default();
    Ok(BrowserPairing {
        profile_id,
        generation,
        port,
        target_id,
        engine_id,
    })
}
