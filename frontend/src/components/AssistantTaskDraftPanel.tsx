import { useEffect, useState } from 'react';
import { ListTodo, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { addAssistantDraft, cancelAssistantDraft, getAssistantDrafts,
  type AssistantDraftTask } from './AssistantTaskDraftApi';
import { getAuthHeader } from './SuperAgentConsoleUtils';

/** Draft management only. Queued records are NOT background or running agents. */
export function AssistantTaskDraftPanel({ workspace, sessionId }: {
  workspace: string; sessionId: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [drafts, setDrafts] = useState<AssistantDraftTask[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setDrafts([]);
    setTitle('');
    setError('');
    if (!open || !workspace || !sessionId) return;
    const controller = new AbortController();
    let alive = true;
    const load = async () => {
      try {
        const snapshot = await getAssistantDrafts(workspace, sessionId, getAuthHeader, controller.signal);
        if (alive) {
          setDrafts(snapshot.tasks);
          setError('');
        }
      } catch (cause) {
        if (alive && !controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Unable to read task drafts.');
        }
      }
    };
    void load();
    const interval = window.setInterval(() => { void load(); }, 5000);
    return () => {
      alive = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [open, workspace, sessionId, refresh]);

  const addDraft = async () => {
    const trimmed = title.trim();
    if (!workspace || !sessionId || !trimmed || saving) return;
    setSaving(true); setError('');
    try {
      const idempotencyKey = crypto.randomUUID();
      await addAssistantDraft(workspace, sessionId, trimmed, getAuthHeader, idempotencyKey);
      setTitle('');
      setRefresh(n => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to add draft');
    } finally { setSaving(false); }
  };
  const cancelDraft = async (draft: AssistantDraftTask) => {
    if (saving || draft.status !== 'queued') return;
    if (!window.confirm('Cancel this queued draft? No agent execution was started.')) return;
    setSaving(true); setError('');
    try {
      await cancelAssistantDraft(workspace, sessionId, draft.taskId, draft.revision, getAuthHeader);
      setRefresh(n => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to cancel draft');
    } finally { setSaving(false); }
  };
  return (
    <section className="border-t border-[var(--border-color)] bg-[var(--bg-card)] text-[11px] font-sans">
      <button type="button" aria-expanded={open} onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)]">
        <ListTodo size={14} /><span>Assistant task drafts</span>
        <span className="opacity-70">(planning only)</span>
        <span className="ml-auto">{open ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</span>
      </button>
      {open && (
        <div className="px-3 pb-2 max-h-48 overflow-y-auto" role="region"
          aria-label="Assistant task drafts">
          <div className="flex items-center justify-between text-[var(--text-muted)] pb-1">
            <span>Saved to the session journal. Drafts do not execute agents yet.</span>
            <button type="button" aria-label="Refresh assistant drafts"
              onClick={() => setRefresh(v => v + 1)}><RefreshCw size={13} /></button>
          </div>
          <form onSubmit={event => { event.preventDefault(); void addDraft(); }}
            className="flex gap-2 mb-2">
            <input aria-label="Task draft title" maxLength={2048} placeholder="Describe a planned task"
              value={title} onChange={event => setTitle(event.target.value)}
              className="flex-1 min-w-0 bg-[var(--bg-main)] border border-[var(--border-color)] rounded px-2 py-1" />
            <button type="submit" disabled={saving || !title.trim() || !sessionId || !workspace}
              className="px-2 border rounded border-[var(--border-color)] disabled:opacity-40">
              Add draft
            </button>
          </form>
          {error && <div role="alert" className="text-amber-400 pb-1">{error}</div>}
          {drafts.length === 0 && !error && <div className="text-[var(--text-muted)]">No planned tasks for this session.</div>}
          {drafts.map(draft => (
            <div key={draft.taskId}
              className="py-1 border-t border-[var(--border-color)]/40 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate" title={draft.title}>{draft.title}</span>
              <span className="text-[var(--text-muted)]">{draft.status === 'queued' ? 'draft' : draft.status}</span>
              {draft.status === 'queued' && (
                <button type="button" disabled={saving} onClick={() => { void cancelDraft(draft); }}
                  aria-label={'Cancel draft ' + draft.title}
                  className="text-amber-400 disabled:opacity-50">Cancel</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
