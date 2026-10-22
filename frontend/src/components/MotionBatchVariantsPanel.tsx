import { useEffect, useState } from 'react';
import { Clapperboard, Loader2, Video } from 'lucide-react';
import {
  motionStudioApi, type MotionProject, type MotionAspectRatio, type MotionBatchResult,
} from '../services/motionStudioApi';

interface Props {
  workspacePath: string;
  project: MotionProject;
  busy: boolean;
  onQueued: (result: MotionBatchResult) => void;
}
const ratios: MotionAspectRatio[] = ['16:9', '1:1', '9:16'];
const button = 'inline-flex items-center gap-1.5 rounded border border-[var(--border-color)] px-3 py-2 text-xs hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40';

export function MotionBatchVariantsPanel({ workspacePath, project, busy, onQueued }: Props) {
  const [selected, setSelected] = useState<MotionAspectRatio[]>(['1:1', '9:16']);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<MotionBatchResult | null>(null);
  useEffect(() => {
    setResult(null); setError(''); setWorking(false);
  }, [workspacePath, project.id, project.revision]);

  const start = async () => {
    if (busy || working || !selected.length) return;
    setWorking(true); setError(''); setResult(null);
    try {
      const output = await motionStudioApi.batchVariants(workspacePath, project.id, project.revision, selected);
      setResult(output);
      onQueued(output);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally { setWorking(false); }
  };
  return (
    <details className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3"
      aria-label="Motion batch aspect variants">
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <Clapperboard size={14} /> Batch Aspect Variants
        <span className="ml-auto text-[10px] font-normal text-[var(--text-muted)]">
          Create separate project copies · Queue MP4 renders
        </span>
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {ratios.map(ratio => (
          <label key={ratio} className="inline-flex items-center gap-1 text-xs">
            <input type="checkbox" checked={selected.includes(ratio)} disabled={busy || working}
              aria-label={'Batch ratio ' + ratio} onChange={event => {
                setSelected(current => event.target.checked
                  ? ratios.filter(item => [...current, ratio].includes(item))
                  : current.filter(item => item !== ratio));
                setResult(null);
              }} />
            {ratio}
          </label>
        ))}
        <button type="button" className={button} disabled={busy || working || selected.length === 0}
          onClick={() => void start()}>
          {working ? <Loader2 size={13} className="animate-spin"/> : <Video size={13}/>}
          Create and queue {selected.length} variant{selected.length === 1 ? '' : 's'}
        </button>
        <span className="text-[10px] text-[var(--text-muted)]">640px preview exports; original project unchanged</span>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-red-400">{error}</p>}
      {result && (
        <div className="mt-2 space-y-1" aria-label="Queued Motion variants">
          {result.variants.map(item => (
            <p className="break-words text-xs" key={item.aspectRatio}>
              <strong>{item.aspectRatio}</strong> · {item.jobStatus === 'queued' ? 'Render queued' :
                item.jobStatus ?? 'No render job'} · {item.projectId ?? 'No new project'}
              {item.error ? ' · ' + item.error : ''}
            </p>
          ))}
          <p className="text-[10px] text-[var(--text-muted)]">
            New projects appear in the scene selector. Check render job status before downloading MP4.
          </p>
        </div>
      )}
    </details>
  );
}
