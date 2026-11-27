import { resolveSuperAgentCorePort } from './superAgentCorePort';
import { logE2E } from "./unifiedLogger";
import { Router } from 'express';
import http from 'http';
import { authMiddleware } from './auth';
import { sendSuperAgentRequest } from './superAgentBridge';
import { getSuperAgentServiceHeaders } from './superAgentAuth';
import {resolveRuntimeTarget} from './superAgentRuntimeTarget';
import {probeSuperAgentPort} from './superAgentPortProbe';
import { fetchParityReadAction, PARITY_READ_ACTIONS, type ParityReadAction } from './superAgentParityBridge';
import { streamTlineTaskEvents } from './superAgentTaskEvents';
import { forwardTaskCancel } from './superAgentTaskCancel';
import { forwardTlineRetry } from './superAgentTaskRetry';
import studioProxyRouter from './studioProxy';
import brainExplorerRouter from './brainExplorerRoutes';
import { createAssistantTaskProxy } from './assistantTaskProxy';
import { createAgentTimelineProxy } from './agentTimelineProxy';
import { createApprovalStatusProxy } from './approvalStatusProxy';
import { createAgentTimelineStreamProxy } from './agentTimelineStreamProxy';
import { createTlineAssistantTurnsRouter } from './tlineAssistantTurns';
import { createOrchestrationProxy } from './orchestrationProxy';
import { getWorkspaceSessions, getSessionMessages } from './sessionManager';
import { createManagedBrowserHandoffRouter } from './managedBrowserHandoff';

const router = Router();

// Apply authMiddleware globally to all routes in this router
router.use(authMiddleware);

// Studio is canonical; retain legacy /motion for already-running clients.
router.use('/studio', studioProxyRouter);
router.use('/motion', studioProxyRouter);
router.use('/brain', brainExplorerRouter);
router.use('/assistant/tasks', createAssistantTaskProxy());
router.use('/assistant/agent-timeline', createAgentTimelineProxy());
router.use('/assistant/approvals', createApprovalStatusProxy());
router.use('/assistant/agent-stream', createAgentTimelineStreamProxy());
router.use('/assistant/turns', createTlineAssistantTurnsRouter());
router.use('/orchestration', createOrchestrationProxy());

// Read-only runtime choice: T-Line never runs a second backend for testing.
// There is intentionally no hot-switch POST: agent effects/sessions must not
// silently cross runtimes in an active desktop process.
router.get('/runtime-target', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const target = resolveRuntimeTarget();
    const state = await probeSuperAgentPort(target.corePort);
    res.json({...target, ready: state === 'compatible'});
  } catch {
    res.status(409).json({error: 'Invalid or unavailable SuperAgent runtime target configuration'});
  }
});

// ACP Protocol status and capability discovery
router.get('/acp/status', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    protocol: 'acp',
    version: '1.0.0',
    transport: ['stdio', 'http', 'sse'],
    supportedMethods: [
      'initialize',
      'session/new',
      'session/prompt',
      'session/cancel',
      'session/update',
      'session/request_permission',
    ],
    features: {
      promptStreaming: true,
      thoughtStreaming: true,
      toolEventInterception: true,
      humanInTheLoopApproval: true,
    },
  });
});

// ACP Multi-Engine Registry discovery endpoint
router.get('/acp/engines', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const { listAcpEngines } = await import('./acpEngineRegistry');
  res.json({
    engines: listAcpEngines(),
    defaultEngine: 'superagent',
  });
});

// Read-only, authenticated browser session monitoring for the T-Line browser.
// Sourced from the selected Core runtime over HTTP: T-Line never reads Core
// session files from disk, and no CDP capability or cookie data is returned.
router.get('/browser/sessions', async (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const upstream = await proxyToSuperAgent(
    '/api/browser/sessions',
    { ok: false, sessions: [], summary: { activeTabs: 0, activeAgents: 0 } },
    undefined,
    2500,
  );
  res.status(upstream?.ok === true ? 200 : 503).json(upstream);
});

/** Fixed-action browser collaboration controls, gated by T-Line auth AND
 * SuperAgent's per-tab owner capability. Never record or persist that token. */
