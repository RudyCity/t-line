import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { STUDIO_DISPLAY_NAME } from '../services/studioBranding';
import {
  studioApi,
  type StudioJob,
  type StudioProject,
  type StudioLayer,
  type StudioEdit,
  type StudioSchedulerStatus,
  type CompoundPresetApplication,
  type StudioEffectApplication,
  type StudioStackOperation,
  type StudioTemplateInput,
  type StudioBeatSyncInput,
  type StudioParticleInput,
  type StudioTypographyInput,
  type StudioProperty,
  type StudioProjectSummary,
  type StudioStorageStatus,
  type StudioQueueRecovery,
  type StudioSupervisorStatus,
  type StudioQualityReport,
  type StudioVisionReview,
} from '../services/studioApi';
import { evaluateLayer, fpsOf } from '../services/studioScene';
import { StudioTopBar } from './studio/StudioTopBar';
import { StudioDirectorSection } from './studio/StudioDirectorSection';
import { StudioLayersSection } from './studio/StudioLayersSection';
import { StudioInspectorSection } from './studio/StudioInspectorSection';
import { StudioCanvasStage } from './studio/StudioCanvasStage';
import { StudioRenderFooter } from './studio/StudioRenderFooter';
import { StudioPresetPanel } from './StudioPresetPanel';
import { StudioEffectLibrary } from './StudioEffectLibrary';
import { StudioEffectStackPanel } from './StudioEffectStackPanel';
import { StudioRecoveryPanel } from './StudioRecoveryPanel';
import { StudioBrandKitPanel } from './StudioBrandKitPanel';
import { StudioTemplatePanel } from './StudioTemplatePanel';
import { StudioBatchVariantsPanel } from './StudioBatchVariantsPanel';
import { StudioBeatSyncPanel } from './StudioBeatSyncPanel';
import { StudioStoryboardPanel } from './StudioStoryboardPanel';
import { StudioParticlesPanel } from './StudioParticlesPanel';
import { StudioTypographyPanel } from './StudioTypographyPanel';
import { StudioTimeline } from './StudioTimeline';
import { StudioAudioPanel } from './StudioAudioPanel';
import { StudioInteractionPanel } from './StudioInteractionPanel';
import { StudioVideoToCodePanel } from './StudioVideoToCodePanel';
import { StudioCodeToVideoPanel } from './StudioCodeToVideoPanel';
import { motionPlaybackFrame } from '../services/studioTimelineClock';
import { DEFAULT_MOTION_VIEWPORT, type StudioViewport } from '../services/studioViewport';
import { AlertCircle, CheckCircle2, Film, Loader2, Sparkles, X } from 'lucide-react';

interface Props {
  workspacePath: string;
  isActive: boolean;
}

type PropertyDraft = { field: StudioProperty; value: string };
const idle = new Set<StudioJob['status']>(['completed', 'failed', 'cancelled', 'interrupted']);
const control = 'rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-main)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const action = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-card-hover)] hover:border-[var(--color-primary)]/40 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 disabled:pointer-events-none';

