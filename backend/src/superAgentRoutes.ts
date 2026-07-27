import { Router } from 'express';
import http from 'http';
import { authMiddleware } from './auth';
import { 
  getAuditLogs, 
  clearAuditLogs, 
  getCliPromptHistory, 
  saveCliPromptHistory,
  sendSuperAgentRequest
} from './superAgentBridge';
import {
  loadMergedPresets,
  setActivePreset,
  saveProviderProfile,
  deleteProviderProfile,
  setActiveProviderProfile,
  getProviderModels,
  saveCustomPreset,
  deleteCustomPreset,
  updateSystemSettings,
  getMcpServers,
  saveMcpServer,
  reloadMcpServers,
  deleteMcpServer,
  addTrustedDirectoryViaServer,
  removeTrustedDirectory,
  exportSessionContent,
  importSessionData
} from './presetUtils';
import {
  getWorkspaceSessions,
  getSessionMessages,
  saveWorkspaceSession,
  deleteWorkspaceSession
} from './sessionManager';

const router = Router();

// Apply authMiddleware globally to all routes in this router
router.use(authMiddleware);

// Audit logs routes
router.get('/audit-logs', (req, res) => {
  try {
    res.json(getAuditLogs());
  } catch (e) {
    res.status(500).json({ error: 'Failed to read audit logs' });
  }
});

router.delete('/audit-logs', (req, res) => {
  try {
    clearAuditLogs();
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to clear audit logs' });
  }
});

// History routes
router.get('/history', async (req, res) => {
  try {
    const history = await getCliPromptHistory();
    res.json({ history });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to read CLI history: ' + e.message });
  }
});

router.post('/history', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Prompt text is required' });
  }
  try {
    await saveCliPromptHistory(text);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to save CLI history: ' + e.message });
  }
});

// Config & preset routes
router.get('/config', async (_req, res) => {
  try {
    const data = await loadMergedPresets();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read preset config: ' + err.message });
  }
});

router.post('/config/active-preset', async (req, res) => {
  const { mode, presetId } = req.body;
  if (!mode || !presetId) {
    return res.status(400).json({ error: 'Mode and presetId are required' });
  }
  try {
    const result = await setActivePreset(mode, presetId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update active preset: ' + err.message });
  }
});

router.post('/config/provider', async (req, res) => {
  const { provider } = req.body;
  if (!provider || !provider.id || !provider.name || !provider.type) {
    return res.status(400).json({ error: 'Provider ID, name, and type are required' });
  }
  try {
    const result = await saveProviderProfile(provider);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save provider profile: ' + err.message });
  }
});

router.delete('/config/provider/:id', async (req, res) => {
  const providerId = req.params.id;
  if (!providerId) {
    return res.status(400).json({ error: 'Provider ID is required' });
  }
  try {
    const result = await deleteProviderProfile(providerId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete provider profile: ' + err.message });
  }
});

router.post('/config/active-provider', async (req, res) => {
  const { providerId } = req.body;
  if (!providerId) {
    return res.status(400).json({ error: 'Provider ID is required' });
  }
  try {
    const result = await setActiveProviderProfile(providerId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update active provider: ' + err.message });
  }
});

router.get('/config/provider-models', async (req, res) => {
  const providerId = (req.query.providerId as string) || '';
  try {
    const data = await getProviderModels(providerId);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch provider models: ' + err.message });
  }
});

router.post('/config/preset', async (req, res) => {
  const { mode, preset } = req.body;
  if (!mode || !preset || !preset.name) {
    return res.status(400).json({ error: 'Mode and preset name are required' });
  }
  try {
    const data = await saveCustomPreset(mode as 'single' | 'multi', preset);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save custom preset: ' + err.message });
  }
});

router.delete('/config/preset/:mode/:id', async (req, res) => {
  const { mode, id } = req.params;
  if (!mode || !id) {
    return res.status(400).json({ error: 'Mode and preset ID are required' });
  }
  try {
    const data = await deleteCustomPreset(mode as 'single' | 'multi', id);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete custom preset: ' + err.message });
  }
});

// Helper for forwarding GET requests to SuperAgent HTTP Server (port 7888)
function proxyToSuperAgent(pathName: string, fallback: any, workspace?: string, timeoutMs: number = 1500): Promise<any> {
  return new Promise((resolve) => {
    const url = workspace
      ? `http://127.0.0.1:7888${pathName}?workspace=${encodeURIComponent(workspace)}`
      : `http://127.0.0.1:7888${pathName}`;
    const headers: Record<string, string> = {};
    if (workspace) headers['x-workspace-path'] = workspace;

    const req = http.get(url, { headers, timeout: timeoutMs }, (resp) => {
      let body = '';
      resp.on('data', chunk => { body += chunk; });
      resp.on('end', () => {
        try { resolve(JSON.parse(body)); } catch { resolve(fallback); }
      });
    });
    req.on('error', () => resolve(fallback));
    req.on('timeout', () => { req.destroy(); resolve(fallback); });
  });
}

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
  const query = (req.query.query as string) || '';
  const scope = (req.query.scope as string) || 'all';
  const data = await proxyToSuperAgent(`/api/memory/search?query=${encodeURIComponent(query)}&scope=${encodeURIComponent(scope)}`, { memories: [] });
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

// Installed Skills REST Proxy
router.get('/skills', async (_req, res) => {
  const data = await proxyToSuperAgent('/api/skills', { skills: [] });
  res.json(data);
});

// Chat Session history sync endpoints (100% SuperAgent HTTP Server)
router.get('/sessions', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
  try {
    const result = await getWorkspaceSessions(workspace, limit, offset);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to read workspace sessions: ' + e.message });
  }
});

router.get('/sessions/:id', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const sessionId = req.params.id;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
  try {
    const result = await getSessionMessages(workspace, sessionId, limit, offset);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to read session messages: ' + e.message });
  }
});

router.post('/sessions', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const { session, messages } = req.body;
  if (!session || !session.id || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Session metadata and messages array are required' });
  }
  try {
    await saveWorkspaceSession(workspace, session, messages);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to save workspace session: ' + e.message });
  }
});

