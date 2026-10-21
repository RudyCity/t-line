import { describe, expect, it } from 'vitest';
import { reconcileTabs, reconcileTerminalInstances } from './syncReconcile';
import type { TabData, TerminalInstanceData } from '../hooks/useTerminals';

describe('incremental cross-window restore', () => {
  const current: TabData[] = [
    { id: 'a', name: 'Shell', type: 'terminal', layout: {type:'leaf',terminalId:'t1'}, isDetached:true },
    { id: 'b', name: 'Other', type: 'terminal' },
  ];
  it('preserves identical React tab and list identities', () => {
    const next = reconcileTabs(current, JSON.parse(JSON.stringify(current)));
    expect(next).toBe(current);
    expect(next[0]).toBe(current[0]);
  });
  it('only replaces changed tabs and retains locally owned detached flags', () => {
    const next = reconcileTabs(current, [{...current[0],isDetached:false},{...current[1],name:'Changed'}]);
    expect(next).not.toBe(current);
    expect(next[0]).toBe(current[0]);
    expect(next[1].name).toBe('Changed');
  });
  it('does not replay one-shot initial commands from remote sync', () => {
    const old: Record<string,TerminalInstanceData> = {
      t1: {id:'t1',name:'Shell',cwd:'C:/dev',shellType:'powershell',initialCommand:'run-once'}
    };
    const remote = { t1: {...old.t1,initialCommand:'evil remote command'} };
    expect(reconcileTerminalInstances(old,remote)).toBe(old);
    const changed = reconcileTerminalInstances(old, {t1:{...remote.t1,name:'Other'}});
    expect(changed.t1.name).toBe('Other');
    expect(changed.t1.initialCommand).toBe('run-once');
    expect(reconcileTerminalInstances({},remote).t1.initialCommand).toBeUndefined();
  });
});
