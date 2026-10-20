/** Opt-in fresh-instruction retry; not automated replay of old task inputs. */
const JOB = /^clj_\d{8,17}_[a-f0-9]{8}$/;
export async function getTaskRetryCapability(
  workspace: string, auth: () => Record<string, string>, request: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<boolean> {
  if (!workspace) return false;
  const result = await request('/api/superagent/parity/capabilities?workspace=' + encodeURIComponent(workspace),
    { headers: auth(), signal });
  if (!result.ok) return false;
  const data = await result.json();
  return data?.schemaVersion === 1 && data?.server === 'superagent' &&
    Array.isArray(data.httpActions) &&
    ['tasks.retry.prepare', 'tasks.retry.confirm'].every(action =>
      data.httpActions.some((item: any) => item?.id === action &&
        item?.method === 'POST' && item?.access === 'creator-confirmed'));
}
export async function requestTaskRetry(
  workspace: string, sessionId: string, jobId: string, instruction: string,
  auth: () => Record<string, string>, approval: (description: string) => boolean,
  request: typeof fetch = fetch,
): Promise<string> {
  if (!workspace || !sessionId || !JOB.test(jobId) ||
    typeof instruction !== 'string' || instruction.trim().length < 20 ||
    instruction.length > 4000) throw new Error('Enter a new instruction (20–4000 characters).');
  const input = { workspace, sessionId, jobId };
  const send = async (stage: 'prepare' | 'confirm', extra: Record<string, string>) => {
    const res = await request('/api/superagent/tasks/retry/' + stage, {
      method: 'POST', headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, ...extra }),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || result?.success !== true) {
      throw new Error(String(result?.error || 'Retry request denied.').slice(0, 300));
    }
    return result;
  };
  const prepared = await send('prepare', { prompt: instruction });
  if (prepared.sourceJobId !== jobId || !/^[a-f0-9]{48}$/.test(String(prepared.challenge || ''))) {
    throw new Error('Invalid retry authorization challenge.');
  }
  if (!approval('Start a NEW CLI job using your new instruction? Changes may be irreversible. The original job will NOT be replayed.')) {
    return 'Retry was not approved. No new job started.';
  }
  const result = await send('confirm', { challenge: prepared.challenge });
  if (result.sourceJobId !== jobId || result.requested !== true ||
    typeof result.newJobId !== 'string' || !JOB.test(result.newJobId)) {
    throw new Error('Retry outcome not verified. Check job list before attempting again.');
  }
  return 'New CLI task requested: ' + result.newJobId + ' (source: ' + jobId + '). Watch status separately.';
}