export function StudioTab({ workspacePath, isActive }: Props) {
  const [projects, setProjects] = useState<StudioProjectSummary[]>([]);
  const [project, setProject] = useState<StudioProject | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [frame, setFrame] = useState(0);
  const [canvasSnapping, setCanvasSnapping] = useState(true);
  const [viewport, setViewport] = useState<StudioViewport>(DEFAULT_MOTION_VIEWPORT);
  const [panMode, setPanMode] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [motionPrompt, setStudioPrompt] = useState('');
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
  const [motionSnapshots, setStudioSnapshots] = useState<Array<{ frame: number; url: string }>>([]);
  const motionSnapshotsRef = useRef<Array<{ frame: number; url: string }>>([]);
  const [promptAspectRatio, setPromptAspectRatio] = useState<'16:9' | '1:1' | '9:16'>('16:9');
  const [promptVoiceover, setPromptVoiceover] = useState('');
  const [promptVoiceoverGain, setPromptVoiceoverGain] = useState(1);
  const [promptHistory, setPromptHistory] = useState<Array<{ prompt: string; response: string }>>([]);
  const [quality, setQuality] = useState<StudioQualityReport | null>(null);
  const [visionReview, setVisionReview] = useState<StudioVisionReview | null>(null);
  const [visionAvailable, setVisionAvailable] = useState(false);
  const [visionRepairAvailable, setVisionRepairAvailable] = useState(false);
  const [captionsAvailable, setCaptionsAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const [scheduler, setScheduler] = useState<StudioSchedulerStatus | null>(null);
  const [supervisor, setSupervisor] = useState<StudioSupervisorStatus | null>(null);
  const [supervisedRender, setSupervisedRender] = useState(false);
  const [storage, setStorage] = useState<StudioStorageStatus | null>(null);
  const [queueRecovery, setQueueRecovery] = useState<StudioQueueRecovery | null>(null);
  const [renderWidth, setRenderWidth] = useState<640 | 1280 | 1920>(640);
  const [activeJobId, setActiveJobId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [undoStack, setUndoStack] = useState<StudioProject['composition'][]>([]);
  const [redoStack, setRedoStack] = useState<StudioProject['composition'][]>([]);
  const [draftText, setDraftText] = useState('');
  const [propertyDraft, setPropertyDraft] = useState<PropertyDraft>({ field: 'x', value: '0' });
  const [cornerDraft, setCornerDraft] = useState('0');
  const [compoundAvailable, setCompoundAvailable] = useState(false);
  const [effectsAvailable, setEffectsAvailable] = useState(false);
  const [stackAvailable, setStackAvailable] = useState(false);
  const [historyAvailable, setHistoryAvailable] = useState(false);
  const [brandAvailable, setBrandAvailable] = useState(false);
  const [templatesAvailable, setTemplatesAvailable] = useState(false);
  const [batchAvailable, setBatchAvailable] = useState(false);
  const [beatAvailable, setBeatAvailable] = useState(false);
  const [particlesAvailable, setParticlesAvailable] = useState(false);
  const [typographyAvailable, setTypographyAvailable] = useState(false);
  const [typographyPreview, setTypographyPreview] = useState<StudioProject | null>(null);
  const [particlePreview, setParticlePreview] = useState<StudioProject | null>(null);
  const [extraExportsAvailable, setExtraExportsAvailable] = useState(false);
  const [codeExportAvailable, setCodeExportAvailable] = useState(false);
  const [codeToVideoAvailable, setCodeToVideoAvailable] = useState(false);
  const [interactionRulesAvailable, setInteractionRulesAvailable] = useState(false);
  const [multiVideoAvailable, setMultiVideoAvailable] = useState(false);
  const [textOcrAvailable, setTextOcrAvailable] = useState(false);
  const [textOcrTimelineAvailable, setTextOcrTimelineAvailable] = useState(false);
  const [codeTrigger, setCodeTrigger] = useState<'autoplay' | 'scroll' | 'click' | 'hover'>('autoplay');
  const [reactCodeAvailable, setReactCodeAvailable] = useState(false);
  const [editableReactAvailable, setEditableReactAvailable] = useState(false);
  const [codeFormat, setCodeFormat] = useState<'html' | 'react' | 'react-jsx'>('html');
  const [storyboardAvailable, setStoryboardAvailable] = useState(false);
  const [beatPreview, setBeatPreview] = useState<StudioProject | null>(null);
  const [templatePreview, setTemplatePreview] = useState<StudioProject | null>(null);
  const [resizeRatio, setResizeRatio] = useState<'16:9' | '1:1' | '9:16'>('9:16');
  const [upscaleTarget, setUpscaleTarget] = useState<'2x' | '4x' | '1080p' | '2k' | '4k'>('2x');
  const [effectPreview, setEffectPreview] = useState<StudioProject | null>(null);
  const [presetPreview, setPresetPreview] = useState<StudioProject | null>(null);

  const mounted = useRef(true);
  const previewRef = useRef<string | null>(null);
  const version = useRef(0);
  const selectionSeq = useRef(0);

  const message = useCallback((errorMessage: string) => {
    setError(errorMessage);
    setSuccess('');
  }, []);

  const refreshProjects = useCallback(async () => {
    const list = await studioApi.list(workspacePath);
    if (mounted.current) setProjects(list);
    return list;
  }, [workspacePath]);

  useEffect(() => {
    mounted.current = true;
    const sequence = ++version.current;
    selectionSeq.current++;
    setProject(null);
    setSelectedId('');
    setSelectedLayer(null);
    setFrame(0);
    setStudioPrompt('');
    setPromptHistory([]);
    setDirectorAvailable(false);
    setDirectorMediaAvailable(false);
    setPromptImages([]);
    setPromptAudio(null);
    setPromptAudioGain(1);
    setPromptAudioLoop(false);
    setDirectorSceneImagesAvailable(false);
    setDirectorAudioLoopAvailable(false);
    setDirectorVoiceoverAvailable(false);
    setDirectorAspectAvailable(false);
    setPromptAspectRatio('16:9');
    setDirectorSnapshotAvailable(false);
    setDirectorAutoNarration(false);
    setPromptVoiceover('');
    setPromptVoiceoverGain(1);
    setQuality(null);
    setVisionReview(null);
    setVisionAvailable(false);
    setVisionRepairAvailable(false);
    setCaptionsAvailable(false);
    setCompoundAvailable(false);
    setEffectsAvailable(false);
    setStackAvailable(false);
    setHistoryAvailable(false);
    setBrandAvailable(false);
    setTemplatesAvailable(false);
    setBatchAvailable(false);
    setBeatAvailable(false);
    setParticlesAvailable(false);
    setParticlePreview(null);
    setTypographyAvailable(false);
    setTypographyPreview(null);
    setExtraExportsAvailable(false);
    setCodeExportAvailable(false);
    setCodeToVideoAvailable(false);
    setInteractionRulesAvailable(false);
    setMultiVideoAvailable(false);
    setTextOcrAvailable(false);
    setTextOcrTimelineAvailable(false);
    setReactCodeAvailable(false);
    setEditableReactAvailable(false);
    setCodeFormat('html');
    setStoryboardAvailable(false);
    setBeatPreview(null);
    setTemplatePreview(null);
    setPresetPreview(null);
    setEffectPreview(null);
    setViewport(DEFAULT_MOTION_VIEWPORT);
    setPanMode(false);
    setJobs([]);
    setActiveJobId('');
    setError('');
    setSuccess('');
    setScheduler(null);
    setSupervisor(null);
    setSupervisedRender(false);
    setStorage(null);
    setQueueRecovery(null);
    setUndoStack([]);
    setRedoStack([]);

    const refresh = async () => {
      try {
        const [list, existingJobs] = await Promise.all([studioApi.list(workspacePath), studioApi.jobs(workspacePath)]);
        const [capacity, storageInfo, recoveryInfo, supervisorInfo, motionInfo] = await Promise.all([
          studioApi.scheduler(workspacePath).catch(() => null),
          studioApi.storage(workspacePath).catch(() => null),
          studioApi.queueRecovery(workspacePath).catch(() => null),
          studioApi.supervisor(workspacePath).catch(() => null),
          studioApi.capabilities(workspacePath).catch(() => null),
        ]);
        if (!mounted.current || version.current !== sequence) return;
        setProjects(list);
        setJobs(existingJobs);
        setScheduler(capacity);
        setStorage(storageInfo);
        setQueueRecovery(recoveryInfo);
        setSupervisor(supervisorInfo);
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
        setEffectsAvailable(motionInfo?.capabilities?.effectsEngine === true);
        setStackAvailable(motionInfo?.capabilities?.nondestructiveEffectStack === true);
        setHistoryAvailable(motionInfo?.capabilities?.motionRevisionHistory === true);
        setBrandAvailable(motionInfo?.capabilities?.motionBrandKit === true);
        setTemplatesAvailable(motionInfo?.capabilities?.motionTemplateLibrary === true);
        setBatchAvailable(motionInfo?.capabilities?.motionBatchAspectVariants === true);
        setBeatAvailable(motionInfo?.capabilities?.motionAudioBeatSync === true);
        setParticlesAvailable(motionInfo?.capabilities?.motionCpuParticleOverlays === true);
        setTypographyAvailable(motionInfo?.capabilities?.motionAdvancedTypography?.includes('letter-reveal') === true);
        setExtraExportsAvailable(motionInfo?.capabilities?.motionExtraExportFormats?.includes('gif') === true);
        setCodeExportAvailable(motionInfo?.capabilities?.studioToCodeExport === 'svg-native-html-v2');
        setCodeToVideoAvailable(
          motionInfo?.capabilities?.studioCodeToVideo === 'offline-chromium-ffmpeg-preview-v1' &&
            motionInfo?.capabilities?.localCodeToVideoReady === true
        );
        setReactCodeAvailable(motionInfo?.capabilities?.studioToCodeFormats?.includes('react') === true);
        setEditableReactAvailable(motionInfo?.capabilities?.studioToCodeFormats?.includes('react-jsx') === true);
        setInteractionRulesAvailable(motionInfo?.capabilities?.studioInteractionRules === 'declarative-bindings-v1');
        setMultiVideoAvailable(motionInfo?.capabilities?.experimentalMultiVectorReconstruction === 'two-to-four-bright-separated-objects-api-v1');
        setTextOcrAvailable(
          motionInfo?.capabilities?.experimentalTextOcrReconstruction === 'local-english-stable-captions-v1' &&
            motionInfo?.capabilities?.localTextOcrReady === true
        );
        setTextOcrTimelineAvailable(
          motionInfo?.capabilities?.experimentalTextOcrTimeline === 'local-english-caption-timeline-v1' &&
            motionInfo?.capabilities?.localTextOcrReady === true
        );
        setStoryboardAvailable(motionInfo?.capabilities?.aiStoryboardReview === true);
        const latest = existingJobs.find(job => job.status === 'completed') || existingJobs[0];
        setActiveJobId(latest?.id || '');
      } catch (cause) {
        if (mounted.current && version.current === sequence) message(cause instanceof Error ? cause.message : String(cause));
      }
    };
    if (workspacePath) void refresh();
    return () => {
      mounted.current = false;
      version.current++;
    };
  }, [workspacePath, message]);

  useEffect(() => {
    const sequence = version.current;
    const selectedSequence = ++selectionSeq.current;
    if (!selectedId || !workspacePath) {
      setProject(null);
      return;
    }
    setProject(null);
    setSelectedLayer(null);
    setFrame(0);
    setPlaying(false);
    setViewport(DEFAULT_MOTION_VIEWPORT);
    setUndoStack([]);
    setRedoStack([]);
    setTemplatePreview(null);
    setPresetPreview(null);
    setEffectPreview(null);
    setBeatPreview(null);
    setActiveJobId(jobs.find(item => item.projectId === selectedId)?.id || '');
    studioApi
      .inspect(workspacePath, selectedId)
      .then(next => {
        if (!mounted.current || sequence !== version.current || selectedSequence !== selectionSeq.current) return;
        setProject(next);
        setSelectedLayer(next.composition.layers[0]?.id ?? null);
      })
      .catch(cause => {
        if (mounted.current && sequence === version.current && selectedSequence === selectionSeq.current) {
          message(cause instanceof Error ? cause.message : String(cause));
        }
      });
  }, [selectedId, workspacePath, message]);

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    const ids = [...new Set((project?.composition.layers ?? []).filter(item => item.kind === 'image').map(item => item.assetId))];
    setImageUrls({});
    if (ids.length) {
      void Promise.all(
        ids.map(async id => {
          const url = await studioApi.loadImageUrl(workspacePath, id);
          if (cancelled) {
            URL.revokeObjectURL?.(url);
            return [id, ''] as const;
          }
          urls.push(url);
          return [id, url] as const;
        })
      )
        .then(pairs => {
          if (!cancelled && mounted.current) setImageUrls(Object.fromEntries(pairs));
        })
        .catch(cause => {
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
    const timer = window.setInterval(
      () => setFrame(motionPlaybackFrame(startFrame, performance.now() - startedAt, fps, durationFrames)),
      Math.min(50, 1000 / fps)
    );
    return () => window.clearInterval(timer);
  }, [playing, isActive, fps, project?.id, project?.composition.durationFrames]);

  useEffect(() => {
    const active = jobs.some(item => !idle.has(item.status));
    if (!active || !workspacePath) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const [result, capacity] = await Promise.all([studioApi.jobs(workspacePath), studioApi.scheduler(workspacePath).catch(() => null)]);
        if (!cancelled && mounted.current) {
          setJobs(result);
          if (capacity) setScheduler(capacity);
        }
      } catch (cause) {
        if (!cancelled) message(cause instanceof Error ? cause.message : String(cause));
      }
    };
    const timer = window.setInterval(() => void tick(), 1200);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [jobs, workspacePath, message]);

  useEffect(() => {
    const old = previewRef.current;
    previewRef.current = null;
    setPreviewUrl('');
    if (old) URL.revokeObjectURL(old);
    if (!job || job.status !== 'completed' || !job.artifact) return;
    let cancelled = false;
    studioApi
      .loadPreview(workspacePath, job.id)
      .then(url => {
        if (cancelled) URL.revokeObjectURL(url);
        else {
          previewRef.current = url;
          setPreviewUrl(url);
        }
      })
      .catch(cause => {
        if (!cancelled) message(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
      const current = previewRef.current;
      previewRef.current = null;
      if (current) URL.revokeObjectURL(current);
    };
  }, [workspacePath, job?.id, job?.status, job?.artifact?.sha256, message]);

  useEffect(() => {
    if (!workspacePath || !project) {
      setQuality(null);
      return;
    }
    let cancelled = false;
    void studioApi
      .quality(workspacePath, project.id)
      .then(report => {
        if (!cancelled) setQuality(report);
      })
      .catch(() => {
        if (!cancelled) setQuality(null);
      });
    return () => {
      cancelled = true;
    };
  }, [workspacePath, project?.id, project?.revision]);

  const operation = async (run: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await run();
    } catch (cause) {
      const reason = cause instanceof Error ? cause.message : String(cause);
      message(reason);
      if (/revision conflict/i.test(reason) && selectedId) {
        try {
          setProject(await studioApi.inspect(workspacePath, selectedId));
        } catch {
          /* show conflict */
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const applyCompound = (input: CompoundPresetApplication) => {
    if (!project || busy) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    void operation(async () => {
      const next = await studioApi.applyPreset(workspacePath, project.id, project.revision, input);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(next);
      setSuccess('Applied ' + input.presetId + ' · revision ' + next.revision);
    });
  };

  const applySingleEffect = (input: StudioEffectApplication) => {
    if (!project || busy) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    void operation(async () => {
      const next = stackAvailable
        ? await studioApi.changeStack(workspacePath, project.id, project.revision, {
            type: 'add',
            entry: {
              id: 'fx-' + Math.random().toString(36).slice(2, 12),
              enabled: true,
              ...input,
            },
          })
        : await studioApi.applyEffect(workspacePath, project.id, project.revision, input);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(next);
      setSuccess('Applied ' + input.effectId + ' · revision ' + next.revision);
    });
  };

  const changeEffectStack = (stackOperation: StudioStackOperation) => {
    if (!project || busy) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    void operation(async () => {
      const next = await studioApi.changeStack(workspacePath, project.id, project.revision, stackOperation);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(next);
      setSuccess('Updated Studio effect stack · revision ' + next.revision);
    });
  };

  const resizeProject = () => {
    if (!project || busy) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    void operation(async () => {
      const next = await studioApi.resize(workspacePath, project.id, project.revision, resizeRatio);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(next);
      setSuccess('Resized to ' + resizeRatio + ' · revision ' + next.revision);
    });
  };

  const upscaleProject = () => {
    if (!project || busy) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
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
      const next = await studioApi.upscale(workspacePath, project.id, project.revision, opts);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(next);
      setSuccess('Upscaled to ' + next.composition.width + ' × ' + next.composition.height + ' · revision ' + next.revision);
    });
  };

  const createProject = () =>
    void operation(async () => {
      const created = await studioApi.create(workspacePath, projectName.trim());
      await refreshProjects();
      setCreating(false);
      setProjectName('');
      setSelectedId(created.id);
      setSuccess('New Studio project created');
    });

  const applyEditorEdits = (edits: StudioEdit[], note: string, focus?: string | null) => {
    if (!project || busy) return;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    void operation(async () => {
      const next = await studioApi.edit(workspacePath, project.id, project.revision, edits);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(next);
      if (focus !== undefined) setSelectedLayer(focus);
      setSuccess(note + ' · revision ' + next.revision);
    });
  };

  const applyTypography = (input: StudioTypographyInput) => {
    if (!project || busy) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    setTypographyPreview(null);
    setParticlePreview(null);
    setBeatPreview(null);
    setTemplatePreview(null);
    setPresetPreview(null);
    setEffectPreview(null);
    void operation(async () => {
      const next = await studioApi.typography(workspacePath, project.id, project.revision, input);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(next);
      setSelectedLayer(next.composition.layers.find(item => item.kind === 'text')?.id ?? null);
      setSuccess('Applied ' + input.style + ' typography · revision ' + next.revision);
    });
  };

  const applyParticleOverlay = (input: StudioParticleInput) => {
    if (!project || busy) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    setParticlePreview(null);
    setBeatPreview(null);
    setTemplatePreview(null);
    setPresetPreview(null);
    setEffectPreview(null);
    void operation(async () => {
      const next = await studioApi.particles(workspacePath, project.id, project.revision, input);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(next);
      setSuccess('Applied ' + input.kind + ' particle overlay · revision ' + next.revision);
    });
  };

  const applyAudioBeatSync = (input: StudioBeatSyncInput) => {
    if (!project || busy) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    setBeatPreview(null);
    setTemplatePreview(null);
    setPresetPreview(null);
    setEffectPreview(null);
    void operation(async () => {
      const result = await studioApi.beatSync(workspacePath, project.id, project.revision, input);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(result.project);
      setSuccess('Beat sync applied · ' + result.onsetFrames.length + ' transients · revision ' + result.project.revision);
    });
  };

  const applySceneTemplate = (input: StudioTemplateInput) => {
    if (!project || busy) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    setTemplatePreview(null);
    setEffectPreview(null);
    setPresetPreview(null);
    void operation(async () => {
      const next = await studioApi.applyTemplate(workspacePath, project.id, project.revision, input);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(next);
      setSelectedLayer(next.composition.layers.find(item => item.kind === 'text')?.id ?? next.composition.layers[0]?.id ?? null);
      setSuccess('Applied scene template ' + input.templateId + ' · revision ' + next.revision);
    });
  };

  const recoverSavedRevision = (revision: number) => {
    if (!project || busy) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    void operation(async () => {
      const next = await studioApi.restoreHistory(workspacePath, project.id, project.revision, revision);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), before]);
      setRedoStack([]);
      setProject(next);
      if (!next.composition.layers.some(item => item.id === selectedLayer)) {
        setSelectedLayer(next.composition.layers[0]?.id ?? null);
      }
      setSuccess('Restored saved revision ' + revision + ' · new revision ' + next.revision);
    });
  };

  const restoreHistory = (direction: 'undo' | 'redo') => {
    if (!project || busy) return;
    setPresetPreview(null);
    setEffectPreview(null);
    setTemplatePreview(null);
    const from = direction === 'undo' ? undoStack : redoStack;
    const target = from[from.length - 1];
    if (!target) return;
    const before = structuredClone(project.composition);
    const selectedSequence = selectionSeq.current;
    void operation(async () => {
      const next = await studioApi.edit(workspacePath, project.id, project.revision, [
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
    const currentTracks = project.composition.audioTracks ?? (project.composition.audio ? [project.composition.audio] : []);
    if (currentTracks.length >= 4) {
      message('Studio scenes support up to 4 audio clips');
      return;
    }
    if (file.size < 46 || file.size > 2 * 1024 * 1024) {
      message('Studio WAV must be 2 MB or smaller');
      return;
    }
    const current = project;
    const selectedSequence = selectionSeq.current;
    void operation(async () => {
      const asset = await studioApi.uploadAudio(workspacePath, file);
      if (selectedSequence !== selectionSeq.current) return;
      const next = await studioApi.edit(workspacePath, current.id, current.revision, [
        {
          type: 'set-audio-tracks',
          audioTracks: [...currentTracks, { assetId: asset.id, startFrame: 0, volume: 1 }],
        },
      ]);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(previous => [...previous.slice(-19), structuredClone(current.composition)]);
      setRedoStack([]);
      setProject(next);
      setSuccess('Audio imported · revision ' + next.revision);
    });
  };

  const importImage = (file?: File) => {
    if (!file || !project || busy) return;
    if (file.size > 1024 * 1024 || file.size < 24) {
      message('Studio images must be 1 MB or smaller');
      return;
    }
    const current = project;
    const selectedSequence = selectionSeq.current;
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
      if (selectedSequence !== selectionSeq.current) return;
      const next = await studioApi.edit(workspacePath, current.id, current.revision, [{ type: 'add-layer', layer: newLayer }]);
      if (selectedSequence !== selectionSeq.current) return;
      setUndoStack(prev => [...prev.slice(-19), structuredClone(current.composition)]);
      setRedoStack([]);
      setProject(next);
      setSelectedLayer(layerId);
      setSuccess('Image imported · revision ' + next.revision);
    });
  };

  const insertLayer = (kind: StudioLayer['kind']) => {
    if (!project) return;
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
    if (!Number.isFinite(value) || value < 0 || value > 4096 || value > Math.min(layer.width, layer.height) / 2) {
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
    if (!project || !layer) return;
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
    if (!selected.length || busy || !directorMediaAvailable) return;
    if (selected.length + promptImages.length > (directorSceneImagesAvailable ? 3 : 1)) {
      message('Studio Director accepts up to ' + (directorSceneImagesAvailable ? 3 : 1) + ' images');
      return;
    }
    const workspaceVersion = version.current;
    void operation(async () => {
      const uploaded = await Promise.all(
        selected.map(async file => {
          if (file.size < 24 || file.size > 1024 * 1024) throw new Error('Studio image must be 1 MB or smaller');
          const result = await studioApi.uploadImage(workspacePath, file);
          return { id: result.id, name: file.name };
        })
      );
      if (!mounted.current || version.current !== workspaceVersion) return;
      setPromptImages(previous => [...previous, ...uploaded].slice(0, 3));
      setSuccess(uploaded.length + ' image(s) ready for the next AI Studio prompt');
    });
  };

  const attachDirectorFile = (file?: File) => {
    if (!file || busy || !directorMediaAvailable) return;
    const workspaceVersion = version.current;
    void operation(async () => {
      if (file.size < 46 || file.size > 2 * 1024 * 1024) {
        throw new Error('Studio WAV must be 2 MB or smaller');
      }
      const uploaded = await studioApi.uploadAudio(workspacePath, file);
      if (!mounted.current || version.current !== workspaceVersion) return;
      setPromptAudio({ id: uploaded.id, name: file.name, seconds: uploaded.seconds });
      setSuccess('WAV ready for the next AI Studio prompt');
    });
  };

  useEffect(() => {
    setVisionReview(null);
  }, [project?.id, project?.revision, workspacePath]);

  useEffect(() => {
    motionSnapshotsRef.current.forEach(item => URL.revokeObjectURL?.(item.url));
    motionSnapshotsRef.current = [];
    setStudioSnapshots([]);
    return () => {
      motionSnapshotsRef.current.forEach(item => URL.revokeObjectURL?.(item.url));
      motionSnapshotsRef.current = [];
    };
  }, [project?.id, project?.revision, workspacePath]);

  const reviewVision = () => {
    if (!project || busy || !visionAvailable) return;
    const projectId = project.id,
      revision = project.revision,
      sequence = version.current;
    void operation(async () => {
      const reviewed = await studioApi.visionReview(workspacePath, projectId);
      if (!mounted.current || sequence !== version.current) return;
      if (reviewed.projectId !== projectId || reviewed.revision !== revision) {
        throw new Error('Studio project changed during visual review; retry from the latest revision');
      }
      setVisionReview(reviewed);
      setSuccess('AI visual review completed for ' + reviewed.reviewedFrames.length + ' sampled frame(s)');
    });
  };

  const repairVision = () => {
    if (!project || !visionRepairAvailable || busy) return;
    const id = project.id,
      revision = project.revision,
      sequence = version.current;
    void operation(async () => {
      const repaired = await studioApi.visionRepair(workspacePath, id, revision, renderWidth);
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
      setUndoStack([]);
      setRedoStack([]);
      setProject(updated.project);
      setQuality(updated.quality ?? null);
      setJobs(prev => [updated.job, ...prev.filter(item => item.id !== updated.job.id)]);
      setActiveJobId(updated.job.id);
      setSuccess('Bounded AI visual repair applied · revision ' + updated.project.revision + ' · new MP4 rendering started');
    });
  };

  const exportCaptions = () => {
    if (!project || !captionsAvailable || busy) return;
    const projectId = project.id,
      revision = project.revision,
      sequence = version.current;
    void operation(async () => {
      const subtitles = await studioApi.captions(workspacePath, projectId);
      if (!mounted.current || sequence !== version.current) return;
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
    if (!project || busy || !codeExportAvailable) return;
    const projectId = project.id,
      revision = project.revision,
      sequence = version.current;
    void operation(async () => {
      const latest = await studioApi.inspect(workspacePath, projectId);
      if (latest.revision !== revision) throw new Error('Studio project changed before code export');
      const html =
        codeFormat === 'react-jsx'
          ? await studioApi.exportCodeEditableReact(workspacePath, projectId, codeTrigger)
          : codeFormat === 'react'
          ? await studioApi.exportCodeReact(workspacePath, projectId, codeTrigger)
          : await studioApi.exportCodeHtml(workspacePath, projectId, codeTrigger);
      if (!mounted.current || sequence !== version.current) return;
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
    if (!project || !quality || !directorSnapshotAvailable || busy) return;
    const id = project.id,
      revision = project.revision,
      workspaceVersion = version.current;
    void operation(async () => {
      const frames = [...new Set(quality.samples.map(sample => sample.frame))].slice(0, 3);
      const urls: Array<{ frame: number; url: string }> = [];
      try {
        for (const f of frames) {
          urls.push({ frame: f, url: await studioApi.loadFrameSnapshot(workspacePath, id, f) });
        }
        if (!mounted.current || workspaceVersion !== version.current) {
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
    if (!prompt || busy || !directorAvailable) return;
    const targetId = selectedId;
    const workspaceVersion = version.current;
    const media = {
      ...(!targetId && directorAspectAvailable ? { aspectRatio: promptAspectRatio } : {}),
      ...(!targetId && directorVoiceoverAvailable && directorAutoNarration ? { autoNarrateScenes: true } : {}),
      ...(promptImages.length === 1 ? { imageAssetId: promptImages[0].id } : {}),
      ...(promptImages.length > 1 ? { sceneImageAssetIds: promptImages.map(item => item.id) } : {}),
      ...(promptAudio
        ? {
            audioAssetId: promptAudio.id,
            audioGain: promptAudioGain,
            ...(directorAudioLoopAvailable ? { audioLoop: promptAudioLoop } : {}),
          }
        : {}),
      ...(directorVoiceoverAvailable && promptVoiceover.trim()
        ? { voiceoverText: promptVoiceover.trim(), voiceoverGain: promptVoiceoverGain }
        : {}),
    };
    void operation(async () => {
      const generated = targetId
        ? await studioApi.revise(workspacePath, targetId, prompt, renderWidth, media)
        : await studioApi.generate(workspacePath, prompt, renderWidth, media);
      if (!mounted.current || version.current !== workspaceVersion) return;
      if (generated.job.status === 'failed') throw new Error(generated.job.error || 'Studio render could not start');
      setProjects(await studioApi.list(workspacePath));
      setSelectedId(generated.project.id);
      setProject(generated.project);
      setSelectedLayer(null);
      if (generated.quality) setQuality(generated.quality);
      setUndoStack([]);
      setRedoStack([]);
      setJobs(prev => [generated.job, ...prev.filter(item => item.id !== generated.job.id)]);
      setActiveJobId(generated.job.id);
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
    if (!project) return;
    void operation(async () => {
      const started = await studioApi.render(workspacePath, project.id, renderWidth, supervisedRender);
      if (started.status === 'failed') throw new Error(started.error || 'Could not start render worker');
      setJobs(prev => [started, ...prev.filter(item => item.id !== started.id)]);
      setActiveJobId(started.id);
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

  const activeProject = typographyPreview ?? particlePreview ?? beatPreview ?? templatePreview ?? effectPreview ?? presetPreview ?? project;
  const hasPreview = Boolean(presetPreview || effectPreview || templatePreview || beatPreview || particlePreview || typographyPreview);

  if (!workspacePath) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
        Choose a local workspace to open {STUDIO_DISPLAY_NAME}.
      </div>
    );
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-[var(--bg-main)] text-[var(--text-main)] font-sans" aria-label={STUDIO_DISPLAY_NAME}>
      <StudioTopBar
        workspacePath={workspacePath}
        projects={projects}
        selectedId={selectedId}
        onSelectProject={setSelectedId}
        project={project}
        supervisor={supervisor}
        scheduler={scheduler}
        queueRecovery={queueRecovery}
        storage={storage}
        busy={busy}
        onRefresh={() =>
          void operation(async () => {
            const [_, latestJobs, latestScheduler, latestStorage, latestRecovery, latestSupervisor] = await Promise.all([
              refreshProjects(),
              studioApi.jobs(workspacePath),
              studioApi.scheduler(workspacePath).catch(() => null),
              studioApi.storage(workspacePath).catch(() => null),
              studioApi.queueRecovery(workspacePath).catch(() => null),
              studioApi.supervisor(workspacePath).catch(() => null),
            ]);
            setJobs(latestJobs);
            setScheduler(latestScheduler);
            setStorage(latestStorage);
            setQueueRecovery(latestRecovery);
            setSupervisor(latestSupervisor);
            if (selectedId) setProject(await studioApi.inspect(workspacePath, selectedId));
          })
        }
        creating={creating}
        onToggleCreating={() => setCreating(v => !v)}
        undoDisabled={!project || busy || undoStack.length === 0}
        redoDisabled={!project || busy || redoStack.length === 0}
        onUndo={() => restoreHistory('undo')}
        onRedo={() => restoreHistory('redo')}
        renderWidth={renderWidth}
        onChangeRenderWidth={setRenderWidth}
        supervisedRender={supervisedRender}
        onToggleSupervisedRender={setSupervisedRender}
        onRender={render}
        projectName={projectName}
        onChangeProjectName={setProjectName}
        onCreateProject={createProject}
        onCancelCreating={() => setCreating(false)}
      />

      {(error || success) && (
        <div
          role={error ? 'alert' : 'status'}
          className={
            'flex items-center gap-2 border-b px-4 py-2 text-xs font-medium transition-all ' +
            (error ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-emerald-800 bg-emerald-950/40 text-emerald-300')
          }
        >
          {error ? <AlertCircle size={14} className="shrink-0 text-red-400" /> : <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />}
          <span className="min-w-0 flex-1 break-words">{error || success}</span>
          <button
            aria-label="Dismiss notice"
            className="rounded p-0.5 hover:bg-white/10"
            onClick={() => {
              setError('');
              setSuccess('');
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Experimental Video Reconstruct & Storyboard panels */}
      {multiVideoAvailable && (
        <StudioVideoToCodePanel
          key={workspacePath}
          workspacePath={workspacePath}
          ocrAvailable={textOcrAvailable}
          ocrTimelineAvailable={textOcrTimelineAvailable}
          onUpdated={(next, layerId, at) => {
            if (selectedId === next.id && project && project.revision === next.revision - 1)
              setUndoStack(prev => [...prev.slice(-29), structuredClone(project.composition)]);
            else setUndoStack([]);
            setRedoStack([]);
            setProject(next);
            setSelectedId(next.id);
            setSelectedLayer(layerId);
            setFrame(at);
            setProjects(prev => prev.map(item => (item.id === next.id ? { id: next.id, name: next.name, revision: next.revision } : item)));
            setSuccess('Tracked layer correction saved at frame ' + at);
          }}
          onCreated={result => {
            setProjects(prev => [
              {
                id: result.projectId,
                name: 'Reconstructed video shapes',
                revision: result.revision,
              },
              ...prev.filter(item => item.id !== result.projectId),
            ]);
            setSelectedId(result.projectId);
            setSuccess(
              result.status === 'experimental-ocr'
                ? 'Video OCR extracted ' + result.lines.length + ' editable text layers'
                : result.status === 'experimental-ocr-timeline'
                ? 'Video timeline reconstructed into ' + result.captions.length + ' editable captions'
                : 'Video reconstructed into ' + result.objects.length + ' editable Studio layers'
            );
          }}
        />
      )}

      {storyboardAvailable && (
        <StudioStoryboardPanel
          workspacePath={workspacePath}
          busy={busy}
          renderWidth={renderWidth}
          onCreated={result => {
            setProjects(prev => [
              { id: result.project.id, name: result.project.name, revision: result.project.revision },
              ...prev.filter(item => item.id !== result.project.id),
            ]);
            setSelectedId(result.project.id);
            setProject(result.project);
            setSelectedLayer(result.project.composition.layers.find(item => item.kind === 'text')?.id ?? null);
            setFrame(0);
            setUndoStack([]);
            setRedoStack([]);
            setJobs(prev => [result.job, ...prev.filter(item => item.id !== result.job.id)]);
            setActiveJobId(result.job.id);
            setQuality(result.quality ?? null);
            setSuccess(
              result.job.status === 'failed' ? 'Approved storyboard saved, but MP4 render failed to start' : 'Approved storyboard saved · MP4 rendering queued'
            );
          }}
        />
      )}

      {!project ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center bg-[#0d1017]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg text-[var(--color-primary)]">
            <Film size={32} />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-sm font-semibold tracking-wide text-[var(--text-main)]">
              {projects.length ? 'Choose a scene to edit' : 'Your motion workspace is empty'}
            </h3>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              Create a project to edit built-in text and rectangle layers, animate keyframes, and render a local MP4 preview.
            </p>
          </div>
          {busy && <Loader2 size={20} className="animate-spin text-[var(--color-primary)]" />}

          <div className="w-full max-w-xl rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] text-left shadow-lg overflow-hidden mt-2">
            <StudioDirectorSection
              selectedId={selectedId}
              busy={busy}
              directorAvailable={directorAvailable}
              directorMediaAvailable={directorMediaAvailable}
              directorSceneImagesAvailable={directorSceneImagesAvailable}
              directorAudioLoopAvailable={directorAudioLoopAvailable}
              directorVoiceoverAvailable={directorVoiceoverAvailable}
              directorAspectAvailable={directorAspectAvailable}
              directorSnapshotAvailable={directorSnapshotAvailable}
              directorAutoNarration={directorAutoNarration}
              onToggleAutoNarration={setDirectorAutoNarration}
              motionPrompt={motionPrompt}
              onChangePrompt={setStudioPrompt}
              onSubmitPrompt={submitStudioPrompt}
              promptHistory={promptHistory}
              promptAspectRatio={promptAspectRatio}
              onChangeAspectRatio={setPromptAspectRatio}
              promptImages={promptImages}
              onAttachImages={attachDirectorImages}
              onRemoveImage={i => setPromptImages(prev => prev.filter((_, index) => index !== i))}
              promptAudio={promptAudio}
              onAttachAudio={attachDirectorFile}
              onRemoveAudio={() => setPromptAudio(null)}
              promptAudioGain={promptAudioGain}
              onChangeAudioGain={setPromptAudioGain}
              promptAudioLoop={promptAudioLoop}
              onToggleAudioLoop={setPromptAudioLoop}
              promptVoiceover={promptVoiceover}
              onChangeVoiceover={setPromptVoiceover}
              promptVoiceoverGain={promptVoiceoverGain}
              onChangeVoiceoverGain={setPromptVoiceoverGain}
              quality={quality}
              captionsAvailable={captionsAvailable}
              onExportCaptions={exportCaptions}
              visionRepairAvailable={visionRepairAvailable}
              onRepairVision={repairVision}
              visionAvailable={visionAvailable}
              onReviewVision={reviewVision}
              visionReview={visionReview}
              onPrepareSuggestedRevision={setStudioPrompt}
              motionSnapshots={motionSnapshots}
              onLoadDirectorSnapshots={loadDirectorSnapshots}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Main Studio 3-Column Workstation */}
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)_270px]">
            {/* Left Column: Layers & Creative Tool Modules */}
            <div className="flex min-h-0 flex-col border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:border-b-0 lg:border-r overflow-y-auto">
              <StudioLayersSection
                layers={project.composition.layers}
                selectedLayer={selectedLayer}
                onSelectLayer={setSelectedLayer}
                onInsertLayer={insertLayer}
                onImportImage={importImage}
                onReorderLayer={reorderLayer}
                onRemoveSelectedLayer={removeSelectedLayer}
                busy={busy}
              />

              {/* Creative Suites Collapsible Shelf */}
              <div className="border-t border-[var(--border-color)]">
                {directorAvailable && (
                  <details className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] text-xs" aria-label="AI Studio Director Panel">
                    <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 font-semibold text-xs text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]">
                      <Sparkles size={13} className="text-[var(--color-primary)]" />
                      <span>AI Studio Director</span>
                    </summary>
                    <StudioDirectorSection
                      selectedId={selectedId}
                      busy={busy}
                      directorAvailable={directorAvailable}
                      directorMediaAvailable={directorMediaAvailable}
                      directorSceneImagesAvailable={directorSceneImagesAvailable}
                      directorAudioLoopAvailable={directorAudioLoopAvailable}
                      directorVoiceoverAvailable={directorVoiceoverAvailable}
                      directorAspectAvailable={directorAspectAvailable}
                      directorSnapshotAvailable={directorSnapshotAvailable}
                      directorAutoNarration={directorAutoNarration}
                      onToggleAutoNarration={setDirectorAutoNarration}
                      motionPrompt={motionPrompt}
                      onChangePrompt={setStudioPrompt}
                      onSubmitPrompt={submitStudioPrompt}
                      promptHistory={promptHistory}
                      promptAspectRatio={promptAspectRatio}
                      onChangeAspectRatio={setPromptAspectRatio}
                      promptImages={promptImages}
                      onAttachImages={attachDirectorImages}
                      onRemoveImage={i => setPromptImages(prev => prev.filter((_, index) => index !== i))}
                      promptAudio={promptAudio}
                      onAttachAudio={attachDirectorFile}
                      onRemoveAudio={() => setPromptAudio(null)}
                      promptAudioGain={promptAudioGain}
                      onChangeAudioGain={setPromptAudioGain}
                      promptAudioLoop={promptAudioLoop}
                      onToggleAudioLoop={setPromptAudioLoop}
                      promptVoiceover={promptVoiceover}
                      onChangeVoiceover={setPromptVoiceover}
                      promptVoiceoverGain={promptVoiceoverGain}
                      onChangeVoiceoverGain={setPromptVoiceoverGain}
                      quality={quality}
                      captionsAvailable={captionsAvailable}
                      onExportCaptions={exportCaptions}
                      visionRepairAvailable={visionRepairAvailable}
                      onRepairVision={repairVision}
                      visionAvailable={visionAvailable}
                      onReviewVision={reviewVision}
                      visionReview={visionReview}
                      onPrepareSuggestedRevision={setStudioPrompt}
                      motionSnapshots={motionSnapshots}
                      onLoadDirectorSnapshots={loadDirectorSnapshots}
                    />
                  </details>
                )}

                {brandAvailable && <StudioBrandKitPanel workspacePath={workspacePath} />}

                {templatesAvailable && (
                  <StudioTemplatePanel
                    key={workspacePath + ':' + project.id}
                    workspacePath={workspacePath}
                    project={project}
                    busy={busy}
                    preview={templatePreview}
                    onPreview={next => {
                      setTemplatePreview(next);
                      if (next) {
                        setPresetPreview(null);
                        setEffectPreview(null);
                      }
                    }}
                    onApply={applySceneTemplate}
                  />
                )}

                {typographyAvailable && (
                  <StudioTypographyPanel
                    key={project.id}
                    workspacePath={workspacePath}
                    project={project}
                    selectedLayer={selectedLayer}
                    busy={busy}
                    preview={typographyPreview}
                    onPreview={next => {
                      setTypographyPreview(next);
                      if (next) {
                        setParticlePreview(null);
                        setBeatPreview(null);
                        setTemplatePreview(null);
                        setPresetPreview(null);
                        setEffectPreview(null);
                      }
                    }}
                    onApply={applyTypography}
                  />
                )}

                {particlesAvailable && (
                  <StudioParticlesPanel
                    key={project.id}
                    workspacePath={workspacePath}
                    project={project}
                    busy={busy}
                    preview={particlePreview}
                    onPreview={next => {
                      setParticlePreview(next);
                      if (next) {
                        setBeatPreview(null);
                        setTemplatePreview(null);
                        setPresetPreview(null);
                        setEffectPreview(null);
                      }
                    }}
                    onApply={applyParticleOverlay}
                  />
                )}

                {beatAvailable && (
                  <StudioBeatSyncPanel
                    key={project.id}
                    workspacePath={workspacePath}
                    project={project}
                    selectedLayer={selectedLayer}
                    busy={busy}
                    preview={beatPreview}
                    onPreview={next => {
                      setBeatPreview(next);
                      if (next) {
                        setTemplatePreview(null);
                        setPresetPreview(null);
                        setEffectPreview(null);
                        setParticlePreview(null);
                      }
                    }}
                    onApply={applyAudioBeatSync}
                  />
                )}

                {batchAvailable && (
                  <StudioBatchVariantsPanel
                    key={project.id}
                    workspacePath={workspacePath}
                    project={project}
                    busy={busy}
                    onQueued={result => {
                      setSuccess('Batch created ' + result.variants.filter(v => v.projectId).length + ' project variant(s). Check queue status for MP4.');
                      void refreshProjects().catch(cause => message(cause instanceof Error ? cause.message : String(cause)));
                      void studioApi
                        .jobs(workspacePath)
                        .then(next => {
                          if (mounted.current) setJobs(next);
                        })
                        .catch(cause => message(cause instanceof Error ? cause.message : String(cause)));
                    }}
                  />
                )}

                {historyAvailable && (
                  <StudioRecoveryPanel
                    workspacePath={workspacePath}
                    projectId={project.id}
                    revision={project.revision}
                    busy={busy}
                    onRestore={recoverSavedRevision}
                  />
                )}

                {compoundAvailable && (
                  <StudioPresetPanel
                    key={project.id}
                    workspacePath={workspacePath}
                    project={project}
                    selectedLayer={selectedLayer}
                    busy={busy}
                    preview={presetPreview}
                    onPreview={next => {
                      setPresetPreview(next);
                      if (next) {
                        setEffectPreview(null);
                        setTemplatePreview(null);
                      }
                    }}
                    onApply={applyCompound}
                  />
                )}

                {stackAvailable && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2">
                    <label htmlFor="motion-resize-ratio" className="text-xs">
                      Smart Resize
                    </label>
                    <select
                      id="motion-resize-ratio"
                      aria-label="Studio output aspect ratio"
                      className={control + ' max-w-[90px] text-[11px]'}
                      value={resizeRatio}
                      onChange={event => setResizeRatio(event.target.value as '16:9' | '1:1' | '9:16')}
                    >
                      <option value="16:9">16:9</option>
                      <option value="1:1">1:1</option>
                      <option value="9:16">9:16</option>
                    </select>
                    <button className={action} disabled={busy} onClick={resizeProject}>
                      Resize scene
                    </button>

                    <div className="mx-1 h-3.5 w-px bg-[var(--border-color)]" />

                    <label htmlFor="motion-upscale-target" className="text-xs">
                      Upscale
                    </label>
                    <select
                      id="motion-upscale-target"
                      aria-label="Studio upscale target"
                      className={control + ' max-w-[100px] text-[11px]'}
                      value={upscaleTarget}
                      onChange={event => setUpscaleTarget(event.target.value as '2x' | '4x' | '1080p' | '2k' | '4k')}
                    >
                      <option value="2x">2× (Factor)</option>
                      <option value="4x">4× (Factor)</option>
                      <option value="1080p">1080p (FHD)</option>
                      <option value="2k">2K (1440p)</option>
                      <option value="4k">4K (2160p UHD)</option>
                    </select>
                    <button className={action} disabled={busy} onClick={upscaleProject}>
                      Upscale scene
                    </button>
                  </div>
                )}

                {stackAvailable && <StudioEffectStackPanel project={project} busy={busy} onChange={changeEffectStack} />}

                {effectsAvailable && (
                  <StudioEffectLibrary
                    key={workspacePath + ':' + project.id}
                    workspacePath={workspacePath}
                    project={project}
                    selectedLayer={selectedLayer}
                    busy={busy}
                    preview={effectPreview}
                    onPreview={next => {
                      setEffectPreview(next);
                      if (next) {
                        setPresetPreview(null);
                        setTemplatePreview(null);
                      }
                    }}
                    onApply={applySingleEffect}
                  />
                )}
              </div>
            </div>

            {/* Center Stage: Viewport, Canvas & Floating HUD */}
            <StudioCanvasStage
              project={project}
              activeProject={activeProject}
              frame={frame}
              setFrame={setFrame}
              playing={playing}
              setPlaying={setPlaying}
              totalFrames={totalFrames}
              fps={fps}
              viewport={viewport}
              setViewport={setViewport}
              panMode={panMode}
              setPanMode={setPanMode}
              canvasSnapping={canvasSnapping}
              setCanvasSnapping={setCanvasSnapping}
              selectedLayer={selectedLayer}
              onSelectLayer={setSelectedLayer}
              imageUrls={imageUrls}
              isActive={isActive}
              busy={busy}
              hasPreview={hasPreview}
              onApplyEdits={applyEditorEdits}
            />

            {/* Right Column: Layer Inspector */}
            <StudioInspectorSection
              layer={layer}
              frame={frame}
              draftText={draftText}
              onChangeDraftText={setDraftText}
              onSaveText={saveText}
              cornerDraft={cornerDraft}
              onChangeCornerDraft={setCornerDraft}
              onSaveCornerRadius={saveCornerRadius}
              propertyDraft={propertyDraft}
              onChangePropertyDraft={setPropertyDraft}
              onSaveProperty={saveProperty}
              onKeyframe={keyframe}
              onJumpToFrame={(f, field, val) => {
                setFrame(f);
                setPlaying(false);
                setPropertyDraft({ field, value: String(val) });
              }}
              busy={busy}
            />
          </div>

          {/* Bottom Dock: Multi-Track Timeline & Audio */}
          <div className="flex flex-col border-t border-[var(--border-color)] bg-[var(--bg-sidebar)]">
            {interactionRulesAvailable && (
              <StudioInteractionPanel
                project={project}
                busy={busy}
                onSave={graph => applyEditorEdits([{ type: 'set-interaction-graph', graph }], 'Interaction graph updated')}
                onError={message}
              />
            )}

            <StudioAudioPanel
              project={project}
              workspacePath={workspacePath}
              busy={busy}
              isActive={isActive}
              frame={frame}
              playing={playing}
              onSeekFrame={next => {
                setPlaying(false);
                setFrame(next);
              }}
              onUpload={importAudio}
              onEdit={applyEditorEdits}
              onError={message}
            />

            <StudioTimeline
              project={activeProject}
              currentFrame={frame}
              selectedLayer={selectedLayer}
              busy={busy || hasPreview}
              isActive={isActive && !hasPreview}
              onFrame={next => {
                setPlaying(false);
                setFrame(next);
              }}
              onLayer={setSelectedLayer}
              onEdit={applyEditorEdits}
              onError={message}
            />

            {codeToVideoAvailable && <StudioCodeToVideoPanel workspacePath={workspacePath} projectId={project.id} disabled={busy} />}

            <StudioRenderFooter
              workspacePath={workspacePath}
              projectName={project.name}
              jobs={jobs}
              projectId={project.id}
              activeJobId={activeJobId}
              onSelectJobId={setActiveJobId}
              job={job}
              codeExportAvailable={codeExportAvailable}
              codeFormat={codeFormat}
              onChangeCodeFormat={setCodeFormat}
              reactCodeAvailable={reactCodeAvailable}
              editableReactAvailable={editableReactAvailable}
              codeTrigger={codeTrigger}
              onChangeCodeTrigger={setCodeTrigger}
              onExportWebCode={exportWebCode}
              onCancelJob={() =>
                void operation(async () => {
                  if (job) await studioApi.cancel(workspacePath, job.id);
                  setSuccess('Cancellation requested');
                })
              }
              previewUrl={previewUrl}
              extraExportsAvailable={extraExportsAvailable}
              busy={busy}
            />
          </div>
        </>
      )}
    </section>
  );
}