router.post('/browser/shared-control', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const body = req.body || {};
  const actions = new Set(['share', 'stop', 'invite', 'revoke', 'handover', 'participants']);
  if (!actions.has(body.action) || !Number.isSafeInteger(body.port) ||
      body.port < 1024 || body.port > 65535 ||
      typeof body.targetId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(body.targetId) ||
      typeof body.agentId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:@-]{0,95}$/.test(body.agentId) ||
      typeof body.sessionToken !== 'string' || body.sessionToken.length > 160 || !body.sessionToken ||
      JSON.stringify(body).length > 2000) {
    res.status(400).json({ success: false, error: 'Invalid browser sharing request.' });
    return;
  }
  const request = {
    action: body.action, port: body.port, targetId: body.targetId,
    agentId: body.agentId, sessionToken: body.sessionToken,
    memberId: typeof body.memberId === 'string' ? body.memberId : undefined,
    role: body.role === 'observer' || body.role === 'contributor' ? body.role : undefined,
  };
  const upstream = await proxyToSuperAgent('/api/browser/shared-control',
    { success: false, error: 'SuperAgent browser collaboration API is unavailable.' },
    undefined, 5500, 'POST', request);
  res.status(upstream?.success ? 200 : 403).json(upstream);
});

/** T-Line native browser handoff: verified loopback fingerprint plus selected
 * runtime proxy. Fixed sub-paths only; no generic upstream URL or body passthrough. */
router.use('/browser/managed', createManagedBrowserHandoffRouter(proxyToSuperAgentWithStatus));

/** SSE relay with exact session identity, authenticated and bounded to local SuperAgent. */
router.get('/tasks/events', streamTlineTaskEvents);

/** Fixed-path, opt-in, two-stage operator cancellation. No generic command proxy. */
router.post('/tasks/cancel/:action', async (req, res) => {
  const action = req.params.action;
  if (action !== 'prepare' && action !== 'confirm') {
    res.status(404).json({ success: false, error: 'Unknown task control action.' });
    return;
  }
  const body = req.body || {};
  const result = await forwardTaskCancel(action, {
    workspace: body.workspace, sessionId: body.sessionId,
    jobId: body.jobId, challenge: body.challenge,
  });
  res.status(result.status).json(result.payload);
});

/** Fresh user-instruction retry. Fixed paths only, never a generic CLI proxy. */
router.post('/tasks/retry/:stage', async (req, res) => {
  const stage = req.params.stage;
  if (stage !== 'prepare' && stage !== 'confirm') {
    res.status(404).json({ success: false, error: 'Unknown retry stage.' });
    return;
  }
  const data = req.body || {};
  const result = await forwardTlineRetry(stage, {
    workspace: data.workspace, sessionId: data.sessionId, jobId: data.jobId,
    prompt: data.prompt, challenge: data.challenge,
  });
  res.status(result.status).json(result.payload);
});

/** Typed, read-only desktop actions. No generic upstream URL or method proxy. */
router.get('/parity/:action', async (req, res) => {
  const action = req.params.action;
  if (!Object.prototype.hasOwnProperty.call(PARITY_READ_ACTIONS, action)) {
    res.status(404).json({ error: 'Unknown desktop parity capability.' });
    return;
  }
  const workspace = typeof req.query.workspace === 'string' ? req.query.workspace : '';
  const cursor = action === 'tasks.snapshot' && typeof req.query.cursor === 'string'
    ? req.query.cursor : undefined;
  const result = await fetchParityReadAction(action as ParityReadAction, workspace, { cursor });
  res.status(result.status).json(result.payload);
});

// End-to-End Unified Logging Endpoint
router.post("/log", (req, res) => {
  const { category, message, meta } = req.body || {};
  logE2E(category || "TLINE-UI", message || "UI Event", meta);
  res.json({ success: true });
});


