import { STUDIO_DISPLAY_NAME } from "./studioBranding";
/** Typed Studio Studio v1 contract. The SuperAgent server remains authoritative. */
export type StudioProperty = 'x' | 'y' | 'opacity' | 'rotation' | 'scale' | 'scaleX' | 'scaleY' | 'strokeDashoffset';
export type StudioEasing =
  | 'linear'
  | 'step'
  | 'easeInOut'
  | 'easeOutBack'
  | 'easeIn'
  | 'easeOut'
  | 'bounce'
  | 'easeOutExpo'
  | 'easeOutQuart'
  | 'easeOutCubic'
  | 'spring'
  | 'apple';
export interface StudioKeyframe { frame: number; value: number; easing?: StudioEasing }
export interface StudioTrack { property: StudioProperty; keyframes: StudioKeyframe[] }
export interface BaseStudioLayer {
  id: string; kind: 'text' | 'rect' | 'image' | 'video' | 'path'; x: number; y: number;
  width: number; height: number; rotation: number; opacity: number;
  scale?: number; scaleX?: number; scaleY?: number; strokeDashoffset?: number;
  fill: string; tracks: StudioTrack[];
}
export interface StudioTextLayer extends BaseStudioLayer {
  kind: 'text'; text: string; fontSize: number; fontFamily: string;
}
export interface StudioRectLayer extends BaseStudioLayer { kind: 'rect'; cornerRadius?: number }
export interface StudioImageLayer extends BaseStudioLayer { kind: 'image'; assetId: string }
export interface StudioVideoLayer extends BaseStudioLayer {
  kind: 'video'; assetId: string; startFrame?: number; trimInSeconds?: number;
  trimOutSeconds?: number; speedMultiplier?: number; loop?: boolean;
}
export interface StudioPathLayer extends BaseStudioLayer {
  kind: 'path'; d: string; stroke?: string; strokeWidth?: number;
  strokeDasharray?: number[]; strokeDashoffset?: number; fillRule?: 'nonzero' | 'evenodd';
}
export type StudioLayer = StudioTextLayer | StudioRectLayer | StudioImageLayer | StudioVideoLayer | StudioPathLayer;
export interface StudioAudioTrack {
  assetId: string; startFrame: number; volume: number; fadeInFrames?: number; fadeOutFrames?: number; loop?: boolean; role?: 'music' | 'voiceover';
}
export interface StudioAudioAsset { id: string; bytes: number; sampleRate: number; channels: number; seconds: number }
export interface StudioWaveform { peaks: number[]; seconds: number; sampleRate: number; channels: number }
export interface StudioStackEntry {
  id: string; effectId: string; enabled: boolean; targetLayerId?: string;
  params?: Record<string, string | number | boolean>;
  startFrame?: number; durationFrames?: number;
}
export type StudioStackOperation =
  | { type: 'add'; entry: StudioStackEntry }
  | { type: 'remove'; id: string }
  | { type: 'toggle'; id: string; enabled: boolean }
  | { type: 'move'; id: string; toIndex: number }
  | { type: 'update'; id: string; changes: Partial<Omit<StudioStackEntry, 'id'>> };
