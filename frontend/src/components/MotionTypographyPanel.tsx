import { useEffect, useRef, useState } from 'react';
import { Type, Eye, Save, Loader2 } from 'lucide-react';
import { motionStudioApi, type MotionProject, type MotionTypographyInput } from '../services/motionStudioApi';

interface Props {
  workspacePath: string;
  project: MotionProject;
  selectedLayer: string | null;
  busy: boolean;
  preview: MotionProject | null;
  onPreview: (next: MotionProject | null) => void;
  onApply: (input: MotionTypographyInput) => void;
}
const inputClass = 'rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-xs';
const button = 'inline-flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1.5 text-xs disabled:opacity-40';

export function MotionTypographyPanel({ workspacePath, project, selectedLayer, busy, preview, onPreview, onApply }: Props) {
  const [style, setStyle] = useState<MotionTypographyInput['style']>('letter-reveal');
  const [startFrame, setStartFrame] = useState(0);
  const [durationFrames, setDurationFrames] = useState(Math.min(60, project.composition.durationFrames));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const layer = project.composition.layers.find(item => item.id === selectedLayer && item.kind === 'text');
  useEffect(() => {
    generation.current++;
    setPending(false); setError(''); setStartFrame(0);
    setDurationFrames(Math.min(60, project.composition.durationFrames));
    onPreview(null);
    // Project identity or source revision invalidates the unsaved preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacePath, project.id, project.revision, selectedLayer]);
  const invalidate = () => {
    generation.current++; setPending(false); setError(''); onPreview(null);
  };
  const input: MotionTypographyInput = { targetLayerId: selectedLayer ?? '', style, startFrame, durationFrames };
  const valid = Boolean(layer && !busy && !pending && Number.isSafeInteger(startFrame) &&
    startFrame >= 0 && startFrame < project.composition.durationFrames &&
    Number.isSafeInteger(durationFrames) && durationFrames >= 1 &&
    durationFrames + startFrame <= project.composition.durationFrames);
  const show = async () => {
    if (!valid) return;
    const serial = ++generation.current; setPending(true); setError('');
    try {
      const result = await motionStudioApi.typography(workspacePath, project.id, project.revision, input, true);
      if (serial === generation.current) onPreview(result);
    } catch (cause) {
      if (serial === generation.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally { if (serial === generation.current) setPending(false); }
  };
  return (
    <details aria-label="Motion advanced typography" className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <Type size={14}/> Advanced Typography
        <span className="ml-auto text-[10px] font-normal text-[var(--text-muted)]">
          Per-letter reveal · Word rise · Native text layers
        </span>
      </summary>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[10px] text-[var(--text-muted)]">Animation style
          <select className={inputClass} aria-label="Motion typography style" value={style}
            disabled={busy || pending} onChange={e => { setStyle(e.target.value as MotionTypographyInput['style']); invalidate(); }}>
            <option value="letter-reveal">Letter Reveal</option><option value="word-rise">Word Rise</option>
          </select>
        </label>
        <label className="grid gap-1 text-[10px] text-[var(--text-muted)]">Start frame
          <input className={inputClass + ' w-20'} aria-label="Typography start frame" type="number" min={0} step={1}
            disabled={busy || pending} value={startFrame}
            onChange={e => { setStartFrame(Number(e.target.value)); invalidate(); }}/>
        </label>
        <label className="grid gap-1 text-[10px] text-[var(--text-muted)]">Duration frames
          <input className={inputClass + ' w-24'} aria-label="Typography duration" type="number" min={1} step={1}
            disabled={busy || pending} value={durationFrames}
            onChange={e => { setDurationFrames(Number(e.target.value)); invalidate(); }}/>
        </label>
        <button className={button} type="button" disabled={!valid} onClick={() => void show()}>
          {pending ? <Loader2 size={12} className="animate-spin"/> : <Eye size={12}/>} Preview
        </button>
        <button className={button} type="button" disabled={!valid} onClick={() => { invalidate(); onApply(input); }}>
          <Save size={12}/> Apply
        </button>
        <span className="text-[10px] text-[var(--text-muted)]">
          Target {selectedLayer ?? 'select a text layer'} · Undo restores original text layer
        </span>
      </div>
      {preview && <p className="mt-2 text-xs text-[var(--text-muted)]">Unsaved preview · no project changes</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    </details>
  );
}
