import type { TabData, TerminalInstanceData } from '../hooks/useTerminals';

function equalRecord(left: Record<string, unknown>, right: Record<string, unknown>): boolean {
  const keys = Object.keys(left);
  const otherKeys = Object.keys(right);
  return keys.length === otherKeys.length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(right, key) &&
    JSON.stringify(left[key]) === JSON.stringify(right[key])
  );
}

/** Retain stable tab refs, and preserve local detached-window ownership. */
export function reconcileTabs(current: TabData[], incoming: TabData[]): TabData[] {
  const previous = new Map(current.map(tab => [tab.id, tab]));
  const next = incoming.map(tab => {
    const old = previous.get(tab.id);
    const adjusted = { ...tab };
    // Preserve the original optional-property shape for identical local tabs.
    if (old) {
      if (old.isDetached === undefined) delete adjusted.isDetached;
      else adjusted.isDetached = old.isDetached;
    } else {
      adjusted.isDetached = false;
    }
    return old && equalRecord(old as unknown as Record<string, unknown>, adjusted as Record<string, unknown>)
      ? old : adjusted;
  });
  return current.length === next.length && current.every((item, i) => item === next[i]) ? current : next;
}

/** initialCommand is one-shot and must never be replayed on re-attach. */
export function reconcileTerminalInstances(
  current: Record<string, TerminalInstanceData>,
  incoming: Record<string, TerminalInstanceData>
): Record<string, TerminalInstanceData> {
  const next: Record<string, TerminalInstanceData> = {};
  for (const [id, instance] of Object.entries(incoming)) {
    const { initialCommand: _discard, ...remote } = instance;
    const old = current[id];
    // Local ephemeral quick-launch commands must survive only until initial execution.
    const normalized = { ...remote, ...(old?.initialCommand ? { initialCommand: old.initialCommand } : {}) };
    next[id] = old && equalRecord(old as unknown as Record<string, unknown>, normalized as Record<string, unknown>)
      ? old : normalized;
  }
  const before = Object.keys(current);
  const after = Object.keys(next);
  return before.length === after.length && before.every(id => next[id] === current[id]) ? current : next;
}
