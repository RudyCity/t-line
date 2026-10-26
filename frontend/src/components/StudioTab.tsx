import { useState } from 'react';
import { STUDIO_DISPLAY_NAME } from '../services/studioBranding';
import { useStudioState } from './studio/useStudioState';
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
import { studioApi } from '../services/studioApi';
import { AlertCircle, CheckCircle2, Film, Loader2, Plus, SlidersHorizontal, Sparkles, X } from 'lucide-react';

interface Props {
  workspacePath: string;
  isActive: boolean;
}

const control = 'rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-main)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const action = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-card-hover)] hover:border-[var(--color-primary)]/40 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 disabled:pointer-events-none';

export function StudioTab({ workspacePath, isActive }: Props) {
  const s = useStudioState(workspacePath, isActive);
  const [studioLayout, setStudioLayout] = useState<'split' | 'prompt' | 'editor'>('split');

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
        projects={s.projects}
        selectedId={s.selectedId}
        onSelectProject={s.setSelectedId}
        project={s.project}
        supervisor={s.supervisor}
        scheduler={s.scheduler}
        queueRecovery={s.queueRecovery}
        storage={s.storage}
        busy={s.busy}
        onRefresh={() =>
          void s.operation(async () => {
            const [_, latestJobs, latestScheduler, latestStorage, latestRecovery, latestSupervisor] = await Promise.all([
              s.refreshProjects(),
              studioApi.jobs(workspacePath),
              studioApi.scheduler(workspacePath).catch(() => null),
              studioApi.storage(workspacePath).catch(() => null),
              studioApi.queueRecovery(workspacePath).catch(() => null),
              studioApi.supervisor(workspacePath).catch(() => null),
            ]);
            s.setJobs(latestJobs);
            if (latestScheduler) s.scheduler;
            if (latestStorage) s.storage;
            if (latestRecovery) s.queueRecovery;
            if (latestSupervisor) s.supervisor;
            if (s.selectedId) s.setProject(await studioApi.inspect(workspacePath, s.selectedId));
          })
        }
        creating={s.creating}
        onToggleCreating={() => s.setCreating(v => !v)}
        undoDisabled={!s.project || s.busy || s.undoStack.length === 0}
        redoDisabled={!s.project || s.busy || s.redoStack.length === 0}
        onUndo={() => s.restoreHistory('undo')}
        onRedo={() => s.restoreHistory('redo')}
        renderWidth={s.renderWidth}
        onChangeRenderWidth={s.setRenderWidth}
        supervisedRender={s.supervisedRender}
        onToggleSupervisedRender={s.setSupervisedRender}
        onRender={s.render}
        projectName={s.projectName}
        onChangeProjectName={s.setProjectName}
        onCreateProject={s.createProject}
        onCancelCreating={() => s.setCreating(false)}
        layout={studioLayout}
        onChangeLayout={setStudioLayout}
      />

      {(s.error || s.success) && (
        <div
          role={s.error ? 'alert' : 'status'}
          className={
            'flex items-center gap-2 border-b px-4 py-2 text-xs font-medium transition-all ' +
            (s.error ? 'border-red-800 bg-red-950/40 text-red-300' : 'border-emerald-800 bg-emerald-950/40 text-emerald-300')
          }
        >
          {s.error ? <AlertCircle size={14} className="shrink-0 text-red-400" /> : <CheckCircle2 size={14} className="shrink-0 text-emerald-400" />}
          <span className="min-w-0 flex-1 break-words">{s.error || s.success}</span>
          <button
            aria-label="Dismiss notice"
            className="rounded p-0.5 hover:bg-white/10"
            onClick={() => {
              s.setError('');
              s.setSuccess('');
            }}
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* Experimental Video Reconstruct & Storyboard panels */}
      {s.multiVideoAvailable && (
        <StudioVideoToCodePanel
          key={workspacePath}
          workspacePath={workspacePath}
          ocrAvailable={s.textOcrAvailable}
          ocrTimelineAvailable={s.textOcrTimelineAvailable}
          onUpdated={(next, layerId, at) => {
            if (s.selectedId === next.id && s.project && s.project.revision === next.revision - 1)
              s.setUndoStack(prev => [...prev.slice(-29), structuredClone(s.project!.composition)]);
            else s.setUndoStack([]);
            s.setRedoStack([]);
            s.setProject(next);
            s.setSelectedId(next.id);
            s.setSelectedLayer(layerId);
            s.setFrame(at);
            s.setProjects(prev => prev.map(item => (item.id === next.id ? { id: next.id, name: next.name, revision: next.revision } : item)));
            s.setSuccess('Tracked layer correction saved at frame ' + at);
          }}
          onCreated={result => {
            s.setProjects(prev => [
              {
                id: result.projectId,
                name: 'Reconstructed video shapes',
                revision: result.revision,
              },
              ...prev.filter(item => item.id !== result.projectId),
            ]);
            s.setSelectedId(result.projectId);
            s.setSuccess(
              result.status === 'experimental-ocr'
                ? 'Video OCR extracted ' + result.lines.length + ' editable text layers'
                : result.status === 'experimental-ocr-timeline'
                ? 'Video timeline reconstructed into ' + result.captions.length + ' editable captions'
                : 'Video reconstructed into ' + result.objects.length + ' editable Studio layers'
            );
          }}
        />
      )}

      {s.storyboardAvailable && (
        <StudioStoryboardPanel
          workspacePath={workspacePath}
          busy={s.busy}
          renderWidth={s.renderWidth}
          onCreated={result => {
            s.setProjects(prev => [
              { id: result.project.id, name: result.project.name, revision: result.project.revision },
              ...prev.filter(item => item.id !== result.project.id),
            ]);
            s.setSelectedId(result.project.id);
            s.setProject(result.project);
            s.setSelectedLayer(result.project.composition.layers.find(item => item.kind === 'text')?.id ?? null);
            s.setFrame(0);
            s.setUndoStack([]);
            s.setRedoStack([]);
            s.setJobs(prev => [result.job, ...prev.filter(item => item.id !== result.job.id)]);
            s.setActiveJobId(result.job.id);
            s.setQuality(result.quality ?? null);
            s.setSuccess(
              result.job.status === 'failed' ? 'Approved storyboard saved, but MP4 render failed to start' : 'Approved storyboard saved · MP4 rendering queued'
            );
          }}
        />
      )}

      {!s.project ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 text-center bg-[#0d1017]">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg text-[var(--color-primary)]">
            <Film size={32} />
          </div>
          <div className="max-w-md space-y-1.5">
            <h3 className="text-sm font-semibold tracking-wide text-[var(--text-main)]">
              {s.projects.length ? 'Choose a scene to edit' : 'Your motion workspace is empty'}
            </h3>
            <p className="text-xs leading-relaxed text-[var(--text-muted)]">
              Create a project to edit built-in text and rectangle layers, animate keyframes, and render a local MP4 preview.
            </p>
          </div>
          {s.busy && <Loader2 size={20} className="animate-spin text-[var(--color-primary)]" />}

          {studioLayout === 'editor' && !s.projects.length ? (
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={() => setStudioLayout('prompt')}
                className={action + ' font-semibold text-[var(--color-primary)]'}
              >
                <Sparkles size={13} /> Open AI Prompt Mode
              </button>
              <button
                onClick={() => s.setCreating(true)}
                className={action}
              >
                <Plus size={13} /> Create Blank Project
              </button>
            </div>
          ) : (
            <div className="w-full max-w-xl rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] text-left shadow-lg overflow-hidden mt-2">
              <StudioDirectorSection
                selectedId={s.selectedId}
                busy={s.busy}
                directorAvailable={s.directorAvailable}
                directorMediaAvailable={s.directorMediaAvailable}
                directorSceneImagesAvailable={s.directorSceneImagesAvailable}
                directorAudioLoopAvailable={s.directorAudioLoopAvailable}
                directorVoiceoverAvailable={s.directorVoiceoverAvailable}
                directorAspectAvailable={s.directorAspectAvailable}
                directorSnapshotAvailable={s.directorSnapshotAvailable}
                directorAutoNarration={s.directorAutoNarration}
                onToggleAutoNarration={s.setDirectorAutoNarration}
                motionPrompt={s.motionPrompt}
                onChangePrompt={s.setStudioPrompt}
                onSubmitPrompt={s.submitStudioPrompt}
                promptHistory={s.promptHistory}
                promptAspectRatio={s.promptAspectRatio}
                onChangeAspectRatio={s.setPromptAspectRatio}
                promptImages={s.promptImages}
                onAttachImages={s.attachDirectorImages}
                onRemoveImage={i => s.setPromptImages(prev => prev.filter((_, index) => index !== i))}
                promptAudio={s.promptAudio}
                onAttachAudio={s.attachDirectorFile}
                onRemoveAudio={() => s.setPromptAudio(null)}
                promptAudioGain={s.promptAudioGain}
                onChangeAudioGain={s.setPromptAudioGain}
                promptAudioLoop={s.promptAudioLoop}
                onToggleAudioLoop={s.setPromptAudioLoop}
                promptVoiceover={s.promptVoiceover}
                onChangeVoiceover={s.setPromptVoiceover}
                promptVoiceoverGain={s.promptVoiceoverGain}
                onChangeVoiceoverGain={s.setPromptVoiceoverGain}
                quality={s.quality}
                captionsAvailable={s.captionsAvailable}
                onExportCaptions={s.exportCaptions}
                visionRepairAvailable={s.visionRepairAvailable}
                onRepairVision={s.repairVision}
                visionAvailable={s.visionAvailable}
                onReviewVision={s.reviewVision}
                visionReview={s.visionReview}
                onPrepareSuggestedRevision={s.setStudioPrompt}
                motionSnapshots={s.motionSnapshots}
                onLoadDirectorSnapshots={s.loadDirectorSnapshots}
              />
            </div>
          )}
        </div>
      ) : studioLayout === 'prompt' ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          {/* Left Column: AI Director Form & Actions */}
          <div className="flex min-h-0 flex-col overflow-y-auto border-b border-[var(--border-color)] bg-[var(--bg-main)] p-4 lg:border-b-0 lg:border-r">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3.5 shadow-xs">
              <div className="space-y-0.5">
                <h3 className="flex items-center gap-2 text-xs font-semibold text-[var(--text-main)]">
                  <Sparkles size={14} className="text-[var(--color-primary)]" />
                  AI Studio Director Mode
                </h3>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Describe scenes, attach audio, generate variations, or run AI vision reviews.
                </p>
              </div>
              <button
                onClick={() => setStudioLayout('editor')}
                className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition-all hover:brightness-110 active:scale-[0.98]"
              >
                <SlidersHorizontal size={12} />
                Open in Full Editor →
              </button>
            </div>

            <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-sidebar)] shadow-xs overflow-hidden">
              <StudioDirectorSection
                selectedId={s.selectedId}
                busy={s.busy}
                directorAvailable={s.directorAvailable}
                directorMediaAvailable={s.directorMediaAvailable}
                directorSceneImagesAvailable={s.directorSceneImagesAvailable}
                directorAudioLoopAvailable={s.directorAudioLoopAvailable}
                directorVoiceoverAvailable={s.directorVoiceoverAvailable}
                directorAspectAvailable={s.directorAspectAvailable}
                directorSnapshotAvailable={s.directorSnapshotAvailable}
                directorAutoNarration={s.directorAutoNarration}
                onToggleAutoNarration={s.setDirectorAutoNarration}
                motionPrompt={s.motionPrompt}
                onChangePrompt={s.setStudioPrompt}
                onSubmitPrompt={s.submitStudioPrompt}
                promptHistory={s.promptHistory}
                promptAspectRatio={s.promptAspectRatio}
                onChangeAspectRatio={s.setPromptAspectRatio}
                promptImages={s.promptImages}
                onAttachImages={s.attachDirectorImages}
                onRemoveImage={i => s.setPromptImages(prev => prev.filter((_, index) => index !== i))}
                promptAudio={s.promptAudio}
                onAttachAudio={s.attachDirectorFile}
                onRemoveAudio={() => s.setPromptAudio(null)}
                promptAudioGain={s.promptAudioGain}
                onChangeAudioGain={s.setPromptAudioGain}
                promptAudioLoop={s.promptAudioLoop}
                onToggleAudioLoop={s.setPromptAudioLoop}
                promptVoiceover={s.promptVoiceover}
                onChangeVoiceover={s.setPromptVoiceover}
                promptVoiceoverGain={s.promptVoiceoverGain}
                onChangeVoiceoverGain={s.setPromptVoiceoverGain}
                quality={s.quality}
                captionsAvailable={s.captionsAvailable}
                onExportCaptions={s.exportCaptions}
                visionRepairAvailable={s.visionRepairAvailable}
                onRepairVision={s.repairVision}
                visionAvailable={s.visionAvailable}
                onReviewVision={s.reviewVision}
                visionReview={s.visionReview}
                onPrepareSuggestedRevision={s.setStudioPrompt}
                motionSnapshots={s.motionSnapshots}
                onLoadDirectorSnapshots={s.loadDirectorSnapshots}
              />
            </div>
          </div>

          {/* Right Column: Live Scene Preview & Handoff */}
          <div className="flex min-h-0 flex-col overflow-hidden bg-[var(--bg-sidebar)]">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] px-4 py-2.5 text-xs">
              <span className="font-semibold text-[var(--text-main)]">Scene Live Preview</span>
              <span className="font-mono text-[11px] text-[var(--text-muted)]">
                {s.project.composition.width}×{s.project.composition.height} · r{s.project.revision}
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <StudioCanvasStage
                project={s.project}
                activeProject={s.activeProject || s.project}
                frame={s.frame}
                setFrame={s.setFrame}
                playing={s.playing}
                setPlaying={s.setPlaying}
                totalFrames={s.totalFrames}
                fps={s.fps}
                viewport={s.viewport}
                setViewport={s.setViewport}
                panMode={s.panMode}
                setPanMode={s.setPanMode}
                canvasSnapping={s.canvasSnapping}
                setCanvasSnapping={s.setCanvasSnapping}
                selectedLayer={s.selectedLayer}
                onSelectLayer={s.setSelectedLayer}
                imageUrls={s.imageUrls}
                isActive={isActive}
                busy={s.busy}
                hasPreview={s.hasPreview}
                onApplyEdits={s.applyEditorEdits}
              />
            </div>
            <div className="border-t border-[var(--border-color)] bg-[var(--bg-card)] p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs text-[var(--text-muted)]">
                  {s.project.composition.layers.length} layer(s) · {s.totalFrames} frames
                </div>
                <button
                  onClick={() => setStudioLayout('editor')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-primary)]/40 bg-[var(--color-primary)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/20"
                >
                  <SlidersHorizontal size={12} />
                  Customize in Full Editor →
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Main Studio 3-Column Workstation */}
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)_270px]">
            {/* Left Column: Layers & Creative Tool Modules */}
            <div className="flex min-h-0 flex-col border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:border-b-0 lg:border-r overflow-y-auto">
              <StudioLayersSection
                layers={s.project.composition.layers}
                selectedLayer={s.selectedLayer}
                onSelectLayer={s.setSelectedLayer}
                onInsertLayer={s.insertLayer}
                onImportImage={s.importImage}
                onReorderLayer={s.reorderLayer}
                onRemoveSelectedLayer={s.removeSelectedLayer}
                busy={s.busy}
              />

              {/* Creative Suites Collapsible Shelf */}
              <div className="border-t border-[var(--border-color)]">
                {studioLayout === 'split' ? (
                  <details className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] text-xs" aria-label="AI Studio Director Panel">
                    <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 font-semibold text-xs text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]">
                      <Sparkles size={13} className="text-[var(--color-primary)]" />
                      <span>AI Studio Director</span>
                    </summary>
                    <StudioDirectorSection
                      selectedId={s.selectedId}
                      busy={s.busy}
                      directorAvailable={s.directorAvailable}
                      directorMediaAvailable={s.directorMediaAvailable}
                      directorSceneImagesAvailable={s.directorSceneImagesAvailable}
                      directorAudioLoopAvailable={s.directorAudioLoopAvailable}
                      directorVoiceoverAvailable={s.directorVoiceoverAvailable}
                      directorAspectAvailable={s.directorAspectAvailable}
                      directorSnapshotAvailable={s.directorSnapshotAvailable}
                      directorAutoNarration={s.directorAutoNarration}
                      onToggleAutoNarration={s.setDirectorAutoNarration}
                      motionPrompt={s.motionPrompt}
                      onChangePrompt={s.setStudioPrompt}
                      onSubmitPrompt={s.submitStudioPrompt}
                      promptHistory={s.promptHistory}
                      promptAspectRatio={s.promptAspectRatio}
                      onChangeAspectRatio={s.setPromptAspectRatio}
                      promptImages={s.promptImages}
                      onAttachImages={s.attachDirectorImages}
                      onRemoveImage={i => s.setPromptImages(prev => prev.filter((_, index) => index !== i))}
                      promptAudio={s.promptAudio}
                      onAttachAudio={s.attachDirectorFile}
                      onRemoveAudio={() => s.setPromptAudio(null)}
                      promptAudioGain={s.promptAudioGain}
                      onChangeAudioGain={s.setPromptAudioGain}
                      promptAudioLoop={s.promptAudioLoop}
                      onToggleAudioLoop={s.setPromptAudioLoop}
                      promptVoiceover={s.promptVoiceover}
                      onChangeVoiceover={s.setPromptVoiceover}
                      promptVoiceoverGain={s.promptVoiceoverGain}
                      onChangeVoiceoverGain={s.setPromptVoiceoverGain}
                      quality={s.quality}
                      captionsAvailable={s.captionsAvailable}
                      onExportCaptions={s.exportCaptions}
                      visionRepairAvailable={s.visionRepairAvailable}
                      onRepairVision={s.repairVision}
                      visionAvailable={s.visionAvailable}
                      onReviewVision={s.reviewVision}
                      visionReview={s.visionReview}
                      onPrepareSuggestedRevision={s.setStudioPrompt}
                      motionSnapshots={s.motionSnapshots}
                      onLoadDirectorSnapshots={s.loadDirectorSnapshots}
                    />
                  </details>
                ) : (
                  <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-xs">
                    <span className="text-[var(--text-muted)] font-medium">Need AI assistance?</span>
                    <button
                      onClick={() => setStudioLayout('prompt')}
                      className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] hover:underline"
                    >
                      <Sparkles size={11} /> Open Prompt Director
                    </button>
                  </div>
                )}

                {s.brandAvailable && <StudioBrandKitPanel workspacePath={workspacePath} />}

                {s.templatesAvailable && (
                  <StudioTemplatePanel
                    key={workspacePath + ':' + s.project.id}
                    workspacePath={workspacePath}
                    project={s.project}
                    busy={s.busy}
                    preview={s.templatePreview}
                    onPreview={next => {
                      s.setTemplatePreview(next);
                      if (next) {
                        s.setPresetPreview(null);
                        s.setEffectPreview(null);
                      }
                    }}
                    onApply={s.applySceneTemplate}
                  />
                )}

                {s.typographyAvailable && (
                  <StudioTypographyPanel
                    key={s.project.id}
                    workspacePath={workspacePath}
                    project={s.project}
                    selectedLayer={s.selectedLayer}
                    busy={s.busy}
                    preview={s.typographyPreview}
                    onPreview={next => {
                      s.setTypographyPreview(next);
                      if (next) {
                        s.setParticlePreview(null);
                        s.setBeatPreview(null);
                        s.setTemplatePreview(null);
                        s.setPresetPreview(null);
                        s.setEffectPreview(null);
                      }
                    }}
                    onApply={s.applyTypography}
                  />
                )}

                {s.particlesAvailable && (
                  <StudioParticlesPanel
                    key={s.project.id}
                    workspacePath={workspacePath}
                    project={s.project}
                    busy={s.busy}
                    preview={s.particlePreview}
                    onPreview={next => {
                      s.setParticlePreview(next);
                      if (next) {
                        s.setBeatPreview(null);
                        s.setTemplatePreview(null);
                        s.setPresetPreview(null);
                        s.setEffectPreview(null);
                      }
                    }}
                    onApply={s.applyParticleOverlay}
                  />
                )}

                {s.beatAvailable && (
                  <StudioBeatSyncPanel
                    key={s.project.id}
                    workspacePath={workspacePath}
                    project={s.project}
                    selectedLayer={s.selectedLayer}
                    busy={s.busy}
                    preview={s.beatPreview}
                    onPreview={next => {
                      s.setBeatPreview(next);
                      if (next) {
                        s.setTemplatePreview(null);
                        s.setPresetPreview(null);
                        s.setEffectPreview(null);
                        s.setParticlePreview(null);
                      }
                    }}
                    onApply={s.applyAudioBeatSync}
                  />
                )}

                {s.batchAvailable && (
                  <StudioBatchVariantsPanel
                    key={s.project.id}
                    workspacePath={workspacePath}
                    project={s.project}
                    busy={s.busy}
                    onQueued={result => {
                      s.setSuccess('Batch created ' + result.variants.filter(v => v.projectId).length + ' project variant(s). Check queue status for MP4.');
                      void s.refreshProjects().catch(cause => s.message(cause instanceof Error ? cause.message : String(cause)));
                      void studioApi
                        .jobs(workspacePath)
                        .then(next => {
                          s.setJobs(next);
                        })
                        .catch(cause => s.message(cause instanceof Error ? cause.message : String(cause)));
                    }}
                  />
                )}

                {s.historyAvailable && (
                  <StudioRecoveryPanel
                    workspacePath={workspacePath}
                    projectId={s.project.id}
                    revision={s.project.revision}
                    busy={s.busy}
                    onRestore={s.recoverSavedRevision}
                  />
                )}

                {s.compoundAvailable && (
                  <StudioPresetPanel
                    key={s.project.id}
                    workspacePath={workspacePath}
                    project={s.project}
                    selectedLayer={s.selectedLayer}
                    busy={s.busy}
                    preview={s.presetPreview}
                    onPreview={next => {
                      s.setPresetPreview(next);
                      if (next) {
                        s.setEffectPreview(null);
                        s.setTemplatePreview(null);
                      }
                    }}
                    onApply={s.applyCompound}
                  />
                )}

                {s.stackAvailable && (
                  <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-3 py-2">
                    <label htmlFor="motion-resize-ratio" className="text-xs">
                      Smart Resize
                    </label>
                    <select
                      id="motion-resize-ratio"
                      aria-label="Studio output aspect ratio"
                      className={control + ' max-w-[90px] text-[11px]'}
                      value={s.resizeRatio}
                      onChange={event => s.setResizeRatio(event.target.value as '16:9' | '1:1' | '9:16')}
                    >
                      <option value="16:9">16:9</option>
                      <option value="1:1">1:1</option>
                      <option value="9:16">9:16</option>
                    </select>
                    <button className={action} disabled={s.busy} onClick={s.resizeProject}>
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
                      value={s.upscaleTarget}
                      onChange={event => s.setUpscaleTarget(event.target.value as '2x' | '4x' | '1080p' | '2k' | '4k')}
                    >
                      <option value="2x">2× (Factor)</option>
                      <option value="4x">4× (Factor)</option>
                      <option value="1080p">1080p (FHD)</option>
                      <option value="2k">2K (1440p)</option>
                      <option value="4k">4K (2160p UHD)</option>
                    </select>
                    <button className={action} disabled={s.busy} onClick={s.upscaleProject}>
                      Upscale scene
                    </button>
                  </div>
                )}

                {s.stackAvailable && <StudioEffectStackPanel project={s.project} busy={s.busy} onChange={s.changeEffectStack} />}

                {s.effectsAvailable && (
                  <StudioEffectLibrary
                    key={workspacePath + ':' + s.project.id}
                    workspacePath={workspacePath}
                    project={s.project}
                    selectedLayer={s.selectedLayer}
                    busy={s.busy}
                    preview={s.effectPreview}
                    onPreview={next => {
                      s.setEffectPreview(next);
                      if (next) {
                        s.setPresetPreview(null);
                        s.setTemplatePreview(null);
                      }
                    }}
                    onApply={s.applySingleEffect}
                  />
                )}
              </div>
            </div>

            {/* Center Stage: Viewport, Canvas & Floating HUD */}
            <StudioCanvasStage
              project={s.project}
              activeProject={s.activeProject || s.project}
              frame={s.frame}
              setFrame={s.setFrame}
              playing={s.playing}
              setPlaying={s.setPlaying}
              totalFrames={s.totalFrames}
              fps={s.fps}
              viewport={s.viewport}
              setViewport={s.setViewport}
              panMode={s.panMode}
              setPanMode={s.setPanMode}
              canvasSnapping={s.canvasSnapping}
              setCanvasSnapping={s.setCanvasSnapping}
              selectedLayer={s.selectedLayer}
              onSelectLayer={s.setSelectedLayer}
              imageUrls={s.imageUrls}
              isActive={isActive}
              busy={s.busy}
              hasPreview={s.hasPreview}
              onApplyEdits={s.applyEditorEdits}
            />

            {/* Right Column: Layer Inspector */}
            <StudioInspectorSection
              layer={s.layer}
              frame={s.frame}
              draftText={s.draftText}
              onChangeDraftText={s.setDraftText}
              onSaveText={s.saveText}
              cornerDraft={s.cornerDraft}
              onChangeCornerDraft={s.setCornerDraft}
              onSaveCornerRadius={s.saveCornerRadius}
              propertyDraft={s.propertyDraft}
              onChangePropertyDraft={s.setPropertyDraft}
              onSaveProperty={s.saveProperty}
              onKeyframe={s.keyframe}
              onJumpToFrame={(f, field, val) => {
                s.setFrame(f);
                s.setPlaying(false);
                s.setPropertyDraft({ field, value: String(val) });
              }}
              busy={s.busy}
            />
          </div>

          {/* Bottom Dock: Multi-Track Timeline & Audio */}
          <div className="flex flex-col border-t border-[var(--border-color)] bg-[var(--bg-sidebar)]">
            {s.interactionRulesAvailable && (
              <StudioInteractionPanel
                project={s.project}
                busy={s.busy}
                onSave={graph => s.applyEditorEdits([{ type: 'set-interaction-graph', graph }], 'Interaction graph updated')}
                onError={s.message}
              />
            )}

            <StudioAudioPanel
              project={s.project}
              workspacePath={workspacePath}
              busy={s.busy}
              isActive={isActive}
              frame={s.frame}
              playing={s.playing}
              onSeekFrame={next => {
                s.setPlaying(false);
                s.setFrame(next);
              }}
              onUpload={s.importAudio}
              onEdit={s.applyEditorEdits}
              onError={s.message}
            />

            <StudioTimeline
              project={s.activeProject || s.project}
              currentFrame={s.frame}
              selectedLayer={s.selectedLayer}
              busy={s.busy || s.hasPreview}
              isActive={isActive && !s.hasPreview}
              onFrame={next => {
                s.setPlaying(false);
                s.setFrame(next);
              }}
              onLayer={s.setSelectedLayer}
              onEdit={s.applyEditorEdits}
              onError={s.message}
            />

            {s.codeToVideoAvailable && <StudioCodeToVideoPanel workspacePath={workspacePath} projectId={s.project.id} disabled={s.busy} />}

            <StudioRenderFooter
              workspacePath={workspacePath}
              projectName={s.project.name}
              jobs={s.jobs}
              projectId={s.project.id}
              activeJobId={s.activeJobId}
              onSelectJobId={s.setActiveJobId}
              job={s.job}
              codeExportAvailable={s.codeExportAvailable}
              codeFormat={s.codeFormat}
              onChangeCodeFormat={s.setCodeFormat}
              reactCodeAvailable={s.reactCodeAvailable}
              editableReactAvailable={s.editableReactAvailable}
              codeTrigger={s.codeTrigger}
              onChangeCodeTrigger={s.setCodeTrigger}
              onExportWebCode={s.exportWebCode}
              onCancelJob={() =>
                void s.operation(async () => {
                  if (s.job) await studioApi.cancel(workspacePath, s.job.id);
                  s.setSuccess('Cancellation requested');
                })
              }
              previewUrl={s.previewUrl}
              extraExportsAvailable={s.extraExportsAvailable}
              busy={s.busy}
            />
          </div>
        </>
      )}
    </section>
  );
}
