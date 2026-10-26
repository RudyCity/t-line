//! Bounded user-input bridge for T-Line-owned, headless Chrome only.
//! All input is initiated by the trusted primary app window; arbitrary CDP
//! methods, endpoints, profiles and JavaScript are never accepted.
use crate::managed_browser::{self, ManagedBrowserState};
use serde::Deserialize;
use serde_json::{json, Value};
use std::io;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;
use tungstenite::{protocol::WebSocketConfig, Message};

const MAX_REPLY: usize = 128 * 1024;

#[derive(Default)]
pub struct BrowserInputState {
    // Exactly one CDP input connection is retained. It is never shared with
    // the screencast socket or an external user's normal Chrome profile.
    session: Arc<Mutex<Option<InputSession>>>,
}

struct InputSession {
    port: u16,
    target: String,
    generation: String,
    fingerprint: String,
    socket: CdpSocket,
    next_id: u64,
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum BrowserInteraction {
    Click { x: f64, y: f64 },
    Move { x: f64, y: f64 },
    Scroll { x: f64, y: f64, delta_y: f64 },
    Text { text: String },
    Key { key: String },
    Navigate { url: String },
    Back,
    Forward,
    Reload,
}

fn point(x: f64, y: f64) -> Result<(), String> {
    if x.is_finite() && y.is_finite() && (0.0..=4096.0).contains(&x)
        && (0.0..=4096.0).contains(&y)
    { Ok(()) } else { Err("Invalid browser pointer coordinates.".into()) }
}
fn allowed_url(raw: &str) -> Result<(), String> {
    if raw == "about:blank" { return Ok(()); }
    if raw.len() > 4096 || raw.chars().any(char::is_control) {
        return Err("Invalid browser navigation URL.".into());
    }
    let parsed = tauri::Url::parse(raw).map_err(|_| "Invalid browser URL.")?;
    if !matches!(parsed.scheme(), "https" | "http")
        || !parsed.username().is_empty() || parsed.password().is_some()
    { return Err("Only HTTP(S) navigation without embedded credentials is allowed.".into()); }
    Ok(())
}
fn mapped_key(key: &str) -> Result<(&'static str, &'static str, i32), String> {
    match key {
        "Enter" => Ok(("Enter", "Enter", 13)),
        "Backspace" => Ok(("Backspace", "Backspace", 8)),
        "Tab" => Ok(("Tab", "Tab", 9)),
        "Escape" => Ok(("Escape", "Escape", 27)),
        "Delete" => Ok(("Delete", "Delete", 46)),
        "ArrowLeft" => Ok(("ArrowLeft", "ArrowLeft", 37)),
        "ArrowUp" => Ok(("ArrowUp", "ArrowUp", 38)),
        "ArrowRight" => Ok(("ArrowRight", "ArrowRight", 39)),
        "ArrowDown" => Ok(("ArrowDown", "ArrowDown", 40)),
        "Home" => Ok(("Home", "Home", 36)),
        "End" => Ok(("End", "End", 35)),
        "PageUp" => Ok(("PageUp", "PageUp", 33)),
        "PageDown" => Ok(("PageDown", "PageDown", 34)),
        " " => Ok((" ", "Space", 32)),
        _ => Err("Unsupported native browser shortcut.".into()),
    }
}
fn validate(action: &BrowserInteraction) -> Result<(), String> {
    match action {
        BrowserInteraction::Click { x, y } | BrowserInteraction::Move { x, y } =>
            point(*x, *y),
        BrowserInteraction::Scroll { x, y, delta_y } => {
            point(*x, *y)?;
            if !delta_y.is_finite() || delta_y.abs() > 2000.0 {
                return Err("Invalid browser scroll delta.".into());
            }
            Ok(())
        }
        BrowserInteraction::Text { text } =>
            if !text.is_empty() && text.chars().count() <= 16 && !text.chars().any(char::is_control) {
                Ok(())
            } else { Err("Browser text input outside permitted bounds.".into()) },
        BrowserInteraction::Key { key } => mapped_key(key).map(|_| ()),
        BrowserInteraction::Navigate { url } => allowed_url(url),
        BrowserInteraction::Back | BrowserInteraction::Forward | BrowserInteraction::Reload => Ok(()),
    }
}
type CdpSocket = tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>;
fn command(session: &mut InputSession, method: &str, params: Value) -> Result<Value, String> {
    // Persistent CDP sockets must never reuse an old command ID; a late reply
    // could otherwise acknowledge the wrong click or keyboard action.
    let id = session.next_id;
    session.next_id = session.next_id.checked_add(1).ok_or("Chrome command ID exhausted.")?;
    let request = json!({"id":id, "method":method, "params":params}).to_string();
    session.socket.send(Message::Text(request.into())).map_err(|_| "Chrome input send failed.")?;
    for _ in 0..30 {
        match session.socket.read() {
            Ok(Message::Text(reply)) if reply.len() <= MAX_REPLY => {
                let response: Value = serde_json::from_str(&reply)
                    .map_err(|_| "Invalid Chrome response.")?;
                if response["id"] == id {
                    if !response["error"].is_null() {
                        return Err("Chrome rejected this browser action.".into());
                    }
                    return Ok(response["result"].clone());
                }
            }
            Err(tungstenite::Error::Io(ref e))
                if matches!(e.kind(), io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock) =>
            { return Err("Chrome input timed out.".into()); }
            _ => return Err("Chrome input socket disconnected.".into()),
        }
    }
    Err("Chrome did not acknowledge browser action.".into())
}
fn open_input_session(
    port: u16, target: &str, generation: &str, fingerprint: &str,
) -> Result<InputSession, String> {
    let debugger = crate::managed_browser_capture::discover_page_debugger(port, target)?;
    let (mut socket, _) = tungstenite::connect(debugger.as_str())
        .map_err(|_| "Chrome input session unavailable.")?;
    socket.set_config(|config: &mut WebSocketConfig| {
        config.max_message_size = Some(MAX_REPLY);
        config.max_frame_size = Some(MAX_REPLY);
    });
    if let tungstenite::stream::MaybeTlsStream::Plain(stream) = socket.get_mut() {
        stream.set_read_timeout(Some(Duration::from_secs(2)))
            .map_err(|_| "Unable to set input deadline.")?;
        stream.set_write_timeout(Some(Duration::from_secs(2)))
            .map_err(|_| "Unable to set input deadline.")?;
    }
    Ok(InputSession {
        port, target: target.to_owned(), generation: generation.to_owned(),
        fingerprint: fingerprint.to_owned(), socket, next_id: 1,
    })
}

fn dispatch_input(session: &mut InputSession, action: BrowserInteraction) -> Result<(), String> {
    match action {
        BrowserInteraction::Click { x, y } => {
            command(session, "Input.dispatchMouseEvent",
                json!({"type":"mousePressed","x":x,"y":y,"button":"left","clickCount":1}))?;
            command(session, "Input.dispatchMouseEvent",
                json!({"type":"mouseReleased","x":x,"y":y,"button":"left","clickCount":1}))?;
        }
        BrowserInteraction::Move { x, y } => {
            command(session, "Input.dispatchMouseEvent",
                json!({"type":"mouseMoved","x":x,"y":y}))?;
        }
        BrowserInteraction::Scroll { x, y, delta_y } => {
            command(session, "Input.dispatchMouseEvent",
                json!({"type":"mouseWheel","x":x,"y":y,"deltaX":0,"deltaY":delta_y}))?;
        }
        BrowserInteraction::Text { text } => {
            command(session, "Input.insertText", json!({"text":text}))?;
        }
        BrowserInteraction::Key { key } => {
            let (key, code, vk) = mapped_key(&key)?;

            command(session, "Input.dispatchKeyEvent",
                json!({"type":"rawKeyDown", "key":key,"code":code,
                    "windowsVirtualKeyCode":vk,"nativeVirtualKeyCode":vk}))?;
            if key == "Enter" || key == " " {
                command(session, "Input.dispatchKeyEvent",
                    json!({"type":"char","text":if key == "Enter" {"\r"} else {" "},
                        "key":key,"code":code,"windowsVirtualKeyCode":vk}))?;
            }
            command(session, "Input.dispatchKeyEvent",
                json!({"type":"keyUp","key":key,"code":code,
                    "windowsVirtualKeyCode":vk,"nativeVirtualKeyCode":vk}))?;

        }
        BrowserInteraction::Navigate { url } => {
            command(session, "Page.navigate", json!({"url":url}))?;
        }
        BrowserInteraction::Reload => {
            command(session, "Page.reload", json!({"ignoreCache":false}))?;
        }
        BrowserInteraction::Back | BrowserInteraction::Forward => {
            let result = command(session, "Page.getNavigationHistory", json!({}))?;
            let index = result["currentIndex"].as_i64().ok_or("Chrome history unavailable.")?
                + if matches!(action, BrowserInteraction::Back) { -1 } else { 1 };
            let entries = result["entries"].as_array().ok_or("Chrome history unavailable.")?;
            if index < 0 || index as usize >= entries.len() {
                return Ok(());
            }
            let entry_id = entries[index as usize]["id"].as_i64()
                .ok_or("Invalid Chrome history entry.")?;
            command(session, "Page.navigateToHistoryEntry",
                json!({"entryId":entry_id}))?;
        }
    }
    Ok(())
}

/// Standalone native smoke path. The live UI uses the cached session below.
#[cfg(test)]
pub(crate) fn run_input(port: u16, target: &str, action: BrowserInteraction) -> Result<(), String> {
    let mut session = open_input_session(port, target, "smoke", "smoke")?;
    dispatch_input(&mut session, action)
}

fn run_input_cached(
    cached: &mut Option<InputSession>,
    port: u16,
    target: &str,
    generation: &str,
    fingerprint: &str,
    action: BrowserInteraction,
) -> Result<(), String> {
    let same_session = cached.as_ref().is_some_and(|current|
        current.port == port && current.target == target &&
        current.generation == generation && current.fingerprint == fingerprint);
    if !same_session {
        // Drop the old WebSocket before discovering a different tab or session.
        *cached = None;
        *cached = Some(open_input_session(port, target, generation, fingerprint)?);
    }
    let result = dispatch_input(cached.as_mut().ok_or("Chrome input session missing.")?, action);
    if result.is_err() {
        // Never retry a click or typed character: doing so can duplicate input.
        // The next user action may open a fresh, verified CDP connection.
        *cached = None;
    }
    result
}

#[cfg(test)]
pub(crate) fn smoke_reused_input(port: u16, target: &str) -> Result<(), String> {
    let mut cached = None;
    run_input_cached(
        &mut cached, port, target, "smoke-generation", "smoke-fingerprint",
        BrowserInteraction::Click { x: 80.0, y: 60.0 },
    )?;
    let id_after_click = cached.as_ref().ok_or("Smoke session missing.")?.next_id;
    run_input_cached(
        &mut cached, port, target, "smoke-generation", "smoke-fingerprint",
        BrowserInteraction::Text { text: "abc".into() },
    )?;
    let id_after_text = cached.as_ref().ok_or("Smoke session missing.")?.next_id;
    if id_after_text != id_after_click + 1 {
        return Err("Typing reopened Chrome CDP instead of reusing the owned socket.".into());
    }
    run_input_cached(
        &mut cached, port, target, "new-generation", "smoke-fingerprint",
        BrowserInteraction::Reload,
    )?;
    if cached.as_ref().ok_or("New smoke session missing.")?.next_id != 2 {
        return Err("Chrome generation change failed to reset the cached CDP connection.".into());
    }
    Ok(())
}

#[tauri::command]
pub async fn managed_browser_interact(
    webview: tauri::Webview,
    state: State<'_, ManagedBrowserState>,
    inputs: State<'_, BrowserInputState>,
    streams: State<'_, crate::managed_browser_stream::BrowserStreamState>,
    profile_id: String,
    generation: String,
    target_id: String,
    interaction: BrowserInteraction,
) -> Result<(), String> {
    managed_browser::primary_ui(&webview)?;
    validate(&interaction)?;
    let session = inputs.session.clone();
    let browser_state = state.inner().clone();
    let worker_profile = profile_id.clone();
    let worker_generation = generation.clone();
    let input_target = target_id.clone();
    let (port, fingerprint) = tauri::async_runtime::spawn_blocking(move || {
        let mut cached = session.lock().map_err(|_| "Chrome input queue unavailable.")?;
        // Verify only after entering the serialized input queue. This avoids
        // redundant network identity checks for every keystroke while keeping
        // the ownership check immediately before CDP input.
        let (port, fingerprint) = managed_browser::verified_embedded_identity(
            &browser_state, &worker_profile, &worker_generation,
        )?;
        run_input_cached(
            &mut cached, port, &input_target, &worker_generation, &fingerprint, interaction,
        )?;
        Ok::<(u16, String), String>((port, fingerprint))
    }).await.map_err(|_| "Chrome input worker failed.".to_string())??;
    let (current_port, current_fingerprint) =
        managed_browser::verified_embedded_identity(&state, &profile_id, &generation)?;
    if current_port != port || current_fingerprint != fingerprint {
        return Err("Embedded Chrome identity changed during input.".into());
    }
    streams.mark_interaction(&target_id);
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_invalid_input_without_contacting_chrome() {
        assert!(validate(&BrowserInteraction::Click { x: -1.0, y: 20.0 }).is_err());
        assert!(validate(&BrowserInteraction::Scroll { x: 0.0, y: 0.0, delta_y: f64::NAN }).is_err());
        assert!(validate(&BrowserInteraction::Text { text: "a".repeat(17) }).is_err());
        assert!(validate(&BrowserInteraction::Key { key: "F12".into() }).is_err());
        assert!(validate(&BrowserInteraction::Navigate { url: "file:///C:/secret".into() }).is_err());
        assert!(validate(&BrowserInteraction::Navigate { url: "javascript:alert(1)".into() }).is_err());
        assert!(validate(&BrowserInteraction::Navigate { url: "https://user:pass@example.com".into() }).is_err());
        assert!(validate(&BrowserInteraction::Navigate { url: "https://example.com/?page=2".into() }).is_ok());
        assert!(validate(&BrowserInteraction::Text { text: "é".into() }).is_ok());
        let wheel: BrowserInteraction = serde_json::from_value(json!({
            "type": "scroll", "x": 10.0, "y": 20.0, "delta_y": 200.0,
        })).expect("React scroll payload must deserialize");
        assert!(validate(&wheel).is_ok());
        let click: BrowserInteraction = serde_json::from_value(json!({
            "type": "click", "x": 20.0, "y": 30.0,
        })).expect("React click payload must deserialize");
        assert!(validate(&click).is_ok());
    }
}