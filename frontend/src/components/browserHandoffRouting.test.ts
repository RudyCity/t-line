import { describe, expect, it } from 'vitest';
import { browserHandoffWorkspace, isFreshBrowserHandoff } from './browserHandoffRouting';

const instruction = 'Use superagent_browser_gateway with action=discover, port=53333\nThen action=claim, port=53333, targetId=TARGET1.';
const workspaces = [
  { id: 'project-a', path: 'D:\\Work\\project-a' },
  { id: 'project-b', path: 'D:\\Work\\project-b' },
];
describe('managed browser assistant handoff routing', () => {
  it('routes to the exact selected workspace, not the currently visible workspace', () => {
    expect(browserHandoffWorkspace('project-a', instruction, workspaces)).toBe('D:\\Work\\project-a');
    expect(browserHandoffWorkspace('project-b', instruction, workspaces)).toBe('D:\\Work\\project-b');
    expect(browserHandoffWorkspace('unknown', instruction, workspaces)).toBeNull();
  });
  it('does not deliver generic text, another workspace or oversized instructions', () => {
    expect(browserHandoffWorkspace(undefined, instruction, workspaces)).toBeNull();
    expect(browserHandoffWorkspace('project-a', 'open any browser and log in', workspaces)).toBeNull();
    expect(browserHandoffWorkspace('project-a', 'superagent_browser_gateway without a claim', workspaces)).toBeNull();
    expect(browserHandoffWorkspace('project-a', instruction.repeat(500), workspaces)).toBeNull();
  });
  it('expires in-memory requests after 60 seconds or when timestamps are invalid', () => {
    expect(isFreshBrowserHandoff(1_000, 61_000)).toBe(true);
    expect(isFreshBrowserHandoff(1_000, 61_001)).toBe(false);
    expect(isFreshBrowserHandoff(1_001, 1_000)).toBe(false);
    expect(isFreshBrowserHandoff(Number.NaN)).toBe(false);
  });
});
