# T-Line Managed Browser Runtime — Implementation Plan

**Date:** 2026-10-25
**Status:** PLAN ONLY — no managed browser launched, bundled, installed, or tested as part of this document
**Primary workspace:** T-Line (Windows-first Tauri/Bun/React)
**Runtime workspace:** SuperAgent (canonical authenticated CDP lease, agent operations, permission policy)
**Related plans:** [Browser V2 audit](2026-10-25-tline-browser-v2.md), [Persistent parallel assistant](2026-10-25-persistent-parallel-assistant-workspace.md)

## 1. Product decision

Make T-Line a **desktop browser manager with optional in-app live viewer**, rather than relying on embedded WebView2 for public third-party websites.

1. **Managed System Chrome (first choice for public sites):** discover an installed, supported stable Chrome executable; spawn a *separate real visible browser process* with an explicitly owned, non-default T-Line user-data directory and a dynamically selected loopback CDP transport. Never alter, attach to without permission, or kill a user's existing personal Chrome instance.
2. **Managed Bundled Chromium (opt-in/offline fallback after distribution review):** include or download a permitted, pinned Chromium browser binary; verify provenance, hashes, integrity, licensing/notices, Windows signing and patch delivery. Do **not** assume redistributing branded Google Chrome is allowed. Compare runtime behavior with stable Chrome on supported websites.
3. **Native WebView2:** keep for trusted local development previews and existing local/browser fallback flows, not the default for public login/payment pages.
4. **Chrome for Testing:** reserve for reproducible automation/E2E; it does not auto-update and is not intended as the everyday user browser.

**MVP experience:** T-Line creates/selects managed browser profile; launches a visible Chrome window; shows mapped tabs, URLs, target leases and agent activity within T-Line; agents safely control the same Chrome targets through SuperAgent's existing CDP Gateway. The browser window remains the authoritative renderer.

**Phase 2 experience:** an optional *interactive mirrored Chrome viewport* inside a T-Line panel, using bounded CDP screencast and input events. This is NOT native embedding of the Chrome window and MUST be explicitly labeled as a mirror. If delayed/unavailable, users can use the actual Chrome window immediately via "Focus browser".

**Success is functional compatibility, not anti-bot evasion.** A real Chrome process can avoid some embedded-browser restrictions, but websites can still prohibit automation, enforce CAPTCHA or require special sign-in. Do not add stealth fingerprints, CAPTCHA bypass, credential extraction, unsolicited bulk traffic or anti-spam circumvention. For OAuth requiring a system browser, launch the official external authentication flow and accept provider restrictions.

## 2. Code baseline verified on 2026-10-25

| Capability | Existing owner / source | Build vs reuse |
| --- | --- | --- |
| Native browser tab rendering and session-preserving lifetime | T-Line: frontend/src/components/BrowserTab.tsx, browserUrlUtils.ts, hooks/useBrowserListeners.ts | Keep as independent native renderer; add a runtime selector and a managed-browser controller. |
| Session panel / manual owner-token sharing | T-Line: BrowserAgentSessions.tsx, BrowserSharedControls.tsx | Extend to selected managed profile, target tabs, ownership and feedback, without duplicating coordinator. |
| Read-only browser monitoring | T-Line: backend/src/browserSessions.ts; superAgentRoutes.ts GET /browser/sessions | Reuse projections, add typed supervised-runtime status rather than direct unscoped CDP access. |
| Shared collaboration controls | T-Line: superAgentRoutes.ts POST /browser/shared-control | Preserve owner-token authorization, fixed-action validation, no plaintext persistence. |
| CDP target commands / port selectors | SuperAgent: src/core/tools/chromeCdpTools.ts; chromeCdpHelpers.ts | Reuse with dynamic port/target IDs, no hardcoded 9222 requirement for managed instances. |
| Cross-client authenticated gateway | SuperAgent: src/core/mcp/tools/chromeMcpTools.ts (superagent_browser_gateway) | Reuse identity / discover / claim / share / execute / heartbeat / release, add trusted runtime registration only if a narrow missing contract is demonstrated. |
| Cross-process tab locks, TTL, claims | SuperAgent: src/core/tools/chromeCdpSessionManager.ts | Canonical ownership and queue; do not create a second ownership store in T-Line. |
| Desktop lifecycle and process state | T-Line: desktop-tauri/src-tauri/src/lib.rs, state.rs | Add isolated process supervisor module, no shared-core restart. |
| Cross-project bridge contract | T-Line AGENTS.md, backend/src/superAgentRoutes.ts / superAgentBridge.ts | All SuperAgent state/actions via authenticated fixed endpoints; no direct .superagent-r writes in T-Line backend. |

