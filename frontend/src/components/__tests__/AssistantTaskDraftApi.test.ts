import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelAssistantDraft, prepareAssistantPatch, reconcileAssistantTask, getAssistantPatch,
} from '../AssistantTaskDraftApi';

afterEach(() => vi.unstubAllGlobals());
describe('desktop task API fixed-action paths', () => {
  it('calls exact scoped cancel/prepare/reconcile/patch routes and never forwards tools', async () => {
    const requests: Array<{ url: string; init: RequestInit }> = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
      requests.push({ url, init });
      return {
        ok: true, json: async () => ({ success: true, taskId: 'task', patch: 'diff', replayed: false }),
      };
    }));
    const auth = () => ({ Authorization: 'Bearer example' });
    const id = 'c7ba78d0-1719-4a8e-90b4-15832cf48114';
    await cancelAssistantDraft('D:/project', 'sess_1', id, 3, auth);
    await prepareAssistantPatch('D:/project', 'sess_1', id, 3, auth);
    await reconcileAssistantTask('D:/project', 'sess_1', id, 3, auth);
    await getAssistantPatch('D:/project', 'sess_1', id, auth);
    expect(requests.map(r => r.url.split('?')[0])).toEqual([
      '/api/superagent/assistant/tasks/' + id + '/cancel',
      '/api/superagent/assistant/tasks/' + id + '/prepare',
      '/api/superagent/assistant/tasks/' + id + '/reconcile',
      '/api/superagent/assistant/tasks/' + id + '/patch',
    ]);
    expect(requests.map(r => r.init.method ?? 'GET')).toEqual(['POST','POST','POST','GET']);
    expect(requests.every(r => r.url.includes('sessionId=sess_1') &&
      r.url.includes('workspace=D%3A%2Fproject'))).toBe(true);
    expect(JSON.parse(requests[0].init.body as string)).toEqual({ expectedRevision: 3 });
    expect(requests[3].init.body).toBeUndefined();
  });
});