export interface StudioComposition {
  width: number; height: number;
  fps: { numerator: number; denominator: number };
  durationFrames: number; background: string;
  audio?: StudioAudioTrack; audioTracks?: StudioAudioTrack[];
  layers: StudioLayer[];
  effectStack?: StudioStackEntry[];
  stackBase?: Omit<StudioComposition, 'effectStack' | 'stackBase'>;
}
export interface StudioProject {
  schemaVersion: 1; id: string; workspaceRoot: string; name: string;
  revision: number; createdAt: string; updatedAt: string;
  composition: StudioComposition;
}
export interface StudioProjectSummary { id: string; name: string; revision: number }
export interface StudioRevisionSnapshot { revision: number; updatedAt: string; name: string }
export interface StudioBrandKit {
  revision: number; name: string; primary: string; accent: string;
  background: string; textColor: string;
  fontFamily: 'Arial' | 'Helvetica' | 'Georgia' | 'Verdana' | 'sans-serif' | 'serif' | 'monospace';
  logoAssetId?: string; updatedAt: string;
}
export type StudioBrandKitInput = Omit<StudioBrandKit, 'revision' | 'updatedAt'>;
export interface StudioTemplateSummary {
  id: string; name: string; category: string; description: string;
  align: 'left' | 'center' | 'right'; tone: 'bold' | 'clean' | 'calm'; origin?: 'superagent-original';
}
export interface StudioTemplateInput { templateId: string; headline?: string; subtitle?: string }
export interface StudioStoryboardScene {
  headline: string; subtitle?: string; accent: string;
  motion?: string; effect?: string; preset?: string; narration?: string;
  layout?: 'left' | 'center' | 'right';
}
export interface StudioStoryboardPlan {
  name: string; durationSeconds: number; background: string;
  scenes: StudioStoryboardScene[];
  motion?: string; effect?: string; preset?: string;
  transition?: 'crossfade' | 'cut';
  aspectRatio?: '16:9' | '1:1' | '9:16';
  artDirection?: 'minimal' | 'editorial' | 'neon' | 'brutalist';
}
export type StudioAspectRatio = '16:9' | '1:1' | '9:16';
export interface StudioBatchVariant {
  aspectRatio: StudioAspectRatio;
  projectId?: string; revision?: number; jobId?: string;
  jobStatus?: StudioJob['status']; error?: string;
}
export interface StudioBatchResult {
  sourceProjectId: string; sourceRevision: number; variants: StudioBatchVariant[];
}
export interface StudioBeatSyncInput { targetLayerId: string; audioTrackIndex?: number; intensity?: number }
export interface StudioParticleInput { kind: 'confetti' | 'sparks' | 'snow'; count?: number; color?: string }
export interface StudioTypographyInput {
  targetLayerId: string; style: 'letter-reveal' | 'word-rise';
  startFrame?: number; durationFrames?: number;
}
export interface StudioBeatSyncResult { project: StudioProject; onsetFrames: number[]; analysis: string }
export interface CompoundPreset {
  id: string; name: string; description: string; tags: string[];
  entrance: string; emphasis: string; exit: string; accent?: string;
}
export interface CompoundPresetApplication {
  presetId: string; targetLayerId: string; startFrame?: number;
  durationFrames?: number; intensity?: number;
}
export type StudioEffectCategory = 'entrance' | 'exit' | 'kinetic-typography' | 'camera' |
  'transition' | 'background' | 'graphic-accent';
export interface StudioEffectParameter {
  name: string; type: 'number' | 'color' | 'boolean' | 'string' | 'enum';
  description: string; default: string | number | boolean;
  min?: number; max?: number; step?: number; choices?: Array<string | number>;
}
export interface StudioEffectCatalogItem {
  id: string; name: string; description: string; category: StudioEffectCategory;
  tags: string[]; targetKinds: Array<'text' | 'rect' | 'image' | 'video' | 'path' | 'scene'>;
  parameters: Record<string, StudioEffectParameter>;
}
export interface StudioEffectApplication {
  effectId: string; targetLayerId?: string; params?: Record<string, string | number | boolean>;
  startFrame?: number; durationFrames?: number;
}
export type StudioEdit =
  | { type: 'set-text'; layerId: string; text: string }
  | { type: 'set-property'; layerId: string; property: StudioProperty; value: number }
  | { type: 'set-track'; layerId: string; track: StudioTrack }
  | { type: 'add-layer'; layer: StudioLayer; index?: number }
  | { type: 'remove-layer'; layerId: string }
  | { type: 'move-layer'; layerId: string; toIndex: number }
  | { type: 'replace-composition'; composition: StudioProject['composition'] }
  | { type: 'set-audio'; audio: StudioAudioTrack | null }
  | { type: 'set-audio-tracks'; audioTracks: StudioAudioTrack[] };
