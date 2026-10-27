import { useCallback, useEffect, useRef, useState } from 'react';
import { studioControlChannel } from '../../services/studioControlChannel';
import {
  studioApi,
  type StudioJob,
  type StudioProject,
  type StudioProjectSummary,
  type StudioSchedulerStatus,
  type StudioStorageStatus,
  type StudioQueueRecovery,
  type StudioSupervisorStatus,
  type StudioQualityReport,
} from '../../services/studioApi';

const idle = new Set<StudioJob['status']>(['completed', 'failed', 'cancelled', 'interrupted']);

export function useStudioLifecycle(
  workspacePath: string,
  message: (msg: string) => void,
  resetWorkspaceStates: () => void,
  resetPreviews?: () => void
) {
  const [projects, setProjects] = useState<StudioProjectSummary[]>([]);
  const [project, setProject] = useState<StudioProject | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [jobs, setJobs] = useState<StudioJob[]>([]);
  const [scheduler, setScheduler] = useState<StudioSchedulerStatus | null>(null);
  const [supervisor, setSupervisor] = useState<StudioSupervisorStatus | null>(null);
  const [storage, setStorage] = useState<StudioStorageStatus | null>(null);
  const [queueRecovery, setQueueRecovery] = useState<StudioQueueRecovery | null>(null);
  const [activeJobId, setActiveJobId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [quality, setQuality] = useState<StudioQualityReport | null>(null);

  // Capabilities
  const [directorAvailable, setDirectorAvailable] = useState(false);
  const [directorMediaAvailable, setDirectorMediaAvailable] = useState(false);
  const [directorSceneImagesAvailable, setDirectorSceneImagesAvailable] = useState(false);
  const [directorAudioLoopAvailable, setDirectorAudioLoopAvailable] = useState(false);
  const [directorVoiceoverAvailable, setDirectorVoiceoverAvailable] = useState(false);
  const [directorAspectAvailable, setDirectorAspectAvailable] = useState(false);
  const [directorSnapshotAvailable, setDirectorSnapshotAvailable] = useState(false);
  const [visionAvailable, setVisionAvailable] = useState(false);
  const [visionRepairAvailable, setVisionRepairAvailable] = useState(false);
  const [captionsAvailable, setCaptionsAvailable] = useState(false);
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
  const [extraExportsAvailable, setExtraExportsAvailable] = useState(false);
  const [codeExportAvailable, setCodeExportAvailable] = useState(false);
  const [codeToVideoAvailable, setCodeToVideoAvailable] = useState(false);
  const [interactionRulesAvailable, setInteractionRulesAvailable] = useState(false);
  const [multiVideoAvailable, setMultiVideoAvailable] = useState(false);
  const [textOcrAvailable, setTextOcrAvailable] = useState(false);
  const [textOcrTimelineAvailable, setTextOcrTimelineAvailable] = useState(false);
  const [reactCodeAvailable, setReactCodeAvailable] = useState(false);
  const [editableReactAvailable, setEditableReactAvailable] = useState(false);
  const [storyboardAvailable, setStoryboardAvailable] = useState(false);

  const mounted = useRef(true);
  const previewRef = useRef<string | null>(null);
  const version = useRef(0);
  const selectionSeq = useRef(0);

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
    resetWorkspaceStates();
    setJobs([]);
    setActiveJobId('');
    setScheduler(null);
    setSupervisor(null);
    setStorage(null);
    setQueueRecovery(null);

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
    resetPreviews?.();
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

  // Real-time synchronization and reconnect catch-up: reconcile authoritative project from Core
  useEffect(() => {
    if (!selectedId || !workspacePath) return;

    // Listen for real-time project events emitted when the assistant or background jobs mutate the project
    const unsubscribe = studioControlChannel.onEvent(evt => {
      if (evt.workspacePath !== workspacePath || evt.projectId !== selectedId) return;
      if (evt.type === 'project_revision_changed') {
        const rev = Number(evt.payload?.revision);
        if (!project || (rev && rev > project.revision)) {
          studioApi.inspect(workspacePath, selectedId).then(latest => {
            if (mounted.current && (!project || latest.revision > project.revision)) {
              setProject(latest);
            }
          }).catch(() => {});
        }
      }
    });

    // Reconcile on window focus after desktop reconnect or tab switch
    const handleFocus = () => {
      studioApi.inspect(workspacePath, selectedId).then(latest => {
        if (mounted.current && (!project || latest.revision > project.revision)) {
          setProject(latest);
        }
      }).catch(() => {});
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocus);
    };
  }, [selectedId, workspacePath, project?.revision]);

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
    const activeJob = jobs.find(item => item.id === activeJobId);
    if (!activeJob || activeJob.status !== 'completed' || !activeJob.artifact) return;
    let cancelled = false;
    studioApi
      .loadPreview(workspacePath, activeJob.id)
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
  }, [workspacePath, activeJobId, jobs, message]);

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

  return {
    projects,
    setProjects,
    project,
    setProject,
    selectedId,
    setSelectedId,
    selectedLayer,
    setSelectedLayer,
    jobs,
    setJobs,
    scheduler,
    setScheduler,
    supervisor,
    setSupervisor,
    storage,
    setStorage,
    queueRecovery,
    setQueueRecovery,
    activeJobId,
    setActiveJobId,
    previewUrl,
    imageUrls,
    quality,
    setQuality,
    directorAvailable,
    directorMediaAvailable,
    directorSceneImagesAvailable,
    directorAudioLoopAvailable,
    directorVoiceoverAvailable,
    directorAspectAvailable,
    directorSnapshotAvailable,
    visionAvailable,
    visionRepairAvailable,
    captionsAvailable,
    compoundAvailable,
    effectsAvailable,
    stackAvailable,
    historyAvailable,
    brandAvailable,
    templatesAvailable,
    batchAvailable,
    beatAvailable,
    particlesAvailable,
    typographyAvailable,
    extraExportsAvailable,
    codeExportAvailable,
    codeToVideoAvailable,
    interactionRulesAvailable,
    multiVideoAvailable,
    textOcrAvailable,
    textOcrTimelineAvailable,
    reactCodeAvailable,
    editableReactAvailable,
    storyboardAvailable,
    refreshProjects,
    mounted,
    version,
    selectionSeq,
  };
}
