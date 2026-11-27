//! One-shot CDP page commands used by the T-Line toolbar.
//!
//! Human input, scrolling, media, and rendering are handled by the real
//! browser window itself. T-Line only issues the explicit navigation commands
//! the user asks for, over the already verified loopback debugging port.
use serde_json::{json, Value};
use std::time::Duration;
use tungstenite::protocol::WebSocketConfig;
use tungstenite::Message;

const MAX_REPLY_BYTES: usize = 256 * 1024;
const READ_TIMEOUT: Duration = Duration::from_secs(4);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PageAction {
    Navigate,
    Reload,
    Back,
    Forward,
}

pub fn parse_action(raw: &str) -> Result<PageAction, String> {
    match raw {
        "navigate" => Ok(PageAction::Navigate),
        "reload" => Ok(PageAction::Reload),
        "back" => Ok(PageAction::Back),
        "forward" => Ok(PageAction::Forward),
        _ => Err("Unsupported browser action.".into()),
    }
}

fn page_socket_url(port: u16, target_id: &str) -> Result<String, String> {
    if port < 1024 {
        return Err("Invalid local debugging port.".into());
    }
    if target_id.is_empty()
        || target_id.len() > 128
        || !target_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-' || byte == b'_')
    {
        return Err("Invalid browser target identifier.".into());
    }
    Ok(format!("ws://127.0.0.1:{port}/devtools/page/{target_id}"))
}

/// Sends exactly one CDP command to exactly one verified page target.
pub fn page_command(
    port: u16,
    target_id: &str,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    let url = page_socket_url(port, target_id)?;
    let (mut socket, _) = tungstenite::connect(url.as_str())
        .map_err(|_| "Browser debugging channel unavailable.".to_string())?;
    socket.set_config(|config: &mut WebSocketConfig| {
        config.max_message_size = Some(MAX_REPLY_BYTES);
        config.max_frame_size = Some(MAX_REPLY_BYTES);
    });
    if let tungstenite::stream::MaybeTlsStream::Plain(stream) = socket.get_mut() {
        let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
        let _ = stream.set_write_timeout(Some(READ_TIMEOUT));
    }
    let request = json!({ "id": 1, "method": method, "params": params }).to_string();
    socket
        .send(Message::Text(request.into()))
        .map_err(|_| "Browser rejected the command channel.".to_string())?;
    for _ in 0..12 {
        match socket.read() {
            Ok(Message::Text(reply)) => {
                if reply.len() > MAX_REPLY_BYTES {
                    return Err("Browser response was too large.".into());
                }
                let value: Value = serde_json::from_str(&reply)
                    .map_err(|_| "Invalid browser response.".to_string())?;
                if value["id"] != 1 {
                    continue;
                }
                if !value["error"].is_null() {
                    return Err("Browser rejected this action.".into());
                }
                let _ = socket.close(None);
                return Ok(value["result"].clone());
            }
            Ok(Message::Ping(payload)) => {
                let _ = socket.send(Message::Pong(payload));
            }
            Ok(_) => continue,
            Err(tungstenite::Error::Io(ref error))
                if matches!(
                    error.kind(),
                    std::io::ErrorKind::WouldBlock | std::io::ErrorKind::TimedOut
                ) =>
            {
                return Err("Browser did not answer in time.".into());
            }
            Err(_) => return Err("Browser command channel closed.".into()),
        }
    }
    Err("Browser did not acknowledge this action.".into())
}

/// Applies a toolbar action to the verified page target.
pub fn apply_action(
    port: u16,
    target_id: &str,
    action: PageAction,
    url: Option<&str>,
) -> Result<Value, String> {
    match action {
        PageAction::Navigate => {
            let address = crate::browser::engine::sanitized_url(url)?;
            page_command(port, target_id, "Page.navigate", json!({ "url": address }))
        }
        PageAction::Reload => page_command(port, target_id, "Page.reload", json!({})),
        PageAction::Back => page_command(
            port,
            target_id,
            "Runtime.evaluate",
            json!({ "expression": "history.back()", "awaitPromise": false }),
        ),
        PageAction::Forward => page_command(
            port,
            target_id,
            "Runtime.evaluate",
            json!({ "expression": "history.forward()", "awaitPromise": false }),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn socket_urls_are_loopback_and_bounded() {
        assert_eq!(
            page_socket_url(53331, "ABC-123_x").unwrap(),
            "ws://127.0.0.1:53331/devtools/page/ABC-123_x"
        );
        assert!(page_socket_url(80, "ABC").is_err());
        assert!(page_socket_url(53331, "../escape").is_err());
        assert!(page_socket_url(53331, "").is_err());
    }

    #[test]
    fn actions_are_allow_listed() {
        assert_eq!(parse_action("navigate").unwrap(), PageAction::Navigate);
        for invalid in ["Runtime.evaluate", "", "eval", "Page.navigate"] {
            assert!(parse_action(invalid).is_err());
        }
    }
}
