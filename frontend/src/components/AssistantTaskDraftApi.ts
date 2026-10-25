export type AssistantDraftTask = {
  taskId: string; goalId: string; title: string; status: string; revision: number;
  createdAt: number; updatedAt: number; evidenceIds: string[];
};
const base = '/api/superagent/assistant/tasks';
const contextQuery = (workspace: string, sessionId: string) =>
  new URLSearchParams({ workspace, sessionId }).toString();

async function request<T>(route: string, auth: () => Record<string, string>,
  init: RequestInit = {}, signal?: AbortSignal): Promise<T> {
  const response = await fetch(route, {
    ...init, signal,
    headers: { ...auth(), ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    cache: 'no-store',
  });
  const json = await response.json() as T & { error?: string };
  if (!response.ok || json.error) throw new Error(json.error || 'Task journal unavailable');
  return json;
}
export const getAssistantDrafts = (workspace: string, sessionId: string,
  auth: () => Record<string, string>, signal?: AbortSignal) =>
  request<{ success: boolean; tasks: AssistantDraftTask[]; executionEnabled: false }>(
    base + '?' + contextQuery(workspace, sessionId), auth, {}, signal);

export const addAssistantDraft = (workspace: string, sessionId: string,
  title: string, auth: () => Record<string, string>, idempotencyKey: string) =>
  request<{ success: boolean; task: AssistantDraftTask; executionEnabled: false }>(
    base + '?' + contextQuery(workspace, sessionId), auth, {
      method: 'POST', body: JSON.stringify({ title, goalId: idempotencyKey, idempotencyKey }),
    });

export const cancelAssistantDraft = (workspace: string, sessionId: string,
  taskId: string, expectedRevision: number, auth: () => Record<string, string>) =>
  request<{ success: boolean; task: AssistantDraftTask }>(
    base + '/' + encodeURIComponent(taskId) + '?' + contextQuery(workspace, sessionId),
    auth, { method: 'POST', body: JSON.stringify({ expectedRevision }) });
