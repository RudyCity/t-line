/** Typed Motion Studio v1 contract. The SuperAgent server remains authoritative. */
export type MotionProperty = 'x' | 'y' | 'opacity' | 'rotation';
export type MotionEasing = 'linear' | 'step' | 'easeInOut' | 'easeOutBack';
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
export interface MotionRectLayer extends BaseMotionLayer { kind: 'rect'; cornerRadius?: number }
export interface MotionImageLayer extends BaseMotionLayer { kind: 'image'; assetId: string }
export type MotionLayer = MotionTextLayer | MotionRectLayer | MotionImageLayer;
export interface MotionAudioTrack {
  assetId: string; startFrame: number; volume: number; fadeInFrames?: number; fadeOutFrames?: number; loop?: boolean; role?: 'music' | 'voiceover';
}
export interface MotionAudioAsset { id: string; bytes: number; sampleRate: number; channels: number; seconds: number }
export interface MotionWaveform { peaks: number[]; seconds: number; sampleRate: number; channels: number }
export interface MotionStackEntry {
  id: string; effectId: string; enabled: boolean; targetLayerId?: string;
  params?: Record<string, string | number | boolean>;
  startFrame?: number; durationFrames?: number;
}
export type MotionStackOperation =
  | { type: 'add'; entry: MotionStackEntry }
  | { type: 'remove'; id: string }
  | { type: 'toggle'; id: string; enabled: boolean }
  | { type: 'move'; id: string; toIndex: number }
  | { type: 'update'; id: string; changes: Partial<Omit<MotionStackEntry, 'id'>> };
export interface MotionComposition {
  width: number; height: number;
  fps: { numerator: number; denominator: number };
  durationFrames: number; background: string;
  audio?: MotionAudioTrack; audioTracks?: MotionAudioTrack[];
  layers: MotionLayer[];
  effectStack?: MotionStackEntry[];
  stackBase?: Omit<MotionComposition, 'effectStack' | 'stackBase'>;
}
export interface MotionProject {
  schemaVersion: 1; id: string; workspaceRoot: string; name: string;
  revision: number; createdAt: string; updatedAt: string;
  composition: MotionComposition;
}
export interface MotionProjectSummary { id: string; name: string; revision: number }
export interface MotionRevisionSnapshot { revision: number; updatedAt: string; name: string }
export interface MotionBrandKit {
  revision: number; name: string; primary: string; accent: string;
  background: string; textColor: string;
  fontFamily: 'Arial' | 'Helvetica' | 'Georgia' | 'Verdana' | 'sans-serif' | 'serif' | 'monospace';
  logoAssetId?: string; updatedAt: string;
}
export type MotionBrandKitInput = Omit<MotionBrandKit, 'revision' | 'updatedAt'>;
export interface MotionTemplateSummary {
  id: string; name: string; category: string; description: string;
  align: 'left' | 'center' | 'right'; tone: 'bold' | 'clean' | 'calm';
}
export interface MotionTemplateInput { templateId: string; headline?: string; subtitle?: string }
export interface MotionStoryboardScene {
  headline: string; subtitle?: string; accent: string;
  motion?: string; effect?: string; preset?: string; narration?: string;
  layout?: 'left' | 'center' | 'right';
}
export interface MotionStoryboardPlan {
  name: string; durationSeconds: number; background: string;
  scenes: MotionStoryboardScene[];
  motion?: string; effect?: string; preset?: string;
  transition?: 'crossfade' | 'cut';
  aspectRatio?: '16:9' | '1:1' | '9:16';
  artDirection?: 'minimal' | 'editorial' | 'neon' | 'brutalist';
}
export type MotionAspectRatio = '16:9' | '1:1' | '9:16';
export interface MotionBatchVariant {
  aspectRatio: MotionAspectRatio;
  projectId?: string; revision?: number; jobId?: string;
  jobStatus?: MotionJob['status']; error?: string;
}
export interface MotionBatchResult {
  sourceProjectId: string; sourceRevision: number; variants: MotionBatchVariant[];
}
export interface MotionBeatSyncInput { targetLayerId: string; audioTrackIndex?: number; intensity?: number }
export interface MotionParticleInput { kind: 'confetti' | 'sparks' | 'snow'; count?: number; color?: string }
export interface MotionBeatSyncResult { project: MotionProject; onsetFrames: number[]; analysis: string }
export interface CompoundPreset {
  id: string; name: string; description: string; tags: string[];
  entrance: string; emphasis: string; exit: string; accent?: string;
}
export interface CompoundPresetApplication {
  presetId: string; targetLayerId: string; startFrame?: number;
  durationFrames?: number; intensity?: number;
}
export type MotionEffectCategory = 'entrance' | 'exit' | 'kinetic-typography' | 'camera' |
  'transition' | 'background' | 'graphic-accent';