**Present gap:** monitoring an existing external Chrome CDP session is not the same thing as launching and safely owning that browser process, rendering its frames in T-Line, or mapping its tab lifecycle. None of those are marked implemented here.

## 3. Architecture and authority boundaries

```text
T-Line React
  Browser toolbar / runtime selector / browser profiles / tabs / agent activity
          | authenticated desktop invoke OR authenticated T-Line HTTP
          v
T-Line Desktop BrowserSupervisor (Rust; owned OS process lifecycle)
  discover installed executable -> verify -> spawn owned process -> alive/exit/recover
  nondefault user-data-dir / PID identity / bounded port or pipe / runtime manifest
          | local, never exposes raw CDP over public HTTP
          v
Actual Chrome / permitted Chromium process
          | CDP: browser/target discovery, screenshot, navigation, input
          v
SuperAgent CDP Gateway (canonical target sessions and permissions)
  explicit target claims + leases + observer/contributor/owner + mutation queue
          | authenticated fixed-action projection and event stream
          v
T-Line backend (authorized thin proxy) -> T-Line React agent/task viewer
```

- **Desktop owns process lifetime only**, verifies executable/process identity and cannot kill unowned Chrome PIDs.
- **SuperAgent owns CDP target lease/permission state**, the per-agent action queue and audit evidence, including target revisions and idempotent state changes. T-Line does not save duplicate CDP claims.
- **T-Line backend** is an authenticated adapter; it never forwards arbitrary CDP WebSocket URLs, arbitrary shell commands, arbitrary origins or client-supplied executable paths as a generic execution API.
- **Frontend** receives a redacted, user/owner/workspace-scoped snapshot and limited action results. Credentials and raw debugging endpoints are never sent in URLs, localStorage, logs, analytics or browser history.
- A browser runtime has stable `browserRuntimeId`, `ownerId`, `workspaceId`, `profileId` and `generation`; tabs map `browserRuntimeId + targetId + generation`. A target lease becomes invalid on process/port generation change; reject stale commands even if the target ID repeats.
- Distinguish running browser process, live CDP connection, running SuperAgent, and agent execution task; one does not prove another. Reconcile live state after reconnect.

## 4. Configuration and user experience

New Browser settings (values are design proposals, not existing options):

| Setting | Default | Behavior |
| --- | --- | --- |
| Browser mode | `managed-system` for external public navigation after opt-in; existing `native-webview` stays default during rollout | Chooses external real browser, optionally mirrored panel, or local native preview. |
| Auto-discover installed Chrome | ON | Read-only Windows installed locations/registry; show resolved executable origin/version before first launch. |
| Managed Chromium download | OFF | User opts in; download only from approved release source with integrity checks; storage outside Git workspace. |
| Enable browser automation/CDP | OFF until user explicitly enables per profile | Starts *new owned browser* with controlled debugging transport. |
| Profile | `default-managed` inside T-Line data directory | Persist across app sessions if user chooses; per-workspace or per-agent isolation optional. |
| View mode | `external-window` | Optional `in-app-mirror` only after performance/accessibility/permission gates. |
| On T-Line exit | Leave managed browser running / close owned browser (explicit preference) | Never close personal/unowned browsers; clarify that background agents may require browser to remain running. |
| Agent access | Owner-controlled; read-only by default | Explicit claim and permission to mutate; shared mode and owner handover through existing gateway. |

UI: show browser engine, executable origin/version, managed profile, connection/health state, tab cards, current owner/participants, screenshot/snapshot, queue, permission review and "Focus Browser", "Open in System Browser", "Stop Owned Browser". Use clear distinction between LIVE, DISCONNECTED, STALE and NOT STARTED. Never falsely claim an embedded viewport when only a screenshot is available.

