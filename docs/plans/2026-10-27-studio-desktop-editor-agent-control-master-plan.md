# T-Line Studio Desktop Editor & Unified Agent Control — Master Plan
Date: 2026-10-27
Status: Implementation in progress; P0–P7 not certified. See `docs/audits/2026-10-27-studio-desktop-editor-agent-control-implementation-audit.md` for AUD-01..AUD-10 and current blocking gaps.
Workspace: T-Line desktop and the canonical SuperAgent runtime

## Decision
- T-Line is a **desktop application**, not a separately published MCP/tool server.
- SuperAgent Core/CLI remains an independently usable agent runtime and tool provider.
- The **existing T-Line SuperAgent Assistant is the only AI Director for Studio**. Remove the stand-alone Director chat interface inside the Studio tab; keep supported editing services.
- The Studio tab becomes a **timeline-first desktop video editor** with media thumbnails and categories on the left, large player center, property inspector right, full-width multitrack timeline bottom, and compact global toolbar/export.
- Both human and agent edit the **same canonical Studio project**; no parallel document store, second model conversation, or secondary editor state.

## Codebase audit / starting point
- `frontend/src/components/StudioTab.tsx` currently defaults to `split` and includes `StudioDirectorSection`.
- `frontend/src/components/studio/StudioTopBar.tsx` contains Prompt/Editor/Split modes.
- `frontend/src/components/StudioTimeline.tsx` supports scene-layer keyframes but is not yet a complete video/audio clip NLE.
- `frontend/src/services/studioApi.ts` exposes revisioned `StudioProject`, `StudioComposition`, layers, audio tracks, effect stack and edit operations.
- `backend/src/studioProxy.ts` is an authenticated, workspace-scoped route allowlist connecting the desktop to the canonical SuperAgent Studio API.
- `backend/src/superAgentRoutes.ts` mounts the Studio proxy and assistant conversation/turn/event endpoints.
- Existing SuperAgent Studio tool family includes list, inspect, declarative edit and prompt generation. **Their presence does not establish full assistant-to-UI orchestration or clip-based editing parity yet**.
- Existing `AGENTS.md` requires one T-Line backend, startup-selected SuperAgent runtime, component reuse, per-workspace isolation, explicit staging, neutral commit messages, and regression testing.

## UX contract
1. The assistant stays in its existing T-Line chat panel; do not render a separate Director conversation inside Studio.
2. The user can say: "Open Studio and make a 30-second promo from these clips; trim empty sections, add captions and background music, then export MP4."
3. Assistant discovers the selected workspace and project; if ambiguous, shows a compact project choice instead of guessing.
4. Assistant creates a structured editing plan; lightweight, reversible edits may proceed immediately under permitted scopes, while destructive replacements, bulk edits, external asset access, expensive renders and overwrite/export targets require explicit approval.
5. Agent edits through canonical typed Studio operations; events animate/highlight the actual clips/layers and refresh the preview.
6. User can directly take over editing during AI operations. Pending operations must be serialized/rebased or clearly fail with a revision conflict, never silently overwrite human changes.
7. Undo/redo and project history work across both human and agent edit operations; chat receipts link to affected clips/time spans and output jobs.
8. A `Focus Studio` action can open the local Studio tab, switch/open the target project and select a clip/timecode. This action is desktop-only; it is **not exposed as an external T-Line MCP server**.
9. If Studio tab is closed, project edits can still execute through the canonical engine when authorized; desktop selection/focus is applied when Studio is next opened, without spoofing UI clicks.

## Architecture & authority
```text
T-Line SuperAgent Assistant (existing chat/approval/task UI)
       |
       | intent -> bounded edit plan -> typed SuperAgent Studio tool calls
       v
Canonical SuperAgent Core/Studio API + revisioned project store
       |                          ^
       | job/project events       | edits from native Studio UI
       v                          |
T-Line authenticated workspace-aware Studio bridge
       |
       +--> Studio desktop tab: media bin | player | inspector | multitrack timeline
       +--> Assistant: progress, diff, approvals, operation receipts
```
- Authority for project/media/effect/job state lives in **SuperAgent**, not React-local or T-Line backend duplicate stores.
- Reuse existing Studio route auth, workspace trust and CLI/MCP engine capabilities. Core-mediated tools must not bypass approval/authorization or independently write files outside the selected workspace.
- Desktop view actions use a **strictly typed local app control channel** (open tab, select project, select clip, seek, focus panel) with explicit workspace/project targeting; never arbitrary frontend JavaScript, DOM automation or generic shell execution.
- Editing actions use a **typed revision-guarded server contract**. Include operation ID for deduplication, expected project revision, actor provenance, affected entities, and grouped undo metadata. Conflict: 409 + current revision; inspect, surface diff/replan, never blind retry.
- Realtime contract: per-workspace/project events (revision changed, media indexed, clip modified, export progress, tool error) with monotonic sequence/catch-up via inspect; avoid duplicate edits on reconnect.
- Keep one selected primary Core/runtime as prescribed by `AGENTS.md`. No second T-Line backend and no service-token delivery to renderer.