export interface MotionEffectParameter {
  name: string; type: 'number' | 'color' | 'boolean' | 'string' | 'enum';
  description: string; default: string | number | boolean;
  min?: number; max?: number; step?: number; choices?: Array<string | number>;
}
export interface MotionEffectCatalogItem {
  id: string; name: string; description: string; category: MotionEffectCategory;
  tags: string[]; targetKinds: Array<'text' | 'rect' | 'image' | 'scene'>;
  parameters: Record<string, MotionEffectParameter>;
}
export interface MotionEffectApplication {
  effectId: string; targetLayerId?: string; params?: Record<string, string | number | boolean>;
  startFrame?: number; durationFrames?: number;
}
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
  capabilities?: { motionCpuParticleOverlays?: boolean; aiStoryboardReview?: boolean; motionExtraExportFormats?: string[]; motionAudioBeatSync?: boolean; motionBatchAspectVariants?: boolean; motionBrandKit?: boolean; motionTemplateLibrary?: boolean; motionRevisionHistory?: boolean; motionRevisionHistoryLimit?: number; committedEditsAutoPersisted?: boolean; nondestructiveEffectStack?: boolean; effectsEngine?: boolean; effectsCount?: number; compoundPresets?: boolean; compoundPresetsCount?: number; aiPromptDirector?: string; aiSemanticRevision?: boolean; aiWorkspaceMedia?: string; aiSceneImagesMax?: number; aiAudioLoop?: boolean; localVoiceoverConfigured?: boolean; aiAspectRatios?: string[]; aiAutoSceneNarration?: string; aiMusicVoiceDucking?: boolean; authenticatedFrameSnapshots?: boolean; sampledModelVisionReview?: string; boundedModelVisionRepair?: string; exportSceneCaptionsSrt?: boolean };
}
export interface MotionQualityIssue {
  severity: 'warning' | 'error'; code: string; scene: number; message: string;
}
export interface MotionVisionReview {
  type: 'model-vision-sampled-frames'; projectId: string; revision: number; reviewedFrames: number[];
  passed: boolean;
  issues: Array<{
    frame: number; category: 'readability' | 'layout' | 'contrast' | 'pacing' | 'branding' | 'other';
    severity: 'warning' | 'error'; explanation: string; suggestion: string;
  }>;
  limitations: string[];
}
export interface MotionQualityReport {
  passed: boolean;
  samples: Array<{ frame: number; scene: number; visibleHeadlines: string[] }>;
  issues: MotionQualityIssue[];
}
export interface MotionDirectorMedia {
  imageAssetId?: string; sceneImageAssetIds?: string[]; audioAssetId?: string; audioGain?: number; audioLoop?: boolean;
  voiceoverText?: string; voiceoverGain?: number; autoNarrateScenes?: boolean; aspectRatio?: '16:9' | '1:1' | '9:16';
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
  return base + path + (path.includes('?') ? '&' : '?') + 'workspace=' + encodeURIComponent(workspace);
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
  brandKit: (workspace: string) => json<MotionBrandKit>(workspace, '/brand-kit'),
  saveBrandKit: (workspace: string, baseRevision: number, brand: MotionBrandKitInput) =>
    json<MotionBrandKit>(workspace, '/brand-kit', {
      method: 'POST', body: JSON.stringify({ baseRevision, brand }),
    }),
  templates: (workspace: string) => json<{ templates: MotionTemplateSummary[] }>(workspace, '/templates'),
  previewTemplate: (workspace: string, id: string, baseRevision: number, input: MotionTemplateInput) =>
    json<MotionProject>(workspace, '/projects/' + assertId(id) + '/templates/preview', {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  storyboardPlan: (workspace: string, prompt: string) =>
    json<{ plan: MotionStoryboardPlan; preview: MotionProject }>(workspace, '/storyboard/plan', {
      method: 'POST', body: JSON.stringify({ prompt }),
    }),
  storyboardPreview: (workspace: string, plan: MotionStoryboardPlan) =>
    json<{ preview: MotionProject }>(workspace, '/storyboard/preview', {
      method: 'POST', body: JSON.stringify({ plan }),
    }),
  storyboardRender: (workspace: string, plan: MotionStoryboardPlan, width = 640) =>
    json<MotionDirectorResult>(workspace, '/storyboard/render', {
      method: 'POST', body: JSON.stringify({ plan, width }),
    }),
  applyTemplate: (workspace: string, id: string, baseRevision: number, input: MotionTemplateInput) =>
    json<MotionProject>(workspace, '/projects/' + assertId(id) + '/templates', {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  batchVariants: (workspace: string, id: string, baseRevision: number, aspectRatios: MotionAspectRatio[], width = 640) =>
    json<MotionBatchResult>(workspace, '/projects/' + assertId(id) + '/variants', {
      method: 'POST', body: JSON.stringify({ baseRevision, aspectRatios, width }),
    }),
  particles: (workspace: string, id: string, baseRevision: number, input: MotionParticleInput, preview = false) =>
    json<MotionProject>(workspace, '/projects/' + assertId(id) + '/particles' + (preview ? '/preview' : ''), {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  beatSync: (workspace: string, id: string, baseRevision: number, input: MotionBeatSyncInput, preview = false) =>
    json<MotionBeatSyncResult>(workspace, '/projects/' + assertId(id) + '/beat-sync' + (preview ? '/preview' : ''), {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  history: (workspace: string, id: string) =>
    json<{ snapshots: MotionRevisionSnapshot[] }>(workspace, '/projects/' + assertId(id) + '/history'),
  restoreHistory: (workspace: string, id: string, baseRevision: number, revision: number) =>
    json<MotionProject>(workspace, '/projects/' + assertId(id) + '/history/restore', {
      method: 'POST', body: JSON.stringify({ baseRevision, revision }),
    }),
  presets: (workspace: string) => json<{ count: number; presets: CompoundPreset[] }>(workspace, '/presets'),
  effectsPage: (workspace: string, offset = 0) =>
    json<{ effects: MotionEffectCatalogItem[]; count: number; filteredTotal: number; hasMore: boolean }>(
      workspace, '/effects?limit=100&offset=' + Math.max(0, Math.floor(offset))),
  previewEffect: (workspace: string, id: string, baseRevision: number, input: MotionEffectApplication) =>
    json<MotionProject>(workspace, '/projects/' + assertId(id) + '/effects/preview', {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  applyEffect: (workspace: string, id: string, baseRevision: number, input: MotionEffectApplication) =>
    json<MotionProject>(workspace, '/projects/' + assertId(id) + '/effects', {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  resize: (workspace: string, id: string, baseRevision: number, aspectRatio: '16:9' | '1:1' | '9:16', preview = false) =>
    json<MotionProject>(workspace, '/projects/' + assertId(id) + '/resize' + (preview ? '/preview' : ''), {
      method: 'POST', body: JSON.stringify({ baseRevision, aspectRatio }),
    }),
  changeStack: (workspace: string, id: string, baseRevision: number, operation: MotionStackOperation, preview = false) =>
    json<MotionProject>(workspace, '/projects/' + assertId(id) + '/effect-stack' + (preview ? '/preview' : ''), {
      method: 'POST', body: JSON.stringify({ baseRevision, action: operation.type, operation }),
    }),
  presetInfo: (workspace: string, id: string) => {
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(id)) throw new Error('Invalid compound preset ID');
    return json<CompoundPreset>(workspace, '/presets/' + id);
  },
  previewPreset: (workspace: string, id: string, baseRevision: number, input: CompoundPresetApplication) =>
    json<MotionProject>(workspace, '/projects/' + assertId(id) + '/presets/preview', {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  applyPreset: (workspace: string, id: string, baseRevision: number, input: CompoundPresetApplication) =>
    json<MotionProject>(workspace, '/projects/' + assertId(id) + '/presets', {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  quality: (workspace: string, id: string) =>
    json<MotionQualityReport>(workspace, '/projects/' + assertId(id) + '/quality'),
  visionReview: (workspace: string, id: string) =>
    json<MotionVisionReview>(workspace, '/projects/' + assertId(id) + '/vision-review', {
      method: 'POST', body: JSON.stringify({}),
    }),
  visionRepair: (workspace: string, id: string, baseRevision: number, width = 640) =>
    json<{ changed: boolean; reason?: string; review: MotionVisionReview; result?: MotionDirectorResult }>(
      workspace, '/projects/' + assertId(id) + '/vision-repair', {
        method: 'POST', body: JSON.stringify({ baseRevision, width }),
      }),
  captions: async (workspace: string, id: string): Promise<string> => {
    const response = await motionFetch(workspace, '/projects/' + assertId(id) + '/captions.srt');
    const text = await response.text();
    if (text.length > 256_000) throw new Error('Motion subtitles exceed the maximum size');
    return text;
  },
  async loadFrameSnapshot(workspace: string, id: string, frame: number): Promise<string> {
    if (!Number.isSafeInteger(frame) || frame < 0 || frame > 216000) throw new Error('Invalid Motion snapshot frame');
    const response = await motionFetch(workspace, '/projects/' + assertId(id) + '/frames/' + frame + '.png');
    const blob = await response.blob();
    if (blob.type !== 'image/png' || blob.size < 50 || blob.size > 2 * 1024 * 1024) {
      throw new Error('Invalid Motion frame snapshot');
    }
    return URL.createObjectURL(blob);
  },
  create: (workspace: string, name: string) =>
    json<MotionProject>(workspace, '/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  edit: (workspace: string, id: string, baseRevision: number, edits: MotionEdit[]) =>
    json<MotionProject>(workspace, '/projects/' + assertId(id) + '/edits', {
      method: 'POST', body: JSON.stringify({ baseRevision, edits }),
    }),
  render: (workspace: string, id: string, width = 640, supervised = false) =>
    json<MotionJob>(workspace, '/projects/' + assertId(id) + '/render',
      { method: 'POST', body: JSON.stringify({ width, supervised }) }),
  generate: (workspace: string, prompt: string, width = 640, media: MotionDirectorMedia = {}) =>
    json<MotionDirectorResult>(workspace, '/generate', {
      method: 'POST', body: JSON.stringify({ prompt, width, ...media }),
    }),
  revise: (workspace: string, motionId: string, prompt: string, width = 640, media: MotionDirectorMedia = {}) =>
    json<MotionDirectorResult>(workspace, '/projects/' + assertId(motionId) + '/revise', {
      method: 'POST', body: JSON.stringify({ prompt, width, ...media }),
    }),
  jobs: (workspace: string) => json<MotionJob[]>(workspace, '/jobs'),
  scheduler: (workspace: string) => json<MotionSchedulerStatus>(workspace, '/scheduler'),
  supervisor: (workspace: string) => json<MotionSupervisorStatus>(workspace, '/supervisor'),
  storage: (workspace: string) => json<MotionStorageStatus>(workspace, '/storage'),
  queueRecovery: (workspace: string) => json<MotionQueueRecovery>(workspace, '/queue-recovery'),
  status: (workspace: string, id: string) => json<MotionJob>(workspace, '/jobs/' + assertId(id, true)),
  cancel: (workspace: string, id: string) => json<{ cancellationRequested: boolean }>(workspace, '/jobs/' + assertId(id, true) + '/cancel', { method: 'POST', body: '{}' }),
  async loadExtraExport(workspace: string, id: string, format: 'gif' | 'webm'): Promise<string> {
    if (format !== 'gif' && format !== 'webm') throw new Error('Unsupported Motion export format');
    const response = await motionFetch(workspace, '/jobs/' + assertId(id, true) + '/exports/' + format);
    const declared = response.headers.get('content-length');
    if (declared && Number(declared) > 16 * 1024 * 1024) throw new Error('Motion export exceeds 16 MB');
    const blob = await response.blob();
    if (blob.size < 30 || blob.size > 16 * 1024 * 1024 ||
        blob.type !== (format === 'gif' ? 'image/gif' : 'video/webm')) {
      throw new Error('Invalid Motion extra export response');
    }
    return URL.createObjectURL(blob);
  },
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