// Helper for forwarding requests to SuperAgent HTTP Server (port 7888)
function proxyToSuperAgent(pathName: string, fallback: any, workspace?: string, timeoutMs: number = 1500, method: string = 'GET', body?: any): Promise<any> {
  return new Promise((resolve) => {
    const separator = pathName.includes('?') ? '&' : '?';
    const url = workspace
      ? `http://127.0.0.1:${resolveSuperAgentCorePort()}${pathName}${separator}workspace=${encodeURIComponent(workspace)}`
      : `http://127.0.0.1:${resolveSuperAgentCorePort()}${pathName}`;
    const headers: Record<string, string> = getSuperAgentServiceHeaders();
    if (workspace) headers['x-workspace-path'] = workspace;
    if (body) headers['Content-Type'] = 'application/json';

    const postData = body ? JSON.stringify(body) : undefined;
    if (postData) headers['Content-Length'] = String(Buffer.byteLength(postData));

    const req = http.request(url, { method, headers, timeout: timeoutMs }, (resp) => {
      let responseBody = '';
      resp.on('data', chunk => { responseBody += chunk; });
      resp.on('end', () => {
        try { resolve(JSON.parse(responseBody)); } catch { resolve(fallback); }
      });
    });
    req.on('error', () => resolve(fallback));
    req.on('timeout', () => { req.destroy(); resolve(fallback); });
    if (postData) req.write(postData);
    req.end();
  });
}

type SuperAgentProxyResult = { status: number; payload: any };

export function proxyToSuperAgentWithStatus(
  pathName: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  body?: unknown,
  timeoutMs = 3500,
): Promise<SuperAgentProxyResult> {
  return new Promise((resolve) => {
    const url = `http://127.0.0.1:${resolveSuperAgentCorePort()}${pathName}`;
    const headers: Record<string, string> = getSuperAgentServiceHeaders();
    if (!headers.Authorization) {
      resolve({
        status: 503,
        payload: { success: false, error: 'SuperAgent service authentication is unavailable.' },
      });
      return;
    }
    headers['x-client-mode'] = 'tline';
    const postData = body === undefined ? undefined : JSON.stringify(body);
    if (postData !== undefined) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(postData));
    }

    const upstream = http.request(url, { method, headers, timeout: timeoutMs }, (resp) => {
      let responseBody = '';
      resp.on('data', chunk => { responseBody += chunk; });
      resp.on('end', () => {
        let payload: any = {};
        if (responseBody) {
          try {
            payload = JSON.parse(responseBody);
          } catch {
            payload = { success: false, error: 'Invalid response from SuperAgent Core.' };
          }
        }
        resolve({ status: resp.statusCode || 502, payload });
      });
    });
    upstream.on('error', () => resolve({
      status: 503,
      payload: { success: false, error: 'SuperAgent project browser API is unavailable.' },
    }));
    upstream.on('timeout', () => {
      upstream.destroy();
      resolve({
        status: 503,
        payload: { success: false, error: 'SuperAgent project browser API timed out.' },
      });
    });
    if (postData !== undefined) upstream.write(postData);
    upstream.end();
  });
}

const PROJECT_BROWSER_FILTERS = new Set(['all', 'registered', 'discovered', 'active', 'unavailable']);
const PROJECT_BROWSER_CAPABILITIES = new Set(['read', 'write', 'execute', 'git', 'worktree', 'planning', 'chain']);
const PROJECT_BROWSER_ID_RE = /^[a-z0-9](?:[a-z0-9-]{0,62})$/;
const PROJECT_BROWSER_CATALOG_ID_RE = /^cat_[a-f0-9]{16}$/;
const PROJECT_BROWSER_IDENTITY_HANDLE_RE = /^idh_[a-f0-9]{16}$/;
const PROJECT_BROWSER_SENSITIVE_FIELDS = new Set([
  'root', 'target', 'token', 'bearerToken', 'credentialHash', 'principalKey',
]);

function hasSensitiveProjectBrowserField(body: Record<string, unknown>): boolean {
  return Object.keys(body).some(key => PROJECT_BROWSER_SENSITIVE_FIELDS.has(key));
}

function sendProjectBrowserValidationError(res: any, message: string) {
  res.status(400).json({ success: false, error: message });
}

