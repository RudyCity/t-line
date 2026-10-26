//! Experimental read-only CDP screencast for exactly one T-Line-managed tab.
//! Pushes bounded JPEG pixels only to the primary UI; never exposes CDP URLs.
use crate::managed_browser::{self, ManagedBrowserState};
use serde::Serialize;
use std::collections::HashMap;

use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use tungstenite::{protocol::WebSocketConfig, Message};

static NEXT_STREAM: AtomicU64 = AtomicU64::new(1);
const MAX_CDP_FRAME: usize = 2_500_000;
const MAX_JPEG_BASE64: usize = 2_000_000;
const MIN_SEND_INTERVAL: Duration = Duration::from_millis(200); // maximum 5fps

#[derive(Default)]
pub struct BrowserStreamState {
    streams: Mutex<HashMap<String, Arc<AtomicBool>>>,
}
impl BrowserStreamState {
    pub fn stop_all(&self) {
        if let Ok(mut streams) = self.streams.lock() {
            for cancel in streams.values() {
                cancel.store(true, Ordering::SeqCst);
            }
            streams.clear();
        }
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartedBrowserStream {
    stream_id: String,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct FrameEvent<'a> {
    stream_id: &'a str,
    target_id: &'a str,
    data_url: String,
    captured_at: u64,
    transport: &'a str,
}
fn emit_frame(
    app: &tauri::AppHandle,
    stream_id: &str,
    target_id: &str,
    data_url: String,
    transport: &str,
) -> Result<(), String> {
    let captured_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64;
    let payload = FrameEvent {
        stream_id,
        target_id,
        data_url,
        captured_at,
        transport,
    };
    app.emit_to(
        tauri::EventTarget::webview("main"),
        "managed-browser:frame",
        payload,
    )
    .map_err(|_| "Primary viewer unavailable.".to_owned())
}
fn safe_frame_data(value: &serde_json::Value) -> Option<String> {
    let encoded = value["params"]["data"].as_str()?;
    if encoded.len() < 10
        || encoded.len() > MAX_JPEG_BASE64
        || !encoded.starts_with("/9j/")
        || !encoded
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/' || b == b'=')
    {
        return None;
    }
    Some(format!("data:image/jpeg;base64,{encoded}"))
}
fn process_screencast_event(value: &serde_json::Value) -> Option<(i64, String)> {
    if value["method"] != "Page.screencastFrame" {
        return None;
    }
    let session_id = value["params"]["sessionId"].as_i64()?;
    if session_id < 0 || session_id > i32::MAX as i64 {
        return None;
    }
    Some((session_id, safe_frame_data(value)?))
}
fn send_cdp(
    socket: &mut tungstenite::WebSocket<tungstenite::stream::MaybeTlsStream<std::net::TcpStream>>,
    message: &str,
) -> Result<(), String> {
    socket
        .send(Message::Text(message.into()))
        .map_err(|_| "CDP send failed.".to_owned())
}
fn execute_stream(
    app: tauri::AppHandle,
    state: Arc<ManagedBrowserState>,
    cancel: Arc<AtomicBool>,
    stream_id: String,
    profile_id: String,
    generation: String,
    target_id: String,
    port: u16,
    fingerprint: String,
) -> Result<(), String> {
    // Reuse the same URL/target validation as the single-frame fallback.
    let debugger = crate::managed_browser_capture::discover_page_debugger(port, &target_id)?;
    let (mut socket, _) = tungstenite::connect(debugger.as_str())
        .map_err(|_| "Read-only managed screencast socket unavailable.")?;
    socket.set_config(|config: &mut WebSocketConfig| {
        config.max_message_size = Some(MAX_CDP_FRAME);
        config.max_frame_size = Some(MAX_CDP_FRAME);
    });
    if let tungstenite::stream::MaybeTlsStream::Plain(stream) = socket.get_mut() {
        stream
            .set_read_timeout(Some(Duration::from_millis(750)))
            .map_err(|_| "Cannot configure screencast read timeout.")?;
        stream
            .set_write_timeout(Some(Duration::from_secs(2)))
            .map_err(|_| "Cannot configure screencast write timeout.")?;
    }
    send_cdp(&mut socket, r#"{"id":11,"method":"Page.enable"}"#)?;
    send_cdp(
        &mut socket,
        r#"{"id":1,"method":"Page.startScreencast","params":{"format":"jpeg","quality":50,"maxWidth":1280,"maxHeight":720,"everyNthFrame":4}}"#,
    )?;

    let mut last_emit = Instant::now() - MIN_SEND_INTERVAL;
    let mut last_check = Instant::now() - Duration::from_secs(1);
    let mut last_screencast = Instant::now();
    let mut last_snapshot_request = Instant::now() - Duration::from_secs(2);
    let mut snapshot_pending = false;
    let mut has_screencast_frames = false;
    while !cancel.load(Ordering::SeqCst) {
        if last_check.elapsed() >= Duration::from_secs(1) {
            let (live_port, live_fingerprint) =
                managed_browser::verified_stream_identity(&state, &profile_id, &generation)?;
            if live_port != port || live_fingerprint != fingerprint {
                return Err("Owned Chrome changed while streaming.".into());
            }
            last_check = Instant::now();
        }
        // Headless/offscreen Chrome may accept startScreencast yet emit no
        // frames. Retain the SAME verified WebSocket and capture a bounded
        // JPEG every second rather than reopening a CDP socket each poll.
        if last_screencast.elapsed() >= Duration::from_secs(2)
            && !snapshot_pending
            && last_snapshot_request.elapsed() >= Duration::from_secs(1)
        {
            send_cdp(
                &mut socket,
                r#"{"id":7,"method":"Page.captureScreenshot","params":{"format":"jpeg","quality":50,"captureBeyondViewport":false}}"#,
            )?;
            snapshot_pending = true;
            last_snapshot_request = Instant::now();
        }
        match socket.read() {
            Ok(Message::Text(text)) => {
                if text.len() > MAX_CDP_FRAME {
                    return Err("Unbounded screencast message.".into());
                }
                let value: serde_json::Value = match serde_json::from_str(&text) {
                    Ok(value) => value,
                    Err(_) => continue,
                };
                if value["id"] == 7 {
                    snapshot_pending = false;
                    if last_screencast.elapsed() >= Duration::from_secs(1)
                        && last_emit.elapsed() >= MIN_SEND_INTERVAL
                    {
                        if let Ok(data_url) = crate::managed_browser_capture::extract_frame(&text) {
                            if cancel.load(Ordering::SeqCst) {
                                break;
                            }
                            emit_frame(&app, &stream_id, &target_id, data_url, "snapshot")?;
                            last_emit = Instant::now();
                        }
                    }
                }
                // ACK every event, even dropped frames, to respect CDP backpressure.
                if value["method"] == "Page.screencastFrame" {
                    let session_id = match value["params"]["sessionId"].as_i64() {
                        Some(v) if v >= 0 && v <= i32::MAX as i64 => v,
                        _ => continue,
                    };
                    send_cdp(
                        &mut socket,
                        &format!(
                            r#"{{"id":2,"method":"Page.screencastFrameAck","params":{{"sessionId":{session_id}}}}}"#
                        ),
                    )?;
                    if let Some((_, data_url)) = process_screencast_event(&value) {
                        last_screencast = Instant::now();
                        has_screencast_frames = true;
                        if last_emit.elapsed() >= MIN_SEND_INTERVAL {
                            if cancel.load(Ordering::SeqCst) {
                                break;
                            }
                            emit_frame(&app, &stream_id, &target_id, data_url, "screencast")?;
                            last_emit = Instant::now();
                        }
                    }
                }
            }
            Ok(Message::Close(_)) => return Err("Managed Chrome closed screencast.".into()),
            Ok(_) => {}
            Err(tungstenite::Error::Io(e))
                if e.kind() == std::io::ErrorKind::TimedOut
                    || e.kind() == std::io::ErrorKind::WouldBlock =>
            { /* cancellation + liveness */ }
            Err(_) => return Err("Managed Chrome screencast disconnected.".into()),
        }
        if has_screencast_frames && cancel.load(Ordering::SeqCst) {
            break;
        }
    }
    let _ = send_cdp(&mut socket, r#"{"id":3,"method":"Page.stopScreencast"}"#);
    let _ = socket.close(None);
    Ok(())
}

#[tauri::command]
pub fn managed_browser_stream_start(
    app: tauri::AppHandle,
    webview: tauri::Webview,
    browsers: tauri::State<'_, ManagedBrowserState>,
    streams: tauri::State<'_, BrowserStreamState>,
    profile_id: String,
    generation: String,
    target_id: String,
) -> Result<StartedBrowserStream, String> {
    managed_browser::primary_ui(&webview)?;
    if target_id.is_empty()
        || target_id.len() > 128
        || !target_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("Invalid screencast target.".into());
    }
    let (port, fingerprint) =
        managed_browser::verified_stream_identity(&browsers, &profile_id, &generation)?;
    // Keep maximum one active screencast per primary UI, even across tabs.
    let stream_id = format!(
        "{}-{}",
        std::process::id(),
        NEXT_STREAM.fetch_add(1, Ordering::Relaxed)
    );
    let cancelled = Arc::new(AtomicBool::new(false));
    let mut active = streams
        .streams
        .lock()
        .map_err(|_| "Screencast registry unavailable.")?;
    for old in active.values() {
        old.store(true, Ordering::SeqCst);
    }
    active.clear();
    active.insert(stream_id.clone(), cancelled.clone());
    drop(active);
    // Cloning the supervisor shares its same Arc<Mutex<owned Child handles>>.
    // The stream cannot independently create or adopt a Chrome process.
    let browser_state = Arc::new(browsers.inner().clone());
    let worker_stream = stream_id.clone();
    let worker_app = app.clone();
    let worker_cancel = cancelled;
    tauri::async_runtime::spawn_blocking(move || {
        let _ = execute_stream(
            worker_app,
            browser_state,
            worker_cancel,
            worker_stream,
            profile_id,
            generation,
            target_id,
            port,
            fingerprint,
        );
    });
    Ok(StartedBrowserStream { stream_id })
}
#[tauri::command]
pub fn managed_browser_stream_stop(
    webview: tauri::Webview,
    streams: tauri::State<'_, BrowserStreamState>,
    stream_id: String,
) -> Result<(), String> {
    managed_browser::primary_ui(&webview)?;
    let mut active = streams
        .streams
        .lock()
        .map_err(|_| "Screencast registry unavailable.")?;
    if let Some(cancelled) = active.remove(&stream_id) {
        cancelled.store(true, Ordering::SeqCst);
    }
    Ok(())
}
#[cfg(test)]
pub(crate) fn smoke_probe_screencast(port: u16, target_id: &str) -> Result<&'static str, String> {
    let ws = crate::managed_browser_capture::discover_page_debugger(port, target_id)?;
    let (mut socket, _) = tungstenite::connect(ws.as_str())
        .map_err(|_| "Chrome smoke websocket refused connection.")?;
    if let tungstenite::stream::MaybeTlsStream::Plain(stream) = socket.get_mut() {
        stream
            .set_read_timeout(Some(Duration::from_millis(750)))
            .map_err(|_| "Chrome smoke timeout configuration failed.")?;
    }
    send_cdp(
        &mut socket,
        r#"{"id":1,"method":"Page.startScreencast","params":{"format":"jpeg","quality":50,"maxWidth":1280,"maxHeight":720,"everyNthFrame":4}}"#,
    )?;
    let deadline = Instant::now() + Duration::from_secs(8);
    let started_at = Instant::now();
    let mut requested_fallback = false;
    let mut supported = false;
    while Instant::now() < deadline {
        if !requested_fallback && started_at.elapsed() >= Duration::from_secs(2) {
            send_cdp(
                &mut socket,
                r#"{"id":7,"method":"Page.captureScreenshot","params":{"format":"jpeg","quality":50,"captureBeyondViewport":false}}"#,
            )?;
            requested_fallback = true;
        }
        match socket.read() {
            Ok(Message::Text(text)) => {
                let value: serde_json::Value = serde_json::from_str(&text)
                    .map_err(|_| "Malformed live Chrome screencast event.")?;
                if value["id"] == 7 && crate::managed_browser_capture::extract_frame(&text).is_ok()
                {
                    let _ = send_cdp(&mut socket, r#"{"id":3,"method":"Page.stopScreencast"}"#);
                    return Ok("persistent-snapshot-fallback");
                }
                if value["id"] == 1 {
                    if !value["error"].is_null() {
                        return Err("Installed Chrome does not support screencast.".into());
                    }
                    supported = true;
                }
                if let Some((id, image)) = process_screencast_event(&value) {
                    send_cdp(
                        &mut socket,
                        &format!(
                            r#"{{"id":2,"method":"Page.screencastFrameAck","params":{{"sessionId":{id}}}}}"#
                        ),
                    )?;
                    if supported && image.starts_with("data:image/jpeg;base64,/9j/") {
                        let _ = send_cdp(&mut socket, r#"{"id":3,"method":"Page.stopScreencast"}"#);
                        return Ok("screencast");
                    }
                }
            }
            Err(tungstenite::Error::Io(error))
                if error.kind() == std::io::ErrorKind::TimedOut
                    || error.kind() == std::io::ErrorKind::WouldBlock => {}
            Err(_) => return Err("Chrome closed screencast before first JPEG frame.".into()),
            _ => {}
        }
    }
    Err("No Chrome screencast or persistent fallback frame arrived within test deadline.".into())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn screencast_filters_non_jpeg_and_invalid_session_frames() {
        let valid = serde_json::json!({
            "method":"Page.screencastFrame",
            "params":{"sessionId":1,"data":format!("/9j/{}", "A".repeat(20))}
        });
        assert!(process_screencast_event(&valid).is_some());
        assert!(process_screencast_event(&serde_json::json!({
            "method":"Page.screencastFrame",
            "params":{"sessionId": -1,"data":"/9j/AAAA"}
        }))
        .is_none());
        assert!(process_screencast_event(&serde_json::json!({
            "method":"Page.screencastFrame",
            "params":{"sessionId": 1,"data":"NOTJPEG"}
        }))
        .is_none());
        assert!(safe_frame_data(&serde_json::json!({
            "params":{"data":format!("/9j/{}", "A".repeat(MAX_JPEG_BASE64))}
        }))
        .is_none());
    }
}
