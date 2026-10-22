import { useEffect, useRef, useState } from 'react';
import { AudioLines, Eye, Save, Loader2 } from 'lucide-react';
import {
  motionStudioApi, type MotionProject, type MotionBeatSyncInput, type MotionBeatSyncResult,
} from '../services/motionStudioApi';

interface Props {
  workspacePath: string;
  project: MotionProject;
  selectedLayer: string | null;
  busy: boolean;
  preview: MotionProject | null;
  onPreview: (project: MotionProject | null) => void;
  onApply: (input: MotionBeatSyncInput) => void;
}
const control = 'rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-xs';
const btn = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] px-2 py-1.5 text-xs hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40';

export function MotionBeatSyncPanel({ workspacePath, project, selectedLayer, busy, preview, onPreview, onApply }: Props) {
  const clips = project.composition.audioTracks ??
    (project.composition.audio ? [project.composition.audio] : []);
  const [audioTrackIndex, setAudioTrackIndex] = useState(0);
  const [intensity, setIntensity] = useState(.35);
  const [pending, setPending] = useState(false);
  const [onsets, setOnsets] = useState<number[]>([]);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current++; setPending(false); setOnsets([]); setError(''); onPreview(null);
    // Snapshot changes invalidate previews. Parent scopes editor to project ID.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacePath, project.id, project.revision, selectedLayer]);
  const cancelPreview = () => {
    generation.current++; setOnsets([]); setPending(false); setError(''); onPreview(null);
  };
  const valid = clips.length > 0 && !!selectedLayer && !busy && !pending;
  const input: MotionBeatSyncInput = {
    targetLayerId: selectedLayer ?? '', audioTrackIndex, intensity,
  };
  const previewSync = async () => {
    if (!valid) return;
    const sequence = ++generation.current; setPending(true); setError('');
    try {
      const result: MotionBeatSyncResult = await motionStudioApi.beatSync(
        workspacePath, project.id, project.revision, input, true);
      if (generation.current === sequence) {
        setOnsets(result.onsetFrames);
        onPreview(result.project);
      }
    } catch (cause) {
      if (generation.current === sequence) setError(cause instanceof Error ? cause.message : String(cause));
    } finally { if (generation.current === sequence) setPending(false); }
  };
  const apply = () => { if (valid) { cancelPreview(); onApply(input); } };
  return (
    <details aria-label="Motion audio beat sync" className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <AudioLines size={14}/> Audio Beat Sync
        <span className="ml-auto text-[10px] font-normal text-[var(--text-muted)]">
          Detect local WAV transients · Preview · Apply opacity pulses
        </span>
      </summary>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[10px] text-[var(--text-muted)]">Audio clip
          <select aria-label="Beat sync audio clip" className={control} disabled={busy}
            value={audioTrackIndex} onChange={event => { setAudioTrackIndex(Number(event.target.value)); cancelPreview(); }}>
            {clips.map((clip, i) => <option key={clip.assetId + i} value={i}>Clip {i + 1} · {clip.role ?? 'audio'}</option>)}
            {!clips.length && <option value={0}>No WAV attached</option>}
          </select>
        </label>
        <label className="grid gap-1 text-[10px] text-[var(--text-muted)]">Pulse intensity
          <input aria-label="Beat sync intensity" type="number" min={.1} max={.8} step={.05}
            className={control + ' w-24'} value={intensity} disabled={busy}
            onChange={event => { setIntensity(Number(event.target.value)); cancelPreview(); }}/>
        </label>
        <button type="button" className={btn} disabled={!valid || intensity < .1 || intensity > .8}
          onClick={() => void previewSync()}>{pending ? <Loader2 size={13} className="animate-spin"/> : <Eye size={13}/>} Preview beats</button>
        <button type="button" className={btn} disabled={!valid || intensity < .1 || intensity > .8}
          onClick={apply}><Save size={13}/> Apply beat sync</button>
        <span className="text-[10px] text-[var(--text-muted)]">
          Target: {selectedLayer ?? 'select a layer'} · Replaces its opacity track · Undo available
        </span>
      </div>
      {onsets.length > 0 && <p className="mt-2 text-[11px] text-[var(--text-muted)]">
        {onsets.length} transient(s) found; first at frames {onsets.slice(0, 8).join(', ')}
        {preview ? ' · Unsaved preview' : ''}
      </p>}
      {error && <p className="mt-2 text-xs text-red-400" role="alert">{error}</p>}
    </details>
  );
}
