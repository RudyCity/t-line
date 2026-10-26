import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssistantTaskDraftPanel } from '../AssistantTaskDraftPanel';
import {
  addAssistantDraft, cancelAssistantDraft, getAssistantDrafts,
  getAssistantTaskResult, runAssistantReadOnlyTask, prepareAssistantPatch,
  getAssistantPatch, reconcileAssistantTask, pauseAssistantDraft, resumeAssistantDraft,
  retryAssistantAsDraft, getAssistantCheckpoint, type AssistantTaskDomainDescriptor,
} from '../AssistantTaskDraftApi';

vi.mock('../AssistantTaskDraftApi', () => ({
  addAssistantDraft: vi.fn(), cancelAssistantDraft: vi.fn(), getAssistantDrafts: vi.fn(),
  getAssistantTaskResult: vi.fn(), runAssistantReadOnlyTask: vi.fn(),
  prepareAssistantPatch: vi.fn(), getAssistantPatch: vi.fn(), reconcileAssistantTask: vi.fn(),
  pauseAssistantDraft: vi.fn(), resumeAssistantDraft: vi.fn(), retryAssistantAsDraft: vi.fn(),
  getAssistantCheckpoint: vi.fn(),
}));
vi.mock('../SuperAgentConsoleUtils', () => ({
  getAuthHeader: () => ({ Authorization: 'Bearer test' }),
}));
const draft = {
  taskId: 'c7ba78d0-1719-4a8e-90b4-15832cf48114',
  goalId: 'goal', title: 'Investigate app', domain: 'coding' as const, status: 'queued',
  revision: 1, createdAt: 1, updatedAt: 1, evidenceIds: [],
};
const snapshot = {
  success: true, tasks: [draft], executionEnabled: true,
  executionPolicy: 'read-only-explicit-run', supportedModes: ['analysis', 'patch-preview', 'draft-checkpoint'],
  liveTaskIds: [], unverifiedTaskIds: [],
  domains: [
    { id: 'general', label: 'General Assistant', description: 'General conversation', patchPreview: false },
    { id: 'research', label: 'Research', description: 'Online research', patchPreview: false },
    { id: 'analysis', label: 'Analysis', description: 'Review', patchPreview: false },
    { id: 'planning', label: 'Planning', description: 'Plan', patchPreview: false },
    { id: 'files', label: 'Files & Documents', description: 'Local reading', patchPreview: false },
    { id: 'coding', label: 'Coding', description: 'Code patch review', patchPreview: true },
  ] as AssistantTaskDomainDescriptor[],
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAssistantDrafts).mockResolvedValue(snapshot);
  vi.mocked(addAssistantDraft).mockResolvedValue({ success: true, task: draft, executionEnabled: true });
  vi.mocked(cancelAssistantDraft).mockResolvedValue({
    success: true, task: { ...draft, status: 'cancelled', revision: 2 },
  });
  vi.mocked(runAssistantReadOnlyTask).mockResolvedValue({
    success: true, scheduled: true, taskId: draft.taskId,
  });
  vi.mocked(prepareAssistantPatch).mockResolvedValue({ success: true, scheduled: true, taskId: draft.taskId });
  vi.mocked(pauseAssistantDraft).mockResolvedValue({success:true,
    task:{...draft,status:'paused',revision:2}});
  vi.mocked(resumeAssistantDraft).mockResolvedValue({success:true,
    task:{...draft,status:'queued',revision:3}});
  vi.mocked(getAssistantCheckpoint).mockResolvedValue({ success:true,taskId:draft.taskId,
    revision:1,status:'queued',checkpoint:'draft-boundary',
    canResumeWithoutExecution:false,executionResumptionSupported:false });
  vi.mocked(retryAssistantAsDraft).mockResolvedValue({success:true,executed:false,
    task:{...draft,taskId:'ca7ad858-16c5-4705-9c7c-ec6721f0f191',
      status:'queued',retryOfTaskId:draft.taskId}});
  vi.mocked(reconcileAssistantTask).mockResolvedValue({ success: true, replayed: false,
    task: { ...draft, status: 'interrupted', revision: 4 } });
  vi.mocked(getAssistantPatch).mockResolvedValue({ success: true, taskId: draft.taskId,
    patch: 'diff --git a/src/file.ts b/src/file.ts' });
  vi.mocked(getAssistantTaskResult).mockResolvedValue({
    success: true, taskId: draft.taskId, result: 'Verified review',
  });
  vi.stubGlobal('crypto', { randomUUID: () => 'draft_request_123' });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('session-scoped background analysis panel', () => {
  async function open() {
    render(<AssistantTaskDraftPanel workspace="D:/project" sessionId="sess_1" />);
    expect(getAssistantDrafts).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Assistant tasks/i }));
    await waitFor(() => expect(screen.getByText('Investigate app')).toBeTruthy());
  }
  it('shows queued tasks with explicit read-only run and no implicit launch', async () => {
    await open();
    expect(screen.getByText(/Choose a skill, save a draft/)).toBeTruthy();
    expect(screen.getByText('Ready')).toBeTruthy();
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
    expect(vi.mocked(getAssistantDrafts).mock.calls[0].slice(0,2)).toEqual(['D:/project', 'sess_1']);
  });
  it('creates a persisted draft without automatically launching a worker', async () => {
    await open();
    fireEvent.change(screen.getByRole('textbox', { name: 'Task draft title' }), {
      target: { value: 'Review changes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add draft' }));
    await waitFor(() => expect(addAssistantDraft).toHaveBeenCalledOnce());
    expect(vi.mocked(addAssistantDraft).mock.calls[0].slice(0, 3))
      .toEqual(['D:/project', 'sess_1', 'Review changes']);
    expect(vi.mocked(addAssistantDraft).mock.calls[0][4]).toBe('draft_request_123');
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
  });
  it('shows checkpoint metadata without attempting execution or replay', async () => {
    await open();
    fireEvent.click(screen.getByRole('button',{name:'Inspect checkpoint Investigate app'}));
    await waitFor(()=>expect(getAssistantCheckpoint).toHaveBeenCalledOnce());
    expect(vi.mocked(getAssistantCheckpoint).mock.calls[0].slice(0,3))
      .toEqual(['D:/project','sess_1',draft.taskId]);
    expect(screen.getByText(/Checkpoint verified: unstarted draft/)).toBeTruthy();
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
  });
  it('pauses and resumes only unstarted drafts; neither action launches a worker', async () => {
    vi.spyOn(window,'confirm').mockReturnValue(true);
    await open();
    fireEvent.click(screen.getByRole('button',{name:'Pause draft Investigate app'}));
    await waitFor(()=>expect(pauseAssistantDraft).toHaveBeenCalledOnce());
    expect(vi.mocked(pauseAssistantDraft).mock.calls[0].slice(0,4))
      .toEqual(['D:/project','sess_1',draft.taskId,1]);
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
    cleanup();
    vi.clearAllMocks();
    vi.mocked(getAssistantDrafts).mockResolvedValue({
      ...snapshot,tasks:[{...draft,status:'paused',revision:2}],
    });
    await open();
    expect(screen.queryByRole('button',{name:'Run read-only Investigate app'})).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Resume draft Investigate app'}));
    await waitFor(()=>expect(resumeAssistantDraft).toHaveBeenCalledOnce());
    expect(vi.mocked(resumeAssistantDraft).mock.calls[0].slice(0,4))
      .toEqual(['D:/project','sess_1',draft.taskId,2]);
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
    expect(prepareAssistantPatch).not.toHaveBeenCalled();
  });
  it('creates a new retry draft from failed work but never auto-runs old or new workers', async () => {
    vi.mocked(getAssistantDrafts).mockResolvedValue({
      ...snapshot,tasks:[{...draft,status:'failed',revision:4}],
    });
    vi.spyOn(window,'confirm').mockReturnValue(true);
    await open();
    fireEvent.click(screen.getByRole('button',{name:'Retry as new draft Investigate app'}));
    await waitFor(()=>expect(retryAssistantAsDraft).toHaveBeenCalledOnce());
    const params=vi.mocked(retryAssistantAsDraft).mock.calls[0];
    expect(params.slice(0,4)).toEqual(['D:/project','sess_1',draft.taskId,4]);
    expect(params[5]).toBe('draft_request_123');
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
    expect(prepareAssistantPatch).not.toHaveBeenCalled();
  });
  it('requires approval to launch a task and forwards only task id/revision', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Run read-only Investigate app' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Run read-only Investigate app' }));
    await waitFor(() => expect(runAssistantReadOnlyTask).toHaveBeenCalledOnce());
    expect(vi.mocked(runAssistantReadOnlyTask).mock.calls[0].slice(0, 4))
      .toEqual(['D:/project', 'sess_1', draft.taskId, 1]);
  });
  it('requires approval to cancel a draft', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel draft Investigate app' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(cancelAssistantDraft).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel draft Investigate app' }));
    await waitFor(() => expect(cancelAssistantDraft).toHaveBeenCalledOnce());
  });
  it('hides unsafe retry/cancel on unverified orphan and loads only completed result', async () => {
    vi.mocked(getAssistantDrafts).mockResolvedValue({
      ...snapshot, tasks: [{ ...draft, status: 'running', revision: 3 }],
      unverifiedTaskIds: [draft.taskId],
    });
    await open();
    expect(screen.getByText('Needs reconciliation')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Cancel draft/ })).toBeNull();
    cleanup();
    vi.clearAllMocks();
    vi.mocked(getAssistantDrafts).mockResolvedValue({
      ...snapshot, tasks: [{ ...draft, status: 'completed', revision: 4 }],
    });
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'View result Investigate app' }));
    await waitFor(() => expect(screen.getByText('Verified review')).toBeTruthy());
  });
  it('requires approval to prepare an isolated patch', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Prepare patch Investigate app' }));
    expect(prepareAssistantPatch).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Prepare patch Investigate app' }));
    await waitFor(() => expect(prepareAssistantPatch).toHaveBeenCalledOnce());
    expect(vi.mocked(prepareAssistantPatch).mock.calls[0].slice(0,4))
      .toEqual(['D:/project', 'sess_1', draft.taskId, 1]);
  });
  it('reconciles an orphan but never retries it', async () => {
    vi.mocked(getAssistantDrafts).mockResolvedValue({
      ...snapshot, tasks: [{ ...draft, status: 'running', revision: 3 }],
      unverifiedTaskIds: [draft.taskId],
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Reconcile task Investigate app' }));
    await waitFor(() => expect(reconcileAssistantTask).toHaveBeenCalledOnce());
    expect(vi.mocked(reconcileAssistantTask).mock.calls[0].slice(0,4))
      .toEqual(['D:/project','sess_1', draft.taskId, 3]);
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
    expect(prepareAssistantPatch).not.toHaveBeenCalled();
  });
  it('inspects completed verified patch without applying it', async () => {
    vi.mocked(getAssistantDrafts).mockResolvedValue({
      ...snapshot, tasks: [{ ...draft, status: 'completed', revision: 4,
        evidenceIds: ['patch_review_ready'] }],
    });
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Review patch Investigate app' }));
    await waitFor(() => expect(screen.getByText(/diff --git a\/src\/file/)).toBeTruthy());
    expect(getAssistantPatch).toHaveBeenCalledOnce();
    expect(prepareAssistantPatch).not.toHaveBeenCalled();
  });
  it('creates research tasks without forcing coding', async () => {
    await open();
    expect(screen.getByRole('button', { name: 'Domain: General Assistant' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Domain: Research' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Task draft title' }),
      { target: { value: 'Research recent technology' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add draft' }));
    await waitFor(() => expect(addAssistantDraft).toHaveBeenCalledOnce());
    expect(vi.mocked(addAssistantDraft).mock.calls[0][5]).toBe('research');
    expect(prepareAssistantPatch).not.toHaveBeenCalled();
  });
  it('does not show patch for a general task', async () => {
    vi.mocked(getAssistantDrafts).mockResolvedValue({
      ...snapshot, tasks: [{ ...draft, domain: 'general' }],
    });
    await open();
    expect(screen.queryByRole('button', { name: /Prepare patch/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Run read-only Investigate app' })).toBeTruthy();
  });
  it('keeps unsaved text and domain during refresh', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Domain: Research' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Task draft title' }), {
      target: { value: 'My research notes are not finished' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Refresh assistant tasks' }));
    await waitFor(() => expect(getAssistantDrafts).toHaveBeenCalledTimes(2));
    expect((screen.getByRole('textbox', { name: 'Task draft title' }) as HTMLTextAreaElement).value)
      .toBe('My research notes are not finished');
    expect(screen.getByRole('button', { name: 'Domain: Research' }).getAttribute('aria-pressed'))
      .toBe('true');
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
  });
  it('hands off chat text as a reviewable draft without running a worker', async () => {
    const onDraftCreated = vi.fn();
    const handoff = { id: 8, text: 'Compare cloud platforms', sessionId: 'sess_1', workspace: 'D:/project' };
    const view = render(<AssistantTaskDraftPanel workspace="D:/project" sessionId="sess_1"
      handoff={handoff} onDraftCreated={onDraftCreated}/>);
    const editor = await screen.findByRole('textbox', { name: 'Task draft title' });
    await waitFor(() => expect((editor as HTMLTextAreaElement).value).toBe(handoff.text));
    expect(addAssistantDraft).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Domain: Research' }));
    view.rerender(<AssistantTaskDraftPanel workspace="D:/project" sessionId="sess_1"
      handoff={handoff} onDraftCreated={onDraftCreated}/>);
    expect((editor as HTMLTextAreaElement).value).toBe(handoff.text);
    fireEvent.click(screen.getByRole('button', { name: 'Add draft' }));
    await waitFor(() => expect(onDraftCreated).toHaveBeenCalledWith('Compare cloud platforms'));
    expect(vi.mocked(addAssistantDraft).mock.calls[0][5]).toBe('research');
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
  });
  it('keeps delegated text after a save failure', async () => {
    vi.mocked(addAssistantDraft).mockRejectedValueOnce(Error('Offline'));
    const onDraftCreated = vi.fn();
    render(<AssistantTaskDraftPanel workspace="D:/project" sessionId="sess_1"
      handoff={{ id: 22, text: 'Explain these files', sessionId: 'sess_1', workspace: 'D:/project' }}
      onDraftCreated={onDraftCreated}/>);
    const editor = await screen.findByRole('textbox', { name: 'Task draft title' });
    await waitFor(() => expect((editor as HTMLTextAreaElement).value).toBe('Explain these files'));
    fireEvent.click(screen.getByRole('button', { name: 'Add draft' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Offline'));
    expect((editor as HTMLTextAreaElement).value).toBe('Explain these files');
    expect(onDraftCreated).not.toHaveBeenCalled();
  });
  it('filters task statuses without mixing completed and failed tasks', async () => {
    vi.mocked(getAssistantDrafts).mockResolvedValue({
      ...snapshot,
      tasks: [
        draft,
        { ...draft, taskId: 'c8ba78d0-1719-4a8e-90b4-15832cf48115',
          title: 'Completed summary', status: 'completed', domain: 'general' },
        { ...draft, taskId: 'c9ba78d0-1719-4a8e-90b4-15832cf48116',
          title: 'Failed research', status: 'failed', domain: 'research' },
      ],
    });
    await open();
    fireEvent.click(screen.getByRole('button', { name: /Completed 1/ }));
    expect(screen.getByText('Completed summary')).toBeTruthy();
    expect(screen.queryByText('Investigate app')).toBeNull();
    expect(screen.getByRole('button', { name: 'View result Completed summary' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Needs review 1/ }));
    expect(screen.getByText('Failed research')).toBeTruthy();
    expect(screen.queryByText('Completed summary')).toBeNull();
  });
  it('keeps older Core drafts non-executable', async () => {
    vi.mocked(getAssistantDrafts).mockResolvedValue({
      ...snapshot, executionEnabled: false, executionPolicy: 'drafts-only',
    });
    await open();
    expect(screen.queryByRole('button', { name: /Run read-only/ })).toBeNull();
  });
});
