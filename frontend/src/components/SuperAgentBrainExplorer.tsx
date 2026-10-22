import { useCallback, useEffect, useState } from 'react';
import { Brain, FileText, FolderOpen, RefreshCw, X, AlertTriangle, Clock3 } from 'lucide-react';
import { getAuthHeader } from './SuperAgentConsoleUtils';

type BrainSession = { sessionId: string; createdAt: string; updatedAt: string };
type BrainFile = { path: string; bytes: number };
type BrainJob = { jobId: string; cli: string; status: string; completionState: string; startedAt: number; updatedAt: number };

async function readApi<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { headers: getAuthHeader(), signal, cache: 'no-store' });
  if (!response.ok) {
    const info = await response.json().catch(() => null);
    throw new Error(info?.error || `Brain request failed (HTTP ${response.status})`);
  }
  return response.json() as Promise<T>;
}

export function SuperAgentBrainExplorer({ activeSessionId, onClose }: {
  activeSessionId: string;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<BrainSession[]>([]);
  const [selected, setSelected] = useState('');
  const [files, setFiles] = useState<BrainFile[]>([]);
  const [jobs, setJobs] = useState<BrainJob[]>([]);
  const [selectedFile, setSelectedFile] = useState('');
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [refreshId, setRefreshId] = useState(0);
  const refresh = useCallback(() => setRefreshId(id => id + 1), []);

  useEffect(() => {
    const ctrl = new AbortController();
    setPending(true);
    setError('');
    readApi<{ sessions: BrainSession[] }>('/api/superagent/brain/sessions', ctrl.signal)
      .then(({ sessions: entries }) => {
        setSessions(entries);
        setSelected(previous => entries.some(entry => entry.sessionId === previous) ? previous
          : entries.find(entry => entry.sessionId === activeSessionId)?.sessionId || entries[0]?.sessionId || '');
      })
      .catch(err => { if (!ctrl.signal.aborted) setError(err.message || 'Could not list Brain sessions.'); })
      .finally(() => { if (!ctrl.signal.aborted) setPending(false); });
    return () => ctrl.abort();
  }, [activeSessionId, refreshId]);

  useEffect(() => {
    const ctrl = new AbortController();
    setFiles([]);
    setJobs([]);
    setSelectedFile('');
    setPreview('');
    if (!selected) return () => ctrl.abort();
    readApi<{ files: BrainFile[] }>(
      `/api/superagent/brain/sessions/${encodeURIComponent(selected)}/files`,
      ctrl.signal,
    ).then(data => setFiles(data.files))
      .catch(err => { if (!ctrl.signal.aborted) setError(err.message || 'Could not load Brain files.'); });
    readApi<{ jobs: BrainJob[] }>(
      `/api/superagent/brain/sessions/${encodeURIComponent(selected)}/jobs`,
      ctrl.signal,
    ).then(data => setJobs(data.jobs))
      .catch(err => { if (!ctrl.signal.aborted) setError(err.message || 'Could not load delegation snapshots.'); });
    return () => ctrl.abort();
  }, [selected, refreshId]);

  useEffect(() => {
    const ctrl = new AbortController();
    setPreview('');
    if (!selected || !selectedFile) return () => ctrl.abort();
    readApi<{ content: string }>(
      `/api/superagent/brain/sessions/${encodeURIComponent(selected)}/file?path=${encodeURIComponent(selectedFile)}`,
      ctrl.signal,
    ).then(result => setPreview(result.content))
      .catch(err => { if (!ctrl.signal.aborted) setPreview(err.message || 'Preview unavailable.'); });
    return () => ctrl.abort();
  }, [selected, selectedFile, refreshId]);

  return (
    <section aria-label="Brain Explorer" className="h-full w-full flex flex-col bg-[var(--bg-main)] text-[var(--text-main)] border-l border-[var(--border-color)] shadow-xl">
      <header className="shrink-0 p-4 border-b border-[var(--border-color)] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Brain size={18} className="text-[var(--color-primary)] shrink-0" />
          <div>
            <h2 className="font-semibold text-sm">Brain Explorer</h2>
            <p className="text-[11px] text-[var(--text-muted)]">Session scratch · artifacts · evidence</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={refresh} title="Refresh Brain Explorer" aria-label="Refresh Brain Explorer" className="p-2 rounded hover:bg-[var(--bg-card)]"><RefreshCw size={15} /></button>
          <button type="button" onClick={onClose} aria-label="Close Brain Explorer" title="Close Brain Explorer" className="p-2 rounded hover:bg-[var(--bg-card)]"><X size={16} /></button>
        </div>
      </header>
      <div className="px-4 py-2 bg-[var(--bg-card)] text-xs text-[var(--text-muted)]">
        Read-only local CLI Brain. Project files and MCP identities remain isolated.
      </div>
      {error && <div role="alert" className="mx-4 mt-3 text-xs p-3 border border-red-500/30 rounded text-red-400 flex gap-2"><AlertTriangle size={15} /> {error}</div>}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(180px,0.75fr)_minmax(0,1fr)]">
        <div className="border-r border-[var(--border-color)] overflow-y-auto min-h-0">
          <div className="uppercase text-[10px] tracking-wide text-[var(--text-muted)] font-medium p-3 border-b border-[var(--border-color)]">Sessions {pending ? '…' : `(${sessions.length})`}</div>
          {sessions.length === 0 && !pending && <p className="p-4 text-xs text-[var(--text-muted)]">No Brain sessions found yet. Start a chat or run /brain create.</p>}
          {sessions.map(item => (
            <button type="button" key={item.sessionId} onClick={() => setSelected(item.sessionId)}
              className={`text-left w-full px-3 py-2 border-b border-[var(--border-color)] hover:bg-[var(--bg-card)] ${selected === item.sessionId ? 'bg-[var(--color-primary-glow)]' : ''}`}>
              <div className="flex gap-2 items-center text-xs font-mono break-all"><FolderOpen size={13} className="shrink-0 text-[var(--color-primary)]" /> {item.sessionId}</div>
              <div className="flex gap-1 items-center mt-1 ml-5 text-[10px] text-[var(--text-muted)]"><Clock3 size={11}/>{new Date(item.updatedAt).toLocaleString()}</div>
            </button>
          ))}
        </div>
        <div className="min-h-0 flex flex-col">
          <div className="border-b border-[var(--border-color)] p-3">
            <p className="text-xs font-medium mb-2">Delegation snapshots {jobs.length ? `(${jobs.length})` : ''}</p>
            {jobs.length === 0 ? <p className="text-[11px] text-[var(--text-muted)]">No persisted Brain delegations for this session.</p> :
              <div className="max-h-28 overflow-y-auto space-y-1">
                {jobs.map(job => <div key={job.jobId} className="flex gap-2 items-center justify-between text-[11px] bg-[var(--bg-card)] px-2 py-1 rounded">
                  <span className="font-mono truncate">{job.cli} · {job.jobId}</span>
                  <span className="shrink-0 text-[var(--text-muted)]">{job.status} · {job.completionState}</span>
                </div>)}
              </div>}
            <p className="text-[10px] mt-1 text-[var(--text-muted)]">Last recorded state; not a live process guarantee.</p>
          </div>
          <div className="p-3 text-xs border-b border-[var(--border-color)] flex justify-between">
            <span className="font-medium">Files {files.length > 0 ? `(${files.length})` : ''}</span>
            <span className="text-[var(--text-muted)]">max 128 KiB preview</span>
          </div>
          <div className="overflow-y-auto max-h-[38%] border-b border-[var(--border-color)] min-h-[76px]">
            {selected && !files.length && <p className="p-3 text-xs text-[var(--text-muted)]">No scratch, artifact or evidence files.</p>}
            {files.map(file => <button type="button" key={file.path} onClick={() => setSelectedFile(file.path)}
              className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--bg-card)] flex gap-2 ${selectedFile === file.path ? 'text-[var(--color-primary)] bg-[var(--color-primary-glow)]' : ''}`}>
              <FileText size={13} className="shrink-0 mt-0.5"/>
              <span className="min-w-0 break-all font-mono">{file.path}</span>
              <span className="shrink-0 ml-auto text-[10px] text-[var(--text-muted)]">{file.bytes} B</span>
            </button>)}
          </div>
          <div className="flex-1 overflow-auto p-3 min-h-0">
            <p className="text-xs font-medium mb-2 truncate">{selectedFile || 'Select a file to preview'}</p>
            <pre data-testid="brain-preview" className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words select-text text-[var(--text-muted)]">{preview}</pre>
          </div>
        </div>
      </div>
    </section>
  );
}
