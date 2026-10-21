//! Authenticates a local backend without ever sending its bypass bearer token.
//! This is a proof-of-possession protocol for reattaching to a known T-Line backend.
use std::io::Read;
use std::time::Duration;

const IDENTITY_DOMAIN: &str = "tline-backend-v1:";

fn decode_hex(input: &str) -> Option<Vec<u8>> {
    if input.len() % 2 != 0 || !input.is_ascii() {
        return None;
    }
    (0..input.len())
        .step_by(2)
        .map(|index| u8::from_str_radix(&input[index..index + 2], 16).ok())
        .collect()
}

fn verify_proof(token: &str, nonce: &str, proof: &str) -> bool {
    if token.len() != 64
        || decode_hex(token).map_or(true, |bytes| bytes.len() != 32)
        || nonce.len() != 32
        || decode_hex(nonce).map_or(true, |bytes| bytes.len() != 16)
        || proof.len() != 64
    {
        return false;
    }
    let Some(bytes) = decode_hex(proof) else {
        return false;
    };
    let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, token.as_bytes());
    ring::hmac::verify(
        &key,
        format!("{}{}", IDENTITY_DOMAIN, nonce).as_bytes(),
        &bytes,
    )
    .is_ok()
}

pub fn verify_local_backend(port: u16, token: Option<&str>) -> bool {
    let Some(token) = token.filter(|t| t.len() == 64) else {
        return false;
    };
    // Every probe uses a new nonce, and no query or header contains the token.
    let mut random = [0u8; 16];
    if ring::rand::SecureRandom::fill(&ring::rand::SystemRandom::new(), &mut random).is_err() {
        return false;
    }
    let nonce: String = random.iter().map(|b| format!("{b:02x}")).collect();
    let url = format!("http://127.0.0.1:{port}/api/desktop/identity?nonce={nonce}");
    let response = ureq::get(&url).timeout(Duration::from_millis(800)).call();
    let Ok(response) = response else {
        return false;
    };
    let mut body = Vec::new();
    if response
        .into_reader()
        .take(513)
        .read_to_end(&mut body)
        .is_err()
        || body.len() > 512
    {
        return false;
    }
    let Ok(value) = serde_json::from_slice::<serde_json::Value>(&body) else {
        return false;
    };
    value.get("protocol").and_then(|v| v.as_str()) == Some("tline-backend-v1")
        && value
            .get("proof")
            .and_then(|v| v.as_str())
            .is_some_and(|proof| verify_proof(token, &nonce, proof))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PortDecision {
    AttachVerified,
    StartOnFreePort,
    RefuseOccupied,
}
pub fn decide_port(occupied: bool, authenticated: bool) -> PortDecision {
    match (occupied, authenticated) {
        (false, _) => PortDecision::StartOnFreePort,
        (true, true) => PortDecision::AttachVerified,
        (true, false) => PortDecision::RefuseOccupied,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn occupied_unverified_port_never_allows_start_or_kill() {
        assert_eq!(decide_port(true, false), PortDecision::RefuseOccupied);
        assert_eq!(decide_port(true, true), PortDecision::AttachVerified);
        assert_eq!(decide_port(false, false), PortDecision::StartOnFreePort);
        assert_eq!(decide_port(false, true), PortDecision::StartOnFreePort);
    }
    #[test]
    fn hmac_proof_is_bound_to_nonce_and_ephemeral_token() {
        let token = "a".repeat(64);
        let nonce = "b".repeat(32);
        let key = ring::hmac::Key::new(ring::hmac::HMAC_SHA256, token.as_bytes());
        let sig = ring::hmac::sign(&key, format!("{}{}", IDENTITY_DOMAIN, nonce).as_bytes());
        let proof: String = sig.as_ref().iter().map(|b| format!("{b:02x}")).collect();
        assert!(verify_proof(&token, &nonce, &proof));
        assert!(!verify_proof(&token, &"c".repeat(32), &proof));
        assert!(!verify_proof(&"d".repeat(64), &nonce, &proof));
        assert!(!verify_proof(&token, &nonce, &"z".repeat(64)));
        assert!(!verify_proof("malformed", &nonce, &proof));
    }
    #[test]
    fn rejects_foreign_port_without_disclosing_bearer_token() {
        use std::io::{Read, Write};
        use std::net::TcpListener;
        let listener = TcpListener::bind(("127.0.0.1", 0)).expect("test loopback bind");
        let port = listener.local_addr().unwrap().port();
        let captured = std::thread::spawn(move || {
            let (mut connection, _) = listener.accept().expect("test connection");
            let mut request = [0u8; 4096];
            let length = connection.read(&mut request).unwrap();
            let text = String::from_utf8_lossy(&request[..length]).to_string();
            let json = r#"{"protocol":"tline-backend-v1","proof":"0000000000000000000000000000000000000000000000000000000000000000"}"#;
            let response = format!("HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", json.len(), json);
            let _ = connection.write_all(response.as_bytes());
            text
        });
        let token = "d".repeat(64);
        assert!(!verify_local_backend(port, Some(&token)));
        let request = captured.join().expect("socket thread");
        assert!(request.starts_with("GET /api/desktop/identity?nonce="));
        assert!(!request.contains(&token));
        assert!(!request.to_ascii_lowercase().contains("authorization:"));
    }
    #[test]
    fn never_authenticates_without_a_full_session_token() {
        assert!(!verify_local_backend(5779, None));
        assert!(!verify_local_backend(5779, Some("")));
    }
}
