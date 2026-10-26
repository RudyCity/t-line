import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AgentExecutionTimeline, buildAgentTimeline } from '../AgentExecutionTimeline';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const mainMessages = [
  { role: 'user' as const, text: 'Check repo' },
  { role: 'tool' as const, text: 'Invoking tool', toolName: 'read_files' },
  { role: 'tool' as const, text: 'Done', toolName: 'web_search', result: ['found'] },
];
const agent = {
  id: 'agent-1', role: 'Researcher', status: 'RUNNING', startedAt: '2026-10-26T02:00:00Z',
  prompt: 'Research original sources',
  logs: ['[9:00] Started research', '[9:01] Checked citations'],
};
const task = {
  taskId: 'task-1', goalId: 'goal-1', title: 'Summarize policy',
  domain: 'analysis' as const, status: 'running', revision: 2,
  createdAt: 1792960000000, updatedAt: 1792960120000, evidenceIds: [],
};
const approval = {
  permissionId: 'perm-1', toolCall: { name: 'write_file', args: { path: 'README.md', content: 'Hello' } },
  description: 'Write README',
};

describe('Per-agent timeline evidence and approval', () => {
  it('shows only observed tool action state, not invented timestamps or hidden reasoning', () => {
    const timeline = buildAgentTimeline(mainMessages, [], [], null);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].events.map(step => step.state)).toEqual(['running', 'completed']);
    expect(timeline[0].events.every(step => step.timestamp === undefined)).toBe(true);
  });

  it('builds separate per-subagent and retained background-task traces', () => {
    const timeline = buildAgentTimeline([], [agent], [task], null);
    expect(timeline).toHaveLength(3);
    expect(timeline[1].id).toBe('sub:agent-1');
    expect(timeline[1].events.map(event => event.label)).toEqual([
      'Agent started', 'Instruction received', 'Log entry 1', 'Log entry 2', 'Current status: Running',
    ]);
    expect(timeline[1].events[0].timestamp).toBe(Date.parse(agent.startedAt));
    expect(timeline[1].events[2].timestamp).toBeUndefined();
    expect(timeline[2].events.map(event => event.label)).toEqual(['Task created', 'Latest observed status: Running']);
    expect(timeline[2].events[1].detail).toContain('not a reconstructed');
  });

  it('uses persisted Core transition journal with exact sequence, revisions and timestamps', () => {
    const events = [
      { seq: 3, taskId: 'task-1', status: 'running', at: 1792960120000, revision: 3 },
      { seq: 1, taskId: 'task-1', status: 'queued', at: 1792960000000, revision: 1 },
      { seq: 2, taskId: 'task-1', status: 'planning', at: 1792960060000, revision: 2 },
    ];
    const rows = buildAgentTimeline([], [], [task], null, [], events)[1].events;
    expect(rows.map(row => row.label)).toEqual([
      'Task queued', 'Transition: Planning', 'Transition: Running',
    ]);
    expect(rows.map(row => row.timestamp)).toEqual([
      1792960000000, 1792960060000, 1792960120000,
    ]);
    expect(rows[1].detail).toBe('Recorded by Core · revision 2');
    expect(rows.some(row => row.label.includes('Latest observed status'))).toBe(false);
  });

  it('replays actual main and subagent tool actions from the Core journal without enabling old approvals', () => {
    const hash = 'abcdef0123456789abcd';
    const core = [
      { seq: 1, kind: 'tool_start' as const, actor: 'main', tool: 'read_files',
        at: 1792960000000, status: 'running' },
      { seq: 2, kind: 'permission_requested' as const, actor: 'main', tool: 'write_file',
        at: 1792960001000, status: 'queued' },
      { seq: 3, kind: 'permission_decided' as const, actor: 'main',
        at: 1792960003000, status: 'denied' },
      { seq: 4, kind: 'tool_start' as const, actor: 'sub:' + hash, tool: 'web_search',
        at: 1792960005000, status: 'running' },
      { seq: 5, kind: 'tool_end' as const, actor: 'sub:' + hash, tool: 'web_search',
        at: 1792960009000, status: 'completed' },
    ];
    const items = buildAgentTimeline(mainMessages, [], [], null, [], [], core);
    expect(items[0].events.map(e => e.label)).toEqual([
      'Tool started · read_files', 'Approval requested · write_file',
      'Approval decision · denied',
    ]);
    expect(items[0].events).toHaveLength(3); // No duplicate from live message history.
    expect(items[1].events.map(e => e.label)).toEqual([
      'Tool started · web_search', 'Tool finished · web_search',
    ]);
    expect(items[1].events.map(e => e.timestamp)).toEqual([1792960005000, 1792960009000]);
    render(<AgentExecutionTimeline messages={mainMessages} subagents={[]} drafts={[]}
      coreEvents={core}/>);
    expect(screen.queryByRole('button', { name: /Allow Once/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Subagent history/ }));
    expect(screen.getByRole('list', { name: /Timeline for Subagent history/ })).toBeTruthy();
  });

  it('does not treat orphaned task as running and does not invent old transitions', () => {
    const result = buildAgentTimeline([], [], [task], null, ['task-1']);
    expect(result[1].state).toBe('reconcile_required');
    expect(result[1].events[1].state).toBe('review');
    expect(result[1].events).toHaveLength(2);
  });

  it('renders a distinct agent view and allows switching to a single agent', () => {
    render(<AgentExecutionTimeline messages={mainMessages} subagents={[agent]} drafts={[task]}/>);
    expect(screen.getByRole('region', { name: 'Per-agent execution timeline' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Researcher/ }));
    const events = screen.getByRole('list', { name: 'Timeline for Researcher' });
    expect(within(events).getByText('Agent started')).toBeTruthy();
    expect(within(events).getByText('Log entry 1')).toBeTruthy();
    expect(within(events).queryByText('web_search')).toBeNull();
  });

  it('shows actual live tool permission decisions and does not launch tools on timeline click', () => {
    const decide = vi.fn();
    render(<AgentExecutionTimeline messages={mainMessages} subagents={[]} drafts={[]}
      pendingPermission={approval} onPermissionDecision={decide} connected/>);
    const region = screen.getByRole('region', { name: 'Per-agent execution timeline' });
    expect(within(region).getByText('Action pending approval · Main Agent')).toBeTruthy();
    expect(within(region).getByText('Approval required · write_file')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Allow Once/ }));
    expect(decide).toHaveBeenCalledExactlyOnceWith(true);
    fireEvent.click(screen.getByRole('button', { name: /Deny/ }));
    expect(decide).toHaveBeenCalledWith(false);
  });

  it('fails closed for disconnected Core even if a permission was received before disconnect', () => {
    const decide = vi.fn();
    render(<AgentExecutionTimeline messages={[]} subagents={[]} drafts={[]}
      pendingPermission={approval} onPermissionDecision={decide} connected={false}/>);
    expect(screen.queryByRole('button', { name: /Allow Once/ })).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Connection unavailable');
    expect(decide).not.toHaveBeenCalled();
  });

  it('filters agents and actions, shows dashboard and keeps tool controls non-automatic', () => {
    const controls = vi.fn();
    const openTasks = vi.fn();
    render(<AgentExecutionTimeline messages={mainMessages} subagents={[agent]} drafts={[task]}
      onTaskControl={controls} onOpenTaskPanel={openTasks}/>);
    expect(screen.getByLabelText('Agent dashboard')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Search agents and actions'),
      { target: { value: 'Researcher' } });
    expect(screen.getByRole('button', { name: /Researcher/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Summarize policy/ })).toBeNull();
    fireEvent.change(screen.getByLabelText('Search agents and actions'), { target: {value:''} });
    fireEvent.change(screen.getByLabelText('Agent type filter'), { target: {value:'task'} });
    fireEvent.click(screen.getByRole('button', { name: /Summarize policy/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Request cancel' }));
    expect(controls).toHaveBeenCalledWith(task, 'cancel');
    fireEvent.click(screen.getByRole('button', { name: 'Review task actions' }));
    expect(openTasks).toHaveBeenCalledOnce();
    expect(screen.getByText(/Running workers cannot be paused or resumed/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('does not show fabricated approval controls for ordinary process actions', () => {
    render(<AgentExecutionTimeline messages={mainMessages} subagents={[]} drafts={[]}/>);
    expect(screen.queryByRole('button', { name: /Allow Once/ })).toBeNull();
    expect(screen.queryByText('Action pending approval · Main Agent')).toBeNull();
  });
});
