//! Experimental read-only CDP screencast for exactly one T-Line-managed tab.
//! Pushes bounded JPEG pixels only to the primary UI; never exposes CDP URLs.
use crate::managed_browser::{self, ManagedBrowserState};
use crate::managed_browser_flow::{FrameFlow, FrameStats};
use serde::Serialize;
use std::collections::HashMap;

use std::sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use sysinfo::{Pid, ProcessRefreshKind};
use tauri::Emitter;
use tungstenite::{protocol::WebSocketConfig, Message};

static NEXT_STREAM: AtomicU64 = AtomicU64::new(1);
const MAX_CDP_FRAME: usize = 2_500_000;
const MAX_JPEG_BASE64: usize = 2_000_000;
const MIN_SEND_INTERVAL: Duration = Duration::from_millis(200); // maximum 5fps

struct StreamControl {
    cancel: AtomicBool,
    flow: Mutex<FrameFlow>,
    target_id: String,
    last_input: Mutex<Instant>,
}
impl StreamControl {
    fn new(target_id: String) -> Self {
        Self {
            cancel: AtomicBool::new(false),
            flow: Mutex::new(FrameFlow::default()),
            target_id,
            last_input: Mutex::new(Instant::now()),
        }
    }
    fn recently_active(&self) -> bool {
        self.last_input.lock().is_ok_and(|at| at.elapsed() < Duration::from_secs(3))
    }
}
#[derive(Default)]
pub struct BrowserStreamState {
    streams: Mutex<HashMap<String, Arc<StreamControl>>>,
    host_probe: Mutex<sysinfo::System>,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserStreamTelemetry {
    #[serde(flatten)]
    flow: FrameStats,
    host_cpu_percent: f32,
    host_rss_bytes: u64,
}
impl BrowserStreamState {
    /// Input is accepted only for the currently displayed browser target,
    /// so inactive tabs cannot force high-FPS capture.
    pub fn mark_interaction(&self, target_id: &str) {
        if let Ok(streams) = self.streams.lock() {
            for control in streams.values() {
                if control.target_id == target_id && !control.cancel.load(Ordering::SeqCst) {
                    if let Ok(mut last) = control.last_input.lock() {
                        *last = Instant::now();
                    }
                }
            }
        }
    }
    pub fn stop_all(&self) {
        if let Ok(mut streams) = self.streams.lock() {
            for cancel in streams.values() {
                cancel.cancel.store(true, Ordering::SeqCst);
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
    sequence: u64,
}
fn emit_frame(
    app: &tauri::AppHandle,
    control: &StreamControl,
    stream_id: &str,
    target_id: &str,
    data_url: String,
    transport: &str,
) -> Result<(), String> {
    if control.cancel.load(Ordering::SeqCst) {
        return Ok(());
    }
    let sequence = {
        let mut flow = control.flow.lock().map_err(|_| "Frame flow unavailable.")?;
        match flow.reserve(Instant::now())? {
            Some(sequence) => sequence,
            None => return Ok(()),
        }
    };
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
        sequence,
    };
    if control.cancel.load(Ordering::SeqCst) {
        if let Ok(mut flow) = control.flow.lock() {
            flow.failed_emit(sequence);
        }
        return Ok(());
    }
    let result = app
        .emit_to(
            tauri::EventTarget::webview("main"),
            "managed-browser:frame",
            payload,
        )
        .map_err(|_| "Primary viewer unavailable.".to_owned());
    if result.is_err() {
        if let Ok(mut flow) = control.flow.lock() {
            flow.failed_emit(sequence);
        }
    }
    result
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
    control: Arc<StreamControl>,
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
    let embedded = managed_browser::verified_embedded_identity(&state, &profile_id, &generation).is_ok();
    if let tungstenite::stream::MaybeTlsStream::Plain(stream) = socket.get_mut() {
        stream
            // A shorter bounded receive period lets headless fallback reach
            // the 5 FPS interaction budget instead of waiting 750ms idle.
            .set_read_timeout(Some(if embedded {
                Duration::from_millis(120)
            } else {
                Duration::from_millis(750)
            }))
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
    while !control.cancel.load(Ordering::SeqCst) {
        if control
            .flow
            .lock()
            .map_err(|_| "Preview flow unavailable.")?
            .is_timed_out(Instant::now())
        {
            return Err("Renderer did not acknowledge browser frame; ending stream.".into());
        }
        if last_check.elapsed() >= Duration::from_secs(1) {
            let (live_port, live_fingerprint) =
                managed_browser::verified_stream_identity(&state, &profile_id, &generation)?;
            if live_port != port || live_fingerprint != fingerprint {
                return Err("Owned Chrome changed while streaming.".into());
            }
            last_check = Instant::now();
        }
        // Headless Chrome can stay silent after startScreencast. Keep its
        // verified connection and adapt screenshot frequency to user activity:
        // 5 fps while interacting, <1 fps while idle. External read-only
        // preview stays at its prior low capture rate.
        if snapshot_pending && last_snapshot_request.elapsed() > Duration::from_secs(3) {
            return Err("Chrome screenshot response timed out.".into());
        }
        let active_input = embedded && control.recently_active();
        let fallback_delay = if active_input {
            MIN_SEND_INTERVAL
        } else if embedded {
            Duration::from_millis(1500)
        } else {
            Duration::from_secs(1)
        };
        if last_screencast.elapsed() >= if embedded { Duration::from_millis(800) } else { Duration::from_secs(2) }
            && !snapshot_pending
            && last_snapshot_request.elapsed() >= fallback_delay
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
                    if last_screencast.elapsed() >= if embedded { Duration::from_millis(700) } else { Duration::from_secs(1) }
                        && last_emit.elapsed() >= MIN_SEND_INTERVAL
                    {
                        if let Ok(data_url) = crate::managed_browser_capture::extract_frame(&text) {
                            if control.cancel.load(Ordering::SeqCst) {
                                break;
                            }
                            emit_frame(
                                &app, &control, &stream_id, &target_id, data_url, "snapshot",
                            )?;
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
                            if control.cancel.load(Ordering::SeqCst) {
                                break;
                            }
                            emit_frame(
                                &app,
                                &control,
                                &stream_id,
                                &target_id,
                                data_url,
                                "screencast",
                            )?;
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
        if has_screencast_frames && control.cancel.load(Ordering::SeqCst) {
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
    let control = Arc::new(StreamControl::new(target_id.clone()));
    let mut active = streams
        .streams
        .lock()
        .map_err(|_| "Screencast registry unavailable.")?;
    for old in active.values() {
        old.cancel.store(true, Ordering::SeqCst);
    }
    active.clear();
    active.insert(stream_id.clone(), control.clone());
    drop(active);
    // Cloning the supervisor shares its same Arc<Mutex<owned Child handles>>.
    // The stream cannot independently create or adopt a Chrome process.
    let browser_state = Arc::new(browsers.inner().clone());
    let worker_stream = stream_id.clone();
    let worker_app = app.clone();
    let worker_control = control;
    tauri::async_runtime::spawn_blocking(move || {
        let _ = execute_stream(
            worker_app,
            browser_state,
            worker_control.clone(),
            worker_stream,
            profile_id,
            generation,
            target_id,
            port,
            fingerprint,
        );
        worker_control.cancel.store(true, Ordering::SeqCst);
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
    if let Some(control) = active.remove(&stream_id) {
        control.cancel.store(true, Ordering::SeqCst);
    }
    Ok(())
}
/// Renderer acknowledges *only* the currently active stream and its exact
/// in-flight sequence; forged, duplicate or stale acknowledgements fail closed.
#[tauri::command]
pub fn managed_browser_stream_ack(
    webview: tauri::Webview,
    streams: tauri::State<'_, BrowserStreamState>,
    stream_id: String,
    sequence: u64,
) -> Result<(), String> {
    managed_browser::primary_ui(&webview)?;
    let active = streams
        .streams
        .lock()
        .map_err(|_| "Stream registry unavailable.")?;
    let control = active
        .get(&stream_id)
        .ok_or("Stream ID is no longer active.")?;
    if control.cancel.load(Ordering::SeqCst) {
        return Err("Stream was cancelled.".into());
    }
    if !control
        .flow
        .lock()
        .map_err(|_| "Flow metrics unavailable.")?
        .acknowledge(sequence, Instant::now())
    {
        return Err("Invalid, duplicate or stale browser frame ACK.".into());
    }
    Ok(())
}
#[tauri::command]
pub fn managed_browser_stream_stats(
    webview: tauri::Webview,
    streams: tauri::State<'_, BrowserStreamState>,
    stream_id: String,
) -> Result<BrowserStreamTelemetry, String> {
    managed_browser::primary_ui(&webview)?;
    let active = streams
        .streams
        .lock()
        .map_err(|_| "Stream registry unavailable.")?;
    let control = active.get(&stream_id).ok_or("Stream no longer active.")?;
    if control.cancel.load(Ordering::SeqCst) {
        return Err("Stream was cancelled.".into());
    }
    let snapshot = control
        .flow
        .lock()
        .map_err(|_| "Flow metrics unavailable.")?
        .stats(&stream_id, Instant::now());
    drop(active);
    // Host process metrics only: Chrome's multi-process CPU/RAM usage is NOT
    // attributed to this stream or represented as a whole-browser total.
    let mut probe = streams
        .host_probe
        .lock()
        .map_err(|_| "Host telemetry unavailable.")?;
    let pid = Pid::from(std::process::id() as usize);
    probe.refresh_process_specifics(pid, ProcessRefreshKind::new().with_cpu().with_memory());
    let (host_cpu_percent, host_rss_bytes) = probe
        .process(pid)
        .map_or((0.0, 0), |process| (process.cpu_usage(), process.memory()));
    Ok(BrowserStreamTelemetry {
        flow: snapshot,
        host_cpu_percent,
        host_rss_bytes,
    })
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
    fn capture_rate_switches_only_for_the_active_target() {
        let state = BrowserStreamState::default();
        let active = Arc::new(StreamControl::new("OWNED_TAB".into()));
        *active.last_input.lock().unwrap() = Instant::now() - Duration::from_secs(5);
        state.streams.lock().unwrap().insert("stream1".into(), active.clone());
        assert!(!active.recently_active(), "idle tab should not run at high frame rate");
        state.mark_interaction("OTHER_TAB");
        assert!(!active.recently_active(), "unrelated browser tabs must not wake this viewer");
        state.mark_interaction("OWNED_TAB");
        assert!(active.recently_active(), "clicking active tab restores interactive frame rate");
        active.cancel.store(true, Ordering::SeqCst);
        *active.last_input.lock().unwrap() = Instant::now() - Duration::from_secs(5);
        state.mark_interaction("OWNED_TAB");
        assert!(!active.recently_active(), "stopped viewers remain idle");
    }
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
