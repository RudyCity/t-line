import { useEffect, useState } from 'react';
import { History, RotateCcw, Loader2 } from 'lucide-react';
import { studioApi, type StudioRevisionSnapshot } from '../services/studioApi';

interface Props {
  workspacePath: string;
  projectId: string;
  revision: number;
  busy: boolean;
  onRestore: (revision: number) => void;
}

/** Immutable server checkpoints, not a browser-local draft. The project
 * remains saved after a crash even when no editor session is running. */
export function StudioRecoveryPanel({ workspacePath, projectId, revision, busy, onRestore }: Props) {
  const [history, setHistory] = useState<StudioRevisionSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setHistory([]);
    setError('');
    void studioApi.history(workspacePath, projectId).then(result => {
      if (active) setHistory(result.snapshots);
    }).catch(cause => {
      if (active) setError(cause instanceof Error ? cause.message : String(cause));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [workspacePath, projectId, revision]);
  return (
    <details aria-label="Studio project recovery" className="border-b border-[var(--border-color)] bg-[var(--bg-sidebar)] px-4 py-3">
      <summary className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
        <History size={14} /> Auto-saved revisions
        <span className="rounded border border-[var(--border-color)] px-1.5 py-0.5 text-[10px] font-normal">
          {history.length} snapshots
        </span>
        <span className="ml-auto text-[10px] font-normal text-[var(--text-muted)]">Restore via revision-checked save</span>
      </summary>
      <div className="mt-2 grid gap-2">
        {loading && <span className="inline-flex items-center gap-2 text-xs"><Loader2 className="animate-spin" size={12}/>Loading previous revisions…</span>}
        {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
        {!loading && !history.length && !error && <p className="text-xs text-[var(--text-muted)]">Older revisions appear after the next saved edit.</p>}
        {history.map(item => (
          <div key={item.revision} className="flex items-center justify-between gap-3 rounded border border-[var(--border-color)] p-2">
            <span className="text-xs">
              <strong>Revision {item.revision}</strong>
              <span className="ml-2 text-[var(--text-muted)]">{new Date(item.updatedAt).toLocaleString()}</span>
            </span>
            <button type="button" disabled={busy || loading} onClick={() => onRestore(item.revision)}
              aria-label={'Restore Studio revision ' + item.revision}
              className="inline-flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1 text-xs hover:bg-[var(--surface-overlay-hover)] disabled:opacity-40">
              <RotateCcw size={12}/> Restore
            </button>
          </div>
        ))}
      </div>
    </details>
  );
}
