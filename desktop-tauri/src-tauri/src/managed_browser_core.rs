//! Authenticated fixed-destination loopback Core registration.
//! No service credentials or raw CDP WebSocket URLs are returned to React.
use std::io::Read;
use std::time::Duration;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrationReceipt {
    pub registered: bool,
    pub expires_at: u64,
}

pub fn post_registration(
    port: u16,
    token: &str,
    payload: &serde_json::Value,
) -> Result<RegistrationReceipt, String> {
    if port < 1024 || token.len() != 48 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("Invalid local registration transport configuration.".into());
    }
    let endpoint = format!("http://127.0.0.1:{port}/api/browser/managed/register");
    let response = ureq::post(&endpoint)
        .set("Authorization", &format!("Bearer {token}"))
        .set("Content-Type", "application/json")
        .timeout(Duration::from_secs(4))
        .send_string(&payload.to_string())
        .map_err(|_| "Authenticated local Core browser registration unavailable.")?;
    let mut body = String::new();
    response
        .into_reader()
        .take(4096)
        .read_to_string(&mut body)
        .map_err(|_| "Cannot read Core registration response.")?;
    let data: serde_json::Value =
        serde_json::from_str(&body).map_err(|_| "Invalid Core registration response.")?;
    let expires = data["registration"]["expiresAt"]
        .as_u64()
        .ok_or("Missing Core registration expiry.")?;
    let now_ms = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|_| "Clock unavailable.")?
        .as_millis() as u64;
    if data["success"] != true || expires <= now_ms || expires > now_ms + 120_000 {
        return Err("Core did not confirm a current short-lived registration.".into());
    }
    Ok(RegistrationReceipt {
        registered: true,
        expires_at: expires,
    })
}

#[derive(serde::Serialize)]
pub struct ControlReceipt {
    pub mode: String,
}

/// A fixed authenticated loopback handoff; credentials never enter React.
pub fn post_control(port: u16, token: &str, payload: &serde_json::Value) -> Result<ControlReceipt, String> {
    if port != 7888 || token.len() != 48 || !token.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("Invalid local control transport.".into());
    }
    let response = ureq::post("http://127.0.0.1:7888/api/browser/managed/control")
        .set("Authorization", &format!("Bearer {token}"))
        .set("Content-Type", "application/json")
        .timeout(Duration::from_secs(5))
        .send_string(&payload.to_string())
        .map_err(|_| "Authenticated Core browser control handoff unavailable.")?;
    let mut body = String::new();
    response.into_reader().take(2048).read_to_string(&mut body)
        .map_err(|_| "Unable to read browser control acknowledgement.")?;
    let data: serde_json::Value = serde_json::from_str(&body)
        .map_err(|_| "Invalid browser control acknowledgement.")?;
    let expected = payload["mode"].as_str().ok_or("Invalid requested control mode.")?;
    if data["success"] != true || data["mode"] != expected {
        return Err("Core did not acknowledge requested browser control mode.".into());
    }
    Ok(ControlReceipt { mode: expected.to_owned() })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::TcpListener;
    use std::thread;

    fn run_fixture(status: u16, include_registration: bool) -> (u16, thread::JoinHandle<()>) {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let port = listener.local_addr().unwrap().port();
        let handle = thread::spawn(move || {
            let (mut socket, _) = listener.accept().unwrap();
            socket
                .set_read_timeout(Some(Duration::from_secs(3)))
                .unwrap();
            let mut bytes = [0u8; 4096];
            let count = socket.read(&mut bytes).unwrap();
            let request = String::from_utf8_lossy(&bytes[..count]);
            assert!(request.starts_with("POST /api/browser/managed/register HTTP/1.1"));
            assert!(request
                .to_ascii_lowercase()
                .contains("authorization: bearer "));
            assert!(request.contains("application/json"));
            let expires = (std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64)
                + 90_000;
            let body = if include_registration {
                format!(r#"{{"success":true,"registration":{{"expiresAt":{expires}}}}}"#)
            } else {
                r#"{"success":false}"#.to_string()
            };
            let line = if status == 200 {
                "200 OK"
            } else {
                "403 Forbidden"
            };
            let response = format!("HTTP/1.1 {line}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}", body.len());
            socket.write_all(response.as_bytes()).unwrap();
        });
        (port, handle)
    }

    #[test]
    fn local_core_http_accepts_current_registration() {
        let (port, handle) = run_fixture(200, true);
        let data = serde_json::json!({"profileId":"testing","targetId":"page123"});
        let receipt = post_registration(port, &"a".repeat(48), &data).unwrap();
        assert!(receipt.registered);
        handle.join().unwrap();
    }

    #[test]
    fn local_core_http_rejects_denied_registration() {
        let (port, handle) = run_fixture(403, false);
        assert!(post_registration(port, &"b".repeat(48), &serde_json::json!({})).is_err());
        handle.join().unwrap();
    }
}