**Profile storage:** under OS-specific T-Line app data directory, e.g. `%LOCALAPPDATA%/t-line/browser-profiles/<opaque-profile-id>/` (final folder resolved through Tauri app path APIs). Avoid default Chrome profile directories, home-directory glob import, copying existing Chrome cookies, profile lock races and shared use of one profile by multiple processes. Do not put profiles or browser binaries under the project/Git repo. Profile reset/export/delete are explicit scoped operations with warnings, audit and confirmation.

## 5. Implementation packages and dependencies

### P0-A — Contract, threat model and baseline tests (first)

- [ ] Add typed `ManagedBrowserRuntime`, `ManagedBrowserProfile`, `ManagedBrowserTarget`, `CdpLeaseProjection` and error state schemas. Allow safe fields only.
- [ ] Add capability checks: desktop operator can launch/focus/stop **owned** processes; agent owner can claim/release and approve mutation; observer cannot send input; contributor cannot hand over ownership.
- [ ] Define runtime registry identity and process generation, lock policy, TTL, browser version compatibility, port allocation and reconnect event cursor.
- [ ] Make feature flags OFF by default: `tline.browser.managed`, `tline.browser.cdpControl`, `tline.browser.mirror`. Flags exposed via T-Line UI settings, persisted through existing T-Line settings; not a new unsupported SuperAgent environment variable.
- [ ] Unit tests for unauthorized executable path, user-data-dir traversal, PID spoofing, cross-owner permissions, no-connection status and stale generation.
- **Gate:** approved API contracts and threat model; existing BrowserTab and shared-session tests remain green.

### P0-B — Desktop browser discovery, launch and lifecycle

- [ ] Create isolated Rust `desktop-tauri/src-tauri/src/managed_browser/` module (small modules: executable discovery, profile store, spawn/stop, runtime status, health), not another 1,000+ line lib.rs.
- [ ] Detect supported Windows stable Chrome executable using OS discovery and version checks; never rewrite the user's existing shortcuts or start Chrome against a default personal profile for CDP.
- [ ] Launch a genuine **visible** owned browser process with an opaque managed user-data-dir; discover a dynamic debugging endpoint, not fixed 9222; record only the minimal runtime descriptor.
- [ ] Prefer a safe restricted local transport if compatible. For TCP-based CDP use an ephemeral **loopback-only** port, ensure no remote binding, validate endpoint/process identity, and document local process/DNS-rebinding threat: loopback CDP is not authenticated by itself. Do not claim it is safe from other local processes. Use an authenticated proxy and OS-level controls; evaluate pipe transport as a later hardening path when end-to-end tool compatibility allows it.
- [ ] Implement process ownership/PID+start-time/executable validation, read-only health, graceful shutdown, browser crash detection, stale lock handling and no automatic kill of other Chrome processes. Browser child not killed by changing chat model/mode, workspace pane or tunnel state.
- [ ] Create Tauri native commands for trusted browser actions, with narrow argument validation and explicit operator approval. Test web-only fallback as NOT SUPPORTED rather than fake success.
- **Gate:** on Windows, launch two independent managed profiles while the user's personal Chrome is open, verify they stay isolated, and that only T-Line-owned PID is ever stopped.

### P0-C — Connect owned Chrome targets to existing SuperAgent CDP gateway

**M2-C checkpoint (2026-10-25):** Native Rust now registers a live owned target directly with authenticated local Core, which publishes a 90-second, cross-process, nonsecret runtime descriptor to MCP gateway `action=managed`. The existing gateway retains exclusive ownership/lease controls. This is discovery, not agent auto-claim, and packaged Windows E2E remains required. See [M2-C native registry](2026-10-25-tline-browser-m2c-native-registry.md).

- [ ] Extend SuperAgent tools/gateway only for missing *trusted browser runtime registration* and per-runtime target mapping. Preserve current external-Chrome CDP workflow on 9222.
- [ ] Add **fixed, authenticated** T-Line proxy operations `GET /api/browser-managed/status`, `POST /api/browser-managed/launch`, `POST /api/browser-managed/stop`, and narrowly scoped `GET /api/superagent/browser-managed/targets` / `POST /api/superagent/browser-managed/action` (names provisional). Desktop process control via Tauri or authenticated internal bridge only, never unauthenticated local HTTP.
- [ ] Use existing CDP `claim`, `share`, `execute`, `heartbeat`, `release` and per-target write queue. Map target IDs, owner/session identity, workspace, browser generation; make multi-agent shared writes serialize unless resource policy explicitly permits concurrency.
- [ ] Add reconciliation for browser crash, tab close, app/UI reconnect, core rolling restart, stale ownership, new endpoint generation and cross-IDE clients. Stale targets fail closed, never silently rebind to a different tab.
- [ ] Browser action policy: allowlisted navigation/snapshot/screenshot/click/type/scroll by permission; destructive external submissions/purchases/uploads require separate user approval when applicable; do not autologin with copied personal Chrome secrets.
- **Gate:** one user opens a real managed Chrome page; an authorized agent navigates it; a second observer cannot type; contributor edits serialize; forced crash/recovery preserves other agent and chat sessions.

