import { describe, expect, it, vi } from 'vitest';
import { CLI_COMMAND_PARITY, getCliOnlySuggestions, getSlashCommands, isCliOnlyCommand } from '../SuperAgentCommands';

describe('T-Line / SuperAgent CLI command parity guard', () => {
  it('contains source-inferred CLI commands missing from T-Line UI', () => {
    expect(CLI_COMMAND_PARITY.length).toBeGreaterThan(50);
    for (const name of ['/daemon', '/gateway', '/motion', '/selfdev', '/muse', '/tools']) {
      expect(isCliOnlyCommand(name)).toBe(true);
    }
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
