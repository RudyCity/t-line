import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  studioApi,
  type StudioProject,
  type StudioLayer,
  type StudioEdit,
  type CompoundPresetApplication,
  type StudioEffectApplication,
  type StudioStackOperation,
  type StudioTemplateInput,
  type StudioBeatSyncInput,
  type StudioParticleInput,
  type StudioTypographyInput,
  type StudioProperty,
  type StudioVisionReview,
} from '../../services/studioApi';
import { evaluateLayer, fpsOf } from '../../services/studioScene';
import { motionPlaybackFrame } from '../../services/studioTimelineClock';
import { DEFAULT_MOTION_VIEWPORT, type StudioViewport } from '../../services/studioViewport';
import { useStudioLifecycle } from './useStudioLifecycle';

type PropertyDraft = { field: StudioProperty; value: string };

export function useStudioState(workspacePath: string, isActive: boolean) {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const message = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setSuccess('');
  }, []);

  const [frame, setFrame] = useState(0);
  const [canvasSnapping, setCanvasSnapping] = useState(true);
  const [viewport, setViewport] = useState<StudioViewport>(DEFAULT_MOTION_VIEWPORT);
  const [panMode, setPanMode] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [motionPrompt, setStudioPrompt] = useState('');
  const [promptImages, setPromptImages] = useState<Array<{ id: string; name: string }>>([]);
  const [promptAudio, setPromptAudio] = useState<{ id: string; name: string; seconds: number } | null>(null);
  const [promptAudioGain, setPromptAudioGain] = useState(1);
  const [promptAudioLoop, setPromptAudioLoop] = useState(false);
  const [promptAspectRatio, setPromptAspectRatio] = useState<'16:9' | '1:1' | '9:16'>('16:9');
  const [promptVoiceover, setPromptVoiceover] = useState('');
  const [promptVoiceoverGain, setPromptVoiceoverGain] = useState(1);
  const [promptHistory, setPromptHistory] = useState<Array<{ prompt: string; response: string }>>([]);
  const [directorAutoNarration, setDirectorAutoNarration] = useState(false);
  const [motionSnapshots, setStudioSnapshots] = useState<Array<{ frame: number; url: string }>>([]);
  const motionSnapshotsRef = useRef<Array<{ frame: number; url: string }>>([]);
  const [visionReview, setVisionReview] = useState<StudioVisionReview | null>(null);
  const [supervisedRender, setSupervisedRender] = useState(false);
  const [renderWidth, setRenderWidth] = useState<640 | 1280 | 1920>(640);
  const [undoStack, setUndoStack] = useState<StudioProject['composition'][]>([]);
  const [redoStack, setRedoStack] = useState<StudioProject['composition'][]>([]);
  const [draftText, setDraftText] = useState('');
  const [propertyDraft, setPropertyDraft] = useState<PropertyDraft>({ field: 'x', value: '0' });
  const [cornerDraft, setCornerDraft] = useState('0');
  const [typographyPreview, setTypographyPreview] = useState<StudioProject | null>(null);
  const [particlePreview, setParticlePreview] = useState<StudioProject | null>(null);
  const [beatPreview, setBeatPreview] = useState<StudioProject | null>(null);
  const [templatePreview, setTemplatePreview] = useState<StudioProject | null>(null);
  const [effectPreview, setEffectPreview] = useState<StudioProject | null>(null);
  const [presetPreview, setPresetPreview] = useState<StudioProject | null>(null);
  const [codeTrigger, setCodeTrigger] = useState<'autoplay' | 'scroll' | 'click' | 'hover'>('autoplay');
  const [codeFormat, setCodeFormat] = useState<'html' | 'react' | 'react-jsx'>('html');
  const [resizeRatio, setResizeRatio] = useState<'16:9' | '1:1' | '9:16'>('9:16');
  const [upscaleTarget, setUpscaleTarget] = useState<'2x' | '4x' | '1080p' | '2k' | '4k'>('2x');

  const resetEditorStates = useCallback(() => {
    setFrame(0);
    setStudioPrompt('');
    setPromptHistory([]);
    setPromptImages([]);
    setPromptAudio(null);
    setPromptAudioGain(1);
    setPromptAudioLoop(false);
    setPromptAspectRatio('16:9');
    setDirectorAutoNarration(false);
    setPromptVoiceover('');
    setPromptVoiceoverGain(1);
    setVisionReview(null);
    setParticlePreview(null);
    setTypographyPreview(null);
    setBeatPreview(null);
    setTemplatePreview(null);
    setPresetPreview(null);
    setEffectPreview(null);
    setViewport(DEFAULT_MOTION_VIEWPORT);
    setPanMode(false);
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const resetPreviews = useCallback(() => {
    setRedoStack([]);
    setParticlePreview(null);
    setTypographyPreview(null);
    setBeatPreview(null);
    setTemplatePreview(null);
    setPresetPreview(null);
    setEffectPreview(null);
  }, []);

  const life = useStudioLifecycle(workspacePath, message, resetEditorStates, resetPreviews);

  const layer = useMemo(
    () => life.project?.composition.layers.find(item => item.id === life.selectedLayer) || null,
    [life.project, life.selectedLayer]
  );
  const job = life.jobs.find(item => item.id === life.activeJobId) || null;
  const totalFrames = life.project?.composition.durationFrames ?? 1;
  const fps = life.project ? fpsOf(life.project) : 30;

  useEffect(() => {
    if (layer?.kind === 'text') setDraftText(layer.text);
    if (layer?.kind === 'rect') setCornerDraft(String(layer.cornerRadius ?? 0));
    setPropertyDraft({ field: 'x', value: String(layer?.x ?? 0) });
  }, [layer?.id, layer?.kind, layer?.kind === 'text' ? layer.text : '', life.project?.revision]);

  useEffect(() => {
    if (!playing || !isActive || !life.project) return;
    const startedAt = performance.now();
    const startFrame = frame;
    const durationFrames = life.project.composition.durationFrames;
    const timer = window.setInterval(
      () => setFrame(motionPlaybackFrame(startFrame, performance.now() - startedAt, fps, durationFrames)),
      Math.min(50, 1000 / fps)
    );
    return () => window.clearInterval(timer);
  }, [playing, isActive, fps, life.project?.id, life.project?.composition.durationFrames]);

  useEffect(() => {
    setVisionReview(null);
  }, [life.project?.id, life.project?.revision, workspacePath]);

  useEffect(() => {
    motionSnapshotsRef.current.forEach(item => URL.revokeObjectURL?.(item.url));
    motionSnapshotsRef.current = [];
    setStudioSnapshots([]);
    return () => {
      motionSnapshotsRef.current.forEach(item => URL.revokeObjectURL?.(item.url));
      motionSnapshotsRef.current = [];
    };
  }, [life.project?.id, life.project?.revision, workspacePath]);

  const operation = async (run: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await run();
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      message(reason);
      if (/revision conflict/i.test(reason) && life.selectedId) {
        try {
          life.setProject(await studioApi.inspect(workspacePath, life.selectedId));
        } catch {
          /* show conflict */
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const applyCompound = (input: CompoundPresetApplication) => {
    if (!life.project || busy) return;
    const before = structuredClone(life.project.composition);
    const selectedSequence = life.selectionSeq.current;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    void operation(async () => {
      const next = await studioApi.applyPreset(workspacePath, life.project!.id, life.project!.revision, input);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      life.setProject(next);
      setSuccess('Applied ' + input.presetId + ' · revision ' + next.revision);
    });
  };

  const applySingleEffect = (input: StudioEffectApplication) => {
    if (!life.project || busy) return;
    const before = structuredClone(life.project.composition);
    const selectedSequence = life.selectionSeq.current;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    void operation(async () => {
      const next = life.stackAvailable
        ? await studioApi.changeStack(workspacePath, life.project!.id, life.project!.revision, {
            type: 'add',
            entry: {
              id: 'fx-' + Math.random().toString(36).slice(2, 12),
              enabled: true,
              ...input,
            },
          })
        : await studioApi.applyEffect(workspacePath, life.project!.id, life.project!.revision, input);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      life.setProject(next);
      setSuccess('Applied ' + input.effectId + ' · revision ' + next.revision);
    });
  };

  const changeEffectStack = (stackOperation: StudioStackOperation) => {
    if (!life.project || busy) return;
    const before = structuredClone(life.project.composition);
    const selectedSequence = life.selectionSeq.current;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    void operation(async () => {
      const next = await studioApi.changeStack(workspacePath, life.project!.id, life.project!.revision, stackOperation);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      life.setProject(next);
      setSuccess('Updated Studio effect stack · revision ' + next.revision);
    });
  };

  const resizeProject = () => {
    if (!life.project || busy) return;
    const before = structuredClone(life.project.composition);
    const selectedSequence = life.selectionSeq.current;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    void operation(async () => {
      const next = await studioApi.resize(workspacePath, life.project!.id, life.project!.revision, resizeRatio);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      life.setProject(next);
      setSuccess('Resized to ' + resizeRatio + ' · revision ' + next.revision);
    });
  };

  const upscaleProject = () => {
    if (!life.project || busy) return;
    const before = structuredClone(life.project.composition);
    const selectedSequence = life.selectionSeq.current;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    void operation(async () => {
      const opts =
        upscaleTarget === '2x'
          ? { scale: 2 }
          : upscaleTarget === '4x'
          ? { scale: 4 }
          : { target: upscaleTarget as '1080p' | '2k' | '4k' };
      const next = await studioApi.upscale(workspacePath, life.project!.id, life.project!.revision, opts);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      life.setProject(next);
      setSuccess('Upscaled to ' + next.composition.width + ' × ' + next.composition.height + ' · revision ' + next.revision);
    });
  };

  const createProject = () =>
    void operation(async () => {
      const created = await studioApi.create(workspacePath, projectName.trim());
      await life.refreshProjects();
      setCreating(false);
      setProjectName('');
      life.setSelectedId(created.id);
      setSuccess('New Studio project created');
    });

  const applyEditorEdits = (edits: StudioEdit[], note: string, focus?: string | null) => {
    if (!life.project || busy) return;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    const before = structuredClone(life.project.composition);
    const selectedSequence = life.selectionSeq.current;
    void operation(async () => {
      const next = await studioApi.edit(workspacePath, life.project!.id, life.project!.revision, edits);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      life.setProject(next);
      if (focus !== undefined) life.setSelectedLayer(focus);
      setSuccess(note + ' · revision ' + next.revision);
    });
  };

  const applyTypography = (input: StudioTypographyInput) => {
    if (!life.project || busy) return;
    const before = structuredClone(life.project.composition);
    const selectedSequence = life.selectionSeq.current;
    setTypographyPreview(null);
    setParticlePreview(null);
    setBeatPreview(null);
    setTemplatePreview(null);
    setPresetPreview(null);
    setEffectPreview(null);
    void operation(async () => {
      const next = await studioApi.typography(workspacePath, life.project!.id, life.project!.revision, input);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      life.setProject(next);
      life.setSelectedLayer(next.composition.layers.find(item => item.kind === 'text')?.id ?? null);
      setSuccess('Applied ' + input.style + ' typography · revision ' + next.revision);
    });
  };

  const applyParticleOverlay = (input: StudioParticleInput) => {
    if (!life.project || busy) return;
    const before = structuredClone(life.project.composition);
    const selectedSequence = life.selectionSeq.current;
    setParticlePreview(null);
    setBeatPreview(null);
    setTemplatePreview(null);
    setPresetPreview(null);
    setEffectPreview(null);
    void operation(async () => {
      const next = await studioApi.particles(workspacePath, life.project!.id, life.project!.revision, input);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      life.setProject(next);
      setSuccess('Applied ' + input.kind + ' particle overlay · revision ' + next.revision);
    });
  };

  const applyAudioBeatSync = (input: StudioBeatSyncInput) => {
    if (!life.project || busy) return;
    const before = structuredClone(life.project.composition);
    const selectedSequence = life.selectionSeq.current;
    setBeatPreview(null);
    setTemplatePreview(null);
    setPresetPreview(null);
    setEffectPreview(null);
    void operation(async () => {
      const result = await studioApi.beatSync(workspacePath, life.project!.id, life.project!.revision, input);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      life.setProject(result.project);
      setSuccess('Beat sync applied · ' + result.onsetFrames.length + ' transients · revision ' + result.project.revision);
    });
  };

  const applySceneTemplate = (input: StudioTemplateInput) => {
    if (!life.project || busy) return;
    const before = structuredClone(life.project.composition);
    const selectedSequence = life.selectionSeq.current;
    setTemplatePreview(null);
    setEffectPreview(null);
    setPresetPreview(null);
    void operation(async () => {
      const next = await studioApi.applyTemplate(workspacePath, life.project!.id, life.project!.revision, input);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      life.setProject(next);
      life.setSelectedLayer(
        next.composition.layers.find(item => item.kind === 'text')?.id ?? next.composition.layers[0]?.id ?? null
      );
      setSuccess('Applied scene template ' + input.templateId + ' · revision ' + next.revision);
    });
  };

  const recoverSavedRevision = (revision: number) => {
    if (!life.project || busy) return;
    const before = structuredClone(life.project.composition);
    const selectedSequence = life.selectionSeq.current;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    void operation(async () => {
      const next = await studioApi.restoreHistory(workspacePath, life.project!.id, life.project!.revision, revision);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      life.setProject(next);
      if (!next.composition.layers.some(item => item.id === life.selectedLayer)) {
        life.setSelectedLayer(next.composition.layers[0]?.id ?? null);
      }
      setSuccess('Restored saved revision ' + revision + ' · new revision ' + next.revision);
    });
  };

  const restoreHistory = (direction: 'undo' | 'redo') => {
    if (!life.project || busy) return;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    const from = direction === 'undo' ? undoStack : redoStack;
    const target = from[from.length - 1];
    if (!target) return;
    const before = structuredClone(life.project.composition);
    const selectedSequence = life.selectionSeq.current;
    void operation(async () => {
      const next = await studioApi.edit(workspacePath, life.project!.id, life.project!.revision, [
        { type: 'replace-composition', composition: structuredClone(target) },
      ]);
      if (selectedSequence !== life.selectionSeq.current) return;
      if (direction === 'undo') {
        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev.slice(-19), before]);
      } else {
        setRedoStack(prev => prev.slice(0, -1));
        setUndoStack(prev => [...prev.slice(-19), before]);
      }
      life.setProject(next);
      if (!next.composition.layers.some(item => item.id === life.selectedLayer)) {
        life.setSelectedLayer(next.composition.layers[0]?.id ?? null);
      }
      setSuccess((direction === 'undo' ? 'Undo' : 'Redo') + ' · revision ' + next.revision);
    });
  };

  const importAudio = (file: File) => {
    if (!life.project || busy) return;
    const currentTracks = life.project.composition.audioTracks ?? (life.project.composition.audio ? [life.project.composition.audio] : []);
    if (currentTracks.length >= 4) {
      message('Studio scenes support up to 4 audio clips');
      return;
    }
    if (file.size < 46 || file.size > 2 * 1024 * 1024) {
      message('Studio WAV must be 2 MB or smaller');
      return;
    }
    const current = life.project;
    const selectedSequence = life.selectionSeq.current;
    void operation(async () => {
      const asset = await studioApi.uploadAudio(workspacePath, file);
      if (selectedSequence !== life.selectionSeq.current) return;
      const next = await studioApi.edit(workspacePath, current.id, current.revision, [
        {
          type: 'set-audio-tracks',
          audioTracks: [...currentTracks, { assetId: asset.id, startFrame: 0, volume: 1 }],
        },
      ]);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(previous => [...previous.slice(-19), structuredClone(current.composition)]);
      setRedoStack([]);
      life.setProject(next);
      setSuccess('Audio imported · revision ' + next.revision);
    });
  };

  const importImage = (file?: File) => {
    if (!file || !life.project || busy) return;
    if (file.size > 1024 * 1024 || file.size < 24) {
      message('Studio images must be 1 MB or smaller');
      return;
    }
    const current = life.project;
    const selectedSequence = life.selectionSeq.current;
    void operation(async () => {
      const asset = await studioApi.uploadImage(workspacePath, file);
      const layerId = 'layer-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
      const scale = Math.min(1, 600 / Math.max(asset.width, asset.height));
      const width = Math.max(1, Math.round(asset.width * scale));
      const height = Math.max(1, Math.round(asset.height * scale));
      const newLayer: StudioLayer = {
        kind: 'image',
        id: layerId,
        assetId: asset.id,
        x: (current.composition.width - width) / 2,
        y: (current.composition.height - height) / 2,
        width,
        height,
        rotation: 0,
        opacity: 1,
        fill: '#FFFFFF',
        tracks: [],
      };
      if (selectedSequence !== life.selectionSeq.current) return;
      const next = await studioApi.edit(workspacePath, current.id, current.revision, [{ type: 'add-layer', layer: newLayer }]);
      if (selectedSequence !== life.selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), structuredClone(current.composition)]);
      setRedoStack([]);
      life.setProject(next);
      life.setSelectedLayer(layerId);
      setSuccess('Image imported · revision ' + next.revision);
    });
  };

  const insertLayer = (kind: StudioLayer['kind']) => {
    if (!life.project) return;
    const id = 'layer-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const common = {
      id,
      x: 120,
      y: 160,
      width: 480,
      height: 130,
      rotation: 0,
      opacity: 1,
      fill: kind === 'text' ? '#FFFFFF' : '#4C80EE',
      tracks: [],
    };
    const newLayer: StudioLayer =
      kind === 'text' ? { ...common, kind: 'text', text: 'New text', fontFamily: 'Arial', fontSize: 64 } : { ...common, kind: 'rect' };
    applyEditorEdits([{ type: 'add-layer', layer: newLayer }], 'Layer added', id);
  };

  const reorderLayer = (delta: number) => {
    if (!life.project || !life.selectedLayer) return;
    const index = life.project.composition.layers.findIndex(item => item.id === life.selectedLayer);
    const toIndex = index + delta;
    if (index < 0 || toIndex < 0 || toIndex >= life.project.composition.layers.length) return;
    applyEditorEdits([{ type: 'move-layer', layerId: life.selectedLayer, toIndex }], 'Layer reordered');
  };

  const removeSelectedLayer = () => {
    if (!life.project || !life.selectedLayer) return;
    const nextSelected = life.project.composition.layers.find(item => item.id !== life.selectedLayer)?.id ?? null;
    applyEditorEdits([{ type: 'remove-layer', layerId: life.selectedLayer }], 'Layer removed', nextSelected);
  };

  const saveText = () => {
    if (!life.project || layer?.kind !== 'text' || draftText === layer.text) return;
    applyEditorEdits([{ type: 'set-text', layerId: layer.id, text: draftText }], 'Text saved');
  };

  const saveCornerRadius = () => {
    if (!life.project || !layer || layer.kind !== 'rect') return;
    const value = Number(cornerDraft);
    if (!Number.isFinite(value) || value < 0 || value > 4096 || value > Math.min(layer.width, layer.height) / 2) {
      message('Rounded corner radius must fit inside the rectangle');
      return;
    }
    if (value === (layer.cornerRadius ?? 0)) return;
    const composition = structuredClone(life.project.composition);
    const target = composition.layers.find(item => item.id === layer.id);
    if (!target || target.kind !== 'rect') return;
    target.cornerRadius = value;
    applyEditorEdits([{ type: 'replace-composition', composition }], 'Rounded rectangle updated');
  };

  const saveProperty = () => {
    if (!life.project || !layer) return;
    const value = Number(propertyDraft.value);
    const { field } = propertyDraft;
    const range =
      field === 'opacity'
        ? [0, 1]
        : field === 'rotation'
        ? [-36000, 36000]
        : field === 'scale' || field === 'scaleX' || field === 'scaleY'
        ? [0.001, 100]
        : [-100000, 100000];
    if (!Number.isFinite(value) || value < range[0] || value > range[1]) {
      message('Property value is outside the supported range');
      return;
    }
    applyEditorEdits([{ type: 'set-property', layerId: layer.id, property: field, value }], 'Base property updated');
  };

  const keyframe = () => {
    if (!life.project || !layer) return;
    const { field } = propertyDraft;
    const evaluated = evaluateLayer(layer, frame);
    const numeric = Number(propertyDraft.value);
    if (!Number.isFinite(numeric)) {
      message('Enter a numeric keyframe value');
      return;
    }
    const value = numeric;
    const range =
      field === 'opacity'
        ? [0, 1]
        : field === 'rotation'
        ? [-36000, 36000]
        : field === 'scale' || field === 'scaleX' || field === 'scaleY'
        ? [0.001, 100]
        : [-100000, 100000];
    if (value < range[0] || value > range[1]) {
      message('Keyframe value is outside supported range');
      return;
    }
    const track = {
      property: field,
      keyframes: [...layer.tracks.find(t => t.property === field)?.keyframes.filter(k => k.frame !== frame) ?? [], { frame, value }].sort(
        (a, b) => a.frame - b.frame
      ),
    };
    applyEditorEdits([{ type: 'set-track', layerId: layer.id, track }], `Keyframe set at ${frame} · previous value ${evaluated[field].toFixed(2)}`);
  };

  const attachDirectorImages = (files: FileList | null) => {
    const selected = [...(files ?? [])];
    if (!selected.length || busy || !life.directorMediaAvailable) return;
    if (selected.length + promptImages.length > (life.directorSceneImagesAvailable ? 3 : 1)) {
      message('Studio Director accepts up to ' + (life.directorSceneImagesAvailable ? 3 : 1) + ' images');
      return;
    }
    const workspaceVersion = life.version.current;
    void operation(async () => {
      const uploaded = await Promise.all(
        selected.map(async file => {
          if (file.size < 24 || file.size > 1024 * 1024) throw new Error('Studio image must be 1 MB or smaller');
          const result = await studioApi.uploadImage(workspacePath, file);
          return { id: result.id, name: file.name };
        })
      );
      if (!life.mounted.current || versionMatch(life.version.current, workspaceVersion)) return;
      setPromptImages(previous => [...previous, ...uploaded].slice(0, 3));
      setSuccess(uploaded.length + ' image(s) ready for the next AI Studio prompt');
    });
  };

  function versionMatch(a: number, b: number) {
    return a !== b;
  }

  const attachDirectorFile = (file?: File) => {
    if (!file || busy || !life.directorMediaAvailable) return;
    const workspaceVersion = life.version.current;
    void operation(async () => {
      if (file.size < 46 || file.size > 2 * 1024 * 1024) {
        throw new Error('Studio WAV must be 2 MB or smaller');
      }
      const uploaded = await studioApi.uploadAudio(workspacePath, file);
      if (!life.mounted.current || versionMatch(life.version.current, workspaceVersion)) return;
      setPromptAudio({ id: uploaded.id, name: file.name, seconds: uploaded.seconds });
      setSuccess('WAV ready for the next AI Studio prompt');
    });
  };

  const reviewVision = () => {
    if (!life.project || busy || !life.visionAvailable) return;
    const projectId = life.project.id,
      revision = life.project.revision,
      sequence = life.version.current;
    void operation(async () => {
      const reviewed = await studioApi.visionReview(workspacePath, projectId);
      if (!life.mounted.current || sequence !== life.version.current) return;
      if (reviewed.projectId !== projectId || reviewed.revision !== revision) {
        throw new Error('Studio project changed during visual review; retry from the latest revision');
      }
      setVisionReview(reviewed);
      setSuccess('AI visual review completed for ' + reviewed.reviewedFrames.length + ' sampled frame(s)');
    });
  };

  const repairVision = () => {
    if (!life.project || !life.visionRepairAvailable || busy) return;
    const id = life.project.id,
      revision = life.project.revision,
      sequence = life.version.current;
    void operation(async () => {
      const repaired = await studioApi.visionRepair(workspacePath, id, revision, renderWidth);
      if (!life.mounted.current || sequence !== life.version.current) return;
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
      setUndoStack([]);
      setRedoStack([]);
      life.setProject(updated.project);
      life.setQuality(updated.quality ?? null);
      life.setJobs(prev => [updated.job, ...prev.filter(item => item.id !== updated.job.id)]);
      life.setActiveJobId(updated.job.id);
      setSuccess('Bounded AI visual repair applied · revision ' + updated.project.revision + ' · new MP4 rendering started');
    });
  };

  const exportCaptions = () => {
    if (!life.project || !life.captionsAvailable || busy) return;
    const projectId = life.project.id,
      revision = life.project.revision,
      sequence = life.version.current;
    void operation(async () => {
      const subtitles = await studioApi.captions(workspacePath, projectId);
      if (!life.mounted.current || sequence !== life.version.current) return;
      const latest = await studioApi.inspect(workspacePath, projectId);
      if (latest.revision !== revision) throw new Error('Studio project changed during subtitle export');
      const url = URL.createObjectURL(new Blob([subtitles], { type: 'application/x-subrip;charset=utf-8' }));
      try {
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'motion-' + projectId + '-r' + revision + '.srt';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(url);
      }
      setSuccess('Exported editable scene-copy subtitles (not automatic speech transcription)');
    });
  };

  const exportWebCode = () => {
    if (!life.project || busy || !life.codeExportAvailable) return;
    const projectId = life.project.id,
      revision = life.project.revision,
      sequence = life.version.current;
    void operation(async () => {
      const latest = await studioApi.inspect(workspacePath, projectId);
      if (latest.revision !== revision) throw new Error('Studio project changed before code export');
      const html =
        codeFormat === 'react-jsx'
          ? await studioApi.exportCodeEditableReact(workspacePath, projectId, codeTrigger)
          : codeFormat === 'react'
          ? await studioApi.exportCodeReact(workspacePath, projectId, codeTrigger)
          : await studioApi.exportCodeHtml(workspacePath, projectId, codeTrigger);
      if (!life.mounted.current || sequence !== life.version.current) return;
      const blobUrl = URL.createObjectURL(
        new Blob([html], { type: codeFormat !== 'html' ? 'text/plain;charset=utf-8' : 'text/html;charset=utf-8' })
      );
      try {
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download =
          'studio-' +
          projectId +
          '-r' +
          revision +
          '-' +
          codeTrigger +
          (codeFormat === 'react-jsx' ? '.editable.tsx' : codeFormat === 'react' ? '.tsx' : '.html');
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
      } finally {
        URL.revokeObjectURL(blobUrl);
      }
      setSuccess(
        'Exported offline Studio ' +
          (codeFormat === 'react-jsx' ? 'editable React JSX' : codeFormat === 'react' ? 'React/Next wrapper' : 'HTML/SVG') +
          ' (' +
          codeTrigger +
          ')'
      );
    });
  };

  const loadDirectorSnapshots = () => {
    if (!life.project || !life.quality || !life.directorSnapshotAvailable || busy) return;
    const id = life.project.id,
      revision = life.project.revision,
      workspaceVersion = life.version.current;
    void operation(async () => {
      const frames = [...new Set(life.quality!.samples.map(sample => sample.frame))].slice(0, 3);
      const urls: Array<{ frame: number; url: string }> = [];
      try {
        for (const f of frames) {
          urls.push({ frame: f, url: await studioApi.loadFrameSnapshot(workspacePath, id, f) });
        }
        if (!life.mounted.current || workspaceVersion !== life.version.current) {
          urls.forEach(item => URL.revokeObjectURL?.(item.url));
          return;
        }
        const latest = await studioApi.inspect(workspacePath, id);
        if (latest.revision !== revision) throw new Error('Project changed while collecting frame snapshots');
        motionSnapshotsRef.current.forEach(item => URL.revokeObjectURL?.(item.url));
        motionSnapshotsRef.current = urls;
        setStudioSnapshots(urls);
      } catch (err) {
        urls.forEach(item => URL.revokeObjectURL?.(item.url));
        throw err;
      }
    });
  };

  const submitStudioPrompt = () => {
    const prompt = motionPrompt.trim();
    if (!prompt || busy || !life.directorAvailable) return;
    const targetId = life.selectedId;
    const workspaceVersion = life.version.current;
    const media = {
      ...(!targetId && life.directorAspectAvailable ? { aspectRatio: promptAspectRatio } : {}),
      ...(!targetId && life.directorVoiceoverAvailable && directorAutoNarration ? { autoNarrateScenes: true } : {}),
      ...(promptImages.length === 1 ? { imageAssetId: promptImages[0].id } : {}),
      ...(promptImages.length > 1 ? { sceneImageAssetIds: promptImages.map(item => item.id) } : {}),
      ...(promptAudio
        ? {
            audioAssetId: promptAudio.id,
            audioGain: promptAudioGain,
            ...(life.directorAudioLoopAvailable ? { audioLoop: promptAudioLoop } : {}),
          }
        : {}),
      ...(life.directorVoiceoverAvailable && promptVoiceover.trim()
        ? { voiceoverText: promptVoiceover.trim(), voiceoverGain: promptVoiceoverGain }
        : {}),
    };
    void operation(async () => {
      const generated = targetId
        ? await studioApi.revise(workspacePath, targetId, prompt, renderWidth, media)
        : await studioApi.generate(workspacePath, prompt, renderWidth, media);
      if (!life.mounted.current || versionMatch(life.version.current, workspaceVersion)) return;
      if (generated.job.status === 'failed') throw new Error(generated.job.error || 'Studio render could not start');
      life.setProjects(await studioApi.list(workspacePath));
      life.setSelectedId(generated.project.id);
      life.setProject(generated.project);
      life.setSelectedLayer(null);
      if (generated.quality) life.setQuality(generated.quality);
      setUndoStack([]);
      setRedoStack([]);
      life.setJobs(prev => [generated.job, ...prev.filter(item => item.id !== generated.job.id)]);
      life.setActiveJobId(generated.job.id);
      setPromptHistory(prev => [
        ...prev.slice(-9),
        {
          prompt,
          response: generated.outline.join(' · ') + (generated.limitations.length ? ' · ' + generated.limitations.join('; ') : ''),
        },
      ]);
      setStudioPrompt('');
      setPromptImages([]);
      setPromptAudio(null);
      setPromptAudioGain(1);
      setPromptAudioLoop(false);
      setPromptVoiceover('');
      setPromptVoiceoverGain(1);
      setDirectorAutoNarration(false);
      setSuccess('AI Studio created revision ' + generated.project.revision + ' · MP4 rendering started');
    });
  };

  const render = () => {
    if (!life.project) return;
    void operation(async () => {
      const started = await studioApi.render(workspacePath, life.project!.id, renderWidth, supervisedRender);
      if (started.status === 'failed') throw new Error(started.error || 'Could not start render worker');
      life.setJobs(prev => [started, ...prev.filter(item => item.id !== started.id)]);
      life.setActiveJobId(started.id);
      setSuccess(
        'Render queued at revision ' +
          started.revision +
          ' · ' +
          renderWidth +
          'px wide' +
          (supervisedRender ? ' · awaiting separate SuperAgent FIFO supervisor' : '')
      );
    });
  };

  const activeProject = typographyPreview ?? particlePreview ?? beatPreview ?? templatePreview ?? effectPreview ?? presetPreview ?? life.project;
  const hasPreview = Boolean(presetPreview || effectPreview || templatePreview || beatPreview || particlePreview || typographyPreview);

  return {
    ...life,
    frame,
    setFrame,
    canvasSnapping,
    setCanvasSnapping,
    viewport,
    setViewport,
    panMode,
    setPanMode,
    playing,
    setPlaying,
    creating,
    setCreating,
    projectName,
    setProjectName,
    motionPrompt,
    setStudioPrompt,
    promptImages,
    setPromptImages,
    promptAudio,
    setPromptAudio,
    promptAudioGain,
    setPromptAudioGain,
    promptAudioLoop,
    setPromptAudioLoop,
    directorAutoNarration,
    setDirectorAutoNarration,
    motionSnapshots,
    promptAspectRatio,
    setPromptAspectRatio,
    promptVoiceover,
    setPromptVoiceover,
    promptVoiceoverGain,
    setPromptVoiceoverGain,
    promptHistory,
    visionReview,
    busy,
    error,
    setError,
    success,
    setSuccess,
    supervisedRender,
    setSupervisedRender,
    renderWidth,
    setRenderWidth,
    undoStack,
    setUndoStack,
    redoStack,
    setRedoStack,
    draftText,
    setDraftText,
    propertyDraft,
    setPropertyDraft,
    cornerDraft,
    setCornerDraft,
    typographyPreview,
    setTypographyPreview,
    particlePreview,
    setParticlePreview,
    codeTrigger,
    setCodeTrigger,
    codeFormat,
    setCodeFormat,
    beatPreview,
    setBeatPreview,
    templatePreview,
    setTemplatePreview,
    resizeRatio,
    setResizeRatio,
    upscaleTarget,
    setUpscaleTarget,
    effectPreview,
    setEffectPreview,
    presetPreview,
    setPresetPreview,
    layer,
    job,
    totalFrames,
    fps,
    activeProject,
    hasPreview,
    operation,
    applyCompound,
    applySingleEffect,
    changeEffectStack,
    resizeProject,
    upscaleProject,
    createProject,
    applyEditorEdits,
    applyTypography,
    applyParticleOverlay,
    applyAudioBeatSync,
    applySceneTemplate,
    recoverSavedRevision,
    restoreHistory,
    importAudio,
    importImage,
    insertLayer,
    reorderLayer,
    removeSelectedLayer,
    saveText,
    saveCornerRadius,
    saveProperty,
    keyframe,
    attachDirectorImages,
    attachDirectorFile,
    reviewVision,
    repairVision,
    exportCaptions,
    exportWebCode,
    loadDirectorSnapshots,
    submitStudioPrompt,
    render,
    message,
  };
}
