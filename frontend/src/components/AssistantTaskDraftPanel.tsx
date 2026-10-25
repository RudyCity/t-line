import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, Copy, Check,
  AlertCircle, Sparkles, X, Layers3 } from 'lucide-react';
import {
  addAssistantDraft, cancelAssistantDraft, getAssistantDrafts,
  runAssistantReadOnlyTask, getAssistantTaskResult, prepareAssistantPatch,
  getAssistantPatch, reconcileAssistantTask, type AssistantDraftTask,
  type AssistantTaskDomain, type AssistantTaskDomainDescriptor,
} from './AssistantTaskDraftApi';
import { AssistantDomainPicker, AssistantTaskCard } from './AssistantTaskCards';
import { getAuthHeader } from './SuperAgentConsoleUtils';

export type AssistantTaskHandoff = { id: number; text: string; sessionId: string; workspace: string };
type Filter = 'all' | 'active' | 'done' | 'attention';
const ACTIVE_STATES = ['queued', 'planning', 'running', 'awaiting_approval'];
const LEGACY_DOMAINS: AssistantTaskDomainDescriptor[] = [
  { id: 'analysis', label: 'Analysis', description: 'Read-only project analysis (older Core)', patchPreview: false },
];

/** Natural-language, session-scoped task workspace. Never executes a draft implicitly. */
export function AssistantTaskDraftPanel({ workspace, sessionId, handoff, onDraftCreated, embedded = false, visible = true }: {
  workspace: string; sessionId: string; handoff?: AssistantTaskHandoff | null;
  onDraftCreated?: (submitted: string) => void; embedded?: boolean; visible?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expanded = embedded || open;
  const [title, setTitle] = useState('');
  const [domain, setDomain] = useState<AssistantTaskDomain>('general');
  const [domains, setDomains] = useState<AssistantTaskDomainDescriptor[]>([]);
  const [drafts, setDrafts] = useState<AssistantDraftTask[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [patchEnabled, setPatchEnabled] = useState(false);
  const [liveIds, setLiveIds] = useState<string[]>([]);
  const [unverifiedIds, setUnverifiedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ taskId: string; text: string; kind: 'summary' | 'patch' } | null>(null);
  const [copied, setCopied] = useState(false);
  const processedHandoff = useRef<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // A refresh must NEVER discard the human's unfinished draft or open result.
  // Only a genuine session/workspace boundary resets private in-progress state.
  useEffect(() => {
    setTitle(''); setDrafts([]); setDomains([]); setDomain('general');
    setError(''); setNotice(''); setResult(null); setFilter('all');
    setLiveIds([]); setUnverifiedIds([]); setEnabled(false); setPatchEnabled(false);
    processedHandoff.current = null;
  }, [workspace, sessionId]);

  useEffect(() => {
    if (!handoff || handoff.workspace !== workspace || handoff.sessionId !== sessionId ||
        handoff.id === processedHandoff.current) return;
    processedHandoff.current = handoff.id;
    setTitle(handoff.text.trim().slice(0, 2048));
    setOpen(true);
    setFilter('all');
    setNotice('Review the task type and save a draft. Nothing runs until you choose Run.');
    // Focus after the panel opens and mounts the editor.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [handoff, workspace, sessionId]);

  useEffect(() => {
    if (!expanded || !visible || !workspace || !sessionId) return;
    const controller = new AbortController();
    let active = true;
    let requestIndex = 0;
    const load = async () => {
      const current = ++requestIndex;
      try {
        const snapshot = await getAssistantDrafts(workspace, sessionId, getAuthHeader, controller.signal);
        if (!active || current !== requestIndex) return;
        setDrafts(snapshot.tasks);
        const supported = snapshot.domains?.length ? snapshot.domains : LEGACY_DOMAINS;
        setDomains(supported);
        setDomain(prev => supported.some(item => item.id === prev) ? prev : supported[0].id);
        setEnabled(snapshot.executionEnabled === true &&
          snapshot.executionPolicy === 'read-only-explicit-run');
        setPatchEnabled(snapshot.executionEnabled === true &&
          snapshot.supportedModes?.includes('patch-preview') === true);
        setLiveIds(snapshot.liveTaskIds || []);
        setUnverifiedIds(snapshot.unverifiedTaskIds || []);
        setError('');
      } catch (cause) {
        if (active && !controller.signal.aborted && current === requestIndex) {
          setError(cause instanceof Error ? cause.message : 'Unable to load assistant tasks');
        }
      }
    };
    void load();
    const interval = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 3000);
    const onVisibilityChange = () => { if (!document.hidden) void load(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [expanded, visible, workspace, sessionId, refresh]);

  const stats = useMemo(() => ({
    active: drafts.filter(task => ACTIVE_STATES.includes(task.status) && !unverifiedIds.includes(task.taskId)).length,
    done: drafts.filter(task => task.status === 'completed').length,
    attention: drafts.filter(task => unverifiedIds.includes(task.taskId) ||
      ['failed', 'interrupted', 'reconcile_required'].includes(task.status)).length,
  }), [drafts, unverifiedIds]);
  const filtered = drafts.filter(task => filter === 'all' ||
    (filter === 'active' && ACTIVE_STATES.includes(task.status) && !unverifiedIds.includes(task.taskId)) ||
    (filter === 'done' && task.status === 'completed') ||
    (filter === 'attention' && (unverifiedIds.includes(task.taskId) ||
      ['failed', 'interrupted', 'reconcile_required'].includes(task.status))));

  const addDraft = async () => {
    const trimmed = title.trim();
    if (!workspace || !sessionId || !trimmed || saving ||
        !domains.some(item => item.id === domain)) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const id = crypto.randomUUID();
      await addAssistantDraft(workspace, sessionId, trimmed, getAuthHeader, id, domain);
      setTitle('');
      setNotice('Draft saved. Choose Run to start its independent, read-only worker.');
      onDraftCreated?.(trimmed);
      setRefresh(n => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to save draft');
    } finally { setSaving(false); }
  };
  const start = async (task: AssistantDraftTask) => {
    if (saving || !enabled || task.status !== 'queued') return;
    if (!window.confirm('Run this task using a separate read-only assistant? File writes, shell commands and interactive approvals are disabled.')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await runAssistantReadOnlyTask(workspace, sessionId, task.taskId, task.revision, getAuthHeader);
      setNotice('Task started separately. You can keep chatting.');
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
    setSaving(true); setError(''); setCopied(false);
    try {
      const response = await getAssistantTaskResult(workspace, sessionId, task.taskId, getAuthHeader);
      setResult({ taskId: task.taskId, text: response.result, kind: 'summary' });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Result unavailable');
    } finally { setSaving(false); }
  };
  const preparePatch = async (task: AssistantDraftTask) => {
    if (saving || !patchEnabled || task.status !== 'queued' || task.domain !== 'coding') return;
    if (!window.confirm('Prepare an isolated Git patch proposal? Only tracked source/test files may change in a separate worktree. Nothing will be merged automatically.')) return;
    setSaving(true); setError(''); setNotice('');
    try {
      await prepareAssistantPatch(workspace, sessionId, task.taskId, task.revision, getAuthHeader);
      setNotice('Patch proposal started in a separate worktree. Nothing changes in your working folder.');
      setRefresh(n => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Patch preparation failed');
    } finally { setSaving(false); }
  };
  const previewPatch = async (task: AssistantDraftTask) => {
    if (saving || task.status !== 'completed') return;
    setSaving(true); setError(''); setCopied(false);
    try {
      const response = await getAssistantPatch(workspace, sessionId, task.taskId, getAuthHeader);
      setResult({ taskId: task.taskId, text: response.patch, kind: 'patch' });
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
      setNotice('Task marked interrupted; previous operations were not replayed.');
      setRefresh(n => n + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Reconciliation failed');
    } finally { setSaving(false); }
  };
  const copyResult = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
    } catch { setError('Unable to copy result. Select text to copy manually.'); }
  };

  const filters: Array<{ id: Filter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: drafts.length },
    { id: 'active', label: 'Active', count: stats.active },
    { id: 'done', label: 'Completed', count: stats.done },
    { id: 'attention', label: 'Needs review', count: stats.attention },
  ];
  return (
    <section className={embedded ? 'bg-[var(--bg-card)] font-sans' :
      'shrink-0 border-t border-[var(--border-color)] bg-[var(--bg-card)] font-sans'}
      aria-label="Assistant task workspace">
      {!embedded && <button type="button" aria-expanded={open} aria-controls="assistant-task-workspace-body"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-2.5 px-3 sm:px-4 py-2 text-left text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-primary-glow)] text-[var(--color-primary)]">
          <Layers3 size={16} aria-hidden="true"/>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold">Assistant tasks</span>
          <span className="block text-[10px] text-[var(--text-muted)]">
            Delegate research, plans, files or code · chat stays available
          </span>
        </span>
        {stats.active > 0 &&
          <span className="rounded-full bg-[var(--color-primary-glow)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-primary)]">
            {stats.active} active
          </span>}
        {stats.attention > 0 &&
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
            {stats.attention} review
          </span>}
        {open ? <ChevronDown size={16} className="text-[var(--text-muted)]"/> :
          <ChevronUp size={16} className="text-[var(--text-muted)]"/>}
      </button>}
      {expanded && (
        <div id="assistant-task-workspace-body" role="region" aria-label="Assistant tasks"
          className={embedded ? 'max-h-[56vh] min-h-0 overflow-y-auto px-3 sm:px-4 py-3' :
            'max-h-[60vh] min-h-0 overflow-y-auto border-t border-[var(--border-color)] px-3 sm:px-4 py-3'}>
          <div className="mx-auto max-w-3xl space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-main)]">
                  <Sparkles size={15} className="text-[var(--color-primary)]"/> Delegate a task
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                  Choose a skill, save a draft, then start it when ready.
                </p>
              </div>
              <button type="button" onClick={() => setRefresh(value => value + 1)}
                aria-label="Refresh assistant tasks" title="Refresh tasks"
                className="rounded-md border border-[var(--border-color)] p-2 text-[var(--text-muted)] hover:text-[var(--text-main)]">
                <RefreshCw size={14}/>
              </button>
            </div>

            <form onSubmit={event => { event.preventDefault(); void addDraft(); }}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 space-y-3">
              <AssistantDomainPicker domains={domains} value={domain} disabled={saving}
                onChange={setDomain}/>
              <div className="space-y-1.5">
                <label htmlFor="assistant-task-draft" className="text-[11px] font-medium text-[var(--text-muted)]">
                  Your request
                </label>
                <textarea id="assistant-task-draft" ref={inputRef} aria-label="Task draft title"
                  maxLength={2048} rows={2} value={title}
                  onChange={event => setTitle(event.target.value)}
                  placeholder="Research competitors, explain a document, create a plan..."
                  className="block w-full resize-y min-h-[64px] max-h-40 rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-2 text-[13px] leading-relaxed text-[var(--text-main)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)]"/>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-[var(--text-muted)]">
                  Saving a draft never runs tools or changes files.
                </span>
                <button type="submit" disabled={saving || !title.trim() || !workspace || !sessionId ||
                    !domains.some(item => item.id === domain)}
                  className="rounded-lg bg-[var(--color-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:opacity-40">
                  {saving ? 'Saving…' : 'Add draft'}
                </button>
              </div>
            </form>

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-amber-400">
                <AlertCircle size={14} className="shrink-0 mt-px"/> {error}
              </div>
            )}
            {notice && <div role="status" className="text-xs text-[var(--text-muted)]">{notice}</div>}

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-[var(--text-main)]">Tasks</h3>
                <span className="text-[11px] text-[var(--text-muted)]">Scoped to this chat session</span>
              </div>
              <div role="group" aria-label="Filter assistant tasks" className="flex gap-1.5 overflow-x-auto pb-0.5">
                {filters.map(item => (
                  <button key={item.id} type="button" aria-pressed={filter === item.id}
                    onClick={() => setFilter(item.id)}
                    className={'shrink-0 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors ' +
                      (filter === item.id
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-glow)] text-[var(--color-primary)]'
                        : 'border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]')}>
                    {item.label} <span className="opacity-70">{item.count}</span>
                  </button>
                ))}
              </div>
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--border-color)] px-4 py-6 text-center text-xs text-[var(--text-muted)]">
                  {filter === 'all' ? 'No tasks yet. Describe what you need above.' :
                    'No tasks match this filter.'}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {filtered.map(task => (
                    <AssistantTaskCard key={task.taskId} task={task} busy={saving}
                      active={liveIds.includes(task.taskId)}
                      unverified={unverifiedIds.includes(task.taskId)}
                      enabled={enabled} patchEnabled={patchEnabled}
                      onRun={task => { void start(task); }}
                      onPatch={task => { void preparePatch(task); }}
                      onCancel={task => { void cancel(task); }}
                      onResult={task => { void view(task); }}
                      onReview={task => { void previewPatch(task); }}
                      onReconcile={task => { void reconcile(task); }}/>
                  ))}
                </div>
              )}
            </div>
            {result && (
              <section aria-label="Task result" className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-main)]">
                <div className="flex items-center justify-between gap-2 border-b border-[var(--border-color)] px-3 py-2">
                  <strong className="text-xs font-semibold text-[var(--text-main)]">
                    {result.kind === 'patch' ? 'Review patch · not applied' : 'Verified task summary'}
                  </strong>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => { void copyResult(); }}
                      className="inline-flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)]">
                      {copied ? <Check size={13}/> : <Copy size={13}/>}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button type="button" onClick={() => setResult(null)} aria-label="Close result"
                      className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-main)]">
                      <X size={14}/>
                    </button>
                  </div>
                </div>
                <pre className={'max-h-48 overflow-auto whitespace-pre-wrap break-words p-3 text-xs leading-relaxed text-[var(--text-main)] ' +
                  (result.kind === 'patch' ? 'font-mono' : 'font-sans')}>{result.text}</pre>
              </section>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