## Agent Studio operations — coverage
**Reuse confirmed/existing first**
- Project list, inspect, revisioned layer edits, prompt scene generation, composition inspector and render/job queries.
- Existing effects, assets, audio, templates, storyboard, preview, quality and history endpoints as supported by `studioProxy.ts`.

**Add only missing canonical operations, with corresponding assistant tools**
- Project: create/open/duplicate/rename; select active project (desktop UI only for selection).
- Media: bounded import/probe/index, thumbnails, waveform, proxy media; explicit source permission.
- Timeline NLE: tracks, clips, add/move/split/trim/ripple/snap, gaps, overlays, transitions, keyframes.
- Audio: multi-track placement, gain, fades, ducking, mixing.
- Captions: transcription/import, timed edits, style, approval of transcript.
- Effects: list/apply/tune/remove stack operations; batch with preview.
- Playback: seek, preview range, frame snapshots, selected clip/layer highlight.
- Export: presets, validation, render queue/job status, cancellation and artifact open.
- Desktop-specific: focus Studio, open project, select clip, seek preview, toggle contextual inspector.

## Work plan and acceptance gates
### P0 — Contract & capability inventory
- Audit Core Studio tool implementations, API schemas and revision behavior across both repositories.
- Define `StudioControlAction`, `StudioEditIntent`, `StudioOperationReceipt`, `StudioProjectEvent`; map known operations to existing services.
- Build capability matrix: existing, missing, unsafe, release-blocking.
**Gate:** documented tool-to-route mapping, single state owner, authorization matrix.

### P1 — Editor UI, Director removal
- Retain supported generation/analysis capabilities but remove standalone `StudioDirectorSection` and Prompt/Split switcher from Studio screen.
- Refactor Studio into docked media categories/library, large player, property inspector, full-height resizable timeline; keep components modular (<1000 LOC).
- Prioritize keyboard navigation, drag resize, compact dark layout, 16:9 preview, thumbnails, 9:16/1:1 compositions.
**Gate:** UI tests, narrow-window smoke, no loss of existing project open/edit/render.

### P2 — Unified Agent Director & desktop focus
- Existing assistant can discover currently open Studio workspace/project; typed local focus and selection actions.
- Intent parser/tool orchestration executes canonical read operations and single reversible edit; display receipts.
- Shared agent/human context, no hidden independent Director history.
**Gate:** chat -> open Studio -> inspect scene -> edit text -> live highlight -> undo.

### P3 — Shared live edits and approvals
- Workspace/project event stream with reconnect replay; operation idempotency, revision guards, change attribution, preview and approval cards.
- Human handover and edit conflict handling. Mutations fail closed without auth/project scope.
**Gate:** concurrent human/agent edits cannot silently clobber; offline/reconnect test.

### P4 — Clip-based multi-track editor
- Introduce versioned clip/track schema and backward-compatible migration from composition v1.
- Implement split/trim/move/ripple/snap, video/audio sync and clip inspector; preserve original media and reversible project history.
**Gate:** import -> assemble 3 clips -> trim/transition -> playback -> undo/redo -> reopen project.

### P5 — Agent video workflows
- Extend agent tools for media indexing, clip operations, subtitles, audio, effects, render jobs; expose risk-aware approval.
- End-to-end command: request -> plan -> approve -> timeline edits -> preview -> export.
**Gate:** real local assets and verifiable MP4 output; no simulated tool results.

### P6 — Performance and native robustness
- Waveforms/thumbnails/proxies, playback smoothness, timeline virtualization, job throttling and retry.
- Restore after app/engine restart with project revisions, render queue and crash evidence preserved.
**Gate:** long project soak and native packaged Windows desktop smoke tests.

### P7 — Rollout and migration
- Preserve legacy project access and rollback, feature-flag new editor, migrate progressively, update guides and changelog.
- Certify source tests and installed-desktop QA separately; never claim native release after only local source checks.

## Test checklist
- Assistant direct commands through existing chat; supported tool invocation and receipts.
- Workspace and project isolation; expired auth; forged selection; invalid workspace, path traversal and unauthorized media import.
- Revision race with simultaneous manual/agent editing; idempotent retries after disconnect.
- Focus/open Studio tab does not leak renderer privileges or trigger autonomous edits.
- Renders/exports and filesystem writes require proper approval, bounded timeouts and cancellation.
- Legacy Studio project opens and exports; migration rollback/recovery.
- Neutral engineering-only commit subject/body, explicit file staging and changelog/version policy.

## Implementation order
P0 -> P1 -> P2 -> P3 -> P4 -> P5 -> P6 -> P7. Prefer delivering a narrow vertical slice (one chat command that visibly changes an existing Studio project) before widening tool breadth.
