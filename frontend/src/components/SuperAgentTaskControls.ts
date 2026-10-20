/** Strictly opt-in TLine cancel workflow. No generic task mutations. */
const JOB = /^clj_\d{8,17}_[a-f0-9]{8}$/;
export async function getTaskCancelCapability(
  workspace: string, auth: () => Record<string, string>, request: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!workspace) return false;
  const resp = await request('/api/superagent/parity/capabilities?workspace=' + encodeURIComponent(workspace),
    { headers: auth(), signal });
  if (!resp.ok) return false;
  const data = await resp.json();
  return data?.server === 'superagent' && data.schemaVersion === 1 &&
    Array.isArray(data.httpActions) &&
    ['tasks.cancel.prepare', 'tasks.cancel.confirm'].every(id =>
      data.httpActions.some((item: any) => item.id === id && item.method === 'POST' &&
        item.access === 'workspace-operator'));
}
export async function requestTaskCancellation(
  workspace: string, sessionId: string, jobId: string,
  auth: () => Record<string, string>, request: typeof fetch = fetch,
): Promise<string> {
  if (!workspace || !sessionId || !JOB.test(jobId)) throw new Error('Invalid CLI task scope.');
  const base = '/api/superagent/tasks/cancel/';
  const source = { workspace, sessionId, jobId };
  const send = async (step: 'prepare' | 'confirm', challenge?: string) => {
    const response = await request(base + step, { method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...source, ...(challenge ? { challenge } : {}) }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data?.success !== true) {
      throw new Error(String(data?.error || 'Task cancellation denied.').slice(0, 250));
    }
    return data;
  };
  const prepared = await send('prepare');
  if (prepared.jobId !== jobId || typeof prepared.challenge !== 'string' ||
    !/^[a-f0-9]{48}$/.test(prepared.challenge)) throw new Error('Invalid task cancellation confirmation.');
  const confirmed = await send('confirm', prepared.challenge);
  if (confirmed.jobId !== jobId || confirmed.requested !== true) {
    throw new Error('Cancellation request not confirmed.');
  }
  return 'Cancellation requested for ' + jobId + '. Awaiting verified task exit status.';
}
