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
  type MotionProperty, type MotionProjectSummary,
} from '../services/motionStudioApi';
import { evaluateLayer, fpsOf, frameLabel, makeKeyframeTrack } from '../services/motionScene';
import { MotionCanvas } from './MotionCanvas';
import { MotionTimeline } from './MotionTimeline';
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [jobs, setJobs] = useState<MotionJob[]>([]);
  const [scheduler, setScheduler] = useState<MotionSchedulerStatus | null>(null);
  const [activeJobId, setActiveJobId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [undoStack, setUndoStack] = useState<MotionProject['composition'][]>([]);
  const [redoStack, setRedoStack] = useState<MotionProject['composition'][]>([]);
  const [draftText, setDraftText] = useState('');
  const [propertyDraft, setPropertyDraft] = useState<PropertyDraft>({ field: 'x', value: '0' });
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
    setViewport(DEFAULT_MOTION_VIEWPORT); setPanMode(false); panGesture.current = null;
    setJobs([]); setActiveJobId(''); setError(''); setSuccess('');
    setScheduler(null);
    setUndoStack([]); setRedoStack([]);
    const refresh = async () => {
      try {
        const [list, existingJobs] = await Promise.all([motionStudioApi.list(workspacePath), motionStudioApi.jobs(workspacePath)]);
        // Older SuperAgent builds lack scheduler information; editor remains usable.
        const capacity = await motionStudioApi.scheduler(workspacePath).catch(() => null);
        if (!mounted.current || version.current !== sequence) return;
        setProjects(list); setJobs(existingJobs); setScheduler(capacity);
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
    setUndoStack([]); setRedoStack([]);
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
    setPropertyDraft({ field: 'x', value: String(layer?.x ?? 0) });
  }, [layer?.id, layer?.kind, layer?.kind === 'text' ? layer.text : '', project?.revision]);

  useEffect(() => {
    if (!playing || !isActive || !project) return;
    const timer = window.setInterval(() => setFrame(prev => (prev + 1) % project.composition.durationFrames), 1000 / fps);
    return () => window.clearInterval(timer);
  }, [playing, isActive, fps, project]);

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

  const createProject = () => void operation(async () => {
    const created = await motionStudioApi.create(workspacePath, projectName.trim());
    await refreshProjects();
    setCreating(false); setProjectName(''); setSelectedId(created.id); setSuccess('New Motion project created');
  });

  const applyEditorEdits = (edits: MotionEdit[], note: string, focus?: string | null) => {
    if (!project || busy) return;
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

  const render = () => {
    if (!project) return;
    void operation(async () => {
      const started = await motionStudioApi.render(workspacePath, project.id, 640);
      if (started.status === 'failed') throw new Error(started.error || 'Could not start render worker');
      setJobs(prev => [started, ...prev.filter(item => item.id !== started.id)]);
      setActiveJobId(started.id); setSuccess('Render queued at revision ' + started.revision);
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
          {scheduler && <span role="status" className="rounded border border-[var(--border-color)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]" title="Workspace render queue and rendering capacity">
            Queue {scheduler.queued}/{scheduler.queueLimit} · Render {scheduler.slots.filter(item => item.state === 'claimed_unverified').length}/{scheduler.maxConcurrentRenders}
          </span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="motion-project-picker">Motion project</label>
          <select id="motion-project-picker" value={selectedId} onChange={event => setSelectedId(event.target.value)}
            className={control + ' max-w-[220px]'} aria-label="Select Motion project">
            <option value="">Select a project</option>
            {projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button className={action} onClick={() => void operation(async () => { await refreshProjects(); if (selectedId) setProject(await motionStudioApi.inspect(workspacePath, selectedId)); })} disabled={busy} aria-label="Refresh Motion projects"><RefreshCw size={13} /></button>
          <button className={action} onClick={() => setCreating(value => !value)} aria-expanded={creating}><Plus size={13} /> New</button>
          <button className={action} disabled={!project || busy || undoStack.length === 0} aria-label="Undo scene change" onClick={() => restoreHistory('undo')}><Undo2 size={13} /> Undo</button>
          <button className={action} disabled={!project || busy || redoStack.length === 0} aria-label="Redo scene change" onClick={() => restoreHistory('redo')}><Redo2 size={13} /> Redo</button>
          <button className={primary} onClick={render} disabled={!project || busy}><Film size={14} /> Render MP4</button>
        </div>
      </header>
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
                  Composition · {project.composition.width} × {project.composition.height}
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
                  <MotionCanvas key={project.id + ':' + project.revision} project={project} frame={frame} assetUrls={imageUrls}
                    selectedLayer={selectedLayer} isActive={isActive} busy={busy || panMode} snapping={canvasSnapping}
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

          <MotionTimeline project={project} currentFrame={frame} selectedLayer={selectedLayer}
            busy={busy} isActive={isActive} onFrame={next => { setPlaying(false); setFrame(next); }}
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
