import { useCallback, useEffect, useState } from 'react';
import { Brain, FileText, FolderOpen, RefreshCw, X, AlertTriangle, Clock3 } from 'lucide-react';
import { getAuthHeader } from './SuperAgentConsoleUtils';

type BrainSession = { sessionId: string; createdAt: string; updatedAt: string };
type BrainFile = { path: string; bytes: number };
type BrainJob = { jobId: string; cli: string; status: string; completionState: string; startedAt: number; updatedAt: number };
type StorageArea = { area: 'scratch' | 'artifacts' | 'evidence'; files: number; bytes: number; lastModifiedAt: string | null };
type StorageInfo = { totalBytes: number; areas: StorageArea[] };
type RegisteredProject = { id: string; name: string };
type RetentionPreview = { days: number; autoDelete: false; dryRun: true; partial?: boolean; candidates: Array<{sessionId: string; scratchFiles: number; scratchBytes: number }> ; totalCandidateBytes: number };

async function readApi<T>(url: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(url, { headers: getAuthHeader(), signal, cache: 'no-store' });
  if (!response.ok) {
    const info = await response.json().catch(() => null);
    throw new Error(info?.error || `Brain request failed (HTTP ${response.status})`);
  }
  return response.json() as Promise<T>;
}

async function sendBrainAction<T>(url: string, body: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(url, {
    method: 'POST', headers: { ...getAuthHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body), cache: 'no-store',
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Brain operation failed (' + response.status + ')');
  return data as T;
}
const formatBytes = (n: number) => n >= 1048576 ? (n / 1048576).toFixed(1) + ' MiB' : n >= 1024 ? (n / 1024).toFixed(1) + ' KiB' : n + ' B';

export function SuperAgentBrainExplorer({ activeSessionId, onClose }: {
  activeSessionId: string;
  onClose: () => void;
}) {
  const [sessions, setSessions] = useState<BrainSession[]>([]);
  const [selected, setSelected] = useState('');
  const [files, setFiles] = useState<BrainFile[]>([]);
  const [jobs, setJobs] = useState<BrainJob[]>([]);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [projects, setProjects] = useState<RegisteredProject[]>([]);
  const [retentionDays, setRetentionDays] = useState<7 | 30 | 90>(30);
  const [retention, setRetention] = useState<RetentionPreview | null>(null);
  const [publishProjectId, setPublishProjectId] = useState('');
  const [destinationPath, setDestinationPath] = useState('');
  const [busyAction, setBusyAction] = useState<'cleanup' | 'publish' | 'download' | 'upload' | null>(null);
  const [notice, setNotice] = useState('');
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
    setStorage(null);
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
    readApi<StorageInfo>(
      `/api/superagent/brain/sessions/${encodeURIComponent(selected)}/storage`,
      ctrl.signal,
    ).then(setStorage)
      .catch(err => { if (!ctrl.signal.aborted) setError(err.message || 'Could not load Brain storage.'); });
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

  useEffect(() => {
    const ctrl = new AbortController();
    readApi<{ projects: RegisteredProject[] }>('/api/superagent/brain/projects', ctrl.signal)
      .then(({ projects: available }) => {
        const verified = Array.isArray(available) ? available.filter(p => typeof p?.id === 'string' && typeof p.name === 'string') : [];
        setProjects(verified);
        setPublishProjectId(current => verified.some(p => p.id === current) ? current : verified[0]?.id || '');
      })
      .catch(err => { if (!ctrl.signal.aborted) setError(err.message || 'Could not load permitted project list.'); });
    return () => ctrl.abort();
  }, [refreshId]);

  useEffect(() => {
    const ctrl = new AbortController();
    readApi<RetentionPreview>(
      `/api/superagent/brain/retention/preview?days=${retentionDays}`, ctrl.signal,
    ).then(value => setRetention(value && Array.isArray(value.candidates) ? value : null))
      .catch(err => { if (!ctrl.signal.aborted) setError(err.message || 'Retention preview failed.'); });
    return () => ctrl.abort();
  }, [retentionDays, refreshId]);

  const cleanScratch = async () => {
    if (!selected || busyAction) return;
    setBusyAction('cleanup'); setError(''); setNotice('');
    try {
      const base = `/api/superagent/brain/sessions/${encodeURIComponent(selected)}/cleanup`;
      const prepared = await sendBrainAction<{ challenge: string; preview: { bytes: number; files: number; retained: string[] } }>(base + '/prepare');
      if (!window.confirm(`Delete ${prepared.preview.files} scratch files (${formatBytes(prepared.preview.bytes)}) in session ${selected}? Artifacts and evidence will be retained.`)) return;
      await sendBrainAction(base + '/confirm', { challenge: prepared.challenge });
      setNotice('Scratch cleaned; artifacts and evidence preserved.');
      refresh();
    } catch (e: any) { setError(e.message || 'Cleanup failed.'); }
    finally { setBusyAction(null); }
  };
  const publish = async () => {
    if (!selected || !selectedFile.startsWith('artifacts/') || !publishProjectId || busyAction) return;
    setBusyAction('publish'); setError(''); setNotice('');
    try {
      const base = `/api/superagent/brain/sessions/${encodeURIComponent(selected)}/publish`;
      const payload = { projectId: publishProjectId, filePath: selectedFile, destinationPath: destinationPath.trim() };
      const prepared = await sendBrainAction<{ challenge: string; preview: { bytes: number; destinationPath: string; projectRoot: string; overwrite: boolean } }>(base + '/prepare', payload);
      if (!window.confirm(`Publish ${selectedFile} (${formatBytes(prepared.preview.bytes)}) to ${prepared.preview.projectRoot} / ${prepared.preview.destinationPath}? Existing files will never be overwritten.`)) return;
      await sendBrainAction(base + '/confirm', { challenge: prepared.challenge, projectId: publishProjectId });
      setNotice('Artifact published to the selected local project.');
      refresh();
    } catch (e: any) { setError(e.message || 'Publish failed.'); }
    finally { setBusyAction(null); }
  };
  const importArtifact = async (file: File) => {
    if (!selected || busyAction) return;
    setBusyAction('upload'); setError(''); setNotice('');
    try {
      if (file.size > 5 * 1024 * 1024 || file.size === 0) throw new Error('File must be between 1 byte and 5 MiB.');
      const url = `/api/superagent/brain/sessions/${encodeURIComponent(selected)}/artifacts/import?name=${encodeURIComponent(file.name)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { ...getAuthHeader(), 'Content-Type': 'application/octet-stream' },
        body: file,
      });
      if (!response.ok) {
        const info = await response.json().catch(() => null);
        throw new Error(info?.error || 'Artifact import rejected (' + response.status + ')');
      }
      setNotice('Artifact imported into current Brain session.');
      refresh();
    } catch (e: any) { setError(e.message || 'Artifact import failed.'); }
    finally { setBusyAction(null); }
  };
  const downloadArtifact = async () => {
    if (!selected || !(selectedFile.startsWith('artifacts/') || selectedFile.startsWith('evidence/')) || busyAction) return;
    setBusyAction('download'); setError('');
    try {
      const url = `/api/superagent/brain/sessions/${encodeURIComponent(selected)}/download?path=${encodeURIComponent(selectedFile)}`;
      const response = await fetch(url, { headers: getAuthHeader(), cache: 'no-store' });
      if (!response.ok) throw new Error('Download unavailable (' + response.status + ')');
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a'); link.href = objectUrl;
        link.download = selectedFile.split('/').pop() || 'brain-artifact';
        document.body.appendChild(link); link.click(); link.remove();
      } finally { URL.revokeObjectURL(objectUrl); }
    } catch (e: any) { setError(e.message || 'Download failed.'); }
    finally { setBusyAction(null); }
  };

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
        Local CLI Brain · session-scoped storage. Project publication requires two registered workspaces and confirmation.
      </div>
      {notice && <p role="status" className="mx-4 mt-2 text-xs text-emerald-400">{notice}</p>}
      {error && <div role="alert" className="mx-4 mt-3 text-xs p-3 border border-red-500/30 rounded text-red-400 flex gap-2"><AlertTriangle size={15} /> {error}</div>}
      <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[minmax(180px,0.75fr)_minmax(0,1fr)]">
        <div className="border-r border-[var(--border-color)] overflow-y-auto min-h-0">
          <div className="uppercase text-[10px] tracking-wide text-[var(--text-muted)] font-medium p-3 border-b border-[var(--border-color)]">Sessions {pending ? '…' : `(${sessions.length})`}</div>
          <div className="p-3 text-xs border-b border-[var(--border-color)]">
            <label className="flex flex-wrap items-center gap-2">
              Retention preview
              <select aria-label="Retention threshold" value={retentionDays}
                onChange={e => setRetentionDays(Number(e.target.value) as 7 | 30 | 90)}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1">
                <option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option>
              </select>
            </label>
            <p className="mt-1 text-[var(--text-muted)]">
              {retention ? `${retention.candidates.length} candidates · ${formatBytes(retention.totalCandidateBytes)} · dry-run only` : 'Calculating storage age…'}
            </p>
            {retention?.partial && <p className="text-amber-400">Partial retention scan</p>}
            {retention?.candidates.map(entry => (
              <button key={entry.sessionId} type="button"
                className="block text-left text-[11px] mt-1 underline text-[var(--color-primary)]"
                onClick={() => setSelected(entry.sessionId)}>
                {entry.sessionId} · {formatBytes(entry.scratchBytes)}
              </button>
            ))}
          </div>
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
          <div className="border-b border-[var(--border-color)] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold">Storage {storage ? formatBytes(storage.totalBytes) : '—'}</p>
              <button type="button" disabled={!selected || !!busyAction} onClick={cleanScratch}
                className="px-2 py-1 border border-[var(--border-color)] rounded hover:border-amber-500/70 disabled:opacity-40 text-[11px]">
                {busyAction === 'cleanup' ? 'Cleaning…' : 'Preview cleanup'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(storage?.areas || []).map(area => <div key={area.area} className="bg-[var(--bg-card)] rounded px-2 py-1 text-[10px]">
                <p className="capitalize text-[var(--text-muted)]">{area.area}</p>
                <p className="font-mono">{formatBytes(area.bytes)} · {area.files} files</p>
              </div>)}
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">Only scratch can be cleaned. Artifacts and evidence are retained; no scheduled deletion.</p>
          </div>
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
          <div className="p-3 text-xs border-b border-[var(--border-color)] flex flex-wrap gap-2 justify-between items-center">
            <span className="font-medium">Files {files.length > 0 ? `(${files.length})` : ''}</span>
            <label className="cursor-pointer border border-[var(--border-color)] px-2 py-1 rounded hover:border-[var(--color-primary)]">
              {busyAction === 'upload' ? 'Importing…' : 'Import artifact (5 MiB max)'}
              <input aria-label="Import Brain artifact" type="file" className="sr-only" disabled={!selected || !!busyAction}
                accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.zip,.mp4,.webm,.wav,.mp3,.csv,.json,.txt"
                onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void importArtifact(file); }} />
            </label>
            <span className="text-[var(--text-muted)]">max 128 KiB text preview</span>
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
            {(selectedFile.startsWith('artifacts/') || selectedFile.startsWith('evidence/')) && <button
              type="button" disabled={!!busyAction} onClick={downloadArtifact}
              className="px-2 py-1 mb-3 text-[11px] rounded bg-[var(--bg-card)] border border-[var(--border-color)] disabled:opacity-50">
              {busyAction === 'download' ? 'Downloading…' : 'Download (max 20 MiB)'}
            </button>}
            {selectedFile.startsWith('artifacts/') && (
              <div className="flex flex-wrap items-end gap-2 mb-3">
                <label className="text-[11px] text-[var(--text-muted)]">
                  Publish to
                  <select aria-label="Target registered project" value={publishProjectId}
                    onChange={e => setPublishProjectId(e.target.value)}
                    className="block min-w-28 mt-1 p-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded">
                    {projects.length === 0 && <option value="">No permitted projects</option>}
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="text-[11px] text-[var(--text-muted)]">
                  Destination (relative path)
                  <input aria-label="Destination relative path" value={destinationPath} onChange={e => setDestinationPath(e.target.value)}
                    placeholder="docs/report.md"
                    className="block mt-1 p-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded w-40" />
                </label>
                <button type="button" disabled={!publishProjectId || !destinationPath.trim() || !!busyAction}
                  onClick={publish} className="px-2 py-1 rounded border border-[var(--color-primary)] text-[11px] disabled:opacity-40">
                  {busyAction === 'publish' ? 'Publishing…' : 'Preview publish'}
                </button>
              </div>
            )}
            <pre data-testid="brain-preview" className="text-[11px] leading-relaxed font-mono whitespace-pre-wrap break-words select-text text-[var(--text-muted)]">{preview}</pre>
          </div>
        </div>
      </div>
    </section>
  );
}
