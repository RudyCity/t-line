//! Durable, bounded logs for the desktop-owned backend process.
//! No network requests, environment dumps, or process termination here.
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::Path;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;
const KEEP_BYTES: u64 = 2 * 1024 * 1024;
const MAX_LIFECYCLE_BYTES: u64 = 2 * 1024 * 1024;

fn timestamp_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis()
}

fn redact(mut line: String) -> String {
    // Suppress common credential forms that may reach stdout/stderr as part of
    // upstream exceptions. Crash dumps never include full process env.
    for needle in ["bearer ", "token=", "api_key=", "apikey=", "password=", "secret=",
        "\"token\":\"", "\"apiKey\":\"", "\"password\":\""] {
        let mut start = 0;
        while start < line.len() {
            let lower = line.to_ascii_lowercase();
            let Some(relative) = lower[start..].find(&needle.to_ascii_lowercase()) else { break };
            let value_start = start + relative + needle.len();
            let rest = &line[value_start..];
            let length = rest.find(|c: char| {
                c.is_whitespace() || matches!(c, ',' | ';' | '&' | '\'' | '"' | '}' | ']')
            }).unwrap_or(rest.len());
            if length == 0 { start = value_start; continue; }
            let value_end = value_start + length;
            line.replace_range(value_start..value_end, "[REDACTED]");
            start = value_start + "[REDACTED]".len();
        }
    }
    line.chars().take(4096).collect()
}

fn append_record(target: &Path, event: &str, pid: Option<u32>, detail: &str) -> io::Result<()> {
    if let Some(parent) = target.parent() { fs::create_dir_all(parent)?; }
    if fs::metadata(target).is_ok_and(|meta| meta.len() > MAX_LIFECYCLE_BYTES) {
        let backup = target.with_extension("log.1");
        let _ = fs::remove_file(&backup);
        fs::rename(target, backup)?;
    }
    let mut file = OpenOptions::new().create(true).append(true).open(target)?;
    writeln!(file, "time_ms={} event={} pid={} detail={}",
        timestamp_ms(), event, pid.map_or("none".to_string(), |p| p.to_string()), redact(detail.to_string()))?;
    file.sync_all()
}

pub fn record_backend_event(app_data: &Path, event: &str, pid: Option<u32>, detail: &str) {
    if let Err(error) = append_record(&app_data.join("backend_exit.log"), event, pid, detail) {
        eprintln!("[tauri] Failed to save backend lifecycle diagnostic: {error}");
    }
}

/// A single shared append-only writer: stdout and stderr must not race a
/// File::create/truncate operation. Retain the last 2 MiB on rollover.
pub struct BackendRunLog {
    file: Mutex<File>,
}

impl BackendRunLog {
    pub fn open(target: &Path) -> io::Result<Self> {
        if let Some(parent) = target.parent() { fs::create_dir_all(parent)?; }
        let file = OpenOptions::new().create(true).append(true).read(true).open(target)?;
        Ok(Self { file: Mutex::new(file) })
    }

    pub fn line(&self, source: &str, text: &str) {
        let Ok(mut file) = self.file.lock() else { return };
        if file.metadata().is_ok_and(|m| m.len() > MAX_LOG_BYTES) {
            let mut tail = Vec::new();
            if file.seek(SeekFrom::End(-(KEEP_BYTES as i64))).is_ok()
                && file.read_to_end(&mut tail).is_ok() {
                let after_newline = tail.iter().position(|b| *b == b'\n').map_or(0, |index| index + 1);
                if file.set_len(0).is_ok() {
                    let _ = file.write_all(b"[backend_run] Rotated to last 2 MiB\n");
                    let _ = file.write_all(&tail[after_newline..]);
                }
            }
        }
        let _ = writeln!(file, "time_ms={} [{}] {}", timestamp_ms(), source, redact(text.to_owned()));
        let _ = file.flush();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn persists_lifecycle_exit_with_pid() {
        let directory = std::env::temp_dir().join(format!("tline-exit-test-{}-{}", std::process::id(), timestamp_ms()));
        append_record(&directory.join("backend_exit.log"), "unexpected_exit", Some(123), "code=5").unwrap();
        let content = fs::read_to_string(directory.join("backend_exit.log")).unwrap();
        assert!(content.contains("event=unexpected_exit pid=123 detail=code=5"));
        fs::remove_dir_all(directory).unwrap();
    }

    #[test]
    fn redacts_sensitive_output_before_writing() {
        let directory = std::env::temp_dir().join(format!("tline-stdout-test-{}-{}", std::process::id(), timestamp_ms()));
        let target = directory.join("backend_run.log");
        let log = BackendRunLog::open(&target).unwrap();
        log.line("stderr", "Authorization: Bearer mysecret token=abc123");
        let content = fs::read_to_string(target).unwrap();
        assert!(!content.contains("mysecret"));
        assert!(!content.contains("abc123"));
        assert!(content.contains("[REDACTED]"));
        fs::remove_dir_all(directory).unwrap();
    }
}