**M2-A checkpoint (2026-10-25):** native generation/target-verified pairing handoff and read-only gateway claim projection implemented. Operator copies an existing gateway `discover`/`claim` instruction. This does NOT complete the authenticated *automatic* attachment, recovery/rollback or packaged Windows E2E required for P0-C. See [M2 pairing checkpoint](2026-10-25-tline-browser-m2-pairing-checkpoint.md).

**M2-D checkpoint (2026-10-25):** repeatable genuine Windows headless Chrome integration smoke confirms multi-agent gateway registration/claim/observer/denial/release and stale browser rejection. Rust and Core now hash and reverify the browser's CDP instance identity before registry announcement and managed agent actions. The packaged Tauri UI is still unverified; see [M2-D Windows smoke](2026-10-25-tline-browser-m2d-windows-smoke.md).

**M3 native checkpoint (2026-10-25):** Rust desktop supervisor and installed Windows Chrome have passed an isolated real-process lifecycle smoke, including owned launch/stop and CDP identity verification. The compiled desktop binary was built without launching the GUI. Packaged app IPC and real authenticated Core round-trip are still outstanding. See [M3 native lifecycle](2026-10-25-tline-browser-m3-native-lifecycle.md).

**M3-E checkpoint (2026-10-26):** Native app `Exit` now stops only T-Line-owned Chrome processes while tray minimization leaves them alive. The fixed-loopback Core HTTP client has isolated authorization/response tests. Packaged Windows UI and live Core registration are not yet accepted. See [M3-E report](2026-10-26-tline-browser-m3e-core-transport-and-exit.md).

### P1-A — Browser Manager UI (functional real-window MVP)

- [ ] Add `ManagedBrowserPanel.tsx` and small hooks/types under `frontend/src/components/browser-managed/` and `frontend/src/hooks/`.
- [ ] Browser tabs in T-Line become logical references to selected Chrome targets, not recreated WebViews. Show external Chrome window status + "Focus", "Reopen Tab", "Snapshot", "Open DevTools", "Switch Profile".
- [ ] Add new Browser mode selector and per-workspace browser binding without altering legacy WebView2 tab persistence. Keep T-Line's Browser V2 network/storage tools clearly tagged as WebView2-only unless equivalent CDP backend is wired.
- [ ] Show queue, owners, collaborators, activity timeline, disconnect/reconnect and explicit approval prompts. No manual owner token in URL or persistent storage.
- **Gate:** selected tab/URL/state reflects real Chrome target after navigation, tab switch, browser restart and T-Line UI reload. No duplicate Chrome windows on retry.

**M4-A checkpoint (2026-10-26):** native read-only JPEG snapshot preview implemented behind explicit user selection. Frame access requires verified T-Line-owned browser generation and exact local CDP page target; React receives bounded JPEG pixels, not debugger addresses. Real Windows Chrome headless capture and focused frontend tests passed. Higher-FPS `Page.startScreencast`, interactive mouse/keyboard through agent capabilities, packaged Tauri GUI acceptance and soak testing remain pending. See [M4-A live preview](2026-10-26-tline-browser-m4a-live-preview.md).

**M4-B checkpoint (2026-10-26):** Rust now attempts CDP `Page.startScreencast` and acknowledges frames, with max 5 FPS delivery to the primary WebView, a persistent-CDP snapshot fallback and final M4-A snapshot fallback. Headless Windows Chrome verified **persistent snapshot fallback**, not screencast FPS. Packaged GUI acceptance, renderer-consumer backpressure and authorized interactive input are still outstanding. See [M4-B adaptive preview](2026-10-26-tline-browser-m4b-adaptive-preview.md).

