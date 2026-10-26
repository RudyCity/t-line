export type AssistantTaskDomain = 'general' | 'research' | 'analysis' | 'planning' | 'files' | 'coding';
export type AssistantTaskDomainDescriptor = {
  id: AssistantTaskDomain; label: string; description: string; patchPreview: boolean;
};
export type AssistantDraftTask = {
  taskId: string; goalId: string; title: string; domain?: AssistantTaskDomain;
  status: string; revision: number;
  createdAt: number; updatedAt: number; evidenceIds: string[]; retryOfTaskId?: string;
};
export type AssistantTaskTransitionEvent = {
  seq: number; taskId: string; status: string; at: number; revision: number;
};
export async function getAssistantTaskEvents(workspace: string, sessionId: string,
  cursor: number, auth: () => Record<string, string>, signal?: AbortSignal):
  Promise<{ events: AssistantTaskTransitionEvent[]; nextCursor: number }> {
  if (!Number.isSafeInteger(cursor) || cursor < 0) throw Error('Invalid timeline cursor');
  const data = await request<{ success: boolean; sessionId: string;
    events: AssistantTaskTransitionEvent[]; nextCursor: number }>(
    base + '/events?' + contextQuery(workspace, sessionId) + '&cursor=' + cursor, auth, {}, signal);
  if (data.success !== true || data.sessionId !== sessionId || !Array.isArray(data.events) ||
      data.events.length > 100 || !Number.isSafeInteger(data.nextCursor) ||
      data.nextCursor < cursor || data.events.some((ev, i) =>
        !ev || !Number.isSafeInteger(ev.seq) || ev.seq <= cursor ||
        (i > 0 && ev.seq <= data.events[i - 1].seq) ||
        typeof ev.taskId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(ev.taskId) ||
        typeof ev.status !== 'string' || !Number.isFinite(ev.at) ||
        !Number.isSafeInteger(ev.revision) || ev.revision < 1) ||
      (data.events.length && data.nextCursor !== data.events[data.events.length - 1].seq)) {
    throw Error('Invalid Core task timeline response');
  }
  return { events: data.events, nextCursor: data.nextCursor };
}
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
  request<{ success: boolean; tasks: AssistantDraftTask[]; executionEnabled: boolean;
    liveTaskIds: string[]; unverifiedTaskIds: string[]; executionPolicy: string;
    supportedModes?: string[]; domains?: AssistantTaskDomainDescriptor[] }>(
    base + '?' + contextQuery(workspace, sessionId), auth, {}, signal);

export const addAssistantDraft = (workspace: string, sessionId: string,
  title: string, auth: () => Record<string, string>, idempotencyKey: string,
  domain: AssistantTaskDomain = 'analysis') =>
  request<{ success: boolean; task: AssistantDraftTask; executionEnabled: boolean }>(
    base + '?' + contextQuery(workspace, sessionId), auth, {
      method: 'POST', body: JSON.stringify({ title, goalId: idempotencyKey, idempotencyKey, domain }),
    });

const taskPath = (workspace: string, sessionId: string, taskId: string, action: string) =>
  base + '/' + encodeURIComponent(taskId) + '/' + action + '?' +
    contextQuery(workspace, sessionId);
const postRevision = (workspace: string, sessionId: string, taskId: string,
  action: string, expectedRevision: number, auth: () => Record<string, string>) =>
  request<{ success: boolean; taskId?: string; task?: AssistantDraftTask; replayed?: false; scheduled?: boolean }>(
    taskPath(workspace, sessionId, taskId, action), auth,
    { method: 'POST', body: JSON.stringify({ expectedRevision }) });

export const cancelAssistantDraft = (workspace: string, sessionId: string,
  taskId: string, expectedRevision: number, auth: () => Record<string, string>) =>
  postRevision(workspace, sessionId, taskId, 'cancel', expectedRevision, auth);

export const runAssistantReadOnlyTask = (workspace: string, sessionId: string,
  taskId: string, expectedRevision: number, auth: () => Record<string, string>) =>
  postRevision(workspace, sessionId, taskId, 'run', expectedRevision, auth);

export const prepareAssistantPatch = (workspace: string, sessionId: string,
  taskId: string, expectedRevision: number, auth: () => Record<string, string>) =>
  postRevision(workspace, sessionId, taskId, 'prepare', expectedRevision, auth);

export const reconcileAssistantTask = (workspace: string, sessionId: string,
  taskId: string, expectedRevision: number, auth: () => Record<string, string>) =>
  postRevision(workspace, sessionId, taskId, 'reconcile', expectedRevision, auth);

export const pauseAssistantDraft = (workspace: string, sessionId: string,
  taskId: string, expectedRevision: number, auth: () => Record<string, string>) =>
  postRevision(workspace, sessionId, taskId, 'pause', expectedRevision, auth);

export const resumeAssistantDraft = (workspace: string, sessionId: string,
  taskId: string, expectedRevision: number, auth: () => Record<string, string>) =>
  postRevision(workspace, sessionId, taskId, 'resume', expectedRevision, auth);

export const retryAssistantAsDraft = (workspace: string, sessionId: string,
  taskId: string, expectedRevision: number, auth: () => Record<string, string>,
  idempotencyKey: string) =>
  request<{ success: boolean; task: AssistantDraftTask; executed: false }>(
    taskPath(workspace, sessionId, taskId, 'retry'), auth, {
      method: 'POST', body: JSON.stringify({ expectedRevision, idempotencyKey }),
    });

export const getAssistantCheckpoint = (workspace: string, sessionId: string,
  taskId: string, auth: () => Record<string, string>) =>
  request<{ success: boolean; taskId: string; revision: number; status: string;
    checkpoint: 'draft-boundary'|'manual-review-only';
    canResumeWithoutExecution: boolean; executionResumptionSupported: false }>(
      taskPath(workspace, sessionId, taskId, 'checkpoint'), auth);

export const getAssistantTaskResult = (workspace: string, sessionId: string,
  taskId: string, auth: () => Record<string, string>) =>
  request<{ success: boolean; taskId: string; result: string }>(
    taskPath(workspace, sessionId, taskId, 'result'), auth);

export const getAssistantPatch = (workspace: string, sessionId: string,
  taskId: string, auth: () => Record<string, string>) =>
  request<{ success: boolean; taskId: string; patch: string }>(
    taskPath(workspace, sessionId, taskId, 'patch'), auth);