router.delete('/sessions/:id', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const sessionId = req.params.id;
  try {
    const success = await deleteWorkspaceSession(workspace, sessionId);
    if (success) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete workspace session' });
    }
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to delete workspace session: ' + e.message });
  }
});

// Proxy: Get installed skills from SuperAgent for autocomplete
router.get('/skills', async (_req, res) => {
  const data = await proxyToSuperAgent('/api/skills', { skills: [], error: 'SuperAgent not running' }, undefined, 2000);
  res.json(data);
});

// System settings update
router.post('/config/settings', async (req, res) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== 'object') {
    return res.status(400).json({ error: 'settings object is required' });
  }
  try {
    const result = await updateSystemSettings(settings);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update settings: ' + err.message });
  }
});

// MCP Server CRUD
router.get('/config/mcp', async (_req, res) => {
  try {
    res.json(await getMcpServers());
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch MCP servers: ' + err.message });
  }
});

router.post('/config/mcp/reload', async (_req, res) => {
  try {
    res.json({ success: true, ...(await reloadMcpServers()) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reload MCP servers: ' + err.message });
  }
});

router.post('/config/mcp', async (req, res) => {
  const { name, command, args, env } = req.body;
  if (!name || !command) {
    return res.status(400).json({ error: 'name and command are required' });
  }
  try {
    res.json({ success: true, ...(await saveMcpServer({ name, command, args, env })) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save MCP server: ' + err.message });
  }
});

router.delete('/config/mcp/:name', async (req, res) => {
  try {
    res.json({ success: true, ...(await deleteMcpServer(req.params.name)) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete MCP server: ' + err.message });
  }
});

// Session export / import
router.get('/sessions/:id/export', async (req, res) => {
  const format = (req.query.format as 'json' | 'markdown') || 'json';
  try {
    const content = await exportSessionContent(req.params.id, format);
    res.setHeader('Content-Type', format === 'markdown' ? 'text/markdown; charset=utf-8' : 'application/json; charset=utf-8');
    res.send(content);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to export session: ' + err.message });
  }
});

router.post('/sessions/import', async (req, res) => {
  const { session, messages } = req.body;
  if (!session?.id) {
    return res.status(400).json({ error: 'session.id is required' });
  }
  try {
    res.json(await importSessionData(session, messages || []));
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to import session: ' + err.message });
  }
});

// Trusted directory management
router.post('/config/trusted-directory', async (req, res) => {
  const { path: dirPath } = req.body;
  if (!dirPath) return res.status(400).json({ error: 'path is required' });
  try {
    res.json({ success: true, ...(await addTrustedDirectoryViaServer(dirPath)) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to add trusted directory: ' + err.message });
  }
});

router.delete('/config/trusted-directory', async (req, res) => {
  const { path: dirPath } = req.body;
  if (!dirPath) return res.status(400).json({ error: 'path is required' });
  try {
    res.json({ success: true, ...(await removeTrustedDirectory(dirPath)) });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to remove trusted directory: ' + err.message });
  }
});

// Memory & Shared Memory Proxy
router.get('/memory', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const query = (req.query.query as string) || '';
  const scope = (req.query.scope as string) || 'all';
  const data = await proxyToSuperAgent(
    `/api/memory?workspace=${encodeURIComponent(workspace)}&query=${encodeURIComponent(query)}&scope=${encodeURIComponent(scope)}`,
    { memory: [], sharedMemory: [], error: 'SuperAgent memory unavailable' },
    (req.headers.authorization as string) || '',
    3000
  );
  res.json(data);
});

router.post('/memory', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent(
    `/api/memory?workspace=${encodeURIComponent(workspace)}`,
    { success: false, error: 'SuperAgent memory unavailable' },
    (req.headers.authorization as string) || '',
    3000
  );
  res.json(data);
});

// Detailed Skills Proxy
router.get('/skills/detail', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const data = await proxyToSuperAgent(
    `/api/skills/detail?workspace=${encodeURIComponent(workspace)}`,
    { skills: [], error: 'SuperAgent skills unavailable' },
    (req.headers.authorization as string) || '',
    3000
  );
  res.json(data);
});

export default router;