router.get('/projects/browser', async (req, res) => {
  const filter = typeof req.query.filter === 'string' ? req.query.filter.trim().toLowerCase() : 'all';
  if (!PROJECT_BROWSER_FILTERS.has(filter)) {
    sendProjectBrowserValidationError(res, 'Invalid project browser filter.');
    return;
  }
  const query = typeof req.query.query === 'string' ? req.query.query : '';
  if (query.length > 500) {
    sendProjectBrowserValidationError(res, 'Project browser query is too long.');
    return;
  }
  const identityHandle = typeof req.query.identityHandle === 'string' ? req.query.identityHandle.trim() : '';
  if (identityHandle && !PROJECT_BROWSER_IDENTITY_HANDLE_RE.test(identityHandle)) {
    sendProjectBrowserValidationError(res, 'Invalid identityHandle.');
    return;
  }
  const rawLimit = typeof req.query.limit === 'string' ? req.query.limit : '50';
  const rawOffset = typeof req.query.offset === 'string' ? req.query.offset : '0';
  if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1 || Number(rawLimit) > 200) {
    sendProjectBrowserValidationError(res, 'Invalid limit.');
    return;
  }
  if (!/^\d+$/.test(rawOffset) || Number(rawOffset) < 0) {
    sendProjectBrowserValidationError(res, 'Invalid offset.');
    return;
  }

  const params = new URLSearchParams({
    filter,
    limit: rawLimit,
    offset: rawOffset,
  });
  if (query) params.set('query', query);
  if (identityHandle) params.set('identityHandle', identityHandle);

  const upstream = await proxyToSuperAgentWithStatus('/api/projects/browser?' + params.toString());
  res.status(upstream.status).json(upstream.payload);
});

router.post('/projects/browser/import', async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  if (hasSensitiveProjectBrowserField(body)) {
    sendProjectBrowserValidationError(res, 'Sensitive or arbitrary target fields are not accepted.');
    return;
  }
  const catalogId = typeof body.catalogId === 'string' ? body.catalogId.trim() : '';
  if (!PROJECT_BROWSER_CATALOG_ID_RE.test(catalogId)) {
    sendProjectBrowserValidationError(res, 'A valid catalogId is required.');
    return;
  }
  const projectId = typeof body.projectId === 'string' && body.projectId.trim() ? body.projectId.trim() : undefined;
  if (projectId && !PROJECT_BROWSER_ID_RE.test(projectId)) {
    sendProjectBrowserValidationError(res, 'Invalid projectId.');
    return;
  }
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : undefined;
  if (name && name.length > 120) {
    sendProjectBrowserValidationError(res, 'Project name is too long.');
    return;
  }
  const upstream = await proxyToSuperAgentWithStatus(
    '/api/projects/browser/import',
    'POST',
    { catalogId, ...(projectId ? { projectId } : {}), ...(name ? { name } : {}) },
  );
  res.status(upstream.status).json(upstream.payload);
});

router.post('/projects/browser/grant', async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  if (hasSensitiveProjectBrowserField(body)) {
    sendProjectBrowserValidationError(res, 'Sensitive identity fields are not accepted.');
    return;
  }
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const identityHandle = typeof body.identityHandle === 'string' ? body.identityHandle.trim() : '';
  const capabilities = Array.isArray(body.capabilities)
    ? [...new Set(body.capabilities.filter((cap): cap is string => typeof cap === 'string'))]
    : [];
  if (!PROJECT_BROWSER_ID_RE.test(projectId) || !PROJECT_BROWSER_IDENTITY_HANDLE_RE.test(identityHandle)) {
    sendProjectBrowserValidationError(res, 'Valid projectId and identityHandle are required.');
    return;
  }
  if (
    capabilities.length === 0 ||
    capabilities.length > PROJECT_BROWSER_CAPABILITIES.size ||
    capabilities.some(cap => !PROJECT_BROWSER_CAPABILITIES.has(cap))
  ) {
    sendProjectBrowserValidationError(res, 'Invalid project capabilities.');
    return;
  }
  const upstream = await proxyToSuperAgentWithStatus(
    '/api/projects/browser/grant',
    'POST',
    { projectId, identityHandle, capabilities },
  );
  res.status(upstream.status).json(upstream.payload);
});

