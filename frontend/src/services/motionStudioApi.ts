/** Typed Motion Studio v1 contract. The SuperAgent server remains authoritative. */
export type MotionProperty = 'x' | 'y' | 'opacity' | 'rotation';
export type MotionEasing = 'linear' | 'step' | 'easeInOut';
export interface MotionKeyframe { frame: number; value: number; easing?: MotionEasing }
export interface MotionTrack { property: MotionProperty; keyframes: MotionKeyframe[] }
export interface BaseMotionLayer {
  id: string; kind: 'text' | 'rect' | 'image'; x: number; y: number;
  width: number; height: number; rotation: number; opacity: number;
  fill: string; tracks: MotionTrack[];
}
export interface MotionTextLayer extends BaseMotionLayer {
  kind: 'text'; text: string; fontSize: number; fontFamily: string;
}
export interface MotionRectLayer extends BaseMotionLayer { kind: 'rect' }
export interface MotionImageLayer extends BaseMotionLayer { kind: 'image'; assetId: string }
export type MotionLayer = MotionTextLayer | MotionRectLayer | MotionImageLayer;
export interface MotionAudioTrack {
  assetId: string; startFrame: number; volume: number; fadeInFrames?: number; fadeOutFrames?: number;
}
export interface MotionAudioAsset { id: string; bytes: number; sampleRate: number; channels: number; seconds: number }
export interface MotionWaveform { peaks: number[]; seconds: number; sampleRate: number; channels: number }
export interface MotionProject {
  schemaVersion: 1; id: string; workspaceRoot: string; name: string;
  revision: number; createdAt: string; updatedAt: string;
  composition: {
    width: number; height: number;
    fps: { numerator: number; denominator: number };
    durationFrames: number; background: string; audio?: MotionAudioTrack; audioTracks?: MotionAudioTrack[]; layers: MotionLayer[];
  };
}
export interface MotionProjectSummary { id: string; name: string; revision: number }
export type MotionEdit =
  | { type: 'set-text'; layerId: string; text: string }
  | { type: 'set-property'; layerId: string; property: MotionProperty; value: number }
  | { type: 'set-track'; layerId: string; track: MotionTrack }
  | { type: 'add-layer'; layer: MotionLayer; index?: number }
  | { type: 'remove-layer'; layerId: string }
  | { type: 'move-layer'; layerId: string; toIndex: number }
  | { type: 'replace-composition'; composition: MotionProject['composition'] }
  | { type: 'set-audio'; audio: MotionAudioTrack | null }
  | { type: 'set-audio-tracks'; audioTracks: MotionAudioTrack[] };
export interface MotionCapabilities {
  capabilities?: { aiPromptDirector?: string; aiSemanticRevision?: boolean };
}
export interface MotionQualityIssue {
  severity: 'warning' | 'error'; code: string; scene: number; message: string;
}
export interface MotionQualityReport {
  passed: boolean;
  samples: Array<{ frame: number; scene: number; visibleHeadlines: string[] }>;
  issues: MotionQualityIssue[];
}
export interface MotionDirectorResult {
  project: MotionProject; job: MotionJob; outline: string[]; limitations: string[];
  quality?: MotionQualityReport;
}
export interface MotionQueueRecovery {
  minAgeSeconds: number; queued: number; eligible: number; blocked: number;
  items: Array<{ jobId: string; createdAt: string; state: 'eligible' | 'blocked'; reason?: string }>;
  warning: string;
}
export interface MotionStorageStatus {
  jobs: { total: number; queued: number; running: number; completed: number; failed: number; cancelled: number; interrupted: number };
  completedArtifactBytes: number;
  maintenance: { minAgeDays: number; candidates: number; blockedIds: string[]; reclaimableBytes: number };
}
export interface MotionSupervisorStatus {
  mode: 'opt-in-fifo';
  queuedSupervised: number; occupied: number; maxConcurrentRenders: number;
  oldestWaitingJobId?: string; blockedReason?: string;
  leader: 'free' | 'claimed_unverified' | 'unsafe_or_unreadable';
  automaticRecoveryOfRenderingJobs: false;
}
export interface MotionSchedulerStatus {
  maxConcurrentRenders: number;
  queueLimit: number;
  queued: number;
  active: number;
  slots: Array<{ slot: number; jobId?: string; state: string }>;
}
export interface MotionJob {
  id: string; projectId: string; revision: number; dispatchMode?: 'supervised';
  status: 'queued' | 'preparing' | 'rendering' | 'validating' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  framesCompleted: number;
  profile: { frameCount: number; width: number; height: number };
  artifact?: { bytes: number; sha256: string };
  error?: string;
}
const projectIdPattern = /^motion-[0-9a-f]{20}$/;
const jobIdPattern = /^motionjob-[0-9a-f]{24}$/;
const assetIdPattern = /^asset-[a-f0-9]{64}$/;
const audioIdPattern = /^audio-[a-f0-9]{64}$/;
function assertAudioId(id: string): string {
  if (!audioIdPattern.test(id)) throw new Error('Invalid Motion audio identifier');
  return id;
}
function assertAssetId(id: string): string {
  if (!assetIdPattern.test(id)) throw new Error('Invalid Motion asset identifier');
  return id;
}
const base = '/api/superagent/motion';