**M4-C checkpoint (2026-10-26):** renderer ACK now gates delivery of each native frame; invalid/stale ACKs and 4-second UI stalls stop the stream. FPS, drops/ACK counts, latency and host process metrics are observable in Preview. Deterministic 9,000-frame logical-time stress passed; actual packaged GUI, real 30-minute soak and full Chrome process-tree profiling remain outstanding. See [M4-C ACK and telemetry](2026-10-26-tline-browser-m4c-ack-telemetry.md).

### P1-B — Optional in-app live Chrome viewer (experimental)

- [ ] Prototype official CDP `Page.startScreencast` / `screencastFrame` + frame acknowledgement and bounded WebSocket transport. CDP screencast methods are experimental; keep a screenshot-on-demand fallback.
- [ ] Scale mouse coordinates between rendered frame and actual device viewport. Map click, wheel, keyboard, focus, zoom and device emulation only through authorized SuperAgent CDP action adapter; do not inject JS into unrelated T-Line frames as a shortcut.
- [ ] Explicitly handle browser dialogs, file pickers, downloads, IME/text input, clipboard, window popups, hidden tabs, viewport resizing, permission prompts and accessibility gaps; unsupported operations offer "Focus Chrome window".
- [ ] Apply bounded frame size/rate/backpressure; pause when pane hidden or window minimized, no fan-out rendering per agent. Start target (experiment): <= 1280p, 5–15 FPS when active, bounded frame queue <= 2, adaptive quality; measure CPU/RAM/latency rather than claiming fixed performance.
- [ ] If screen mirroring cannot meet correctness/usability/safety gates, retain external-window MVP indefinitely instead of pretending Chrome has been embedded natively.
- **Gate:** 30-minute interaction soak, multiple tabs, backpressure under network hiccups, clipboard/file-prompt fallback, no stuck input after focus loss, no uncontrolled memory growth.

### P2-A — Optional bundled runtime and update/security lifecycle

- [ ] Legal/licensing review before shipping **any** browser binary. Evaluate distributable Chromium build and required LICENSE/NOTICES/source-offer obligations. Branded Chrome redistribution is not assumed authorized.
- [ ] Treat bundled browser as an explicit optional component. Validate signed trusted download source, pinned manifest, cryptographic hash, archive path canonicalization, disk budget, rollback, atomically switched releases, and cleanup after no instances use old build.
- [ ] Chrome for Testing remains E2E-only (official builds do not auto-update); user browsing defaults to system stable Chrome where possible.
- [ ] Support offline state, interrupted downloads, version mismatch, security patch freshness, fail-closed rollback and license notices. No executable file is downloaded into the code repo by a build-time test.
- [ ] Provide settings `Installed / Managed / Offline / Needs Update` with runtime size, version, signed provenance and uninstall warning.
- **Gate:** clean Windows VM with and without system Chrome, interrupted install, corrupt payload, version upgrade, rollback and uninstall tests; no unverified binary executes.

### P2-B — Production and policy acceptance

- [ ] Full role/auth, OAuth, navigation, target lease, recovery, profile isolation and anti-spam / terms-respecting acceptance matrix using permitted test accounts only.
- [ ] Test representative third-party websites: ordinary browsing, login initiated by human, Google sign-in where official external-browser policies allow, marketplace navigation (no prohibited automated bulk activity).
- [ ] Benchmark 1/3/6 simultaneously owned tabs and 1/2/3 active agents; cap processes/profile count, memory pressure, screenshot frames, CDP event queues, log/retention.
- [ ] Packaged Windows signed installer smoke, startup/relaunch/tray-hide/quit, normal chat + core rolling restart coexistence, SuperAgent tunnel/CDP fallback, E2E with OS window focus.
- **Gate:** browser lifecycle pass on packaged app; no data exfiltration, no unintended request automation, no cross-owner access, no false claims that websites will never detect automation.

## 6. Versioned interface sketch (proposed, NOT implemented)

```ts
type ManagedRuntime = {
  runtimeId: string; generation: string; profileId: string;
  engine: "system-chrome" | "managed-chromium";
  lifecycle: "stopped" | "starting" | "ready" | "disconnected" | "crashed" | "stopping";
  browserVersion?: string; endpointState: "unavailable" | "local-only" | "connected";
  startedAt?: string; owned: true;
};
type ManagedTab = {
  runtimeId: string; generation: string; targetId: string;
  urlDisplay: string; title: string;
  lease?: { mode: "isolated" | "shared"; owner: string; revision: number };
};
```

