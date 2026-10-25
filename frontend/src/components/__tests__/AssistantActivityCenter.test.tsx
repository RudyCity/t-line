import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AssistantActivityCenter, summarizeBackgroundTasks } from '../AssistantActivityCenter';
import { loadAssistantTurns, resumeAssistantTurns } from '../AssistantTurnApi';
import { addAssistantDraft, getAssistantDrafts, runAssistantReadOnlyTask } from '../AssistantTaskDraftApi';

vi.mock('../AssistantTurnApi', async original => ({
  ...await original<typeof import('../AssistantTurnApi')>(),
  loadAssistantTurns: vi.fn(), resumeAssistantTurns: vi.fn(),
}));
vi.mock('../AssistantTaskDraftApi', async original => ({
  ...await original<typeof import('../AssistantTaskDraftApi')>(),
  getAssistantDrafts: vi.fn(), addAssistantDraft: vi.fn(),
  runAssistantReadOnlyTask: vi.fn(), cancelAssistantDraft: vi.fn(),
  getAssistantTaskResult: vi.fn(), prepareAssistantPatch: vi.fn(),
  getAssistantPatch: vi.fn(), reconcileAssistantTask: vi.fn(),
}));
vi.mock('../SuperAgentConsoleUtils', () => ({
  getAuthHeader: () => ({ Authorization: 'Bearer activity-test' }),
}));

