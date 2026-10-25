//! Read-only, bounded image capture from an already verified local Chrome tab.
//! Never accepts an arbitrary host, WebSocket URL, CDP method, or user command.
use serde::Serialize;
use std::io::Read;
use std::time::Duration;
use tungstenite::protocol::WebSocketConfig;
use tungstenite::Message;

const MAX_DISCOVERY: u64 = 128 * 1024;
const MAX_FRAME: usize = 2_500_000;
const MAX_BASE64: usize = 2_000_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserFrame {
    pub target_id: String,
    pub data_url: String,
    pub captured_at: u64,
}

fn checked_debugger_url(port: u16, target: &str, raw: &str) -> Result<String, String> {
    if target.len() > 128
        || target.is_empty()
        || !target
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("Invalid capture target.".into());
    }
    let url = tauri::Url::parse(raw).map_err(|_| "Malformed page debugging URL.")?;
    if url.scheme() != "ws"
        || url.host_str() != Some("127.0.0.1")
        || url.port() != Some(port)
        || url.path() != format!("/devtools/page/{target}")
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err("Page debugger is outside the verified local target.".into());
    }
    Ok(raw.to_owned())
}
fn extract_frame(raw: &str) -> Result<String, String> {
    if raw.len() > MAX_FRAME {
        return Err("Browser screenshot exceeds the frame limit.".into());
    }
    let value: serde_json::Value =
        serde_json::from_str(raw).map_err(|_| "Invalid browser screenshot response.")?;
    if value["id"] != 7 || !value["error"].is_null() {
        return Err("Browser screenshot capture was rejected.".into());
    }
    let encoded = value["result"]["data"]
        .as_str()
        .ok_or("Browser returned no screenshot.")?;
    if encoded.is_empty()
        || encoded.len() > MAX_BASE64
        || !encoded.starts_with("/9j/")
        || !encoded
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'+' || b == b'/' || b == b'=')
    {
        return Err("Browser screenshot was not a bounded JPEG image.".into());
    }
    Ok(format!("data:image/jpeg;base64,{encoded}"))
}
pub fn capture_page_frame(port: u16, target_id: &str) -> Result<BrowserFrame, String> {
    if port < 1024 {
        return Err("Invalid owned browser port.".into());
    }
    // Never accept arbitrary endpoints or target names from a webpage.
    if target_id.len() > 128
        || target_id.is_empty()
        || !target_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    {
        return Err("Invalid capture target.".into());
    }
    let response = ureq::get(&format!("http://127.0.0.1:{port}/json/list"))
        .timeout(Duration::from_secs(2))
        .call()
        .map_err(|_| "Owned browser tab listing unavailable.")?;
    let mut body = String::new();
    response
        .into_reader()
        .take(MAX_DISCOVERY)
        .read_to_string(&mut body)
        .map_err(|_| "Cannot inspect owned browser targets.")?;
    let tabs: serde_json::Value =
        serde_json::from_str(&body).map_err(|_| "Invalid owned browser target listing.")?;
    let tab = tabs
        .as_array()
        .and_then(|list| {
            list.iter()
                .find(|item| item["type"] == "page" && item["id"].as_str() == Some(target_id))
        })
        .ok_or("Capture target no longer belongs to the managed browser.")?;
    let raw_ws = tab["webSocketDebuggerUrl"]
        .as_str()
        .ok_or("Page debugging endpoint unavailable.")?;
    let debugger = checked_debugger_url(port, target_id, raw_ws)?;

    let (mut socket, _) = tungstenite::connect(debugger.as_str())
        .map_err(|_| "Managed page CDP socket unavailable.")?;
    socket.set_config(|config: &mut WebSocketConfig| {
        config.max_message_size = Some(MAX_FRAME);
        config.max_frame_size = Some(MAX_FRAME);
    });
    if let tungstenite::stream::MaybeTlsStream::Plain(stream) = socket.get_mut() {
        stream
            .set_read_timeout(Some(Duration::from_secs(3)))
            .map_err(|_| "Cannot set browser capture timeout.")?;
        stream
            .set_write_timeout(Some(Duration::from_secs(3)))
            .map_err(|_| "Cannot set browser capture timeout.")?;
    }
    let command = r#"{"id":7,"method":"Page.captureScreenshot","params":{"format":"jpeg","quality":55,"captureBeyondViewport":false}}"#;
    socket
        .send(Message::Text(command.into()))
        .map_err(|_| "Could not request browser screenshot.")?;
    for _ in 0..20 {
        match socket.read().map_err(|_| "Browser screenshot timed out.")? {
            Message::Text(data) => {
                let value: serde_json::Value =
                    serde_json::from_str(&data).map_err(|_| "Invalid page CDP response.")?;
                if value["id"] == 7 {
                    let data_url = extract_frame(&data)?;
                    let captured_at = std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .map_err(|_| "Clock unavailable.")?
                        .as_millis() as u64;
                    return Ok(BrowserFrame {
                        target_id: target_id.to_owned(),
                        data_url,
                        captured_at,
                    });
                }
            }
            Message::Close(_) => return Err("Managed browser screenshot connection closed.".into()),
            _ => {}
        }
    }
    Err("Browser did not respond to bounded screenshot request.".into())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn accepts_only_exact_local_page_debugger_urls() {
        let valid = "ws://127.0.0.1:54321/devtools/page/TARGET1";
        assert!(checked_debugger_url(54321, "TARGET1", valid).is_ok());
        for url in [
            "ws://other-host:54321/devtools/page/TARGET1",
            "ws://127.0.0.1:54321/devtools/page/OTHER",
            "ws://127.0.0.1:54322/devtools/page/TARGET1",
            "wss://127.0.0.1:54321/devtools/page/TARGET1",
            "ws://127.0.0.1:54321/devtools/page/TARGET1?token=secret",
        ] {
            assert!(checked_debugger_url(54321, "TARGET1", url).is_err());
        }
    }
    #[test]
    fn rejects_oversized_or_malformed_capture_frames() {
        assert!(extract_frame(r#"{"id":7,"result":{"data":"/9j/test=="}}"#).is_ok());
        assert!(extract_frame(r#"{"id":7,"result":{"data":"AA=="}}"#).is_err());
        assert!(extract_frame(r#"{"id":8,"result":{"data":"/9j/test=="}}"#).is_err());
        assert!(extract_frame(r#"{"id":7,"error":{"message":"denied"}}"#).is_err());
        assert!(extract_frame(&"x".repeat(MAX_FRAME + 1)).is_err());
    }
}
