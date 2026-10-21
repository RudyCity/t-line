import { useEffect, useMemo, useRef, useState } from 'react';
import { Clapperboard, Eye, Loader2, Save, X } from 'lucide-react';
import {
  motionStudioApi, type CompoundPreset, type CompoundPresetApplication, type MotionProject,
} from '../services/motionStudioApi';

interface Props {
  workspacePath: string;
  project: MotionProject;
  selectedLayer: string | null;
  busy: boolean;
  preview: MotionProject | null;
  onPreview: (project: MotionProject | null) => void;
  onApply: (input: CompoundPresetApplication) => void;
}
const field = 'mt-1 w-full rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5 text-xs text-[var(--text-main)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]';
const button = 'inline-flex items-center justify-center gap-1.5 rounded border border-[var(--border-color)] px-3 py-2 text-xs font-medium hover:bg-[var(--surface-overlay-hover)] focus-visible:outline-2 disabled:opacity-40';

/** Render-safe catalog editor: server compiles previews without incrementing revisions.
 * Apply writes one atomic revision through the canonical Motion service.
 */
export function MotionPresetPanel({ workspacePath, project, selectedLayer, busy, preview, onPreview, onApply }: Props) {
  const [items, setItems] = useState<CompoundPreset[]>([]);
  const [search, setSearch] = useState('');
  const [presetId, setPresetId] = useState('');
  const [intensity, setIntensity] = useState(1);
  const [startFrame, setStartFrame] = useState(0);
  const [durationFrames, setDurationFrames] = useState(75);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const requestVersion = useRef(0);
  const visible = useMemo(() => items.filter(item =>
    [item.name, item.id, item.description, ...item.tags].some(t =>
      t.toLowerCase().includes(search.toLowerCase().trim()))), [items, search]);
  const activePreset = visible.some(item => item.id === presetId)
    ? presetId : (visible[0]?.id ?? '');
  const selectedIsText = project.composition.layers.some(layer =>
    layer.id === selectedLayer && layer.kind === 'text');
  const validWindow = Number.isSafeInteger(startFrame) && startFrame >= 0 &&
    Number.isSafeInteger(durationFrames) && durationFrames >= 12 && durationFrames <= 420 &&
    startFrame + durationFrames <= project.composition.durationFrames;
  const validIntensity = Number.isFinite(intensity) && intensity >= 0.25 && intensity <= 2;
  const canEdit = !busy && !pending && selectedIsText && Boolean(activePreset) && validWindow && validIntensity;
  const request: CompoundPresetApplication = {
    presetId: activePreset, targetLayerId: selectedLayer ?? '',
    startFrame, durationFrames, intensity,
  };

  useEffect(() => {
    let live = true;
    setItems([]); setPresetId(''); setError('');
    void motionStudioApi.presets(workspacePath)
      .then(result => {
        if (!live) return;
        setItems(result.presets);
        setPresetId(result.presets[0]?.id ?? '');
      }).catch(cause => { if (live) setError(cause instanceof Error ? cause.message : String(cause)); });
    return () => { live = false; requestVersion.current++; };
  }, [workspacePath]);

  useEffect(() => {
    requestVersion.current++;
    setPending(false);
    setStartFrame(0);
    setDurationFrames(Math.min(75, project.composition.durationFrames));
    setError('');
    onPreview(null);
    // Clear transient preview on changed project identity or server revision.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, project.revision]);

  useEffect(() => {
    requestVersion.current++;
    setPending(false);
    onPreview(null);
    // Preview belongs to a single selected target layer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLayer]);

  const invalidate = () => {
    requestVersion.current++;
    setPending(false);
    onPreview(null);
    setError('');
  };
  const showPreview = async () => {
    if (!canEdit) return;
    const version = ++requestVersion.current;
    setPending(true); setError('');
    try {
      const result = await motionStudioApi.previewPreset(workspacePath, project.id, project.revision, request);
      if (requestVersion.current === version) onPreview(result);
    } catch (cause) {
      if (requestVersion.current === version) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (requestVersion.current === version) setPending(false);
    }
  };
  const apply = () => {
    if (!canEdit) return;
    invalidate();
    onApply(request);
  };

  return (
    <section className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3" aria-label="Motion compound preset browser">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold">
          <Clapperboard size={14} /> Motion presets
          <span className="rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px] font-normal text-[var(--text-muted)]">{items.length} styles</span>
        </div>
        <div className="text-[10px] text-[var(--text-muted)]">Entrance · Kinetic · Exit · Accent</div>
      </div>
      <div className="grid gap-2 md:grid-cols-[minmax(125px,1fr)_minmax(175px,1.3fr)_85px_85px_85px_auto] md:items-end">
        <label className="text-[10px] text-[var(--text-muted)]">
          Find style
          <input aria-label="Search Motion presets" className={field} placeholder="neon, elegant…" value={search}
            onChange={event => { setSearch(event.target.value); invalidate(); }} />
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">
          Preset
          <select aria-label="Select Motion preset" className={field} value={activePreset}
            onChange={event => { setPresetId(event.target.value); invalidate(); }}>
            {visible.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            {!visible.length && <option value="">No matching preset</option>}
          </select>
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">
          Intensity
          <input aria-label="Preset intensity" className={field} type="number" step="0.25" min="0.25" max="2"
            value={intensity} onChange={event => { setIntensity(Number(event.target.value)); invalidate(); }} />
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">
          Start frame
          <input aria-label="Preset start frame" className={field} type="number" step="1" min="0"
            value={startFrame} onChange={event => { setStartFrame(Number(event.target.value)); invalidate(); }} />
        </label>
        <label className="text-[10px] text-[var(--text-muted)]">
          Frames
          <input aria-label="Preset duration" className={field} type="number" step="1" min="12" max="420"
            value={durationFrames} onChange={event => { setDurationFrames(Number(event.target.value)); invalidate(); }} />
        </label>
        <div className="flex gap-1">
          <button type="button" className={button} disabled={!canEdit} onClick={() => void showPreview()}>
            {pending ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />} Preview
          </button>
          <button type="button" className={button + ' border-[var(--color-primary)] text-[var(--color-primary)]'} disabled={!canEdit}
            onClick={apply}><Save size={13} /> Apply</button>
          {preview && <button type="button" aria-label="Close Motion preset preview" className={button}
            onClick={invalidate}><X size={13} /></button>}
        </div>
      </div>
      <p className="mt-2 text-[11px] text-[var(--text-muted)]">
        {error || (!selectedIsText ? 'Select a text layer to apply a preset.' :
          (visible.find(item => item.id === activePreset)?.description ?? 'Choose a preset.'))}
        {preview ? ' · Preview only — not saved. Scrub or play the timeline to inspect.' : ''}
      </p>
    </section>
  );
}