function assertId(id: string, job = false): string {
  if (!(job ? jobIdPattern : projectIdPattern).test(id)) throw new Error('Invalid Motion identifier');
  return id;
}
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Sign in to T-Line before opening Motion Studio');
  return { Authorization: 'Bearer ' + token };
}
function url(workspace: string, path: string): string {
  if (!workspace.trim()) throw new Error('Select a local workspace first');
  return base + path + '?workspace=' + encodeURIComponent(workspace);
}
async function motionFetch(workspace: string, path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url(workspace, path), {
    ...init,
    headers: { ...authHeaders(), ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...init?.headers },
  });
  if (!response.ok) {
    let message = 'Motion Studio HTTP ' + response.status;
    try {
      const parsed = await response.json() as { error?: string };
      if (typeof parsed.error === 'string') message = parsed.error;
    } catch { /* keep HTTP status */ }
    throw new Error(message);
  }
  return response;
}
async function json<T>(workspace: string, path: string, init?: RequestInit): Promise<T> {
  return (await motionFetch(workspace, path, init)).json() as Promise<T>;
}
export const motionStudioApi = {
  capabilities: (workspace: string) => json<MotionCapabilities>(workspace, '/'),
  /** Accepts image bytes only; browser paths never cross the API boundary. */
  async uploadImage(workspace: string, file: File): Promise<{ id: string; bytes: number; width: number; height: number }> {
    if (file.size < 24 || file.size > 1024 * 1024) throw new Error('Motion image must be 1 MB or smaller');
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image');
    const data = new Uint8Array(await file.arrayBuffer());
    // Chunked encoding avoids argument-length limits on desktop browsers.
    let binary = '';
    for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i, i + 8192));
    return json(workspace, '/assets', { method: 'POST', body: JSON.stringify({ base64: btoa(binary) }) });
  },
  async loadImageUrl(workspace: string, id: string): Promise<string> {
    const response = await motionFetch(workspace, '/assets/' + assertAssetId(id));
    const blob = await response.blob();
    if (blob.type !== 'image/png' || blob.size < 24 || blob.size > 1024 * 1024) throw new Error('Invalid Motion asset response');
    return URL.createObjectURL(blob);
  },
  /** Only canonical WAV PCM16 assets are accepted, not file paths or remote URLs. */
  async uploadAudio(workspace: string, file: File): Promise<MotionAudioAsset> {
    if (file.size < 46 || file.size > 2 * 1024 * 1024) throw new Error('Motion WAV must be 2 MB or smaller');
    if (!['audio/wav', 'audio/wave', 'audio/x-wav'].includes(file.type)) throw new Error('Choose a PCM16 WAV audio file');
    const data = new Uint8Array(await file.arrayBuffer());
    let binary = '';
    for (let i = 0; i < data.length; i += 8192) binary += String.fromCharCode(...data.subarray(i, i + 8192));
    return json(workspace, '/audio', { method: 'POST', body: JSON.stringify({ base64: btoa(binary) }) });
  },
  async loadAudioUrl(workspace: string, id: string): Promise<string> {
    const response = await motionFetch(workspace, '/audio/' + assertAudioId(id));
    const data = await response.blob();
    if (data.size < 46 || data.size > 2 * 1024 * 1024 ||
      !['audio/wav', 'audio/wave', 'audio/x-wav'].includes(data.type)) {
      throw new Error('Invalid Motion WAV response');
    }
    return URL.createObjectURL(data);
  },
  loadAudioWaveform: (workspace: string, id: string) =>
    json<MotionWaveform>(workspace, '/audio/' + assertAudioId(id) + '/waveform'),
  list: (workspace: string) => json<MotionProjectSummary[]>(workspace, '/projects'),
  inspect: (workspace: string, id: string) => json<MotionProject>(workspace, '/projects/' + assertId(id)),
  quality: (workspace: string, id: string) =>
    json<MotionQualityReport>(workspace, '/projects/' + assertId(id) + '/quality'),
  create: (workspace: string, name: string) =>
    json<MotionProject>(workspace, '/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  edit: (workspace: string, id: string, baseRevision: number, edits: MotionEdit[]) =>
    json<MotionProject>(workspace, '/projects/' + assertId(id) + '/edits', {
      method: 'POST', body: JSON.stringify({ baseRevision, edits }),
    }),
  render: (workspace: string, id: string, width = 640, supervised = false) =>
    json<MotionJob>(workspace, '/projects/' + assertId(id) + '/render',
      { method: 'POST', body: JSON.stringify({ width, supervised }) }),
  generate: (workspace: string, prompt: string, width = 640) =>
    json<MotionDirectorResult>(workspace, '/generate', {
      method: 'POST', body: JSON.stringify({ prompt, width }),
    }),
  revise: (workspace: string, motionId: string, prompt: string, width = 640) =>
    json<MotionDirectorResult>(workspace, '/projects/' + assertId(motionId) + '/revise', {
      method: 'POST', body: JSON.stringify({ prompt, width }),
    }),
  jobs: (workspace: string) => json<MotionJob[]>(workspace, '/jobs'),
  scheduler: (workspace: string) => json<MotionSchedulerStatus>(workspace, '/scheduler'),
  supervisor: (workspace: string) => json<MotionSupervisorStatus>(workspace, '/supervisor'),
  storage: (workspace: string) => json<MotionStorageStatus>(workspace, '/storage'),
  queueRecovery: (workspace: string) => json<MotionQueueRecovery>(workspace, '/queue-recovery'),
  status: (workspace: string, id: string) => json<MotionJob>(workspace, '/jobs/' + assertId(id, true)),
  cancel: (workspace: string, id: string) => json<{ cancellationRequested: boolean }>(workspace, '/jobs/' + assertId(id, true) + '/cancel', { method: 'POST', body: '{}' }),
  /** Authorize media via T-Line, then use an ephemeral object URL. Never put bearer credentials in <video src>. */
  async loadPreview(workspace: string, id: string): Promise<string> {
    const path = '/jobs/' + assertId(id, true) + '/artifact';
    const head = await motionFetch(workspace, path, { method: 'HEAD' });
    const size = Number(head.headers.get('content-length'));
    if (!Number.isSafeInteger(size) || size < 1 || size > 64 * 1024 * 1024) {
      throw new Error('Preview exceeds the 64 MB editor limit; use an authenticated export workflow');
    }
    const response = await motionFetch(workspace, path);
    const blob = await response.blob();
    if (blob.size !== size || blob.type !== 'video/mp4') throw new Error('Invalid Motion video preview');
    return URL.createObjectURL(blob);
  },
};
