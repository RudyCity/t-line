# T-Line Studio Desktop Editor & Unified Agent Control — Capability Inventory (P0)
Date: 2026-10-27
Status: Complete (P0 Gate)
Authority: Single State Owner (SuperAgent Core) & T-Line Desktop Client

## 1. Executive Summary & Architectural Invariants
- **T-Line is a desktop client**, not a public MCP server. It coordinates desktop-only UI actions (focus, tab navigation, preview scrub) via a typed local control channel.
- **Single Source of Truth**: SuperAgent Core owns all project states, composition revisions, media assets, render queues, and job histories. T-Line does not duplicate document stores or mutate project files behind Core's back.
- **Single Director**: The conversational T-Line SuperAgent Assistant in `SuperAgentConsole` is the unified Studio AI Director. Standalone chat interfaces inside the Studio tab are removed.
- **Typed & Scoped Agent Handoff**: All assistant commands target an authenticated, workspace-scoped project with revision guards. Destructive edits, replacements, and expensive renders require explicit user approval.

## 2. Capability Matrix

| Domain | Capability / Operation | SuperAgent Core Route | Assistant Tool / Action | T-Line Proxy Status | Risk / Approval Level |
|---|---|---|---|---|---|
| **Project** | List projects | `GET /api/studio/projects` | `studio_list` / `motion_status` | Permitted (`studioProxy.ts`) | Safe (Read-only) |
| **Project** | Inspect project | `GET /api/studio/projects/:id` | `studio_inspect` | Permitted (`studioProxy.ts`) | Safe (Read-only) |
| **Project** | Create project | `POST /api/studio/projects` | `studio_create` | Permitted (`studioProxy.ts`) | Reversible |
| **Project** | Revisioned edits | `POST /api/studio/projects/:id/edits` | `studio_edit` | Permitted (`studioProxy.ts`) | Revision-guarded |
| **Project** | Natural language generate | `POST /api/studio/generate` | `studio_generate` | Permitted (`studioProxy.ts`) | User initiated / staged |
| **Project** | Natural language revise | `POST /api/studio/projects/:id/revise` | `studio_revise` | Permitted (`studioProxy.ts`) | Revision-guarded |
| **Media** | Upload asset (image/video) | `POST /api/studio/assets` | `studio_asset_upload` | Permitted (`studioProxy.ts`) | Bounded (1.6 MB / 64 MB) |
| **Media** | Upload audio (WAV) | `POST /api/studio/audio` | `studio_audio_upload` | Permitted (`studioProxy.ts`) | Bounded (3 MB) |
| **Media** | Audio waveform | `GET /api/studio/audio/:id/waveform` | `studio_audio_waveform` | Permitted (`studioProxy.ts`) | Safe (Read-only) |
| **Timeline** | Scene layers & keyframes | `POST /api/studio/projects/:id/edits` | `studio_edit` | Permitted (`studioProxy.ts`) | Reversible with Undo |
| **Timeline (NLE)**| Clip tracks (split/trim/move) | `POST /api/studio/projects/:id/edits` | `studio_clip_edit` | Permitted via typed edits | Reversible with Undo |
| **Effects** | Effects catalogue & preview | `GET /api/studio/effects` | `studio_effects_list` | Permitted (`studioProxy.ts`) | Safe (Read-only) |
| **Effects** | Apply effect / effect stack | `POST /api/studio/projects/:id/effects` | `studio_effect_apply` | Permitted (`studioProxy.ts`) | Reversible with Undo |
| **Audio** | Multi-track audio & beat-sync | `POST /api/studio/projects/:id/beat-sync` | `studio_audio_sync` | Permitted (`studioProxy.ts`) | Reversible with Undo |
| **Captions** | Export captions (.srt) | `GET /api/studio/projects/:id/captions.srt` | `studio_captions` | Permitted (`studioProxy.ts`) | Safe (Read-only) |
| **Render** | Start MP4 render | `POST /api/studio/projects/:id/render` | `studio_render` | Permitted (`studioProxy.ts`) | Approval required (Expensive) |
| **Render** | Query job status / cancel | `GET/POST /api/studio/jobs/:id` | `studio_status` | Permitted (`studioProxy.ts`) | Safe / Reversible |
| **Desktop** | Focus Studio tab | Local client event | `focus_studio` | Client-only (`studioControlChannel`) | Safe (UI navigation) |
| **Desktop** | Open project in editor | Local client event | `open_project` | Client-only (`studioControlChannel`) | Safe (UI navigation) |
| **Desktop** | Select clip / layer | Local client event | `select_clip` | Client-only (`studioControlChannel`) | Safe (UI highlight) |
| **Desktop** | Seek timecode / frame | Local client event | `seek_timecode` | Client-only (`studioControlChannel`) | Safe (UI scrub) |

## 3. Data Contracts & Event Schema

### 3.1 StudioControlAction (Desktop-Only Channel)
Targeted local app view commands:
```typescript
export type StudioControlAction =
  | { type: 'focus_studio'; workspacePath: string; projectId?: string }
  | { type: 'open_project'; workspacePath: string; projectId: string }
  | { type: 'select_clip'; workspacePath: string; projectId: string; clipId?: string; layerId?: string }
  | { type: 'seek_timecode'; workspacePath: string; projectId: string; timeSeconds?: number; frame?: number }
  | { type: 'select_panel'; workspacePath: string; panel: 'media' | 'inspector' | 'timeline' | 'effects' | 'audio' };
```

### 3.2 StudioEditIntent & StudioOperationReceipt
Shared provenance and change attribution:
```typescript
export interface StudioEditIntent {
  intentId: string;
  workspacePath: string;
  projectId: string;
  expectedRevision: number;
  description: string;
  destructive: boolean;
  requiresApproval: boolean;
  operations: StudioEditOperation[];
}

export interface StudioOperationReceipt {
  operationId: string;
  timestamp: string;
  actor: 'assistant' | 'human';
  projectId: string;
  projectName: string;
  revisionBefore: number;
  revisionAfter: number;
  summary: string;
  affectedEntities: {
    tracks?: string[];
    clips?: string[];
    layers?: string[];
  };
  jobId?: string;
  reversible: boolean;
}
```

### 3.3 StudioProjectEvent (Monotonic Real-Time Contract)
```typescript
export interface StudioProjectEvent {
  sequenceId: number;
  timestamp: string;
  workspacePath: string;
  projectId: string;
  type:
    | 'project_revision_changed'
    | 'media_indexed'
    | 'clip_modified'
    | 'render_progress'
    | 'render_completed'
    | 'operation_error';
  payload: Record<string, unknown>;
}
```

## 4. Authorization & Security Boundaries
- **No Direct Filesystem Mutation**: The renderer must never write directly to project files on disk; all changes go through `studioProxy.ts` with valid session token and workspace validation.
- **Fail-Closed Verification**: Requests to `studioProxy.ts` verify that the target workspace is registered with T-Line and that SuperAgent service tokens match.
- **Conflict Handling**: When a revision conflict (HTTP 409) occurs, the client refreshes the latest project state and presents a diff/replan rather than blindly clobbering.
