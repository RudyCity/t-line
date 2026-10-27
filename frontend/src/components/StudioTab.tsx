import { useEffect } from 'react';
import { STUDIO_DISPLAY_NAME } from '../services/studioBranding';
import { useStudioState } from './studio/useStudioState';
import { StudioTopBar } from './studio/StudioTopBar';
import { StudioQuickDirectPanel } from './studio/StudioQuickDirectPanel';
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
import { StudioMultiTrackTimeline } from './studio/StudioMultiTrackTimeline';
import { StudioMediaBin } from './studio/StudioMediaBin';
import { StudioAudioPanel } from './StudioAudioPanel';
import { StudioInteractionPanel } from './StudioInteractionPanel';
import { StudioVideoToCodePanel } from './StudioVideoToCodePanel';
import { StudioCodeToVideoPanel } from './StudioCodeToVideoPanel';
import { studioApi } from '../services/studioApi';
import { studioControlChannel } from '../services/studioControlChannel';
import { AlertCircle, CheckCircle2, Film, Loader2, Plus, Sparkles, X, ChevronRight } from 'lucide-react';

interface Props {
  workspacePath: string;
  isActive: boolean;
}

const control = 'rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2.5 py-1.5 text-xs text-[var(--text-main)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const action = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] bg-[var(--bg-card)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-main)] transition-colors hover:bg-[var(--bg-card-hover)] hover:border-[var(--color-primary)]/40 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40 disabled:pointer-events-none';