export interface StudioCapabilities {
  capabilities?: { motionAdvancedTypography?: string[]; motionCpuParticleOverlays?: boolean; aiStoryboardReview?: boolean; motionExtraExportFormats?: string[]; motionAudioBeatSync?: boolean; motionBatchAspectVariants?: boolean; motionBrandKit?: boolean; motionTemplateLibrary?: boolean; motionRevisionHistory?: boolean; motionRevisionHistoryLimit?: number; committedEditsAutoPersisted?: boolean; nondestructiveEffectStack?: boolean; effectsEngine?: boolean; effectsCount?: number; compoundPresets?: boolean; compoundPresetsCount?: number; aiPromptDirector?: string; aiSemanticRevision?: boolean; aiWorkspaceMedia?: string; aiSceneImagesMax?: number; aiAudioLoop?: boolean; localVoiceoverConfigured?: boolean; aiAspectRatios?: string[]; aiAutoSceneNarration?: string; aiMusicVoiceDucking?: boolean; authenticatedFrameSnapshots?: boolean; sampledModelVisionReview?: string; boundedModelVisionRepair?: string; exportSceneCaptionsSrt?: boolean };
}
export interface StudioQualityIssue {
  severity: 'warning' | 'error'; code: string; scene: number; message: string;
}
export interface StudioVisionReview {
  type: 'model-vision-sampled-frames'; projectId: string; revision: number; reviewedFrames: number[];
  passed: boolean;
  issues: Array<{
    frame: number; category: 'readability' | 'layout' | 'contrast' | 'pacing' | 'branding' | 'other';
    severity: 'warning' | 'error'; explanation: string; suggestion: string;
  }>;
  limitations: string[];
}
export interface StudioQualityReport {
  passed: boolean;
  samples: Array<{ frame: number; scene: number; visibleHeadlines: string[] }>;
  issues: StudioQualityIssue[];
}
export interface StudioDirectorMedia {
  imageAssetId?: string; sceneImageAssetIds?: string[]; audioAssetId?: string; audioGain?: number; audioLoop?: boolean;
  voiceoverText?: string; voiceoverGain?: number; autoNarrateScenes?: boolean; aspectRatio?: '16:9' | '1:1' | '9:16';
  palette?: string; specularSheen?: boolean; deviceMockup?: 'macbook' | 'iphone' | 'browser';
  chartType?: 'benchmark' | 'kpi' | 'radial' | 'sparkline'; chartTitle?: string;
  chartKpiValue?: string; chartProgressPercent?: number; codeSnippet?: string; codeLang?: string;
  audioVisualizer?: boolean; voice?: string; burnCaptions?: boolean;
}
export interface StudioPalette {
  id: string; name: string; bg: string; text: string; primary: string; accent: string; muted: string; border: string;
}
export interface StudioDeviceMockup {
  id: string; name: string; width: number; height: number; description: string;
}
export interface StudioDeliverablesBundle {
  bundlePath: string; files: string[]; sizeBytes: number;
}
export interface StudioImageTraceResult {
  pathData: string; d: string; width: number; height: number;
}
export interface StudioDirectorResult {
  project: StudioProject; job: StudioJob; outline: string[]; limitations: string[];
  quality?: StudioQualityReport;
}
export interface StudioQueueRecovery {
  minAgeSeconds: number; queued: number; eligible: number; blocked: number;
  items: Array<{ jobId: string; createdAt: string; state: 'eligible' | 'blocked'; reason?: string }>;
  warning: string;
}
export interface StudioStorageStatus {
  jobs: { total: number; queued: number; running: number; completed: number; failed: number; cancelled: number; interrupted: number };
  completedArtifactBytes: number;
  maintenance: { minAgeDays: number; candidates: number; blockedIds: string[]; reclaimableBytes: number };
}
export interface StudioSupervisorStatus {
  mode: 'opt-in-fifo';
  queuedSupervised: number; occupied: number; maxConcurrentRenders: number;
  oldestWaitingJobId?: string; blockedReason?: string;
  leader: 'free' | 'claimed_unverified' | 'unsafe_or_unreadable';
  automaticRecoveryOfRenderingJobs: false;
}
export interface StudioSchedulerStatus {
  maxConcurrentRenders: number;
  queueLimit: number;
  queued: number;
  active: number;
  slots: Array<{ slot: number; jobId?: string; state: string }>;
}
export interface StudioJob {
  id: string; projectId: string; revision: number; dispatchMode?: 'supervised';
  status: 'queued' | 'preparing' | 'rendering' | 'validating' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
  framesCompleted: number;
  profile: { frameCount: number; width: number; height: number };
  artifact?: { bytes: number; sha256: string };
  error?: string;
}
export type StudioUpscaleTarget = '1080p' | '2k' | '4k';
export type StudioUpscaleMode = 'lanczos' | 'sharp' | 'spline' | 'superres';