const research = {
  taskId: 'c7ba78d0-1719-4a8e-90b4-15832cf48114',
  goalId: 'goal-1', title: 'Compare services', domain: 'research' as const,
  status: 'queued', revision: 1, createdAt: 1, updatedAt: 1, evidenceIds: [],
};
const snapshot = {
  success: true, tasks: [research], executionEnabled: true,
  executionPolicy: 'read-only-explicit-run', supportedModes: ['analysis', 'patch-preview'],
  liveTaskIds: [], unverifiedTaskIds: [],
  domains: [
    { id: 'general' as const, label: 'General Assistant', description: 'General chat', patchPreview: false },
    { id: 'research' as const, label: 'Research', description: 'Source comparisons', patchPreview: false },
  ],
};
const turns = [
  { turnId: 'turn-one', state: 'running' as const, createdAt: 1, startedAt: 1, finishedAt: null },
  { turnId: 'turn-two', state: 'queued' as const, createdAt: 2, startedAt: null, finishedAt: null },
  { turnId: 'turn-three', state: 'recoverable' as const, createdAt: 3, startedAt: null, finishedAt: null },
];

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadAssistantTurns).mockResolvedValue(turns);
  vi.mocked(getAssistantDrafts).mockResolvedValue(snapshot);
  vi.mocked(resumeAssistantTurns).mockResolvedValue(1);
  vi.mocked(addAssistantDraft).mockResolvedValue({ success: true, task: research, executionEnabled: true });
  vi.stubGlobal('crypto', { randomUUID: () => 'request-one' });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Unified Activity Center', () => {
  it('summarizes independently without counting orphaned tasks as active', () => {
    expect(summarizeBackgroundTasks([
      research,
      { ...research, taskId: 'two', status: 'running' },
      { ...research, taskId: 'three', status: 'completed' },
      { ...research, taskId: 'four', status: 'failed' },
    ], ['two'])).toEqual({ taskActive: 1, taskCompleted: 1, taskAttention: 2 });
  });

  it('aggregates verified source-specific statuses and renders one collapsed center', async () => {
    render(<AssistantActivityCenter workspace="D:/project" sessionId="sess_1"/>);
    await waitFor(() => expect(screen.getByText('Activity Center')).toBeTruthy());
    await waitFor(() => expect(screen.getByText('2 active')).toBeTruthy());
    expect(screen.getByText('1 queued chat · 0 tasks completed', { exact: false })).toBeTruthy();
    expect(screen.getByText('1 review')).toBeTruthy();
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByRole('button', { name: 'Toggle Activity Center' }).getAttribute('aria-expanded'))
      .toBe('false');
    expect(vi.mocked(loadAssistantTurns).mock.calls[0].slice(0,2)).toEqual(['D:/project', 'sess_1']);
    expect(vi.mocked(getAssistantDrafts).mock.calls[0].slice(0,2)).toEqual(['D:/project', 'sess_1']);
  });

  it('shows both sources via tabs, retaining the typed task when switching back', async () => {
    render(<AssistantActivityCenter workspace="D:/project" sessionId="sess_1"/>);
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Activity Center' }));
    await waitFor(() => expect(screen.getByRole('tabpanel', { name: /Chat queue/ })).toBeTruthy());
    const chatPanel = screen.getByRole('tabpanel', { name: /Chat queue/ });
    await waitFor(() => expect(within(chatPanel).getByText('turn-one', { exact: false })).toBeTruthy());
    expect(within(chatPanel).getByText(/Same-session messages execute in order/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: /Background tasks/ }));
    const tasksPanel = screen.getByRole('tabpanel', { name: /Background tasks/ });
    await waitFor(() => expect(within(tasksPanel).getByText('Compare services')).toBeTruthy());
    fireEvent.change(within(tasksPanel).getByRole('textbox', { name: 'Task draft title' }),
      { target: { value: 'An unfinished long research request' } });
    fireEvent.click(screen.getByRole('tab', { name: /Chat queue/ }));
    fireEvent.click(screen.getByRole('tab', { name: /Background tasks/ }));
    expect((within(screen.getByRole('tabpanel', { name: /Background tasks/ }))
      .getByRole('textbox', { name: 'Task draft title' }) as HTMLTextAreaElement).value)
      .toBe('An unfinished long research request');
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Activity Center' }));
    expect(screen.queryByRole('tablist')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Activity Center' }));
    expect((within(screen.getByRole('tabpanel', { name: /Background tasks/ }))
      .getByRole('textbox', { name: 'Task draft title' }) as HTMLTextAreaElement).value)
      .toBe('An unfinished long research request');
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
  });

  it('opens the background task tab from a current-session handoff and requires manual run', async () => {
    const onDraftCreated = vi.fn();
    render(<AssistantActivityCenter workspace="D:/project" sessionId="sess_1"
      handoff={{ id: 1, text: 'Research UI performance', workspace: 'D:/project', sessionId: 'sess_1' }}
      onDraftCreated={onDraftCreated}/>);
    const tasksPanel = await screen.findByRole('tabpanel', { name: /Background tasks/ });
    await waitFor(() => expect((within(tasksPanel).getByRole('textbox', {
      name: 'Task draft title',
    }) as HTMLTextAreaElement).value).toBe('Research UI performance'));
    expect(screen.getByRole('button', { name: 'Toggle Activity Center' }).getAttribute('aria-expanded'))
      .toBe('true');
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
    fireEvent.click(within(tasksPanel).getByRole('button', { name: 'Add draft' }));
    await waitFor(() => expect(onDraftCreated).toHaveBeenCalledWith('Research UI performance'));
    expect(runAssistantReadOnlyTask).not.toHaveBeenCalled();
  });

  it('does not reveal a different session handoff', async () => {
    render(<AssistantActivityCenter workspace="D:/project" sessionId="sess_1"
      handoff={{ id: 2, text: 'A sensitive other-session request',
        workspace: 'D:/project', sessionId: 'sess_2' }}/>);
    await waitFor(() => expect(loadAssistantTurns).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByText('2 active')).toBeTruthy());
    expect(screen.queryByText('A sensitive other-session request')).toBeNull();
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('keeps last known summaries and reports partial service degradation', async () => {
    const ui = render(<AssistantActivityCenter workspace="D:/project" sessionId="sess_1"/>);
    await waitFor(() => expect(screen.getByText('2 active')).toBeTruthy());
    vi.mocked(getAssistantDrafts).mockRejectedValue(new Error('Task store offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh Activity Center' }));
    await waitFor(() => expect(screen.getByLabelText('Activity status delayed')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Activity Center' }));
    expect(screen.getByText(/Background task status unavailable/)).toBeTruthy();
    expect(screen.getByText('2 active')).toBeTruthy();
    ui.unmount();
  });
});
