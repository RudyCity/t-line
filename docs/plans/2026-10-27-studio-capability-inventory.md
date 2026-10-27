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

| Domain | Capability / Operation | Core Route | Tool / Action | Core Impl | Frontend Helper | Wired to Chat | Persists | E2E Verified |
|---|---|---|---|---|---|---|---|---|
| **Project** | List projects | `GET /api/motion/projects` | `studio_list_projects` | Yes | `studioApi.list` | Yes | Yes (disk) | Yes (`motionRoutes.test.ts`) |
| **Project** | Inspect project | `GET /api/motion/projects/:id` | `studio_inspect_project` | Yes | `studioApi.inspect` | Yes | Yes (disk) | Yes (`motionRoutes.test.ts`) |
| **Project** | Create project | `POST /api/motion/projects` | `createMotionProject` | Yes | `studioApi.create` | Yes | Yes (disk) | Yes (`studioRealMediaE2E.test.ts`) |
| **Project** | Revisioned edits | `POST /api/motion/projects/:id` | `studio_edit_project` | Yes | `studioApi.edit` | Yes | Yes (disk) | Yes (`studioRealMediaE2E.test.ts`) |
| **Timeline (NLE)** | Multi-track schema & evaluation | In-memory evaluation | `evaluateFrame` | Yes | `StudioMultiTrackTimeline` | Yes | Yes (`tracks`) | Yes (`motionMultiTrackClipEdits.test.ts`) |
| **Timeline (NLE)** | Clip edits (split/trim/move/delete)| `POST /api/motion/projects/:id` | `studio_clip_edit` | Yes | `studioClipEdits.ts` | Yes | Yes (disk) | Yes (`studioRealMediaE2E.test.ts`) |
| **Media Bin** | Asset list & import | `POST /api/motion/assets` | `studioApi.uploadImage` | Yes | `StudioMediaBin` | Yes | Yes (disk) | Yes (`StudioMediaBin.test.tsx`) |
| **Media Bin** | Audio tracks & import | `POST /api/motion/audio` | `studioApi.uploadAudio` | Yes | `StudioMediaBin` | Yes | Yes (disk) | Yes (`StudioMediaBin.test.tsx`) |
| **Desktop** | Focus Studio tab | Local client event | `focus_studio` | Yes | `useStudioHandoff` | Yes | N/A (UI) | Yes (`useStudioHandoff.test.ts`) |
| **Desktop** | Select clip / seek frame | Local client event | `select_clip` / `seek_timecode` | Yes | `studioControlChannel` | Yes | N/A (UI) | Yes (`SuperAgentToolItem.studio.test.tsx`) |
| **Render** | Export MP4 (H.264 / AAC) | `POST /api/motion/projects/:id/render` | `renderMotionJob` | Yes | `studioApi.render` | Yes | Yes (MP4) | Yes (`studioRealMediaE2E.test.ts`) |

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
