# R4 — T-Line external supervised Core owner verification

Source: backend/src/superAgentCoreOwnership.ts and backend/src/superAgentPortProbe.ts.

The default mode is unchanged: legacy 127.0.0.1:7888. No existing local service is stopped or adopted. Optional routing to a separately managed Core requires both environment values:

    TLINE_SUPERAGENT_OWNER_MODE=supervised-external
    TLINE_SUPERAGENT_CORE_PORT=7892

Also point SUPERAGENT_CONFIG_DIR to the private profile of the same supervisor if not using the default user profile. Never reuse port 7888 for supervised-external mode. The backend's normal server-info-PORT.json token stays backend-only and must agree with the selected port.

Before T-Line accepts an authenticated /api/ping on the selected port, it checks the private core-supervisor-PORT.json record for the exact public port and supervisor PID, matches that PID against the Windows TCP LISTENING table, then performs authenticated private control-plane GET /status with the token in the same owner record. The returned supervisor PID, public port and active generation PID must agree with the authenticated owner evidence; no private POST requests are issued. Missing/unreadable/stale/symlinked metadata, no kernel PID or incompatible protocol causes a fail-closed "occupied" classification. If an external port is free, T-Line does not start a Core process on it. If supervised-external is incorrectly set to legacy port 7888, T-Line refuses to attach or autostart.

No automatic POST /api/chat replay is permitted across reconnect; the session resume contract remains explicit. This is an opt-in source/backend routing guard, NOT a signed release of an installed desktop binary. Windows native packaged app E2E, workspace switching under real simultaneous sessions, independent Core worker failure and external OAuth canary remain release-gated under R6.

Test:

    bun --bun x tsc --noEmit --project backend/tsconfig.json
    bun --bun x vitest run backend/tests/superAgentCoreOwnershipR4.test.ts backend/tests/superAgentAuthenticatedOwnerR4.test.ts backend/tests/superAgentCorePort.test.ts backend/tests/coreReconnectSafety.test.ts backend/tests/superAgentAuthConfig.test.ts

### External port unavailable (R4 follow-up)

When supervised-external mode is explicitly selected, even an ECONNREFUSED
result is classified as unverified/occupied, never as a spawnable free port.
The runtime must not start a replacement Core if the external supervisor is
missing or late after reboot. This is source-level failure safety; the native
installed package remains an independent R6 certification gate.


### Authenticated Core owner contract v1 (2026-10-26)

The `supervised-external` opt-in now requires an authenticated Core
private `GET /status` to return a versioned owner contract in addition
to the supervisor PID and active worker PID:

```json
{
  "ownerContract": {
    "version": 1,
    "role": "core-supervisor",
    "mcpLifecycle": "not-owned",
    "replayPolicy": "explicit-resume-only"
  }
}
```

Missing/unknown versions, Core owners claiming MCP lifecycle control,
and implicit replay policies are rejected as incompatible/occupied.
This is a conservative fail-closed upgrade: earlier Core versions
without the new private contract are intentionally not accepted in
opt-in external mode. Legacy default mode remains unchanged.

This handshake is source-level implementation and has passed backend
negative tests and an independently started private Core stage;
it does NOT certify installed desktop, transport encryption, or
production client migration.
