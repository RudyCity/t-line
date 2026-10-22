import { logE2E } from "./unifiedLogger";
import { Router } from 'express';
import http from 'http';
import { authMiddleware } from './auth';
import { sendSuperAgentRequest } from './superAgentBridge';
import { getSuperAgentServiceHeaders } from './superAgentAuth';
import { fetchParityReadAction, PARITY_READ_ACTIONS, type ParityReadAction } from './superAgentParityBridge';
import { streamTlineTaskEvents } from './superAgentTaskEvents';
import { forwardTaskCancel } from './superAgentTaskCancel';
import { forwardTlineRetry } from './superAgentTaskRetry';
import studioProxyRouter from './studioProxy';
import brainExplorerRouter from './brainExplorerRoutes';
import { getWorkspaceSessions, getSessionMessages } from './sessionManager';
import { getBrowserAgentSessions } from './browserSessions';

const router = Router();

// Apply authMiddleware globally to all routes in this router
router.use(authMiddleware);

// Studio is canonical; retain legacy /motion for already-running clients.
router.use('/studio', studioProxyRouter);
router.use('/motion', studioProxyRouter);
router.use('/brain', brainExplorerRouter);

// Read-only, authenticated browser session monitoring for the T-Line browser.
// The endpoint never returns CDP session capabilities or cookie data.
router.get('/browser/sessions', async (_req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getBrowserAgentSessions());
  } catch {
    res.status(503).json({ ok: false, error: 'Browser session metadata unavailable.' });
  }
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
      ? `http://127.0.0.1:7888${pathName}${separator}workspace=${encodeURIComponent(workspace)}`
      : `http://127.0.0.1:7888${pathName}`;
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
