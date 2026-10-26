# T-Line Backend Crash Diagnostics (Windows)

T-Line records backend failure evidence locally, without sending it to any external service.

## What is recorded

- **Bun/Node reporter**: `%USERPROFILE%\.tline-logs\backend-crashes.jsonl`. One JSON object per startup, unhandled rejection, uncaught exception, or exit. Includes UTC time, PID, runtime/version, uptime, memory summary, stack trace (when available), and at most 25 sanitized preceding console lines. Fatal writes are synchronous and flushed to disk.
- **Desktop supervisor**: `backend_exit.log` inside the Tauri app-data directory. Includes timestamp (Unix milliseconds), event, PID when owned, and kernel exit status. This is valuable when the OS kills Bun, an external tool terminates it, or the native runtime crashes without executing JavaScript hooks.
- **Desktop stdout/stderr**: `backend_run.log` in the same Tauri app-data directory, appended across restarts. Output is capped near 5 MiB with the most recent ~2 MiB retained. There is no truncate/create race between the stdout and stderr readers.
- **Existing text log**: `%USERPROFILE%\.tline-backend.log` remains available; rotation retains the newest half instead of clearing the entire file.

The Bun crash reporter keeps one rotated backup at `backend-crashes.jsonl.1`; the desktop lifecycle reporter keeps one backup at `backend_exit.log.1`. The records use best-effort credential redaction; inspect before forwarding externally.

## Quick diagnostics

Run in PowerShell after the error:

```powershell
Get-Content "$HOME\.tline-logs\backend-crashes.jsonl" -Tail 20
Get-Content "$HOME\.tline-backend.log" -Tail 80
Get-ChildItem "$env:APPDATA" -Recurse -Filter backend_exit.log -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Host $_.FullName
  Get-Content $_.FullName -Tail 30
  Get-Content (Join-Path $_.DirectoryName "backend_run.log") -Tail 80 -ErrorAction SilentlyContinue
}
```

Match the **PID** and timestamp across files. If the crash JSONL contains an `uncaught_exception` or `unhandled_rejection` record, examine the stack. If it contains `startup` but no corresponding `exit`, while Tauri reports `unexpected_exit`, suspect an external termination, native fault, or OS resource issue. A `startup_timeout` is a health/auth readiness failure, not proof of a process crash.

The reporter does not automatically restart backend workers, resend agent prompts, or terminate another application's listener. The native supervisor records exits only for children it launched and owns. It cannot report events that happen after the entire Tauri process itself has been forcibly killed.

## Validation

- Isolated Bun child crash test verifies that a real uncaught exception creates a synchronous record and redacts tokens.
- Rust unit tests verify lifecycle record persistence and redaction of backend stdout/stderr.
- Build checks: `bun run --filter backend build`, `cargo test --manifest-path desktop-tauri/src-tauri/Cargo.toml --lib backend_diagnostics`.

Avoid posting unreviewed logs publicly: third-party libraries can emit confidential values in formats that generic redaction does not recognize.
