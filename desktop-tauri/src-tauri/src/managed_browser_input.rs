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
    queue: Arc<Mutex<()>>,
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
fn command(socket: &mut CdpSocket, id: i32, method: &str, params: Value) -> Result<Value, String> {
    let request = json!({"id":id, "method":method, "params":params}).to_string();
    socket.send(Message::Text(request.into())).map_err(|_| "Chrome input send failed.")?;
    for _ in 0..30 {
        match socket.read() {
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
pub(crate) fn run_input(port: u16, target: &str, action: BrowserInteraction) -> Result<(), String> {
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
    match action {
        BrowserInteraction::Click { x, y } => {
            command(&mut socket, 1, "Input.dispatchMouseEvent",
                json!({"type":"mousePressed","x":x,"y":y,"button":"left","clickCount":1}))?;
            command(&mut socket, 2, "Input.dispatchMouseEvent",
                json!({"type":"mouseReleased","x":x,"y":y,"button":"left","clickCount":1}))?;
        }
        BrowserInteraction::Move { x, y } => {
            command(&mut socket, 1, "Input.dispatchMouseEvent",
                json!({"type":"mouseMoved","x":x,"y":y}))?;
        }
        BrowserInteraction::Scroll { x, y, delta_y } => {
            command(&mut socket, 1, "Input.dispatchMouseEvent",
                json!({"type":"mouseWheel","x":x,"y":y,"deltaX":0,"deltaY":delta_y}))?;
        }
        BrowserInteraction::Text { text } => {
            command(&mut socket, 1, "Input.insertText", json!({"text":text}))?;
        }
        BrowserInteraction::Key { key } => {
            let (key, code, vk) = mapped_key(&key)?;

            command(&mut socket, 1, "Input.dispatchKeyEvent",
                json!({"type":"rawKeyDown", "key":key,"code":code,
                    "windowsVirtualKeyCode":vk,"nativeVirtualKeyCode":vk}))?;
            if key == "Enter" || key == " " {
                command(&mut socket, 2, "Input.dispatchKeyEvent",
                    json!({"type":"char","text":if key == "Enter" {"\r"} else {" "},
                        "key":key,"code":code,"windowsVirtualKeyCode":vk}))?;
            }
            command(&mut socket, 3, "Input.dispatchKeyEvent",
                json!({"type":"keyUp","key":key,"code":code,
                    "windowsVirtualKeyCode":vk,"nativeVirtualKeyCode":vk}))?;

        }
        BrowserInteraction::Navigate { url } => {
            command(&mut socket, 1, "Page.navigate", json!({"url":url}))?;
        }
        BrowserInteraction::Reload => {
            command(&mut socket, 1, "Page.reload", json!({"ignoreCache":false}))?;
        }
        BrowserInteraction::Back | BrowserInteraction::Forward => {
            let result = command(&mut socket, 1, "Page.getNavigationHistory", json!({}))?;
            let index = result["currentIndex"].as_i64().ok_or("Chrome history unavailable.")?
                + if matches!(action, BrowserInteraction::Back) { -1 } else { 1 };
            let entries = result["entries"].as_array().ok_or("Chrome history unavailable.")?;
            if index < 0 || index as usize >= entries.len() {
                return Ok(());
            }
            let entry_id = entries[index as usize]["id"].as_i64()
                .ok_or("Invalid Chrome history entry.")?;
            command(&mut socket, 2, "Page.navigateToHistoryEntry",
                json!({"entryId":entry_id}))?;
        }
    }
    let _ = socket.close(None);
    Ok(())
}
#[tauri::command]
pub async fn managed_browser_interact(
    webview: tauri::Webview,
    state: State<'_, ManagedBrowserState>,
    inputs: State<'_, BrowserInputState>,
    profile_id: String,
    generation: String,
    target_id: String,
    interaction: BrowserInteraction,
) -> Result<(), String> {
    managed_browser::primary_ui(&webview)?;
    validate(&interaction)?;
    let (port, fingerprint) =
        managed_browser::verified_embedded_identity(&state, &profile_id, &generation)?;
    let queue = inputs.queue.clone();
    let browser_state = state.inner().clone();
    let worker_profile = profile_id.clone();
    let worker_generation = generation.clone();
    let expected_fingerprint = fingerprint.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let _guard = queue.lock().map_err(|_| "Chrome input queue unavailable.")?;
        // Reverify after acquiring the queue: a previous action may have
        // finished after this one was submitted and Chrome may have restarted.
        let (actual_port, actual_fingerprint) = managed_browser::verified_embedded_identity(
            &browser_state, &worker_profile, &worker_generation,
        )?;
        if actual_port != port || actual_fingerprint != expected_fingerprint {
            return Err("Owned Chrome changed before processing user input.".into());
        }
        run_input(port, &target_id, interaction)
    }).await.map_err(|_| "Chrome input worker failed.".to_string())?;
    result?;
    let (current_port, current_fingerprint) =
        managed_browser::verified_embedded_identity(&state, &profile_id, &generation)?;
    if current_port != port || current_fingerprint != fingerprint {
        return Err("Embedded Chrome identity changed during input.".into());
    }
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