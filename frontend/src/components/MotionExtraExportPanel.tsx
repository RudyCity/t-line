import { useEffect, useRef, useState } from 'react';
import { Download, Loader2, FileVideo2 } from 'lucide-react';
import { motionStudioApi } from '../services/motionStudioApi';

interface Props {
  workspacePath: string;
  jobId: string;
  filename: string;
}
const formats = ['gif', 'webm'] as const;
export function MotionExtraExportPanel({ workspacePath, jobId, filename }: Props) {
  const [pending, setPending] = useState<'gif' | 'webm' | null>(null);
  const [error, setError] = useState('');
  const [urls, setUrls] = useState<Partial<Record<'gif' | 'webm', string>>>({});
  const refs = useRef<string[]>([]);
  const generation = useRef(0);
  useEffect(() => {
    const serial = ++generation.current;
    setPending(null); setError(''); setUrls({});
    const previous = refs.current;
    refs.current = [];
    previous.forEach(url => URL.revokeObjectURL?.(url));
    return () => {
      if (generation.current === serial) generation.current++;
      refs.current.forEach(url => URL.revokeObjectURL?.(url));
      refs.current = [];
    };
  }, [workspacePath, jobId]);
  const exportOne = async (format: 'gif' | 'webm') => {
    if (pending || urls[format]) return;
    const seq = generation.current;
    setPending(format); setError('');
    try {
      const url = await motionStudioApi.loadExtraExport(workspacePath, jobId, format);
      if (seq !== generation.current) { URL.revokeObjectURL?.(url); return; }
      refs.current.push(url);
      setUrls(current => ({ ...current, [format]: url }));
    } catch (cause) {
      if (seq === generation.current) setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (seq === generation.current) setPending(null);
    }
  };
  return (
    <div aria-label="Motion extra export formats" className="flex flex-wrap items-center gap-2 border-t border-[var(--border-color)] px-3 py-2">
      <FileVideo2 size={13} className="text-[var(--color-primary)]"/>
      <span className="text-xs text-[var(--text-muted)]">Other formats (clips ≤20s)</span>
      {formats.map(format => urls[format] ? (
        <a key={format} href={urls[format]} download={filename + '.' + format}
          className="inline-flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1 text-xs">
          <Download size={12}/> Download {format.toUpperCase()}
        </a>
      ) : (
        <button key={format} type="button" disabled={Boolean(pending)}
          className="inline-flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1 text-xs disabled:opacity-40"
          onClick={() => void exportOne(format)}>
          {pending === format && <Loader2 size={12} className="animate-spin"/>}
          Convert to {format.toUpperCase()}
        </button>
      ))}
      {error && <p role="alert" className="basis-full text-xs text-red-400">{error}</p>}
    </div>
  );
}
