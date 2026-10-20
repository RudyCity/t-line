/**
 * T-Line task polling protocol: strictly read-only, capability-negotiated.
 * Cursor equality avoids resending unchanged snapshots, but this is NOT
 * event-stream replay and missed intermediate states cannot be recovered.
 */
export interface TlineTask {
  schemaVersion: 1;
  channel: 'cli' | 'daemon' | 'tline' | 'gateway' | 'mcp' | 'tunnel';
  taskId: string;
  sessionId: string | null;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'partial' | 'cancelled' | 'interrupted';
  evidence: 'verified' | 'unverified' | 'failed' | 'not_applicable';
  authorization: string;
  notification: string;
  updatedAt: number;
  /** Server-provided hint; never replaces mutation endpoint authorization. */
  cancelEligible?: boolean;
}
export interface TaskSnapshot {
  success: true;
  schemaVersion: 1;
  scope: 'workspace';
  source: 'bounded-polling';
  changed: boolean;
  cursor: string;
  tasks?: TlineTask[];
  total: number;
  incompleteSources: string[];
  replaySupported: false;
}
export interface TaskSnapshotResult {
  snapshot: TaskSnapshot;
  negotiated: true;
}

function validManifest(value: any): boolean {
  return value?.server === 'superagent' && value.schemaVersion === 1 &&
    Array.isArray(value.httpActions) && value.httpActions.some((a: any) =>
      a?.id === 'tasks.snapshot' && a?.method === 'GET' && a?.access === 'read');
}
export function validTaskSnapshot(value: any, expectedCursor?: string): value is TaskSnapshot {
  return value?.success === true && value.schemaVersion === 1 &&
    value.scope === 'workspace' && value.source === 'bounded-polling' &&
    value.replaySupported === false && typeof value.changed === 'boolean' &&
    typeof value.cursor === 'string' && /^[0-9a-f]{64}$/.test(value.cursor) &&
    Number.isSafeInteger(value.total) && value.total >= 0 && value.total <= 60 &&
    Array.isArray(value.incompleteSources) &&
    (value.changed ? Array.isArray(value.tasks) && value.tasks.length === value.total &&
      value.tasks.every((task: any) => task && task.schemaVersion === 1 &&
        typeof task.taskId === 'string' && typeof task.status === 'string' &&
        Number.isFinite(task.updatedAt))
      : value.tasks === undefined && value.cursor === expectedCursor);
}

export async function fetchTlineTaskSnapshot(
  workspace: string,
  auth: () => Record<string, string>,
  opts: { cursor?: string; negotiated?: boolean; signal?: AbortSignal } = {},
  request: typeof fetch = fetch,
): Promise<TaskSnapshotResult> {
  if (!workspace) throw new Error('Select a workspace before opening the task monitor.');
  if (opts.cursor && !/^[0-9a-f]{64}$/.test(opts.cursor)) throw new Error('Invalid task cursor.');
  const headers = auth();
  const base = '/api/superagent/parity/';
  const suffix = '?workspace=' + encodeURIComponent(workspace);
  if (!opts.negotiated) {
    const handshake = await request(base + 'capabilities' + suffix,
      { headers, signal: opts.signal });
    if (!handshake.ok) throw new Error('SuperAgent task capability unavailable (HTTP ' + handshake.status + ').');
    if (!validManifest(await handshake.json())) {
      throw new Error('Current SuperAgent server does not advertise a workspace task snapshot API.');
    }
  }
  const url = base + 'tasks.snapshot' + suffix +
    (opts.cursor ? '&cursor=' + encodeURIComponent(opts.cursor) : '');
  const response = await request(url, { headers, signal: opts.signal });
  if (!response.ok) throw new Error('Task snapshot failed (HTTP ' + response.status + ').');
  const snapshot = await response.json();
  if (!validTaskSnapshot(snapshot, opts.cursor)) throw new Error('Invalid workspace task snapshot response.');
  return { snapshot, negotiated: true };
}