router.post('/projects/browser/revoke', async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  if (hasSensitiveProjectBrowserField(body)) {
    sendProjectBrowserValidationError(res, 'Sensitive identity fields are not accepted.');
    return;
  }
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  const identityHandle = typeof body.identityHandle === 'string' ? body.identityHandle.trim() : '';
  if (!PROJECT_BROWSER_ID_RE.test(projectId) || !PROJECT_BROWSER_IDENTITY_HANDLE_RE.test(identityHandle)) {
    sendProjectBrowserValidationError(res, 'Valid projectId and identityHandle are required.');
    return;
  }
  const upstream = await proxyToSuperAgentWithStatus(
    '/api/projects/browser/revoke',
    'POST',
    { projectId, identityHandle },
  );
  res.status(upstream.status).json(upstream.payload);
});

router.post('/projects/browser/disable', async (req, res) => {
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  if (hasSensitiveProjectBrowserField(body)) {
    sendProjectBrowserValidationError(res, 'Arbitrary project target fields are not accepted.');
    return;
  }
  const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : '';
  if (!PROJECT_BROWSER_ID_RE.test(projectId) || typeof body.enabled !== 'boolean') {
    sendProjectBrowserValidationError(res, 'Valid projectId and enabled boolean are required.');
    return;
  }
  const upstream = await proxyToSuperAgentWithStatus(
    '/api/projects/browser/disable',
    'POST',
    { projectId, enabled: body.enabled },
  );
  res.status(upstream.status).json(upstream.payload);
});

router.delete('/projects/browser/:projectId', async (req, res) => {
  const projectId = req.params.projectId.trim();
  if (!PROJECT_BROWSER_ID_RE.test(projectId)) {
    sendProjectBrowserValidationError(res, 'Invalid projectId.');
    return;
  }
  const upstream = await proxyToSuperAgentWithStatus(
    '/api/projects/browser/' + encodeURIComponent(projectId),
    'DELETE',
  );
  res.status(upstream.status).json(upstream.payload);
});

// History routes → proxy to SA
router.get('/history', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/history', { history: [] }, workspace, 3000);
  res.json(data);
});

router.post('/history', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/history', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

// Config & preset routes → proxy to SA
router.get('/config', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/config', { error: 'SuperAgent config unavailable' }, workspace, 3000);
  res.json(data);
});

router.post('/config/active-preset', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/config/active-preset', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.post('/config/provider', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/config/provider', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.delete('/config/provider/:id', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent(`/api/config/provider/${encodeURIComponent(req.params.id)}`, { success: false }, workspace, 3000, 'DELETE');
  res.json(data);
});

router.post('/config/active-provider', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/config/active-provider', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.get('/config/provider-models', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const providerId = (req.query.providerId as string) || '';
  const data = await proxyToSuperAgent(`/api/config/provider-models?providerId=${encodeURIComponent(providerId)}`, { models: [] }, workspace, 3000);
  res.json(data);
});

router.post('/config/preset', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/config/preset', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.delete('/config/preset/:mode/:id', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent(`/api/config/preset/${encodeURIComponent(req.params.mode)}/${encodeURIComponent(req.params.id)}`, { success: false }, workspace, 3000, 'DELETE');
  res.json(data);
});

// Running instances monitor
router.get('/instances', async (_req, res) => {
  const data = await proxyToSuperAgent('/api/instances', { subagents: [], superagents: [], procs: [] });
  res.json(data);
});

// Checklist tasks monitor (task.md)
router.get('/tasks', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/tasks', { tasks: [], missing: true }, workspace);
  res.json(data);
});

// RMemory & Long-term Memory REST Proxy
router.get('/memory/search', async (req, res) => {
  const workspace = (req.query.workspace as string) || (req.headers['x-workspace-path'] as string) || '';
  const query = (req.query.query as string) || '';
  const scope = (req.query.scope as string) || 'all';
  const data = await proxyToSuperAgent(
    `/api/memory/search?query=${encodeURIComponent(query)}&scope=${encodeURIComponent(scope)}`,
    { memories: [] },
    workspace,
    3000
  );
  res.json(data);
});

