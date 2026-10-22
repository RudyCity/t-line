import { describe, expect, it, vi } from 'vitest';
import { CLI_COMMAND_PARITY, BRAIN_CLI_SUBCOMMANDS, getCliOnlySuggestions, getSlashCommands, getSubCommands, isCliOnlyCommand } from '../SuperAgentCommands';

describe('T-Line / SuperAgent CLI command parity guard', () => {
  it('uses the pinned Brain CLI catalog for nested suggestions without pretending desktop can execute them',()=>{
    const context={workspace:'D:/work',agentMode:'single' as const};
    const brain=getSubCommands('/brain',context);
    const scratch=getSubCommands('/scratch',context);
    expect(brain).toHaveLength(BRAIN_CLI_SUBCOMMANDS.length);
    expect(brain).toEqual(expect.arrayContaining([
      expect.objectContaining({command:'/brain task.reconcile',description:expect.stringContaining('CLI-only')}),
      expect.objectContaining({command:'/brain artifact.recover'}),
      expect.objectContaining({command:'/brain delegate.start agy'}),
      expect.objectContaining({command:'/brain clean.confirm'}),
    ]));
    expect(scratch.some(s=>s.command==='/scratch task.reconcile')).toBe(true);
    expect(brain.some(s=>s.command.includes('credential.rotate'))).toBe(false);
    expect(isCliOnlyCommand('/brain task.reconcile')).toBe(true);
    expect(getCliOnlySuggestions(()=>{}).some(s=>s.command==='/brain')).toBe(false);
  });

  it('contains source-inferred CLI commands missing from T-Line UI', () => {
    expect(CLI_COMMAND_PARITY.length).toBeGreaterThan(50);
    for (const name of ['/daemon', '/gateway', '/selfdev', '/muse', '/tools']) {
      expect(isCliOnlyCommand(name)).toBe(true);
    }
    expect(isCliOnlyCommand('/studio')).toBe(false);
    expect(CLI_COMMAND_PARITY.some(item => item.command === '/motion')).toBe(false);
    expect(CLI_COMMAND_PARITY.some(item => item.command === '/studio' && item.tlineHandler === 'local-ui-handler')).toBe(true);
    expect(isCliOnlyCommand('/status')).toBe(false);
  });

  it('does not mark recursively-forwarded slash handlers as executable', () => {
    for (const name of ['/model', '/login', '/checkpoint', '/history', '/goal', '/memory', '/terminal', '/focus', '/browser']) {
      expect(isCliOnlyCommand(name + ' any')).toBe(true);
    }
  });

  it('shows an explicit warning instead of sending a CLI-only command', () => {
    const warned = vi.fn();
    const suggestions = getCliOnlySuggestions(warned);
    const item = suggestions.find(s => s.command === '/telegram');
    expect(item?.description).toMatch(/CLI only/);
    item?.action?.();
    expect(warned).toHaveBeenCalledWith('/telegram');
  });

  it('opens the native SuperAgent Studio panel without executing CLI code', () => {
    const onOpenStudio = vi.fn();
    const notifyUnsupported = vi.fn();
    const setMessages = vi.fn();
    const ctx: Parameters<typeof getSlashCommands>[0] = {
      ws: null, workspace: 'D:/studio', agentMode: 'single', customArgs: '',
      setMessages, setAgentMode: vi.fn(), setCustomArgs: vi.fn(),
      setWorkspace: vi.fn(), setConnectTrigger: vi.fn(),
      handleSend: vi.fn(), handleAbort: vi.fn(), notifyUnsupported, onOpenStudio,
    };
    const studio = getSlashCommands(ctx).find(item => item.command === '/studio');
    expect(studio).toBeDefined();
    studio?.action?.('open');
    expect(onOpenStudio).toHaveBeenCalledOnce();
    expect(notifyUnsupported).not.toHaveBeenCalled();
    studio?.action?.('help');
    expect(setMessages).toHaveBeenCalledOnce();
  });

  it('legacy slash actions do not reenter handleSend recursively', () => {
    const handleSend = vi.fn();
    const notifyUnsupported = vi.fn();
    const ctx: Parameters<typeof getSlashCommands>[0] = {
      ws: null, workspace: '', agentMode: 'single', customArgs: '',
      setMessages: vi.fn(), setAgentMode: vi.fn(), setCustomArgs: vi.fn(),
      setWorkspace: vi.fn(), setConnectTrigger: vi.fn(),
      handleSend, handleAbort: vi.fn(), notifyUnsupported,
    };
    const commands = getSlashCommands(ctx);
    for (const cmdName of ['/model', '/history', '/goal', '/browser', '/login']) {
      commands.find(c => c.command === cmdName)?.action?.('status');
    }
    expect(handleSend).not.toHaveBeenCalled();
    expect(notifyUnsupported).toHaveBeenCalledTimes(5);
  });
});
