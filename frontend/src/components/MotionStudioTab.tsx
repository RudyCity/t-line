/* Hallmark · pre-emit critique: P4 H5 E4 S5 R5 V4
 * Motion Studio · production-editor layout, inherited T-Line tokens.
 * Scene is drawn with React SVG primitives only; user text is never evaluated as markup.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ChevronDown, Clapperboard, Film, Layers3, Loader2,
  Pause, Play, Plus, RefreshCw, Save, Square, Type, X, Trash2, ArrowUp, ArrowDown, Undo2, Redo2, Image as ImageIcon,
} from 'lucide-react';
import {
  motionStudioApi, type MotionJob, type MotionProject, type MotionLayer, type MotionEdit, type MotionSchedulerStatus,
  type CompoundPresetApplication,
  type MotionProperty, type MotionProjectSummary, type MotionStorageStatus, type MotionQueueRecovery, type MotionSupervisorStatus, type MotionQualityReport, type MotionVisionReview,
} from '../services/motionStudioApi';
import { evaluateLayer, fpsOf, frameLabel, makeKeyframeTrack } from '../services/motionScene';
import { MotionCanvas } from './MotionCanvas';
import { MotionPresetPanel } from './MotionPresetPanel';
import { MotionTimeline } from './MotionTimeline';
import { MotionAudioPanel } from './MotionAudioPanel';
import { motionPlaybackFrame } from '../services/motionTimelineClock';
import { DEFAULT_MOTION_VIEWPORT, panMotionViewport, zoomMotionViewport, type MotionViewport } from '../services/motionViewport';

interface Props { workspacePath: string; isActive: boolean }
type PropertyDraft = { field: MotionProperty; value: string };
const control = 'w-full rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-xs text-[var(--text-main)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const action = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-xs font-medium text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40';
const primary = 'inline-flex items-center gap-1.5 rounded bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50';
const idle = new Set<MotionJob['status']>(['completed', 'failed', 'cancelled', 'interrupted']);

export function MotionStudioTab({ workspacePath, isActive }: Props) {
  const [projects, setProjects] = useState<MotionProjectSummary[]>([]);
  const [project, setProject] = useState<MotionProject | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [canvasSnapping, setCanvasSnapping] = useState(true);
  const [viewport, setViewport] = useState<MotionViewport>(DEFAULT_MOTION_VIEWPORT);
  const [panMode, setPanMode] = useState(false);
  const panGesture = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [motionPrompt, setMotionPrompt] = useState('');
  const [directorAvailable, setDirectorAvailable] = useState(false);
  const [directorMediaAvailable, setDirectorMediaAvailable] = useState(false);
  const [promptImages, setPromptImages] = useState<Array<{ id: string; name: string }>>([]);
  const [promptAudio, setPromptAudio] = useState<{ id: string; name: string; seconds: number } | null>(null);
  const [promptAudioGain, setPromptAudioGain] = useState(1);
  const [promptAudioLoop, setPromptAudioLoop] = useState(false);
  const [directorSceneImagesAvailable, setDirectorSceneImagesAvailable] = useState(false);
  const [directorAudioLoopAvailable, setDirectorAudioLoopAvailable] = useState(false);
  const [directorVoiceoverAvailable, setDirectorVoiceoverAvailable] = useState(false);
  const [directorAspectAvailable, setDirectorAspectAvailable] = useState(false);
  const [directorSnapshotAvailable, setDirectorSnapshotAvailable] = useState(false);
  const [directorAutoNarration, setDirectorAutoNarration] = useState(false);
  const [motionSnapshots, setMotionSnapshots] = useState<Array<{ frame: number; url: string }>>([]);
  const motionSnapshotsRef = useRef<Array<{ frame: number; url: string }>>([]);
  const [promptAspectRatio, setPromptAspectRatio] = useState<'16:9' | '1:1' | '9:16'>('16:9');
  const [promptVoiceover, setPromptVoiceover] = useState('');
  const [promptVoiceoverGain, setPromptVoiceoverGain] = useState(1);
  const [promptHistory, setPromptHistory] = useState<Array<{ prompt: string; response: string }>>([]);
  const [quality, setQuality] = useState<MotionQualityReport | null>(null);
  const [visionReview, setVisionReview] = useState<MotionVisionReview | null>(null);
  const [visionAvailable, setVisionAvailable] = useState(false);
  const [visionRepairAvailable, setVisionRepairAvailable] = useState(false);
  const [captionsAvailable, setCaptionsAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [jobs, setJobs] = useState<MotionJob[]>([]);
  const [scheduler, setScheduler] = useState<MotionSchedulerStatus | null>(null);
  const [supervisor, setSupervisor] = useState<MotionSupervisorStatus | null>(null);
  const [supervisedRender, setSupervisedRender] = useState(false);
  const [storage, setStorage] = useState<MotionStorageStatus | null>(null);
  const [queueRecovery, setQueueRecovery] = useState<MotionQueueRecovery | null>(null);
  const [renderWidth, setRenderWidth] = useState<640 | 1280 | 1920>(640);
  const [activeJobId, setActiveJobId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [undoStack, setUndoStack] = useState<MotionProject['composition'][]>([]);
  const [redoStack, setRedoStack] = useState<MotionProject['composition'][]>([]);
  const [draftText, setDraftText] = useState('');
  const [propertyDraft, setPropertyDraft] = useState<PropertyDraft>({ field: 'x', value: '0' });
  const [cornerDraft, setCornerDraft] = useState('0');
  const [compoundAvailable, setCompoundAvailable] = useState(false);
  const [presetPreview, setPresetPreview] = useState<MotionProject | null>(null);
  const mounted = useRef(true);
  const previewRef = useRef<string | null>(null);
  const version = useRef(0);
  const selectionSeq = useRef(0);

  const message = useCallback((errorMessage: string) => {
    setError(errorMessage); setSuccess('');
  }, []);

  const refreshProjects = useCallback(async () => {
    const list = await motionStudioApi.list(workspacePath);
    if (mounted.current) setProjects(list);
    return list;
  }, [workspacePath]);

  useEffect(() => {
    mounted.current = true;
    const sequence = ++version.current;
    selectionSeq.current++;
    setProject(null); setSelectedId(''); setSelectedLayer(null); setFrame(0);
    setMotionPrompt(''); setPromptHistory([]); setDirectorAvailable(false); setDirectorMediaAvailable(false);
    setPromptImages([]); setPromptAudio(null); setPromptAudioGain(1); setPromptAudioLoop(false);
    setDirectorSceneImagesAvailable(false); setDirectorAudioLoopAvailable(false); setDirectorVoiceoverAvailable(false);
    setDirectorAspectAvailable(false); setPromptAspectRatio('16:9');
    setDirectorSnapshotAvailable(false); setDirectorAutoNarration(false);
    setPromptVoiceover(''); setPromptVoiceoverGain(1); setQuality(null); setVisionReview(null);
    setVisionAvailable(false); setVisionRepairAvailable(false); setCaptionsAvailable(false);
    setCompoundAvailable(false); setPresetPreview(null);
    setViewport(DEFAULT_MOTION_VIEWPORT); setPanMode(false); panGesture.current = null;
    setJobs([]); setActiveJobId(''); setError(''); setSuccess('');
    setScheduler(null); setSupervisor(null); setSupervisedRender(false);
    setStorage(null); setQueueRecovery(null);
    setUndoStack([]); setRedoStack([]);
    const refresh = async () => {
      try {
        const [list, existingJobs] = await Promise.all([motionStudioApi.list(workspacePath), motionStudioApi.jobs(workspacePath)]);
        // Older SuperAgent builds lack scheduler information; editor remains usable.
        const [capacity, storageInfo, recoveryInfo, supervisorInfo, motionInfo] = await Promise.all([
          motionStudioApi.scheduler(workspacePath).catch(() => null),
          motionStudioApi.storage(workspacePath).catch(() => null),
          motionStudioApi.queueRecovery(workspacePath).catch(() => null),
          motionStudioApi.supervisor(workspacePath).catch(() => null),
          motionStudioApi.capabilities(workspacePath).catch(() => null),
        ]);
        if (!mounted.current || version.current !== sequence) return;
        setProjects(list); setJobs(existingJobs); setScheduler(capacity); setStorage(storageInfo); setQueueRecovery(recoveryInfo); setSupervisor(supervisorInfo);
        setDirectorAvailable(Boolean(motionInfo?.capabilities?.aiPromptDirector));
        setDirectorMediaAvailable(motionInfo?.capabilities?.aiWorkspaceMedia === 'uploaded-image-wav');
        setDirectorSceneImagesAvailable((motionInfo?.capabilities?.aiSceneImagesMax ?? 0) >= 3);
        setDirectorAudioLoopAvailable(motionInfo?.capabilities?.aiAudioLoop === true);
        setDirectorVoiceoverAvailable(motionInfo?.capabilities?.localVoiceoverConfigured === true);
        setDirectorAspectAvailable(motionInfo?.capabilities?.aiAspectRatios?.includes('9:16') === true);
        setDirectorSnapshotAvailable(motionInfo?.capabilities?.authenticatedFrameSnapshots === true);
        setVisionAvailable(motionInfo?.capabilities?.sampledModelVisionReview === 'on-demand-vision-model-required');
        setVisionRepairAvailable(motionInfo?.capabilities?.boundedModelVisionRepair === 'one-review-one-revision');
        setCaptionsAvailable(motionInfo?.capabilities?.exportSceneCaptionsSrt === true);
        setCompoundAvailable(motionInfo?.capabilities?.compoundPresets === true);
        const latest = existingJobs.find(job => job.status === 'completed') || existingJobs[0];
        setActiveJobId(latest?.id || '');
      } catch (cause) {
        if (mounted.current && version.current === sequence) message(cause instanceof Error ? cause.message : String(cause));
      }
    };
    if (workspacePath) void refresh();
    return () => { mounted.current = false; version.current++; };
  }, [workspacePath, message]);

  useEffect(() => {
    const sequence = version.current;
    const selectedSequence = ++selectionSeq.current;
    if (!selectedId || !workspacePath) { setProject(null); return; }
    setProject(null); setSelectedLayer(null); setFrame(0); setPlaying(false);
    setViewport(DEFAULT_MOTION_VIEWPORT); panGesture.current = null;
    setUndoStack([]); setRedoStack([]); setPresetPreview(null);
    setActiveJobId(jobs.find(item => item.projectId === selectedId)?.id || '');
    motionStudioApi.inspect(workspacePath, selectedId)
      .then(next => {
        if (!mounted.current || sequence !== version.current || selectedSequence !== selectionSeq.current) return;
        setProject(next);
        setSelectedLayer(next.composition.layers[0]?.id ?? null);
      }).catch(cause => {
        if (mounted.current && sequence === version.current && selectedSequence === selectionSeq.current) message(cause instanceof Error ? cause.message : String(cause));
      });
  }, [selectedId, workspacePath, message]);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const ids = [...new Set((project?.composition.layers ?? []).filter(item => item.kind === 'image').map(item => item.assetId))];
    setImageUrls({});
    if (ids.length) {
      void Promise.all(ids.map(async id => {
        const url = await motionStudioApi.loadImageUrl(workspacePath, id);
        if (cancelled) {
          URL.revokeObjectURL?.(url);
          return [id, ''] as const;
        }
        urls.push(url);
        return [id, url] as const;
      })).then(pairs => {
        if (!cancelled && mounted.current) setImageUrls(Object.fromEntries(pairs));
      }).catch(cause => {
        if (!cancelled) message(cause instanceof Error ? cause.message : String(cause));
      });
    }
    return () => {
      cancelled = true;
      for (const url of urls) URL.revokeObjectURL?.(url);
    };
  }, [workspacePath, project?.id, project?.revision, message]);

  const layer = useMemo(() => project?.composition.layers.find(item => item.id === selectedLayer) || null, [project, selectedLayer]);
  const job = jobs.find(item => item.id === activeJobId) || null;
  const totalFrames = project?.composition.durationFrames ?? 1;
  const fps = project ? fpsOf(project) : 30;

  useEffect(() => {
    if (layer?.kind === 'text') setDraftText(layer.text);
    if (layer?.kind === 'rect') setCornerDraft(String(layer.cornerRadius ?? 0));
    setPropertyDraft({ field: 'x', value: String(layer?.x ?? 0) });
  }, [layer?.id, layer?.kind, layer?.kind === 'text' ? layer.text : '', project?.revision]);

  useEffect(() => {
    if (!playing || !isActive || !project) return;
    const startedAt = performance.now();
    const startFrame = frame;
    const durationFrames = project.composition.durationFrames;
    const timer = window.setInterval(() => setFrame(
      motionPlaybackFrame(startFrame, performance.now() - startedAt, fps, durationFrames),
    ), Math.min(50, 1000 / fps));
    return () => window.clearInterval(timer);
    // Deliberately restart the playback clock only on a play toggle or new scene,
    // not on each frame state update.
  }, [playing, isActive, fps, project?.id, project?.composition.durationFrames]);

  useEffect(() => {
    const active = jobs.some(item => !idle.has(item.status));
    if (!active || !workspacePath) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [result, capacity] = await Promise.all([
          motionStudioApi.jobs(workspacePath), motionStudioApi.scheduler(workspacePath).catch(() => null),
        ]);
        if (!cancelled && mounted.current) {
          setJobs(result);
          if (capacity) setScheduler(capacity);
        }
      } catch (cause) {
        if (!cancelled) message(cause instanceof Error ? cause.message : String(cause));
      }
    };
    const timer = window.setInterval(() => void tick(), 1200);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [jobs, workspacePath, message]);

  useEffect(() => {
    // A blob URL is private to this browser session; revoke it after selection changes.
    const old = previewRef.current;
    previewRef.current = null;
    setPreviewUrl('');
    if (old) URL.revokeObjectURL(old);
    if (!job || job.status !== 'completed' || !job.artifact) return;
    let cancelled = false;
    motionStudioApi.loadPreview(workspacePath, job.id)
      .then(url => {
        if (cancelled) URL.revokeObjectURL(url);
        else { previewRef.current = url; setPreviewUrl(url); }
      })
      .catch(cause => { if (!cancelled) message(cause instanceof Error ? cause.message : String(cause)); });
    return () => {
      cancelled = true;
      const current = previewRef.current;
      previewRef.current = null;
      if (current) URL.revokeObjectURL(current);
    };
  }, [workspacePath, job?.id, job?.status, job?.artifact?.sha256, message]);

  useEffect(() => {
    if (!workspacePath || !project) { setQuality(null); return; }
    let cancelled = false;
    void motionStudioApi.quality(workspacePath, project.id)
      .then(report => { if (!cancelled) setQuality(report); })
      .catch(() => { if (!cancelled) setQuality(null); });
    return () => { cancelled = true; };
  }, [workspacePath, project?.id, project?.revision]);

  const operation = async (run: () => Promise<void>) => {
    setBusy(true); setError(''); setSuccess('');
    try { await run(); }
    catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      message(reason);
      if (/revision conflict/i.test(reason) && selectedId) {
        try { setProject(await motionStudioApi.inspect(workspacePath, selectedId)); } catch { /* show conflict */ }
      }
    } finally { setBusy(false); }
  };

  const applyCompound = (input: CompoundPresetApplication) => {
    if (!project || busy) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    setPresetPreview(null);
    void operation(async () => {
      const next = await motionStudioApi.applyPreset(workspacePath, project.id, project.revision, input);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(next);
      setSuccess('Applied ' + input.presetId + ' · revision ' + next.revision);
    });
  };

  const createProject = () => void operation(async () => {
    const created = await motionStudioApi.create(workspacePath, projectName.trim());
    await refreshProjects();
    setCreating(false); setProjectName(''); setSelectedId(created.id); setSuccess('New Motion project created');
  });

  const applyEditorEdits = (edits: MotionEdit[], note: string, focus?: string | null) => {
    if (!project || busy) return;
    setPresetPreview(null);
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    void operation(async () => {
      const next = await motionStudioApi.edit(workspacePath, project.id, project.revision, edits);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(next);
      if (focus !== undefined) setSelectedLayer(focus);
      setSuccess(note + ' · revision ' + next.revision);
    });
  };

  const restoreHistory = (direction: 'undo' | 'redo') => {
    if (!project || busy) return;
    setPresetPreview(null);
    const from = direction === 'undo' ? undoStack : redoStack;
    const target = from[from.length - 1];
    if (!target) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    void operation(async () => {
      const next = await motionStudioApi.edit(workspacePath, project.id, project.revision, [
        { type: 'replace-composition', composition: structuredClone(target) },
      ]);
      if (selectedSequence !== selectionSeq.current) return;
      if (direction === 'undo') {
        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev.slice(-19), before]);
      } else {
        setRedoStack(prev => prev.slice(0, -1));
        setUndoStack(prev => [...prev.slice(-19), before]);
      }
      setProject(next);
      if (!next.composition.layers.some(item => item.id === selectedLayer)) {
        setSelectedLayer(next.composition.layers[0]?.id ?? null);
      }
      setSuccess((direction === 'undo' ? 'Undo' : 'Redo') + ' · revision ' + next.revision);
    });
  };

  const importAudio = (file: File) => {
    if (!project || busy) return;
    const currentTracks = project.composition.audioTracks ??
      (project.composition.audio ? [project.composition.audio] : []);
    if (currentTracks.length >= 4) { message('Motion scenes support up to 4 audio clips'); return; }
    if (file.size < 46 || file.size > 2 * 1024 * 1024) {
      message('Motion WAV must be 2 MB or smaller'); return;
    }
    const current = project;
    const selectedSequence = selectionSeq.current;
    void operation(async () => {
      const asset = await motionStudioApi.uploadAudio(workspacePath, file);
      if (selectedSequence !== selectionSeq.current) return;
      const next = await motionStudioApi.edit(workspacePath, current.id, current.revision, [{
        type: 'set-audio-tracks', audioTracks: [
          ...currentTracks, { assetId: asset.id, startFrame: 0, volume: 1 },
        ],
      }]);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(previous => [...previous.slice(-19), structuredClone(current.composition)]);
      setRedoStack([]);
      setProject(next);
      setSuccess('Audio imported · revision ' + next.revision);
    });
  };

  const importImage = (file?: File) => {
    if (!file || !project || busy) return;
    if (file.size > 1024 * 1024 || file.size < 24) { message('Motion images must be 1 MB or smaller'); return; }
    const current = project;
    const selectedSequence = selectionSeq.current;
    void operation(async () => {
      const asset = await motionStudioApi.uploadImage(workspacePath, file);
      const layerId = 'layer-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const scale = Math.min(1, 600 / Math.max(asset.width, asset.height));
      const width = Math.max(1, Math.round(asset.width * scale));
      const height = Math.max(1, Math.round(asset.height * scale));
      const layer: MotionLayer = {
        kind: 'image', id: layerId, assetId: asset.id,
        x: (current.composition.width - width) / 2,
        y: (current.composition.height - height) / 2,
        width, height, rotation: 0, opacity: 1, fill: '#FFFFFF', tracks: [],
      };
      // Don't edit an old project if selection changed while file upload ran.
      if (selectedSequence !== selectionSeq.current) return;
      const next = await motionStudioApi.edit(workspacePath, current.id, current.revision, [
        { type: 'add-layer', layer },
      ]);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), structuredClone(current.composition)]);
      setRedoStack([]);
      setProject(next);
      setSelectedLayer(layerId);
      setSuccess('Image imported · revision ' + next.revision);
    });
  };

  const insertLayer = (kind: MotionLayer['kind']) => {
    if (!project) return;
    const id = 'layer-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const common = {
      id, x: 120, y: 160, width: 480, height: 130,
      rotation: 0, opacity: 1, fill: kind === 'text' ? '#FFFFFF' : '#4C80EE', tracks: [],
    };
    const layer: MotionLayer = kind === 'text'
      ? { ...common, kind: 'text', text: 'New text', fontFamily: 'Arial', fontSize: 64 }
      : { ...common, kind: 'rect' };
    applyEditorEdits([{ type: 'add-layer', layer }], 'Layer added', id);
  };

  const reorderLayer = (delta: number) => {
    if (!project || !selectedLayer) return;
    const index = project.composition.layers.findIndex(item => item.id === selectedLayer);
    const toIndex = index + delta;
    if (index < 0 || toIndex < 0 || toIndex >= project.composition.layers.length) return;
    applyEditorEdits([{ type: 'move-layer', layerId: selectedLayer, toIndex }], 'Layer reordered');
  };

  const removeSelectedLayer = () => {
    if (!project || !selectedLayer) return;
    const nextSelected = project.composition.layers.find(item => item.id !== selectedLayer)?.id ?? null;
    applyEditorEdits([{ type: 'remove-layer', layerId: selectedLayer }], 'Layer removed', nextSelected);
  };

  const saveText = () => {
    if (!project || layer?.kind !== 'text' || draftText === layer.text) return;
    applyEditorEdits([{ type: 'set-text', layerId: layer.id, text: draftText }], 'Text saved');
  };

  const saveCornerRadius = () => {
    if (!project || !layer || layer.kind !== 'rect') return;
    const value = Number(cornerDraft);
    if (!Number.isFinite(value) || value < 0 || value > 4096 ||
        value > Math.min(layer.width, layer.height) / 2) {
      message('Rounded corner radius must fit inside the rectangle');
      return;
    }
    if (value === (layer.cornerRadius ?? 0)) return;
    const composition = structuredClone(project.composition);
    const target = composition.layers.find(item => item.id === layer.id);
    if (!target || target.kind !== 'rect') return;
    target.cornerRadius = value;
    applyEditorEdits([{ type: 'replace-composition', composition }], 'Rounded rectangle updated');
  };
  const saveProperty = () => {
    if (!project || !layer) return;
    const value = Number(propertyDraft.value);
    const { field } = propertyDraft;
    const range = field === 'opacity' ? [0, 1] : field === 'rotation' ? [-36000, 36000] : [-100000, 100000];
    if (!Number.isFinite(value) || value < range[0] || value > range[1]) { message('Property value is outside the supported range'); return; }
    applyEditorEdits([{ type: 'set-property', layerId: layer.id, property: field, value }], 'Base property updated');
  };

  const keyframe = () => {
    if (!project || !layer) return;
    const { field } = propertyDraft;
    const evaluated = evaluateLayer(layer, frame);
    const numeric = Number(propertyDraft.value);
    if (!Number.isFinite(numeric)) { message('Enter a numeric keyframe value'); return; }
    const value = numeric;
    const range = field === 'opacity' ? [0, 1] : field === 'rotation' ? [-36000, 36000] : [-100000, 100000];
    if (value < range[0] || value > range[1]) { message('Keyframe value is outside supported range'); return; }
    const track = makeKeyframeTrack(layer, field, frame, value);
    applyEditorEdits([{ type: 'set-track', layerId: layer.id, track }],
      `Keyframe set at ${frame} · previous value ${evaluated[field].toFixed(2)}`);
  };

  const attachDirectorImages = (files: FileList | null) => {
    const selected = [...(files ?? [])];
    if (!selected.length || busy || !directorMediaAvailable) return;
    if (selected.length + promptImages.length > (directorSceneImagesAvailable ? 3 : 1)) {
      message('Motion Director accepts up to ' + (directorSceneImagesAvailable ? 3 : 1) + ' images');
      return;
    }
    const workspaceVersion = version.current;
    void operation(async () => {
      const uploaded = await Promise.all(selected.map(async file => {
        if (file.size < 24 || file.size > 1024 * 1024) throw new Error('Motion image must be 1 MB or smaller');
        const result = await motionStudioApi.uploadImage(workspacePath, file);
        return { id: result.id, name: file.name };
      }));
      if (!mounted.current || version.current !== workspaceVersion) return;
      setPromptImages(previous => [...previous, ...uploaded].slice(0, 3));
      setSuccess(uploaded.length + ' image(s) ready for the next AI Motion prompt');
    });
  };

  const attachDirectorFile = (file?: File) => {
    if (!file || busy || !directorMediaAvailable) return;
    const workspaceVersion = version.current;
    void operation(async () => {
      if (file.size < 46 || file.size > 2 * 1024 * 1024) {
        throw new Error('Motion WAV must be 2 MB or smaller');
      }
      const uploaded = await motionStudioApi.uploadAudio(workspacePath, file);
      if (!mounted.current || version.current !== workspaceVersion) return;
      setPromptAudio({ id: uploaded.id, name: file.name, seconds: uploaded.seconds });
      setSuccess('WAV ready for the next AI Motion prompt');
    });
  };

  useEffect(() => { setVisionReview(null); }, [project?.id, project?.revision, workspacePath]);
  useEffect(() => {
    motionSnapshotsRef.current.forEach(item => URL.revokeObjectURL?.(item.url));
    motionSnapshotsRef.current = [];
    setMotionSnapshots([]);
    return () => {
      motionSnapshotsRef.current.forEach(item => URL.revokeObjectURL?.(item.url));
      motionSnapshotsRef.current = [];
    };
  }, [project?.id, project?.revision, workspacePath]);

  const reviewVision = () => {
    if (!project || busy || !visionAvailable) return;
    const projectId = project.id, revision = project.revision, sequence = version.current;
    void operation(async () => {
      const reviewed = await motionStudioApi.visionReview(workspacePath, projectId);
      if (!mounted.current || sequence !== version.current) return;
      if (reviewed.projectId !== projectId || reviewed.revision !== revision) {
        throw new Error('Motion project changed during visual review; retry from the latest revision');
      }
      setVisionReview(reviewed);
      setSuccess('AI visual review completed for ' + reviewed.reviewedFrames.length + ' sampled frame(s)');
    });
  };
  const repairVision = () => {
    if (!project || !visionRepairAvailable || busy) return;
    const id = project.id, revision = project.revision, sequence = version.current;
    void operation(async () => {
      const repaired = await motionStudioApi.visionRepair(workspacePath, id, revision, renderWidth);
      if (!mounted.current || sequence !== version.current) return;
      if (repaired.review.projectId !== id || repaired.review.revision !== revision) {
        throw new Error('Vision repair returned a stale project review');
      }
      if (!repaired.changed || !repaired.result) {
        setVisionReview(repaired.review);
        setSuccess(repaired.reason || 'No blocking model vision issue to repair');
        return;
      }
      if (repaired.result.project.id !== id || repaired.result.project.revision <= revision) {
        throw new Error('Invalid visual repair revision');
      }
      const updated = repaired.result;
      setUndoStack([]); setRedoStack([]);
      setProject(updated.project);
      setQuality(updated.quality ?? null);
      setJobs(prev => [updated.job, ...prev.filter(item => item.id !== updated.job.id)]);
      setActiveJobId(updated.job.id);
      setSuccess('Bounded AI visual repair applied · revision ' + updated.project.revision +
        ' · new MP4 rendering started');
    });
  };
  const exportCaptions = () => {
    if (!project || !captionsAvailable || busy) return;
    const projectId = project.id, revision = project.revision, sequence = version.current;
    void operation(async () => {
      const subtitles = await motionStudioApi.captions(workspacePath, projectId);
      if (!mounted.current || sequence !== version.current) return;
      const latest = await motionStudioApi.inspect(workspacePath, projectId);
      if (latest.revision !== revision) throw new Error('Motion project changed during subtitle export');
      const url = URL.createObjectURL(new Blob([subtitles], { type: 'application/x-subrip;charset=utf-8' }));
      try {
        const anchor = document.createElement('a');
        anchor.href = url; anchor.download = 'motion-' + projectId + '-r' + revision + '.srt';
        document.body.appendChild(anchor); anchor.click(); anchor.remove();
      } finally { URL.revokeObjectURL(url); }
      setSuccess('Exported editable scene-copy subtitles (not automatic speech transcription)');
    });
  };
  const loadDirectorSnapshots = () => {
    if (!project || !quality || !directorSnapshotAvailable || busy) return;
    const id = project.id, revision = project.revision, workspaceVersion = version.current;
    void operation(async () => {
      const frames = [...new Set(quality.samples.map(sample => sample.frame))].slice(0, 3);
      const urls: Array<{ frame: number; url: string }> = [];
      try {
        for (const frame of frames) {
          urls.push({ frame, url: await motionStudioApi.loadFrameSnapshot(workspacePath, id, frame) });
        }
        if (!mounted.current || workspaceVersion !== version.current) {
          urls.forEach(item => URL.revokeObjectURL?.(item.url));
          return;
        }
        const latest = await motionStudioApi.inspect(workspacePath, id);
        if (latest.revision !== revision) throw new Error('Project changed while collecting frame snapshots');
        motionSnapshotsRef.current.forEach(item => URL.revokeObjectURL?.(item.url));
        motionSnapshotsRef.current = urls;
        setMotionSnapshots(urls);
      } catch (error) {
        urls.forEach(item => URL.revokeObjectURL?.(item.url));
        throw error;
      }
    });
  };

  const submitMotionPrompt = () => {
    const prompt = motionPrompt.trim();
    if (!prompt || busy || !directorAvailable) return;
    const targetId = selectedId;
    const workspaceVersion = version.current;
    const media = {
      ...(!targetId && directorAspectAvailable ? { aspectRatio: promptAspectRatio } : {}),
      ...(!targetId && directorVoiceoverAvailable && directorAutoNarration ?
        { autoNarrateScenes: true } : {}),
      ...(promptImages.length === 1 ? { imageAssetId: promptImages[0].id } : {}),
      ...(promptImages.length > 1 ? { sceneImageAssetIds: promptImages.map(item => item.id) } : {}),
      ...(promptAudio ? { audioAssetId: promptAudio.id, audioGain: promptAudioGain,
        ...(directorAudioLoopAvailable ? { audioLoop: promptAudioLoop } : {}) } : {}),
      ...(directorVoiceoverAvailable && promptVoiceover.trim() ?
        { voiceoverText: promptVoiceover.trim(), voiceoverGain: promptVoiceoverGain } : {}),
    };
    void operation(async () => {
      const generated = targetId
        ? await motionStudioApi.revise(workspacePath, targetId, prompt, renderWidth, media)
        : await motionStudioApi.generate(workspacePath, prompt, renderWidth, media);
      if (!mounted.current || version.current !== workspaceVersion) return;
      if (generated.job.status === 'failed') throw new Error(generated.job.error || 'Motion render could not start');
      setProjects(await motionStudioApi.list(workspacePath));
      setSelectedId(generated.project.id);
      setProject(generated.project); setSelectedLayer(null);
      if (generated.quality) setQuality(generated.quality);
      setUndoStack([]); setRedoStack([]);
      setJobs(prev => [generated.job, ...prev.filter(item => item.id !== generated.job.id)]);
      setActiveJobId(generated.job.id);
      setPromptHistory(prev => [...prev.slice(-9), {
        prompt, response: generated.outline.join(' · ') +
          (generated.limitations.length ? ' · ' + generated.limitations.join('; ') : ''),
      }]);
      setMotionPrompt(''); setPromptImages([]); setPromptAudio(null); setPromptAudioGain(1);
      setPromptAudioLoop(false); setPromptVoiceover(''); setPromptVoiceoverGain(1); setDirectorAutoNarration(false);
      setSuccess('AI Motion created revision ' + generated.project.revision + ' · MP4 rendering started');
    });
  };

  const render = () => {
    if (!project) return;
    void operation(async () => {
      const started = await motionStudioApi.render(workspacePath, project.id, renderWidth, supervisedRender);
      if (started.status === 'failed') throw new Error(started.error || 'Could not start render worker');
      setJobs(prev => [started, ...prev.filter(item => item.id !== started.id)]);
      setActiveJobId(started.id);
      setSuccess('Render queued at revision ' + started.revision + ' · ' + renderWidth + 'px wide' +
        (supervisedRender ? ' · awaiting separate SuperAgent FIFO supervisor' : ''));
    });
  };

  if (!workspacePath) return <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">Choose a local workspace to open Motion Studio.</div>;
  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)]" aria-label="Motion Studio">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Clapperboard size={20} className="text-[var(--color-primary)]" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-wide">Motion Studio <span className="text-[10px] font-normal text-[var(--text-muted)]">v1 · preview</span></h2>
            <p className="max-w-[220px] truncate text-[10px] text-[var(--text-muted)]" title={workspacePath}>{workspacePath}</p>
          </div>
          {project && <span className="rounded border border-[var(--border-color)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]">r{project.revision}</span>}
          {supervisor && <span role="status" className="rounded border border-[var(--border-color)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]"
            title="Opt-in FIFO supervisor is a separate SuperAgent process; this status never starts one">
            FIFO {supervisor.queuedSupervised} queued · {supervisor.leader === 'claimed_unverified' ? 'claim present (unverified)' : supervisor.leader === 'free' ? 'not running' : 'unsafe claim'}
          </span>}
          {scheduler && <span role="status" className="rounded border border-[var(--border-color)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]" title="Workspace render queue and rendering capacity">
            Queue {scheduler.queued}/{scheduler.queueLimit} · Render {scheduler.slots.filter(item => item.state === 'claimed_unverified').length}/{scheduler.maxConcurrentRenders}
          </span>}
          {queueRecovery && (queueRecovery.eligible > 0 || queueRecovery.blocked > 0) && <span role="status"
            className="rounded border border-[var(--border-color)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]"
            title="Read-only recovery diagnosis. Use the SuperAgent CLI and inspect worker identity before any queued job redispatch.">
            Queue recovery: {queueRecovery.eligible} eligible · {queueRecovery.blocked} blocked
          </span>}
          {storage && <span role="status" className="rounded border border-[var(--border-color)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]"
            title="Read-only workspace render storage; existing completed exports are preserved">
            {storage.jobs.total} jobs · {(storage.completedArtifactBytes / (1024 * 1024)).toFixed(1)} MB · {storage.maintenance.candidates} old cleanup candidates
          </span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="motion-project-picker">Motion project</label>
          <select id="motion-project-picker" value={selectedId} onChange={event => setSelectedId(event.target.value)}
            className={control + ' max-w-[220px]'} aria-label="Select Motion project">
            <option value="">Select a project</option>
            {projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button className={action} onClick={() => void operation(async () => {
            const [_, latestJobs, latestScheduler, latestStorage, latestRecovery, latestSupervisor] = await Promise.all([
              refreshProjects(), motionStudioApi.jobs(workspacePath),
              motionStudioApi.scheduler(workspacePath).catch(() => null),
              motionStudioApi.storage(workspacePath).catch(() => null),
              motionStudioApi.queueRecovery(workspacePath).catch(() => null),
              motionStudioApi.supervisor(workspacePath).catch(() => null),
            ]);
            setJobs(latestJobs); setScheduler(latestScheduler); setStorage(latestStorage); setQueueRecovery(latestRecovery); setSupervisor(latestSupervisor);
            if (selectedId) setProject(await motionStudioApi.inspect(workspacePath, selectedId));
          })} disabled={busy} aria-label="Refresh Motion projects"><RefreshCw size={13} /></button>
          <button className={action} onClick={() => setCreating(value => !value)} aria-expanded={creating}><Plus size={13} /> New</button>
          <button className={action} disabled={!project || busy || undoStack.length === 0} aria-label="Undo scene change" onClick={() => restoreHistory('undo')}><Undo2 size={13} /> Undo</button>
          <button className={action} disabled={!project || busy || redoStack.length === 0} aria-label="Redo scene change" onClick={() => restoreHistory('redo')}><Redo2 size={13} /> Redo</button>
          <label htmlFor="motion-render-width" className="sr-only">Render resolution</label>
          <select id="motion-render-width" aria-label="Render resolution" className={control + ' w-auto'} value={renderWidth}
            onChange={event => setRenderWidth(Number(event.target.value) as 640 | 1280 | 1920)} disabled={busy}>
            <option value={640}>640px preview</option>
            <option value={1280}>1280px HD</option>
            <option value={1920}>1920px Full HD</option>
          </select>
          <label className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)]"
            title="Opt-in FIFO mode requires a separately running SuperAgent motion supervisor --watch process">
            <input type="checkbox" aria-label="Use FIFO supervisor" checked={supervisedRender}
              onChange={event => setSupervisedRender(event.target.checked)} disabled={busy || !supervisor} />
            FIFO
          </label>
          <button className={primary} onClick={render} disabled={!project || busy}><Film size={14} /> Render MP4</button>
        </div>
      </header>
      <div className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-4" aria-label="AI Motion Director">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold">AI Motion Director</div>
          <span className="text-[11px] text-[var(--text-muted)]">Prompt → editable storyboard → MP4 · short text/shape preview</span>
        </div>
        {promptHistory.length > 0 && <div className="mb-3 max-h-28 space-y-2 overflow-y-auto text-xs" aria-label="Motion prompt history">
          {promptHistory.map((entry, index) => <div key={index} className="rounded border border-[var(--border-color)] px-3 py-2">
            <div className="font-medium">{entry.prompt}</div>
            <div className="mt-1 text-[var(--text-muted)]">{entry.response}</div>
          </div>)}
        </div>}
        <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); submitMotionPrompt(); }}>
          <label className="min-w-[220px] flex-1 text-xs" htmlFor="motion-director-prompt">
            {selectedId ? 'Describe a revision to this motion' : 'Describe the motion you want to create'}
            <textarea id="motion-director-prompt" aria-label="Motion prompt"
              className={control + ' mt-1 min-h-[72px] w-full resize-y'} rows={2} maxLength={2000}
              value={motionPrompt} onChange={event => setMotionPrompt(event.target.value)}
              placeholder="Buat video promosi produk 15 detik, modern, background gelap dan teks animasi..." disabled={busy} />
          </label>
          <button className={primary} type="submit" disabled={busy || !directorAvailable || !motionPrompt.trim()}>
            <Film size={14} /> {busy ? 'Agent working…' : selectedId ? 'Revise with AI' : 'Generate with AI'}
          </button>
        </form>
        {!selectedId && directorAspectAvailable && <label className="mb-2 inline-flex items-center gap-2 text-xs">
          Video format
          <select aria-label="Motion aspect ratio" className={control + ' w-40'} disabled={busy}
            value={promptAspectRatio}
            onChange={event => setPromptAspectRatio(event.target.value as '16:9' | '1:1' | '9:16')}>
            <option value="16:9">Landscape 16:9</option>
            <option value="1:1">Square 1:1</option>
            <option value="9:16">Portrait 9:16</option>
          </select>
        </label>}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]" aria-label="Motion prompt attachments">
          <label className={action + ' cursor-pointer'}>
            <ImageIcon size={13} /> Attach image(s) / logo
            <input type="file" aria-label="Attach motion image" accept="image/png,image/jpeg,image/webp"
              className="sr-only" multiple={directorSceneImagesAvailable} disabled={busy || !directorMediaAvailable}
              onChange={event => { attachDirectorImages(event.target.files); event.target.value = ''; }} />
          </label>
          <label className={action + ' cursor-pointer'}>
            <Film size={13} /> Attach WAV soundtrack
            <input type="file" aria-label="Attach motion WAV" accept=".wav,audio/wav,audio/x-wav"
              className="sr-only" disabled={busy || !directorMediaAvailable}
              onChange={event => { attachDirectorFile(event.target.files?.[0]); event.target.value = ''; }} />
          </label>
          {promptImages.map((item, i) => <span key={item.id + i} title={item.id}>
            Image: {item.name}{promptImages.length > 1 ? ' (scene ' + (i + 1) + ')' : ''}
            <button type="button" aria-label={i === 0 ? 'Remove prompt image' : 'Remove prompt image ' + (i + 1)}
              className="ml-1 underline" onClick={() => setPromptImages(prev => prev.filter((_, index) => index !== i))}
              disabled={busy}>Remove</button>
          </span>)}
          {promptAudio && <span title={promptAudio.id}>WAV: {promptAudio.name} ({promptAudio.seconds.toFixed(1)}s)
            <button type="button" aria-label="Remove prompt audio" className="ml-1 underline"
              onClick={() => setPromptAudio(null)} disabled={busy}>Remove</button>
          </span>}
          {promptAudio && directorAudioLoopAvailable && <label className="inline-flex items-center gap-1">
            <input type="checkbox" aria-label="Loop prompt soundtrack" disabled={busy}
              checked={promptAudioLoop} onChange={event => setPromptAudioLoop(event.target.checked)} />
            Loop WAV to video end
          </label>}
          {promptAudio && <label>Audio gain
            <input type="number" aria-label="Prompt audio gain" min={0} max={2} step={0.1}
              className={control + ' ml-1 w-16'} disabled={busy} value={promptAudioGain}
              onChange={event => setPromptAudioGain(Number(event.target.value))} />
          </label>}
        </div>
        {directorVoiceoverAvailable && !selectedId && <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          <input type="checkbox" aria-label="Automatically narrate scenes" checked={directorAutoNarration}
            onChange={event => { setDirectorAutoNarration(event.target.checked); if (event.target.checked) setPromptVoiceover(''); }}
            disabled={busy} />
          Generate narration from scene scripts (local Piper required)
        </label>}
        {directorVoiceoverAvailable && promptVoiceover.trim() && <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-[var(--text-muted)]">
          Voice-over gain
          <input type="number" aria-label="Motion voice-over gain" min={0} max={2} step={0.1}
            className={control + ' w-16'} disabled={busy} value={promptVoiceoverGain}
            onChange={event => setPromptVoiceoverGain(Number(event.target.value))} />
        </label>}
        {directorVoiceoverAvailable && !directorAutoNarration && <label className="mt-2 block text-[11px] text-[var(--text-muted)]">
          Narration / voice-over (local Piper)
          <textarea className={control + ' mt-1 w-full resize-y'} rows={2} maxLength={220}
            aria-label="Motion voice-over script" disabled={busy} value={promptVoiceover}
            onChange={event => setPromptVoiceover(event.target.value)}
            placeholder="Tuliskan kalimat yang diucapkan pengisi suara (maksimal 220 karakter)" />
        </label>}
        <p className="mt-2 text-[11px] text-[var(--text-muted)]">
          {directorAvailable ? 'AI uses the configured SuperAgent model. Attach up to 3 scene images and WAV (1 MB image / 2 MB WAV); Piper narration requires a local voice model, footage/3D and AI music generation are unsupported.' : 'AI Motion Director needs an updated SuperAgent server with prompt support. The manual editor remains available.'} {!directorMediaAvailable && directorAvailable ? ' Media attachments require an updated SuperAgent server.' : ''} Select “Select a project” to start a new video.
        </p>
      </div>
      {project && quality && (
        <details className="border-b border-[var(--border-color)] px-4 py-2 text-xs" aria-label="Motion quality checks">
          <summary className="cursor-pointer font-medium">
            Quality checks · {quality.passed ? 'Structure OK' : 'Needs attention'}
            {quality.issues.length > 0 ? ' · ' + quality.issues.length + ' finding(s)' : ' · no warnings'}
            <span className="ml-2 font-normal text-[var(--text-muted)]">(frame sampling, not AI vision review)</span>
          </summary>
          {captionsAvailable && <button type="button" className={action + ' mt-2 mr-2'}
            onClick={exportCaptions} disabled={busy}>
            Export scene subtitles (.srt)
          </button>}
          {visionRepairAvailable && <button type="button" className={action + ' mt-2 mr-2'}
            onClick={repairVision} disabled={busy}
            title="Explicit opt-in: up to one sampled vision review and one validated scene revision">
            Review & auto-improve once
          </button>}
          {visionAvailable && <button type="button" className={action + ' mt-2 mr-2'}
            onClick={reviewVision} disabled={busy}>
            AI Vision Review (uses configured model)
          </button>}
          {visionReview && <div className="mt-2 rounded border border-[var(--border-color)] p-2"
            aria-label="Motion AI vision findings">
            <strong>{visionReview.passed ? 'Sampled frames reviewed' : 'Visual issues identified'}</strong>
            <p className="my-1 text-[var(--text-muted)]">
              Independent model opinion on frames {visionReview.reviewedFrames.join(', ')}; not a full-video guarantee.
            </p>
            {visionReview.issues.map((issue, index) => <div key={index} className="mt-2">
              <strong>{issue.severity}: {issue.category} · frame {issue.frame}</strong>
              <p>{issue.explanation}</p>
              <p className="text-[var(--text-muted)]">Suggested: {issue.suggestion}</p>
              <button type="button" className={action + ' mt-1'} disabled={busy}
                onClick={() => setMotionPrompt('Improve the current motion at frame ' + issue.frame +
                  ' for ' + issue.category + ': ' + issue.suggestion.slice(0, 250))}>
                Prepare suggested revision
              </button>
            </div>)}
          </div>}
          {directorSnapshotAvailable && <button type="button" className={action + ' mt-2'}
            onClick={loadDirectorSnapshots} disabled={busy}>
            Review actual rendered frames
          </button>}
          {motionSnapshots.length > 0 && <div className="mt-2 grid grid-cols-3 gap-2" aria-label="Rendered Motion frame samples">
            {motionSnapshots.map(sample => <figure key={sample.frame}>
              <img alt={'Rendered frame ' + sample.frame} src={sample.url}
                className="max-h-40 w-full object-contain" />
              <figcaption>Frame {sample.frame}</figcaption>
            </figure>)}
          </div>}
          <div className="mt-2 text-[var(--text-muted)]">
            Sampled {quality.samples.length} scene midpoint(s).
            {quality.issues.length === 0 ? ' No structural/readability problems detected.' : null}
          </div>
          {quality.issues.map((issue, index) => (
            <div key={index} className="mt-1 text-[var(--text-muted)]">
              {issue.severity.toUpperCase()} · {issue.code} · scene {issue.scene + 1}: {issue.message}
            </div>
          ))}
        </details>
      )}
      {creating && (
        <form className="flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] px-4 py-3" onSubmit={event => { event.preventDefault(); if (projectName.trim()) createProject(); }}>
          <label className="text-xs" htmlFor="motion-name">Project name</label>
          <input id="motion-name" className={control + ' max-w-[270px]'} maxLength={160} value={projectName} onChange={event => setProjectName(event.target.value)} placeholder="Product launch" required />
          <button className={primary} disabled={busy || !projectName.trim()} type="submit">Create</button>
          <button className={action} type="button" onClick={() => setCreating(false)}><X size={13} /></button>
        </form>
      )}
      {(error || success) && (
        <div role={error ? 'alert' : 'status'} className={'flex items-center gap-2 border-b px-4 py-2 text-xs ' + (error ? 'border-red-800 text-red-400' : 'border-[var(--border-color)] text-[var(--color-primary)]')}>
          {error ? <AlertCircle size={13} /> : <Save size={13} />}
          <span className="min-w-0 flex-1 break-words">{error || success}</span>
          <button aria-label="Dismiss notice" onClick={() => { setError(''); setSuccess(''); }}><X size={12} /></button>
        </div>
      )}
      {project && compoundAvailable && (
        <MotionPresetPanel key={project.id} workspacePath={workspacePath} project={project} selectedLayer={selectedLayer}
          busy={busy} preview={presetPreview} onPreview={setPresetPreview} onApply={applyCompound} />
      )}
      {!project ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <Film size={34} className="text-[var(--text-muted)]" />
          <h3 className="text-sm font-medium">{projects.length ? 'Choose a scene to edit' : 'Your motion workspace is empty'}</h3>
          <p className="max-w-sm text-xs leading-5 text-[var(--text-muted)]">Create a project to edit built-in text and rectangle layers, animate keyframes, and render a local MP4 preview.</p>
          {busy && <Loader2 size={16} className="animate-spin" />}
        </div>
      ) : (
        <>
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-auto lg:grid-cols-[205px_minmax(0,1fr)_245px]">
            <aside className="min-h-0 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:overflow-y-auto lg:border-b-0 lg:border-r" aria-label="Motion layers">
              <div className="flex items-center gap-2 border-b border-[var(--border-color)] px-3 py-3 text-xs font-semibold"><Layers3 size={14} /> Layers ({project.composition.layers.length})</div>
              <div className="flex flex-wrap items-center gap-1 border-b border-[var(--border-color)] p-2">
                <button className={action} disabled={busy} onClick={() => insertLayer('text')} aria-label="Add text layer"><Type size={12} /> Text</button>
                <button className={action} disabled={busy} onClick={() => insertLayer('rect')} aria-label="Add rectangle layer"><Square size={12} /> Rect</button>
                <button className={action} disabled={busy} onClick={() => imageInputRef.current?.click()}
                  aria-label="Import image layer"><ImageIcon size={12} /> Image</button>
                <input ref={imageInputRef} type="file" hidden aria-label="Select Motion image"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={event => {
                    const file = event.currentTarget.files?.[0];
                    event.currentTarget.value = '';
                    importImage(file);
                  }} />
              </div>
              <div className="flex flex-wrap items-center gap-1 p-2">
                <button className={action} aria-label="Move layer up" disabled={busy || !layer || project.composition.layers[0]?.id === layer.id} onClick={() => reorderLayer(-1)}><ArrowUp size={13} /></button>
                <button className={action} aria-label="Move layer down" disabled={busy || !layer || project.composition.layers[project.composition.layers.length - 1]?.id === layer.id} onClick={() => reorderLayer(1)}><ArrowDown size={13} /></button>
                <button className={action} aria-label="Delete selected layer" disabled={busy || !layer} onClick={removeSelectedLayer}><Trash2 size={13} /></button>
              </div>
              <div className="p-2">
                {project.composition.layers.map((item, index) => (
                  <button key={item.id} onClick={() => setSelectedLayer(item.id)}
                    className={'mb-1 flex w-full items-center gap-2 rounded px-3 py-2 text-left text-xs focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ' +
                      (item.id === selectedLayer ? 'bg-[var(--color-primary)]/15 text-[var(--text-main)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-overlay-hover)]')}>
                    {item.kind === 'text' ? <Type size={14} /> : item.kind === 'image' ? <ImageIcon size={14} /> : <Square size={14} />}
                    <span className="min-w-0 flex-1 truncate">{item.kind === 'text' ? item.text || item.id : item.id}</span>
                    <span className="font-mono text-[10px] opacity-60">{index + 1}</span>
                  </button>
                ))}
                <p className="px-3 py-2 text-[10px] leading-4 text-[var(--text-muted)]">Select a layer, then reorder, edit, or animate it.</p>
              </div>
            </aside>

            <div className="flex min-h-[250px] min-w-0 flex-col">
              <div className="flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--text-muted)]">
                <span title="Drag to move · corner handle resizes rotated rectangles · upper handle rotates · arrows nudge · Alt+arrows rotate · Ctrl+arrows resize rectangles">
                  Composition · {project.composition.width} × {project.composition.height}{presetPreview ? ' · PREVIEW (not saved)' : ''}
                </span>
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 normal-case tracking-normal">
                    <input type="checkbox" aria-label="Snap canvas position to grid and center" checked={canvasSnapping}
                      onChange={event => setCanvasSnapping(event.target.checked)} className="accent-[var(--color-primary)]" />
                    Snap 10px
                  </label>
                  <button type="button" className={action} aria-label="Zoom out Motion canvas" onClick={() => setViewport(previous => zoomMotionViewport(previous, previous.zoom / 1.25, { x: 0, y: 0 }, { left: -1, top: -1, width: 2, height: 2 }))}>−</button>
                  <span aria-label="Motion canvas zoom" className="font-mono">{Math.round(viewport.zoom * 100)}%</span>
                  <button type="button" className={action} aria-label="Zoom in Motion canvas" onClick={() => setViewport(previous => zoomMotionViewport(previous, previous.zoom * 1.25, { x: 0, y: 0 }, { left: -1, top: -1, width: 2, height: 2 }))}>+</button>
                  <button type="button" className={action} aria-label="Reset Motion canvas view" onClick={() => setViewport(DEFAULT_MOTION_VIEWPORT)}>Fit</button>
                  <button type="button" className={panMode ? primary : action} aria-label="Toggle Motion canvas pan mode" aria-pressed={panMode} onClick={() => setPanMode(v => !v)}>Pan</button>
                  <span>{fps.toFixed(2)} fps</span>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[var(--bg-card)] p-4 md:p-8"
                data-testid="motion-viewport"
                onWheel={event => {
                  if (!isActive) return;
                  event.preventDefault();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setViewport(previous => zoomMotionViewport(previous,
                    previous.zoom * (event.deltaY < 0 ? 1.12 : 1 / 1.12),
                    { x: event.clientX, y: event.clientY }, rect));
                }}
                onPointerDown={event => {
                  if (!isActive || (event.button !== 1 && !(panMode && event.button === 0))) return;
                  panGesture.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                  event.stopPropagation(); event.preventDefault();
                }}
                onPointerMove={event => {
                  const pending = panGesture.current;
                  if (!pending || pending.pointerId !== event.pointerId) return;
                  setViewport(previous => panMotionViewport(previous, {
                    x: event.clientX - pending.x, y: event.clientY - pending.y,
                  }));
                  panGesture.current = { pointerId: pending.pointerId, x: event.clientX, y: event.clientY };
                }}
                onPointerUp={event => {
                  if (panGesture.current?.pointerId !== event.pointerId) return;
                  panGesture.current = null;
                  event.currentTarget.releasePointerCapture?.(event.pointerId);
                }}
                onPointerCancel={() => { panGesture.current = null; }}
                onLostPointerCapture={() => { panGesture.current = null; }}
              >
                <div className="w-full max-w-[1000px]" data-testid="motion-canvas"
                  style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: 'center center' }}>
                  <MotionCanvas key={project.id + ':' + project.revision + (presetPreview ? ':preview' : '')}
                    project={presetPreview ?? project} frame={frame} assetUrls={imageUrls}
                    selectedLayer={selectedLayer} isActive={isActive && !presetPreview} busy={busy || panMode || !!presetPreview} snapping={canvasSnapping}
                    onSelectLayer={setSelectedLayer} onStopPlayback={() => setPlaying(false)}
                    onEdit={(edits, note) => applyEditorEdits(edits, note)} />
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-[var(--border-color)] px-3 py-3">
                <button className={action} aria-label={playing ? 'Pause playback' : 'Play scene'} onClick={() => setPlaying(v => !v)}>
                  {playing ? <Pause size={15} /> : <Play size={15} />}
                </button>
                <input aria-label="Current frame" type="range" className="min-w-0 flex-1 accent-[var(--color-primary)]"
                  min={0} max={totalFrames - 1} step={1} value={frame}
                  onChange={event => { setPlaying(false); setFrame(Number(event.target.value)); }} />
                <span className="whitespace-nowrap font-mono text-[11px] text-[var(--text-muted)]">{frameLabel(project, frame)}</span>
              </div>
            </div>

            <aside className="border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] p-3 lg:overflow-y-auto lg:border-l lg:border-t-0" aria-label="Layer inspector">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold"><ChevronDown size={14} /> Inspector</h3>
              {!layer ? <p className="text-xs text-[var(--text-muted)]">Select a layer.</p> : (
                <div className="space-y-4">
                  <div className="rounded border border-[var(--border-color)] bg-[var(--bg-card)] p-3 text-xs">
                    <p className="font-medium">{layer.id}</p>
                    <p className="mt-1 text-[10px] uppercase text-[var(--text-muted)]">{layer.kind} · {layer.width} × {layer.height}</p>
                  </div>
                  {layer.kind === 'text' && (
                    <div className="space-y-2">
                      <label htmlFor="motion-layer-text" className="text-xs font-medium">Text</label>
                      <textarea id="motion-layer-text" className={control + ' min-h-[70px] resize-y'} maxLength={8192}
                        value={draftText} onChange={event => setDraftText(event.target.value)} />
                      <button className={action} disabled={busy || draftText === layer.text} onClick={saveText}><Save size={13} /> Save text</button>
                    </div>
                  )}
                  {layer.kind === 'rect' && <div className="space-y-2">
                    <label className="text-xs font-medium" htmlFor="motion-corner-radius">Rounded corner radius</label>
                    <input id="motion-corner-radius" aria-label="Rounded corner radius" className={control}
                      type="number" min={0} max={Math.min(4096, layer.width / 2, layer.height / 2)}
                      step={1} value={cornerDraft} disabled={busy}
                      onChange={event => setCornerDraft(event.target.value)} />
                    <button type="button" className={action} disabled={busy || cornerDraft === String(layer.cornerRadius ?? 0)}
                      onClick={saveCornerRadius}>Save rounded corners</button>
                  </div>}
                  <div className="space-y-2">
                    <label className="text-xs font-medium" htmlFor="motion-property">Property</label>
                    <select id="motion-property" className={control} value={propertyDraft.field}
                      onChange={event => {
                        const field = event.target.value as MotionProperty;
                        setPropertyDraft({ field, value: String(evaluateLayer(layer, frame)[field]) });
                      }}>
                      <option value="x">X position</option><option value="y">Y position</option>
                      <option value="opacity">Opacity</option><option value="rotation">Rotation</option>
                    </select>
                    <label className="text-[11px] text-[var(--text-muted)]" htmlFor="motion-property-value">Value at frame {frame}</label>
                    <input id="motion-property-value" className={control} type="number" step="any" value={propertyDraft.value}
                      onChange={event => setPropertyDraft(prev => ({ ...prev, value: event.target.value }))} />
                    <div className="flex flex-wrap gap-2">
                      <button className={action} disabled={busy} onClick={saveProperty}><Save size={12} /> Base</button>
                      <button className={primary} disabled={busy} onClick={keyframe}><Plus size={12} /> Keyframe</button>
                    </div>
                    <p className="text-[10px] leading-4 text-[var(--text-muted)]">Base changes update the whole layer. Keyframes animate a property over time.</p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-semibold">Animation tracks</h4>
                    {layer.tracks.length === 0 && <p className="text-[11px] text-[var(--text-muted)]">No animated properties.</p>}
                    {layer.tracks.map(track => (
                      <div key={track.property} className="rounded border border-[var(--border-color)] p-2">
                        <p className="mb-1 text-[11px] font-medium">{track.property}</p>
                        <div className="flex flex-wrap gap-1">
                          {track.keyframes.map(item => (
                            <button key={item.frame} title={`Jump to frame ${item.frame}`} onClick={() => {
                              setFrame(item.frame); setPlaying(false);
                              setPropertyDraft({ field: track.property, value: String(item.value) });
                            }} className="rounded bg-[var(--bg-card)] px-2 py-1 font-mono text-[10px] hover:text-[var(--color-primary)]">
                              {item.frame}: {item.value}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>

          <MotionAudioPanel project={project} workspacePath={workspacePath}
            busy={busy} isActive={isActive} frame={frame} playing={playing}
            onSeekFrame={next => { setPlaying(false); setFrame(next); }} onUpload={importAudio}
            onEdit={(edits, note) => applyEditorEdits(edits, note)} onError={message} />
          <MotionTimeline project={presetPreview ?? project} currentFrame={frame} selectedLayer={selectedLayer}
             busy={busy || !!presetPreview} isActive={isActive && !presetPreview} onFrame={next => { setPlaying(false); setFrame(next); }}
            onLayer={setSelectedLayer} onEdit={(edits, note) => applyEditorEdits(edits, note)}
            onError={message} />
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2" aria-label="Render jobs">
            <div className="flex min-w-0 items-center gap-2 text-[11px]">
              <Film size={13} className="text-[var(--color-primary)]" />
              <select className={control + ' max-w-[200px]'} aria-label="Select render job" value={activeJobId} onChange={event => setActiveJobId(event.target.value)}>
                <option value="">No render selected</option>
                {jobs.filter(item => item.projectId === project.id).map(item => <option key={item.id} value={item.id}>{item.id.slice(-8)} · {item.status}</option>)}
              </select>
              {job && <span className="font-mono text-[var(--text-muted)]">{job.status} {job.framesCompleted}/{job.profile.frameCount}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {job && !idle.has(job.status) && (
                <button className={action} onClick={() => void operation(async () => {
                  await motionStudioApi.cancel(workspacePath, job.id);
                  setSuccess('Cancellation requested');
                })} disabled={busy}><X size={13} /> Cancel</button>
              )}
              {job?.status === 'completed' && previewUrl && (
                <a className={primary} href={previewUrl} download={project.name.replace(/[^a-z0-9-_]+/gi, '-') + '.mp4'}>Download preview</a>
              )}
              {job?.status === 'completed' && previewUrl && (
                <button className={action} onClick={() => window.open(previewUrl, '_blank', 'noopener,noreferrer')}>Open MP4</button>
              )}
            </div>
          </div>
          {job?.status === 'completed' && previewUrl && (
            <video aria-label="Rendered Motion MP4" className="max-h-24 w-full border-t border-[var(--border-color)] bg-black" controls src={previewUrl} />
          )}
          {job?.error && <p role="alert" className="border-t border-red-900 px-3 py-2 text-xs text-red-400">{job.error}</p>}
        </>
      )}
    </section>
  );
}