router.post('/memory/save', async (req, res) => {
  try {
    const workspace = (req.headers['x-workspace-path'] as string) || (req.query.workspace as string) || '';
    const data = await sendSuperAgentRequest('/api/memory/save', req.body, workspace);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to save memory' });
  }
});

router.delete('/memory/delete', async (req, res) => {
  try {
    const workspace = (req.headers['x-workspace-path'] as string) || (req.query.workspace as string) || '';
    const data = await sendSuperAgentRequest('/api/memory/delete', req.body, workspace);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to delete memory' });
  }
});

// Memory generic get/post
router.get('/memory', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const query = (req.query.query as string) || '';
  const scope = (req.query.scope as string) || 'all';
  const data = await proxyToSuperAgent(
    `/api/memory?query=${encodeURIComponent(query)}&scope=${encodeURIComponent(scope)}`,
    { memory: [], sharedMemory: [], error: 'SuperAgent memory unavailable' },
    workspace,
    3000
  );
  res.json(data);
});

router.post('/memory', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent(
    `/api/memory`,
    { success: false, error: 'SuperAgent memory unavailable' },
    workspace,
    3000,
    'POST',
    req.body
  );
  res.json(data);
});

// Installed Skills REST Proxy
router.get('/skills', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/skills', { skills: [] }, workspace, 3000);
  res.json(data);
});

// Detailed Skills Proxy
router.get('/skills/detail', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/skills', { skills: [] }, workspace, 3000);
  res.json(data);
});

// Session history → fetch cleaned & formatted sessions from sessionManager
router.get('/sessions/search', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const q = (req.query.q as string) || '';
  const limit = (req.query.limit as string) || '50';
  const data = await proxyToSuperAgent(`/api/history/search?q=${encodeURIComponent(q)}&limit=${limit}`, { success: true, results: [] }, workspace, 3000);
  res.json(data);
});

router.get('/sessions', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
  const data = await getWorkspaceSessions(workspace, limit, offset);
  res.json(data);
});

router.get('/sessions/:id', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
  const data = await getSessionMessages(workspace, req.params.id, limit, offset);
  res.json(data);
});

router.post('/sessions', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/history/session', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.delete('/sessions/:id', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent(`/api/history/session/${encodeURIComponent(req.params.id)}`, { success: false }, workspace, 3000, 'DELETE');
  res.json(data);
});

// Session export / import → proxy to SA
router.get('/sessions/:id/export', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const format = (req.query.format as string) || 'json';
  const data = await proxyToSuperAgent(`/api/history/session/${encodeURIComponent(req.params.id)}/export?format=${format}`, { error: 'Export unavailable' }, workspace, 5000);
  res.json(data);
});

router.post('/sessions/import', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/history/import', { success: false }, workspace, 5000, 'POST', req.body);
  res.json(data);
});

// System settings → proxy to SA (POST /api/config with settings)
router.post('/config/settings', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/config', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

// MCP Server CRUD → proxy to SA
router.get('/config/mcp', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/config/mcp', { servers: [] }, workspace, 3000);
  res.json(data);
});

router.post('/config/mcp/reload', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/config/mcp/reload', { success: false }, workspace, 3000, 'POST', req.body || {});
  res.json(data);
});

router.post('/config/mcp', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/config/mcp', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.delete('/config/mcp/:name', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent(`/api/config/mcp/${encodeURIComponent(req.params.name)}`, { success: false }, workspace, 3000, 'DELETE');
  res.json(data);
});

// Trusted directory management → proxy to SA
router.post('/config/trusted-directory', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/config/trusted-directory', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.delete('/config/trusted-directory', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/config/trusted-directory', { success: false }, workspace, 3000, 'DELETE', req.body);
  res.json(data);
});

// System & Server Status → proxy to SA
router.get('/status', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/status', { status: 'offline' }, workspace, 3000);
  res.json(data);
});

// Workspaces List → proxy to SA
router.get('/workspaces', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/workspaces', { workspaces: [] }, workspace, 3000);
  res.json(data);
});

// Documents Management → proxy to SA
router.get('/documents', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/documents', { documents: [] }, workspace, 3000);
  res.json(data);
});

router.post('/documents', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/documents', { success: false }, workspace, 5000, 'POST', req.body);
  res.json(data);
});

