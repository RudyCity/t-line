import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssistantTaskDraftPanel } from '../AssistantTaskDraftPanel';
import {
  addAssistantDraft, cancelAssistantDraft, getAssistantDrafts,
  getAssistantTaskResult, runAssistantReadOnlyTask, prepareAssistantPatch,
  getAssistantPatch, reconcileAssistantTask,
} from '../AssistantTaskDraftApi';

vi.mock('../AssistantTaskDraftApi', () => ({
  addAssistantDraft: vi.fn(), cancelAssistantDraft: vi.fn(), getAssistantDrafts: vi.fn(),
  getAssistantTaskResult: vi.fn(), runAssistantReadOnlyTask: vi.fn(),
  prepareAssistantPatch: vi.fn(), getAssistantPatch: vi.fn(), reconcileAssistantTask: vi.fn(),
}));
vi.mock('../SuperAgentConsoleUtils', () => ({
  getAuthHeader: () => ({ Authorization: 'Bearer test' }),
}));
const draft = {
  taskId: 'c7ba78d0-1719-4a8e-90b4-15832cf48114',
  goalId: 'goal', title: 'Investigate app', status: 'queued',
  revision: 1, createdAt: 1, updatedAt: 1, evidenceIds: [],
};
const snapshot = {
  success: true, tasks: [draft], executionEnabled: true,
  executionPolicy: 'read-only-explicit-run', supportedModes: ['analysis', 'patch-preview'],
  liveTaskIds: [], unverifiedTaskIds: [],
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
    expect(screen.getByText(/Draft first, then explicitly run/)).toBeTruthy();
    expect(screen.getByText('draft')).toBeTruthy();
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
    expect(screen.getByText('needs reconciliation')).toBeTruthy();
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
  it('keeps older Core drafts non-executable', async () => {
    vi.mocked(getAssistantDrafts).mockResolvedValue({
      ...snapshot, executionEnabled: false, executionPolicy: 'drafts-only',
    });
    await open();
    expect(screen.queryByRole('button', { name: /Run read-only/ })).toBeNull();
  });
});
