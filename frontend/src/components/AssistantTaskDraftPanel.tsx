import { useEffect, useState } from 'react';
import { ListTodo, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import {
  addAssistantDraft, cancelAssistantDraft, getAssistantDrafts,
  runAssistantReadOnlyTask, getAssistantTaskResult, prepareAssistantPatch,
  getAssistantPatch, reconcileAssistantTask, type AssistantDraftTask,
  type AssistantTaskDomain, type AssistantTaskDomainDescriptor,
} from './AssistantTaskDraftApi';
import { getAuthHeader } from './SuperAgentConsoleUtils';

/** Explicit, scope-bound work launched in Core; never auto-executes drafts. */
export function AssistantTaskDraftPanel({ workspace, sessionId }: {
  workspace: string; sessionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<AssistantTaskDomain>('general');
  const [domains, setDomains] = useState<AssistantTaskDomainDescriptor[]>([]);
  const [drafts, setDrafts] = useState<AssistantDraftTask[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [patchEnabled, setPatchEnabled] = useState(false);
  const [liveIds, setLiveIds] = useState<string[]>([]);
  const [unverifiedIds, setUnverifiedIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ taskId: string; text: string } | null>(null);

  useEffect(() => {
    setDrafts([]); setTitle(''); setError(''); setResult(null);
    setLiveIds([]); setUnverifiedIds([]); setEnabled(false); setPatchEnabled(false);
    setDomains([]);
    if (!open || !workspace || !sessionId) return;
    const controller = new AbortController();
    let alive = true;
    const load = async () => {
      try {
        const snapshot = await getAssistantDrafts(workspace, sessionId, getAuthHeader, controller.signal);
        if (!alive) return;
        setDrafts(snapshot.tasks);
        const supported = snapshot.domains?.length ? snapshot.domains :
          [{ id: 'analysis' as const, label: 'Analysis',
            description: 'Read-only analysis (older Core)', patchPreview: false }];
        setDomains(supported);
        setDomain(previous => supported.some(item => item.id === previous) ?
          previous : supported[0].id);
        setEnabled(snapshot.executionEnabled === true &&
          snapshot.executionPolicy === 'read-only-explicit-run');
        setPatchEnabled(snapshot.executionEnabled === true &&
          snapshot.supportedModes?.includes('patch-preview') === true);
        setLiveIds(snapshot.liveTaskIds || []);
        setUnverifiedIds(snapshot.unverifiedTaskIds || []);
        setError('');
      } catch (cause) {
        if (alive && !controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Unable to inspect tasks');
        }
      }
    };
    void load();
    const interval = window.setInterval(() => { if (!document.hidden) void load(); }, 3000);
    return () => { alive = false; controller.abort(); clearInterval(interval); };
  }, [open, workspace, sessionId, refresh]);

  const addDraft = async () => {
    const trimmed = title.trim();
    if (!workspace || !sessionId || !trimmed || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const id = crypto.randomUUID();
      await addAssistantDraft(workspace, sessionId, trimmed, getAuthHeader, id, domain);
      setTitle('');
      setRefresh(n => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add task');
    } finally { setSaving(false); }
  };

  const start = async (task: AssistantDraftTask) => {
    if (saving || !enabled || task.status !== 'queued') return;
    if (!window.confirm('Run this task using a separate read-only assistant? File writes, shell commands and interactive approvals are disabled.')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await runAssistantReadOnlyTask(workspace, sessionId, task.taskId, task.revision, getAuthHeader);
      setNotice('Task scheduled independently. You can continue chatting.');
      setRefresh(n => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to run task');
    } finally { setSaving(false); }
  };

  const cancel = async (task: AssistantDraftTask) => {
    if (saving || !['queued', 'planning', 'running'].includes(task.status)) return;
    if (!window.confirm(task.status === 'queued'
      ? 'Cancel this queued draft? No agent execution was started.'
      : 'Request cancellation of this running task? The worker may require time to stop.')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await cancelAssistantDraft(workspace, sessionId, task.taskId, task.revision, getAuthHeader);
      setNotice(task.status === 'queued' ? 'Draft cancelled.' : 'Cancellation requested.');
      setRefresh(n => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Cancellation failed');
    } finally { setSaving(false); }
  };

  const view = async (task: AssistantDraftTask) => {
    if (saving || task.status !== 'completed') return;
    setSaving(true); setError('');
    try {
      const response = await getAssistantTaskResult(workspace, sessionId, task.taskId, getAuthHeader);
      setResult({ taskId: task.taskId, text: response.result });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Result unavailable');
    } finally { setSaving(false); }
  };

  const preparePatch = async (task: AssistantDraftTask) => {
    if (saving || !patchEnabled || task.status !== 'queued') return;
    if (!window.confirm('Prepare an isolated Git patch proposal? Only tracked source/test files may change in a separate worktree. Nothing will be merged automatically.')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await prepareAssistantPatch(workspace, sessionId, task.taskId, task.revision, getAuthHeader);
      setNotice('Patch proposal started in an isolated worktree; continue chatting.');
      setRefresh(n => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Patch preparation failed');
    } finally { setSaving(false); }
  };
  const previewPatch = async (task: AssistantDraftTask) => {
    if (saving || task.status !== 'completed') return;
    setSaving(true); setError('');
    try {
      const response = await getAssistantPatch(workspace, sessionId, task.taskId, getAuthHeader);
      setResult({ taskId: task.taskId, text: response.patch });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Verified patch unavailable');
    } finally { setSaving(false); }
  };
  const reconcile = async (task: AssistantDraftTask) => {
    if (saving || !unverifiedIds.includes(task.taskId)) return;
    if (!window.confirm('Mark this orphaned task interrupted? No previous tool operations will be replayed.')) return;
    setSaving(true); setError('');
    try {
      await reconcileAssistantTask(workspace, sessionId, task.taskId, task.revision, getAuthHeader);
      setNotice('Task marked interrupted for manual reconciliation; not restarted.');
      setRefresh(n => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reconciliation failed');
    } finally { setSaving(false); }
  };

  return (
    <section className="border-t border-[var(--border-color)] bg-[var(--bg-card)] text-[11px] font-sans">
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)]">
        <ListTodo size={14}/><span>Assistant tasks</span>
        <span className="opacity-70">(general assistant · independent tasks)</span>
        <span className="ml-auto">{open ? <ChevronDown size={14}/> : <ChevronUp size={14}/>}</span>
      </button>
      {open && (
        <div className="px-3 pb-2 max-h-64 overflow-y-auto" role="region" aria-label="Assistant tasks">
          <div className="flex items-center justify-between text-[var(--text-muted)] pb-1">
            <span>{enabled
              ? 'Choose a task domain, draft it, then run independently. No unattended mutations.'
              : 'Drafts do not execute agents yet. Running requires a compatible Core.'}</span>
            <button type="button" aria-label="Refresh assistant tasks"
              onClick={() => setRefresh(v => v + 1)}><RefreshCw size={13}/></button>
          </div>
          <form onSubmit={event => { event.preventDefault(); void addDraft(); }}
            className="flex flex-wrap gap-2 mb-2">
            <select aria-label="Task domain" value={domain}
              disabled={saving || domains.length === 0}
              onChange={event => setDomain(event.target.value as AssistantTaskDomain)}
              title={domains.find(item => item.id === domain)?.description}
              className="min-w-32 bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-2 py-1">
              {domains.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <input aria-label="Task draft title" maxLength={2048}
              placeholder="Ask to research, plan, explain, inspect files or code"
              value={title} onChange={event => setTitle(event.target.value)}
              className="flex-1 min-w-0 bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-2 py-1"/>
            <button type="submit" disabled={saving || !title.trim() || !sessionId || !workspace ||
                !domains.some(item => item.id === domain)}
              className="px-2 border rounded border-[var(--border-color)] disabled:opacity-40">Add draft</button>
          </form>
          {error && <div role="alert" className="text-amber-400 pb-1">{error}</div>}
          {notice && <div role="status" className="text-[var(--text-muted)] pb-1">{notice}</div>}
          {drafts.length === 0 && !error && <div className="text-[var(--text-muted)]">No tasks for this session.</div>}
          {drafts.map(draft => (
            <div key={draft.taskId} className="py-1 border-t border-[var(--border-color)]/40 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate" title={draft.title}>
                <span className="text-[var(--text-muted)]">[{draft.domain || 'analysis'}]</span> {draft.title}
              </span>
              <span className="text-[var(--text-muted)]">
                {unverifiedIds.includes(draft.taskId) ? 'needs reconciliation'
                  : liveIds.includes(draft.taskId) ? 'active'
                    : draft.status === 'queued' ? 'draft' : draft.status}
              </span>
              {draft.status === 'queued' && enabled && (
                <button type="button" disabled={saving} onClick={() => { void start(draft); }}
                  aria-label={'Run read-only ' + draft.title}
                  className="text-[var(--color-primary)] disabled:opacity-40">Run</button>
              )}
              {draft.status === 'queued' && patchEnabled && draft.domain === 'coding' && (
                <button type="button" disabled={saving} onClick={() => { void preparePatch(draft); }}
                  aria-label={'Prepare patch ' + draft.title}
                  className="text-[var(--color-primary)] disabled:opacity-40">Patch</button>
              )}
              {unverifiedIds.includes(draft.taskId) && (
                <button type="button" disabled={saving} onClick={() => { void reconcile(draft); }}
                  aria-label={'Reconcile task ' + draft.title}
                  className="text-amber-400 disabled:opacity-50">Reconcile</button>
              )}
              {['queued', 'planning', 'running'].includes(draft.status) &&
                !unverifiedIds.includes(draft.taskId) && (
                <button type="button" disabled={saving} onClick={() => { void cancel(draft); }}
                  aria-label={'Cancel draft ' + draft.title}
                  className="text-amber-400 disabled:opacity-50">Cancel</button>
              )}
              {draft.status === 'completed' && (
                <>
                  <button type="button" disabled={saving} onClick={() => { void view(draft); }}
                    aria-label={'View result ' + draft.title}
                    className="text-[var(--color-primary)] disabled:opacity-50">Result</button>
                  {draft.evidenceIds.includes('patch_review_ready') && (
                    <button type="button" disabled={saving} onClick={() => { void previewPatch(draft); }}
                      aria-label={'Review patch ' + draft.title}
                      className="text-[var(--color-primary)] disabled:opacity-50">Review patch</button>
                  )}
                </>
              )}
            </div>
          ))}
          {result && (
            <div className="mt-2 border border-[var(--border-color)] rounded p-2">
              <button type="button" className="float-right text-[var(--text-muted)]"
                onClick={() => setResult(null)}>Close result</button>
              <div className="font-medium pb-1">Verified task summary</div>
              <pre className="whitespace-pre-wrap break-words text-[var(--text-main)] max-h-48 overflow-auto">{result.text}</pre>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