router.delete('/documents', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/documents', { success: false }, workspace, 5000, 'DELETE', req.body);
  res.json(data);
});

// Git Changes / Diff Monitor → proxy to SA
router.get('/git/changes', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/git/changes', { changes: [] }, workspace, 3000);
  res.json(data);
});

// Prompt / Input History → proxy to SA
router.get('/input-history', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/input-history', { history: [] }, workspace, 3000);
  res.json(data);
});

router.post('/input-history', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/input-history', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

// Background Tasks Monitor & Kill → proxy to SA
router.get('/background-tasks', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/background-tasks', { tasks: [] }, workspace, 3000);
  res.json(data);
});

router.post('/background-tasks/kill', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/background-tasks/kill', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.delete('/background-tasks/:id', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/background-tasks/kill', { success: false }, workspace, 3000, 'POST', { id: req.params.id });
  res.json(data);
});

// Workspace File Operations → proxy to SA
router.get('/workspace/files', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/workspace/files', { files: [] }, workspace, 3000);
  res.json(data);
});

router.get('/workspace/file/read', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const filePath = (req.query.path as string) || '';
  const data = await proxyToSuperAgent('/api/workspace/file/read', { content: '' }, workspace, 5000, 'POST', { filepath: filePath });
  res.json(data);
});

router.post('/workspace/file/open', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/workspace/file/open', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

// Advisor Status → proxy to SA
router.get('/advisor/status', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/advisor/status', { active: false }, workspace, 3000);
  res.json(data);
});

// Browser Automation: Macros → proxy to SA
router.get('/browser/macros', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/browser/macros', { macros: [] }, workspace, 3000);
  res.json(data);
});

router.post('/browser/macros', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/browser/macros', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.delete('/browser/macros', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/browser/macros', { success: false }, workspace, 3000, 'DELETE', req.body);
  res.json(data);
});

// Browser Automation: Detect UI (UI-DETR-1) → proxy to SA
router.post('/browser/detect-ui', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/browser/detect-ui', { detections: [] }, workspace, 10000, 'POST', req.body);
  res.json(data);
});

// Browser Automation: Step Execution Result → proxy to SA
router.post('/browser/result', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/browser/result', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

// Server Shutdown → proxy to SA
router.post('/shutdown', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/shutdown', { success: true }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

// Workspace Switch → proxy to SA
router.post('/switch-workspace', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/switch-workspace', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

// Advisor Events SSE / status proxy
router.get('/advisor/events', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/advisor/events', { events: [] }, workspace, 3000);
  res.json(data);
});

// Browser Automation: Update Chrome Instance State → proxy to SA
router.post('/browser/update-instance', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/browser/update-instance', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

// Workspace Chain APIs proxied to SuperAgent
router.get('/workspace/chains', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const filter = (req.query.filter as string) || 'true';
  const data = await proxyToSuperAgent(`/api/workspace/chains?filter=${filter}`, { success: false, chains: [] }, workspace, 3000);
  res.json(data);
});

router.get('/workspace/chains/active', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/workspace/chains/active', { success: false, activeChainId: null }, workspace, 3000);
  res.json(data);
});

router.post('/workspace/chains/active', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/workspace/chains/active', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.post('/workspace/chains', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/workspace/chains', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.delete('/workspace/chains', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/workspace/chains', { success: false }, workspace, 3000, 'DELETE', req.body);
  res.json(data);
});

router.post('/workspace/chains/nodes', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/workspace/chains/nodes', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.delete('/workspace/chains/nodes', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/workspace/chains/nodes', { success: false }, workspace, 3000, 'DELETE', req.body);
  res.json(data);
});

router.post('/workspace/chains/switch-node', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/workspace/chains/switch-node', { success: false }, workspace, 3000, 'POST', req.body);
  res.json(data);
});

router.get('/workspace/chains/health', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/workspace/chains/health', { success: false, healthTable: '', healthData: [] }, workspace, 15000);
  res.json(data);
});

router.get('/workspace/chains/status', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent('/api/workspace/chains/status', { success: false, status: [], activeNodeId: null }, workspace, 3000);
  res.json(data);
});

export default router;
