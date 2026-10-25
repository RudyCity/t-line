import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssistantTaskDraftPanel } from '../AssistantTaskDraftPanel';
import { addAssistantDraft, cancelAssistantDraft, getAssistantDrafts } from '../AssistantTaskDraftApi';

vi.mock('../AssistantTaskDraftApi', () => ({
  addAssistantDraft: vi.fn(), cancelAssistantDraft: vi.fn(), getAssistantDrafts: vi.fn(),
}));
vi.mock('../SuperAgentConsoleUtils', () => ({
  getAuthHeader: () => ({ Authorization: 'Bearer test' }),
}));
const draft = {
  taskId: 'c7ba78d0-1719-4a8e-90b4-15832cf48114',
  goalId: 'goal', title: 'Investigate app', status: 'queued',
  revision: 1, createdAt: 1, updatedAt: 1, evidenceIds: [],
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getAssistantDrafts).mockResolvedValue({
    success: true, tasks: [draft], executionEnabled: false,
  });
  vi.mocked(addAssistantDraft).mockResolvedValue({
    success: true, task: draft, executionEnabled: false,
  });
  vi.mocked(cancelAssistantDraft).mockResolvedValue({
    success: true, task: { ...draft, status: 'cancelled', revision: 2 },
  });
  vi.stubGlobal('crypto', { randomUUID: () => 'draft_request_123' });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('session task draft panel', () => {
  it('does not load until opened; shows truthful non-running status', async () => {
    render(<AssistantTaskDraftPanel workspace="D:/project" sessionId="sess_1" />);
    expect(getAssistantDrafts).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Assistant task drafts/i }));
    await waitFor(() => expect(screen.getByText('Investigate app')).toBeTruthy());
    expect(screen.getByText(/Drafts do not execute agents yet/)).toBeTruthy();
    expect(screen.getByText('draft')).toBeTruthy();
    expect(vi.mocked(getAssistantDrafts).mock.calls[0].slice(0, 2)).toEqual(['D:/project', 'sess_1']);
  });
  it('creates a draft with a new idempotency key without launching a worker', async () => {
    render(<AssistantTaskDraftPanel workspace="D:/project" sessionId="sess_1" />);
    fireEvent.click(screen.getByRole('button', { name: /Assistant task drafts/i }));
    await waitFor(() => expect(screen.getByText('Investigate app')).toBeTruthy());
    fireEvent.change(screen.getByRole('textbox', { name: 'Task draft title' }), {
      target: { value: 'Review changes' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add draft' }));
    await waitFor(() => expect(addAssistantDraft).toHaveBeenCalledTimes(1));
    expect(vi.mocked(addAssistantDraft).mock.calls[0].slice(0, 3))
      .toEqual(['D:/project', 'sess_1', 'Review changes']);
    expect(vi.mocked(addAssistantDraft).mock.calls[0][4]).toBe('draft_request_123');
  });
  it('requires confirmation to cancel only a queued draft', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AssistantTaskDraftPanel workspace="D:/project" sessionId="sess_1" />);
    fireEvent.click(screen.getByRole('button', { name: /Assistant task drafts/i }));
    await waitFor(() => expect(screen.getByText('Investigate app')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel draft Investigate app' }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(cancelAssistantDraft).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel draft Investigate app' }));
    await waitFor(() => expect(cancelAssistantDraft).toHaveBeenCalledOnce());
    expect(vi.mocked(cancelAssistantDraft).mock.calls[0].slice(0, 4)).toEqual([
      'D:/project', 'sess_1', draft.taskId, 1,
    ]);
  });
});