export function StudioTab({ workspacePath, isActive }: Props) {
  const s = useStudioState(workspacePath, isActive);

  // Wire up desktop Studio control channel for assistant coordination
  useEffect(() => {
    return studioControlChannel.onAction(act => {
      if (act.workspacePath !== workspacePath) return;
      if (act.type === 'open_project') {
        s.setSelectedId(act.projectId);
      } else if (act.type === 'seek_timecode') {
        if (act.frame !== undefined) {
          s.setPlaying(false);
          s.setFrame(act.frame);
        } else if (act.timeSeconds !== undefined && s.fps > 0) {
          s.setPlaying(false);
          s.setFrame(Math.round(act.timeSeconds * s.fps));
        }
      } else if (act.type === 'select_clip') {
        if (act.layerId) {
          s.setSelectedLayer(act.layerId);
        }
      }
    });
  }, [workspacePath, s.fps]);

  // Broadcast project revision updates to desktop channel
  useEffect(() => {
    if (s.project) {
      studioControlChannel.emitEvent(workspacePath, s.project.id, 'project_revision_changed', {
        revision: s.project.revision,
        projectName: s.project.name,
      });
    }
  }, [workspacePath, s.project?.id, s.project?.revision]);

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

      {/* Tools & Reconstruct Drawers */}
      {(s.storyboardAvailable || s.multiVideoAvailable) && (
        <div className="border-b border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-1.5 text-xs space-y-1">
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

          {s.multiVideoAvailable && (
            <details className="py-0.5">
              <summary className="cursor-pointer font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5">
                <Film size={12} />
                <span>Video → Editable Studio Code (Experimental shapes/OCR)</span>
              </summary>
              <div className="mt-2 pt-2 border-t border-[var(--border-color)]">
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
              </div>
            </details>
          )}
        </div>
      )}

      {!s.project ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* Left Column: Project Browser & Creator */}
          <div className="flex min-h-0 flex-col border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:border-b-0 lg:border-r overflow-y-auto p-3 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-color)]">
              <span className="text-xs font-semibold text-[var(--text-main)] uppercase tracking-wider font-mono">
                Studio Projects
              </span>
              <button
                type="button"
                onClick={s.createNewProject}
                disabled={s.busy}
                className="inline-flex items-center gap-1 rounded bg-[var(--color-primary)] px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                <Plus size={12} />
                <span>New Project</span>
              </button>
            </div>

            {s.projects.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--border-color)] p-4 text-center text-xs text-[var(--text-muted)] space-y-2">
                <p>No Studio projects found in this workspace.</p>
                <p className="text-[11px]">Click "New Project" above or ask the Assistant in chat to create one.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {s.projects.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => s.setSelectedId(p.id)}
                    className="w-full text-left rounded border border-[var(--border-color)] bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] p-2.5 transition-colors group flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="text-xs font-semibold text-[var(--text-main)] truncate group-hover:text-cyan-400">
                        {p.name}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] font-mono">
                        {p.id} • rev {p.revision}
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-[var(--text-muted)] group-hover:text-cyan-400 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center & Bottom: Video Monitor Stage + Timeline Standby */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0d1017]">
            <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-6 relative">
              <div className="w-full max-w-2xl aspect-video rounded-xl border border-[var(--border-color)] bg-[#141824] shadow-2xl flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-lg text-[var(--color-primary)] mb-3">
                  <Film size={26} />
                </div>
                <h3 className="text-sm font-semibold tracking-wide text-[var(--text-main)]">
                  {s.projects.length ? 'Choose a scene to edit' : 'Your motion workspace is empty'}
                </h3>
                <p className="max-w-md mt-1.5 text-xs text-[var(--text-muted)] leading-relaxed">
                  Create a project to edit built-in text and rectangle layers, animate keyframes, and render a local MP4 preview.
                </p>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={() => s.setCreating(true)}
                    className={action + ' font-medium text-xs'}
                  >
                    <Plus size={12} /> Create Blank Scene
                  </button>
                </div>

                {s.busy && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-2 text-xs font-medium text-[var(--color-primary)]">
                    <Loader2 size={18} className="animate-spin" />
                    <span>Generating motion scene…</span>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Standby Dock */}
            <div className="border-t border-[var(--border-color)] bg-[var(--bg-sidebar)] p-3 text-xs text-[var(--text-muted)] flex items-center justify-between">
              <div className="flex items-center gap-2 font-mono text-[11px]">
                <span className="flex h-2 w-2 rounded-full bg-[var(--color-primary)]" />
                <span>Timeline Standby · Tracks and keyframes will populate upon scene creation</span>
              </div>
              <span className="font-mono text-[10px] text-[var(--text-muted)]">00:00:00 / 00:00:00</span>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Main Studio 3-Column Workstation */}
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)_270px]">
            {/* Left Column: Media Bin & Layers (Desktop NLE layout) */}
            <div className="flex min-h-0 flex-col border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] lg:border-b-0 lg:border-r overflow-y-auto">
              <StudioMediaBin
                workspacePath={workspacePath}
                project={s.project}
                busy={s.busy}
                selectedLayer={s.selectedLayer}
                onSelectLayer={s.setSelectedLayer}
                onInsertLayer={s.insertLayer}
                onImportImage={s.importImage}
                onReorderLayer={s.reorderLayer}
                onRemoveSelectedLayer={s.removeSelectedLayer}
                onImportAudio={s.importAudio}
                captionsAvailable={s.captionsAvailable}
                onExportCaptions={s.exportCaptions}
                visionAvailable={s.visionAvailable}
                onReviewVision={s.reviewVision}
                visionRepairAvailable={s.visionRepairAvailable}
                onRepairVision={s.repairVision}
              />

              {/* Creative Suites Collapsible Shelf */}
              <div className="border-t border-[var(--border-color)]">
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

            {/* Multi-Track Clip NLE Timeline */}
            <StudioMultiTrackTimeline
              workspacePath={workspacePath}
              projectId={s.project.id}
              composition={(s.activeProject || s.project).composition}
              currentFrame={s.frame}
              fps={s.fps}
              isPlaying={s.playing}
              onSeek={next => {
                s.setPlaying(false);
                s.setFrame(next);
              }}
              onTogglePlay={() => s.setPlaying(p => !p)}
              onCompositionChange={updated => {
                s.applyEditorEdits([{ type: 'replace-composition', composition: updated }], 'Timeline clip arrangement updated');
              }}
              onSelectLayer={s.setSelectedLayer}
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