Events: `runtime.started`, `runtime.ready`, `runtime.exited`, `runtime.reconnected`, `target.created`, `target.closed`, `lease.changed`, `agent.action`, `viewer.degraded`. Persist only nonsecret projections, mask credential-like URLs and location. CDP target data is tainted/untrusted page content; do not execute page instructions as model commands.

## 7. Security decisions that are non-negotiable

- No default Chrome profile takeover, cookie extraction/import, disabling safe-browsing/security features, changing browser fingerprints for evasion, CAPTCHA bypass, unapproved scraping or unsolicited posting.
- No raw unauthenticated CDP port/network exposed to remote clients; no port-forward/Cloudflare tunnel to the browser itself. Remote agent access MUST traverse authenticated SuperAgent gateway with browser-specific permissions.
- Avoid URLs with tokens in persistent tabs/logs, never forward CDP headers/cookie values to UI, enforce event size/cursor/timeout limits and reject malformed origins.
- OS profile directory and runtime packages cannot be arbitrary paths chosen by a web page, browser agent or unauthenticated client. Windows ACLs and local-process threat model require review.
- Every destructive stop/clear/reset/download/install action needs a scoped authorization; never kill an existing user's Chrome process just to free a port.
- Keep sessions of unrelated project/agent alive across T-Line tab switches, core hot restarts, runtime upgrades and per-session chat model changes.

## 8. Rollout, rollback and estimated order (no time promises)

| Milestone | Priority | Dependency | User-visible outcome |
| --- | --- | --- | --- |
| M0 Contract/security tests | P0 | None | Feature-flagged spec with passing negative cases |
| M1 Real Chrome process manager | P0 | M0 | Launch/focus/stop owned Chrome windows and isolated profiles |
| M2 CDP Gateway integration | P0 | M1 | Agent controls actual tab; multi-agent leases work |
| M3 T-Line browser manager UI | P1 | M2 | Chrome tab list, profile/permissions, agent activity |
| M4 Live embedded mirror | P1 experimental | M3 | Interactive screencast preview, or safe external-window fallback |
| M5 Optional browser bundle/update | P2 | M1–M3 + legal gate | Optional install on clean machine |
| M6 Full packaged QA/rollout | P2 | M1–M5 | Release criteria with crash/security/compatibility evidence |

Rollout: OFF by default -> developer opt-in -> local VM -> staging -> canary -> stable. Feature flag rollback disables **new** managed launches/agent attachment; existing users choose whether owned Chrome stays open. No daemon/core restart or blanket process killing. Archive only sanitized diagnostics.

## 9. Tests and documentation

**Test file map (proposed):**
- T-Line: `desktop-tauri/src-tauri/src/managed_browser/*` native unit tests, `backend/tests/browserManaged*.test.ts` route/auth tests, `frontend/src/components/browser-managed/*.test.tsx` UI and reconnect cases.
- SuperAgent: `tests/browserManagedGateway*.test.ts`, reuse existing `chromeCdpSessionManager` lease and workspace policy fixtures.
- End-to-end: Windows integration fixture to spawn an **owned** browser, create two isolated profiles, navigate permitted local test page, assert 2-agent contention, close/reconnect; separate packaged-app manual trace.

**Definition of Done:** passing tests are necessary but not sufficient. Require a screenshot/video or recorded installed-Windows GUI trace, bounded PID ownership logs, sanitized lease evidence, profile isolation, authentic site compatibility notes and exact release fallback. Never report Chrome running/attached when only tests are passing.

**External reference docs:**
- Chrome 136 debugging profile requirement: https://developer.chrome.com/blog/remote-debugging-port
- Chrome for Testing binaries and update characteristics: https://www.chromium.org/getting-involved/download-chromium/
- CDP Page screencast specification (experimental): https://chromedevtools.github.io/devtools-protocol/tot/Page/
- Chromium profile storage structure: https://chromium.googlesource.com/chromium/src.git/+/HEAD/docs/user_data_dir.md

**Source control:** stage only files belonging to this planning task; commit with neutral engineering message without any external brand or service name, per AGENTS.md. Follow release version and CHANGELOG discipline. SuperAgent source is reviewed for plan grounding but remains unchanged in this planning task.
