# Core HTTP / MCP split: T-Line opt-in routing

Default behavior: T-Line continues to connect to **127.0.0.1:7888** and obtains its corresponding bearer from the private `~/.superagent-r/server-info-7888.json`. Existing sessions are not modified by this change.

## Prepared option

T-Line backend can be launched with `TLINE_SUPERAGENT_CORE_PORT=7892` to opt into a separately supervised Core on the same host. **Do not set this on your production T-Line backend until the target Core has the intended config/profile, all active sessions have been reviewed, and the target server-info token is available to the T-Line backend.** The current supervised canary on port 7892 uses a disposable staging profile and does not contain production sessions.

All T-Line backend REST/SSE proxies, desktop task/status routes, preset/profile APIs, studio proxies, history requests, authenticated port probe and port-scoped bearer discovery now use the same resolver. The resolver only accepts a decimal TCP port 1024–65535, never a hostname or URL. Missing or bad discovery data never falls back to the bearer on 7888.

Non-default ports are **externally owned**: when the target is free, T-Line rejects automatic Core startup rather than silently launching a new server on 7888 or taking over an unknown port. Unrecognized listeners and invalid bearer responses continue to fail closed. The unsafe legacy `forceKillPort7888` function is disabled. The renderer never receives the server's bearer.

## Local-only verification performed

- Existing default: authenticated ping/port probe at 7888 works when the token is read from the original profile.
- Temporary opt-in test: with `SUPERAGENT_CONFIG_DIR` scoped to the existing isolated canary profile and `TLINE_SUPERAGENT_CORE_PORT=7892`, port probe reports compatible; no production setting or session state is changed.
- TypeScript backend check and focused reconnect/auth/port safety tests pass.
- Only backend routing code was changed; there was no T-Line desktop process restart, UI session resume, production migration or external MCP provider connection.

## Production cutover boundary

The running 7888 instance was launched without the Core supervisor and also owns the existing MCP OAuth tunnel on 6789. No system supports inheriting its bound TCP socket, OAuth session state or live in-memory agent objects. **Do not kill or replace that process to activate the port override.** Keep the existing listener until external MCP clients have explicitly reconnected to a separately owned authenticated MCP endpoint and legacy Core sessions have been inventoried/resumed or finished. Cloudflare quick-tunnel URLs are ephemeral and cannot be promised to transfer to a new process. Changes to environment are only effective after a backend restart/launch, never as a silent hot-session migration.

Rollback: launch T-Line without `TLINE_SUPERAGENT_CORE_PORT`; it will continue targeting the original 7888 listener as long as that verified owner remains running. No automatic chat/tool replay is allowed.
