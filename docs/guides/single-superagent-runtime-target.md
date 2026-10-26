# One SuperAgent runtime target per T-Line backend

**Architecture:** One active T-Line desktop and backend connect to ONE selected
SuperAgent Core at a time. SuperAgent remains the only Core/MCP/OAuth runtime
owner. Its test environment is a temporary isolated private Core owner, NOT
a second persistent T-Line backend. No duplicated T-Line desktop backend or
new staging services are required for ordinary daily usage.

## Default — primary

No additional environment variables are necessary. The default primary
SuperAgent runtime uses the existing local Core port 7888 and normal
`~/.superagent-r` profile. Existing sessions remain on the primary runtime.
No migration, endpoint change or process stop occurs by adding this feature.

## Optional temporary testing

The isolated SuperAgent Core must ALREADY be running on a separate nonlegacy
loopback port, using its own *existing* stage profile under
`%USERPROFILE%\.superagent-local-staging\`. Start the T-Line process from
a shell with these variables already set (example values; inspect ownership
and replace with your actual verified test port/profile):

```powershell
$env:TLINE_SUPERAGENT_RUNTIME='testing'
$env:TLINE_SUPERAGENT_OWNER_MODE='supervised-external'
$env:TLINE_SUPERAGENT_CORE_PORT='58922'
$env:SUPERAGENT_CONFIG_DIR=Join-Path $HOME '.superagent-local-staging\my-private-core'
# Start your installed T-Line desktop app from this SAME environment.
```

Never use the legacy/protected ports 6759, 6789, 7888 or 9877 for the
testing target. T-Line requires the exact private authenticated Core owner,
its OS listening PID, the versioned ownership contract and matching
service token. Invalid test configuration prevents the backend starting.
An offline test Core is reported as unavailable: **T-Line will NOT start,
adopt or stop another Core** and will not silently fall back to primary.

The selected runtime is fixed at backend startup. To return to primary,
finish/cancel pending work, close T-Line, remove the testing environment
variables, and relaunch the same desktop application. Do not transfer
chat/MCP session IDs, OAuth keys, or unfinished tool executions.

```powershell
$env:TLINE_SUPERAGENT_RUNTIME='primary'
Remove-Item Env:TLINE_SUPERAGENT_OWNER_MODE -ErrorAction SilentlyContinue
Remove-Item Env:TLINE_SUPERAGENT_CORE_PORT -ErrorAction SilentlyContinue
Remove-Item Env:SUPERAGENT_CONFIG_DIR -ErrorAction SilentlyContinue
# Relaunch T-Line with the normal primary runtime after checking active work.
```

## UI, health and end-to-end acceptance

In **SuperAgent Settings → Execution & Workspace**, the current primary/testing
runtime, selected local port, and verified readiness appear. The endpoint
`GET /api/superagent/runtime-target` is read-only and authenticated; it
exposes no credentials or config directory paths. There is intentionally
no live hot-switch POST because moving an active WebSocket connection
might replay an accepted external tool action.

Unit/rejection tests:
`bun --bun x vitest run backend/tests/superAgentRuntimeTarget.test.ts`.

Real local Windows stage smoke (short-lived, no T-Line backend spawned):
`bun scripts/verify-single-backend-runtime-target.ts`.
This test launches only one isolated, test-owned SuperAgent Core and
exercises the real T-Line owner/authenticated port probe. It refuses
foreign profiles, verifies existing production listener PIDs are
unchanged, and cleans up its test Core. It is NOT an installed desktop
certification and does NOT configure a public OAuth issuer.

**Final intended deployment:** only the primary SuperAgent Core/MCP
owners plus ONE T-Line backend run during normal use; temporary test
Core/issuer/ingress instances are shut down and verified stopped after
testing. No automatic deletion of unverified stage processes or
Scheduled Tasks, no shutdown of legacy owners, and no production
cutover without individual release gates.
