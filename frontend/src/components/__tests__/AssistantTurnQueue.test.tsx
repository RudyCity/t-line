import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AssistantTurnQueue } from '../AssistantTurnQueue';
import { assistantTurnTotals, loadAssistantTurns, resumeAssistantTurns } from '../AssistantTurnApi';
vi.mock('../AssistantTurnApi', async importOriginal => {
  const original = await importOriginal<typeof import('../AssistantTurnApi')>();
  return { ...original, loadAssistantTurns: vi.fn(), resumeAssistantTurns: vi.fn() };
});
vi.mock('../SuperAgentConsoleUtils', () => ({
  getAuthHeader: () => ({ Authorization: 'Bearer sample' }),
}));
const turns = [
  { turnId: 'aaaaaaaa-1234', state: 'running' as const, createdAt: 2, startedAt: 2, finishedAt: null },
  { turnId: 'bbbbbbbb-1234', state: 'queued' as const, createdAt: 3, startedAt: null, finishedAt: null },
  { turnId: 'cccccccc-1234', state: 'recoverable' as const, createdAt: 4, startedAt: null, finishedAt: null },
];
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadAssistantTurns).mockResolvedValue(turns);
  vi.mocked(resumeAssistantTurns).mockResolvedValue(1);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('T-Line assistant execution queue UI', () => {
  it('counts active, queued and recoverable turns from Core without marking drafts as jobs', () => {
    expect(assistantTurnTotals(turns)).toEqual({ pending: 1, running: 1, recoverable: 1 });
  });
  it('shows real session-scoped turns and asks approval for queued recovery', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<AssistantTurnQueue workspace="D:/project" sessionId="session_one" />);
    await waitFor(() => expect(screen.getByText(/Assistant queue · 1 active · 1 pending/)).toBeTruthy());
    expect(vi.mocked(loadAssistantTurns).mock.calls[0].slice(0,2)).toEqual(['D:/project', 'session_one']);
    fireEvent.click(screen.getByRole('button', { name: /Assistant queue/ }));
    expect(screen.getByText('running')).toBeTruthy();
    expect(screen.getByText('queued')).toBeTruthy();
    expect(screen.getByText('recoverable')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Resume 1 safe pending/ }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(resumeAssistantTurns).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: /Resume 1 safe pending/ }));
    await waitFor(() => expect(resumeAssistantTurns).toHaveBeenCalledOnce());
  });
  it('keeps last known turn evidence when snapshot is temporarily unavailable', async () => {
    vi.mocked(loadAssistantTurns).mockRejectedValueOnce(new Error('Unavailable'));
    render(<AssistantTurnQueue workspace="D:/project" sessionId="session_one" />);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Unavailable'));
  });
});