export interface StudioUpscaleTargetInfo {
  target: StudioUpscaleTarget;
  label: string;
  width: number;
  height: number;
  scaleFactor: number;
}

export interface StudioArtifactUpscaleResult {
  jobId: string;
  sourceFile: string;
  upscaledFile: string;
  width: number;
  height: number;
  bytes: number;
  sha256: string;
  durationSeconds: number;
}

const projectIdPattern = /^(?:studio|motion)-[0-9a-f]{20}$/;
const jobIdPattern = /^(?:studiojob|motionjob)-[0-9a-f]{24}$/;
const assetIdPattern = /^asset-[a-f0-9]{64}$/;
const audioIdPattern = /^audio-[a-f0-9]{64}$/;
function assertAudioId(id: string): string {
  if (!audioIdPattern.test(id)) throw new Error('Invalid Studio audio identifier');
  return id;
}
function assertAssetId(id: string): string {
  if (!assetIdPattern.test(id)) throw new Error('Invalid Studio asset identifier');
  return id;
}
const base = '/api/superagent/studio';

function assertId(id: string, job = false): string {
  if (!(job ? jobIdPattern : projectIdPattern).test(id)) throw new Error('Invalid Studio identifier');
  return id;
}
function authHeaders(): Record<string, string> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Sign in to T-Line before opening SuperAgent Studio');
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
    let message = STUDIO_DISPLAY_NAME + ' HTTP ' + response.status;
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
export const studioApi = {
  capabilities: (workspace: string) => json<StudioCapabilities>(workspace, '/'),
  /** Accepts image bytes only; browser paths never cross the API boundary. */
  async uploadImage(workspace: string, file: File): Promise<{ id: string; bytes: number; width: number; height: number }> {
    if (file.size < 24 || file.size > 1024 * 1024) throw new Error('Studio image must be 1 MB or smaller');
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
    if (blob.type !== 'image/png' || blob.size < 24 || blob.size > 1024 * 1024) throw new Error('Invalid Studio asset response');
    return URL.createObjectURL(blob);
  },
  /** Only canonical WAV PCM16 assets are accepted, not file paths or remote URLs. */
  async uploadAudio(workspace: string, file: File): Promise<StudioAudioAsset> {
    if (file.size < 46 || file.size > 2 * 1024 * 1024) throw new Error('Studio WAV must be 2 MB or smaller');
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
      throw new Error('Invalid Studio WAV response');
    }
    return URL.createObjectURL(data);
  },
  loadAudioWaveform: (workspace: string, id: string) =>
    json<StudioWaveform>(workspace, '/audio/' + assertAudioId(id) + '/waveform'),
  list: (workspace: string) => json<StudioProjectSummary[]>(workspace, '/projects'),
  inspect: (workspace: string, id: string) => json<StudioProject>(workspace, '/projects/' + assertId(id)),
  brandKit: (workspace: string) => json<StudioBrandKit>(workspace, '/brand-kit'),
  saveBrandKit: (workspace: string, baseRevision: number, brand: StudioBrandKitInput) =>
    json<StudioBrandKit>(workspace, '/brand-kit', {
      method: 'POST', body: JSON.stringify({ baseRevision, brand }),
    }),
  templates: (workspace: string) => json<{ templates: StudioTemplateSummary[] }>(workspace, '/templates'),
  previewTemplate: (workspace: string, id: string, baseRevision: number, input: StudioTemplateInput) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/templates/preview', {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  storyboardPlan: (workspace: string, prompt: string) =>
    json<{ plan: StudioStoryboardPlan; preview: StudioProject }>(workspace, '/storyboard/plan', {
      method: 'POST', body: JSON.stringify({ prompt }),
    }),
  storyboardPreview: (workspace: string, plan: StudioStoryboardPlan) =>
    json<{ preview: StudioProject }>(workspace, '/storyboard/preview', {
      method: 'POST', body: JSON.stringify({ plan }),
    }),
  storyboardRender: (workspace: string, plan: StudioStoryboardPlan, width = 640) =>
    json<StudioDirectorResult>(workspace, '/storyboard/render', {
      method: 'POST', body: JSON.stringify({ plan, width }),
    }),
  applyTemplate: (workspace: string, id: string, baseRevision: number, input: StudioTemplateInput) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/templates', {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  batchVariants: (workspace: string, id: string, baseRevision: number, aspectRatios: StudioAspectRatio[], width = 640) =>
    json<StudioBatchResult>(workspace, '/projects/' + assertId(id) + '/variants', {
      method: 'POST', body: JSON.stringify({ baseRevision, aspectRatios, width }),
    }),
  typography: (workspace: string, id: string, baseRevision: number, input: StudioTypographyInput, preview = false) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/typography' + (preview ? '/preview' : ''), {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  particles: (workspace: string, id: string, baseRevision: number, input: StudioParticleInput, preview = false) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/particles' + (preview ? '/preview' : ''), {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  beatSync: (workspace: string, id: string, baseRevision: number, input: StudioBeatSyncInput, preview = false) =>
    json<StudioBeatSyncResult>(workspace, '/projects/' + assertId(id) + '/beat-sync' + (preview ? '/preview' : ''), {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  history: (workspace: string, id: string) =>
    json<{ snapshots: StudioRevisionSnapshot[] }>(workspace, '/projects/' + assertId(id) + '/history'),
  restoreHistory: (workspace: string, id: string, baseRevision: number, revision: number) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/history/restore', {
      method: 'POST', body: JSON.stringify({ baseRevision, revision }),
    }),
  presets: (workspace: string) => json<{ count: number; presets: CompoundPreset[] }>(workspace, '/presets'),
  effectsPage: (workspace: string, offset = 0) =>
    json<{ effects: StudioEffectCatalogItem[]; count: number; filteredTotal: number; hasMore: boolean }>(
      workspace, '/effects?limit=100&offset=' + Math.max(0, Math.floor(offset))),
  previewEffect: (workspace: string, id: string, baseRevision: number, input: StudioEffectApplication) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/effects/preview', {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  applyEffect: (workspace: string, id: string, baseRevision: number, input: StudioEffectApplication) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/effects', {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  resize: (workspace: string, id: string, baseRevision: number, aspectRatio: '16:9' | '1:1' | '9:16', preview = false) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/resize' + (preview ? '/preview' : ''), {
      method: 'POST', body: JSON.stringify({ baseRevision, aspectRatio }),
    }),
  upscaleTargets: (workspace: string, id: string) =>
    json<{ currentWidth: number; currentHeight: number; availableTargets: StudioUpscaleTargetInfo[] }>(
      workspace, '/projects/' + assertId(id) + '/upscale/targets'
    ),
  upscale: (
    workspace: string,
    id: string,
    baseRevision: number,
    options: { scale?: number; target?: StudioUpscaleTarget; targetWidth?: number; preview?: boolean } = {}
  ) =>
    json<StudioProject>(
      workspace,
      '/projects/' + assertId(id) + '/upscale' + (options.preview ? '/preview' : ''),
      {
        method: 'POST',
        body: JSON.stringify({ baseRevision, ...options }),
      }
    ),
  upscaleJob: (
    workspace: string,
    id: string,
    options: { scale?: number; target?: StudioUpscaleTarget; mode?: StudioUpscaleMode } = {}
  ) =>
    json<StudioArtifactUpscaleResult>(
      workspace,
      '/jobs/' + assertId(id, true) + '/upscale',
      {
        method: 'POST',
        body: JSON.stringify(options),
      }
    ),
  changeStack: (workspace: string, id: string, baseRevision: number, operation: StudioStackOperation, preview = false) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/effect-stack' + (preview ? '/preview' : ''), {
      method: 'POST', body: JSON.stringify({ baseRevision, action: operation.type, operation }),
    }),
  presetInfo: (workspace: string, id: string) => {
    if (!/^[a-z][a-z0-9-]{1,63}$/.test(id)) throw new Error('Invalid compound preset ID');
    return json<CompoundPreset>(workspace, '/presets/' + id);
  },
  previewPreset: (workspace: string, id: string, baseRevision: number, input: CompoundPresetApplication) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/presets/preview', {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  applyPreset: (workspace: string, id: string, baseRevision: number, input: CompoundPresetApplication) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/presets', {
      method: 'POST', body: JSON.stringify({ ...input, baseRevision }),
    }),
  quality: (workspace: string, id: string) =>
    json<StudioQualityReport>(workspace, '/projects/' + assertId(id) + '/quality'),
  visionReview: (workspace: string, id: string) =>
    json<StudioVisionReview>(workspace, '/projects/' + assertId(id) + '/vision-review', {
      method: 'POST', body: JSON.stringify({}),
    }),
  visionRepair: (workspace: string, id: string, baseRevision: number, width = 640) =>
    json<{ changed: boolean; reason?: string; review: StudioVisionReview; result?: StudioDirectorResult }>(
      workspace, '/projects/' + assertId(id) + '/vision-repair', {
        method: 'POST', body: JSON.stringify({ baseRevision, width }),
      }),
  captions: async (workspace: string, id: string): Promise<string> => {
    const response = await motionFetch(workspace, '/projects/' + assertId(id) + '/captions.srt');
    const text = await response.text();
    if (text.length > 256_000) throw new Error('Studio subtitles exceed the maximum size');
    return text;
  },
  async loadFrameSnapshot(workspace: string, id: string, frame: number): Promise<string> {
    if (!Number.isSafeInteger(frame) || frame < 0 || frame > 216000) throw new Error('Invalid Studio snapshot frame');
    const response = await motionFetch(workspace, '/projects/' + assertId(id) + '/frames/' + frame + '.png');
    const blob = await response.blob();
    if (blob.type !== 'image/png' || blob.size < 50 || blob.size > 2 * 1024 * 1024) {
      throw new Error('Invalid Studio frame snapshot');
    }
    return URL.createObjectURL(blob);
  },
  create: (workspace: string, name: string) =>
    json<StudioProject>(workspace, '/projects', { method: 'POST', body: JSON.stringify({ name }) }),
  edit: (workspace: string, id: string, baseRevision: number, edits: StudioEdit[]) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/edits', {
      method: 'POST', body: JSON.stringify({ baseRevision, edits }),
    }),
  render: (workspace: string, id: string, width = 640, supervised = false) =>
    json<StudioJob>(workspace, '/projects/' + assertId(id) + '/render',
      { method: 'POST', body: JSON.stringify({ width, supervised }) }),
  generate: (workspace: string, prompt: string, width = 640, media: StudioDirectorMedia = {}) =>
    json<StudioDirectorResult>(workspace, '/generate', {
      method: 'POST', body: JSON.stringify({ prompt, width, ...media }),
    }),
  revise: (workspace: string, motionId: string, prompt: string, width = 640, media: StudioDirectorMedia = {}) =>
    json<StudioDirectorResult>(workspace, '/projects/' + assertId(motionId) + '/revise', {
      method: 'POST', body: JSON.stringify({ prompt, width, ...media }),
    }),
  palettes: (workspace: string) => json<{ palettes: StudioPalette[] }>(workspace, '/palettes'),
  mockups: (workspace: string) => json<{ mockups: StudioDeviceMockup[] }>(workspace, '/mockups'),
  attachMockup: (workspace: string, id: string, baseRevision: number, options: { device?: 'macbook' | 'iphone' | 'browser'; title?: string; url?: string; accent?: string }) =>
    json<{ project: StudioProject; layersAdded: number; deviceType: string }>(workspace, '/projects/' + assertId(id) + '/mockup', {
      method: 'POST', body: JSON.stringify({ baseRevision, ...options }),
    }),
  attachChart: (workspace: string, id: string, baseRevision: number, options: { type?: 'benchmark' | 'kpi' | 'radial' | 'sparkline'; title?: string; kpiValue?: string; kpiBadge?: string; progressPercent?: number; accent?: string }) =>
    json<{ project: StudioProject; layersAdded: number }>(workspace, '/projects/' + assertId(id) + '/chart', {
      method: 'POST', body: JSON.stringify({ baseRevision, ...options }),
    }),
  saasPromo: (workspace: string, options: { product?: string; tagline?: string; palette?: string; device?: 'macbook' | 'iphone' | 'browser'; voice?: string; width?: number }) =>
    json<{ project: StudioProject; job: StudioJob }>(workspace, '/saas-promo', {
      method: 'POST', body: JSON.stringify(options),
    }),
  traceImage: (workspace: string, input: { imageBase64?: string; assetId?: string; options?: unknown }) =>
    json<StudioImageTraceResult>(workspace, '/trace-image', {
      method: 'POST', body: JSON.stringify(input),
    }),
  vectorizeLayer: (workspace: string, id: string, baseRevision: number, layerId: string, options?: unknown) =>
    json<StudioProject>(workspace, '/projects/' + assertId(id) + '/vectorize', {
      method: 'POST', body: JSON.stringify({ baseRevision, layerId, options }),
    }),
  exportBundle: (workspace: string, id: string) =>
    json<StudioDeliverablesBundle>(workspace, '/projects/' + assertId(id) + '/bundle', {
      method: 'POST', body: '{}',
    }),
  getBundleManifest: (workspace: string, id: string) =>
    json<StudioDeliverablesBundle>(workspace, '/projects/' + assertId(id) + '/bundle'),
  jobs: (workspace: string) => json<StudioJob[]>(workspace, '/jobs'),
  scheduler: (workspace: string) => json<StudioSchedulerStatus>(workspace, '/scheduler'),
  supervisor: (workspace: string) => json<StudioSupervisorStatus>(workspace, '/supervisor'),
  storage: (workspace: string) => json<StudioStorageStatus>(workspace, '/storage'),
  queueRecovery: (workspace: string) => json<StudioQueueRecovery>(workspace, '/queue-recovery'),
  status: (workspace: string, id: string) => json<StudioJob>(workspace, '/jobs/' + assertId(id, true)),
  cancel: (workspace: string, id: string) => json<{ cancellationRequested: boolean }>(workspace, '/jobs/' + assertId(id, true) + '/cancel', { method: 'POST', body: '{}' }),
  async loadExtraExport(workspace: string, id: string, format: 'gif' | 'webm'): Promise<string> {
    if (format !== 'gif' && format !== 'webm') throw new Error('Unsupported Studio export format');
    const response = await motionFetch(workspace, '/jobs/' + assertId(id, true) + '/exports/' + format);
    const declared = response.headers.get('content-length');
    if (declared && Number(declared) > 16 * 1024 * 1024) throw new Error('Studio export exceeds 16 MB');
    const blob = await response.blob();
    if (blob.size < 30 || blob.size > 16 * 1024 * 1024 ||
        blob.type !== (format === 'gif' ? 'image/gif' : 'video/webm')) {
      throw new Error('Invalid Studio extra export response');
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
    if (blob.size !== size || blob.type !== 'video/mp4') throw new Error('Invalid Studio video preview');
    return URL.createObjectURL(blob);
  },
};
