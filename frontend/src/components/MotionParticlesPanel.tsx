import { useEffect, useRef, useState } from 'react';
import { Sparkles, Eye, Save, Loader2 } from 'lucide-react';
import { motionStudioApi, type MotionProject, type MotionParticleInput } from '../services/motionStudioApi';

interface Props {
  workspacePath: string;
  project: MotionProject;
  busy: boolean;
  preview: MotionProject | null;
  onPreview: (next: MotionProject | null) => void;
  onApply: (input: MotionParticleInput) => void;
}
const control = 'rounded border border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1 text-xs';
const button = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] px-2 py-1.5 text-xs disabled:opacity-40';

export function MotionParticlesPanel({ workspacePath, project, busy, preview, onPreview, onApply }: Props) {
  const [kind, setKind] = useState<MotionParticleInput['kind']>('confetti');
  const [count, setCount] = useState(20);
  const [color, setColor] = useState('#38bdf8');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    generation.current++; setPending(false); setError(''); onPreview(null);
    // parent scopes this panel to the authorized project
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspacePath, project.id, project.revision]);
  const reset = () => { generation.current++; setPending(false); setError(''); onPreview(null); };
  const input: MotionParticleInput = { kind, count, color };
  const enabled = !busy && !pending && Number.isSafeInteger(count) && count >= 4 && count <= 36;
  const show = async () => {
    if (!enabled) return;
    const n = ++generation.current;
    setPending(true); setError('');
    try {
      const result = await motionStudioApi.particles(workspacePath, project.id, project.revision, input, true);
      if (n === generation.current) onPreview(result);
    } catch (cause) {
      if (n === generation.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally { if (n === generation.current) setPending(false); }
  };
  return (
    <details aria-label="Motion procedural particle overlays" className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <Sparkles size={14}/> Procedural Particle Accents
        <span className="ml-auto text-[10px] font-normal text-[var(--text-muted)]">
          Confetti · Sparks · Snow · CPU renderer
        </span>
      </summary>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-[10px] text-[var(--text-muted)]">Style
          <select className={control} value={kind} aria-label="Motion particle style"
            disabled={busy || pending} onChange={e => { setKind(e.target.value as MotionParticleInput['kind']); reset(); }}>
            <option value="confetti">Confetti</option><option value="sparks">Sparks</option><option value="snow">Snow</option>
          </select>
        </label>
        <label className="grid gap-1 text-[10px] text-[var(--text-muted)]">Count
          <input className={control + ' w-20'} type="number" min={4} max={36} step={1}
            aria-label="Motion particle count" value={count} disabled={busy || pending}
            onChange={e => { setCount(Number(e.target.value)); reset(); }}/>
        </label>
        <label className="grid gap-1 text-[10px] text-[var(--text-muted)]">Accent color
          <input type="color" aria-label="Motion particle color"
            className="h-7 w-10 rounded border border-[var(--border-color)]" value={color}
            disabled={busy || pending} onChange={e => { setColor(e.target.value); reset(); }}/>
        </label>
        <button type="button" className={button} disabled={!enabled} onClick={() => void show()}>
          {pending ? <Loader2 size={12} className="animate-spin"/> : <Eye size={12}/>} Preview
        </button>
        <button type="button" className={button} disabled={!enabled} onClick={() => { reset(); onApply(input); }}>
          <Save size={12}/> Apply
        </button>
        <span className="text-[10px] text-[var(--text-muted)]">Existing particle overlay replaced · Undo available</span>
      </div>
      {preview && <p className="mt-2 text-xs text-[var(--text-muted)]">Unsaved particle preview on Motion Canvas</p>}
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
    </details>
  );
}
