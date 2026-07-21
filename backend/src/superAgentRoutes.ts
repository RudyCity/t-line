import { Router } from 'express';
import http from 'http';
import { authMiddleware } from './auth';
import { 
  getAuditLogs, 
  clearAuditLogs, 
  getCliPromptHistory, 
  saveCliPromptHistory 
} from './superAgentBridge';
import {
  loadMergedPresets,
  setActivePreset,
  saveProviderProfile,
  deleteProviderProfile,
  setActiveProviderProfile,
  getProviderModels,
  saveCustomPreset,
  deleteCustomPreset
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
router.get('/config', (req, res) => {
  try {
    const data = loadMergedPresets();
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to read preset config: ' + err.message });
  }
});

router.post('/config/active-preset', (req, res) => {
  const { mode, presetId } = req.body;
  if (!mode || !presetId) {
    return res.status(400).json({ error: 'Mode and presetId are required' });
  }
  try {
    const result = setActivePreset(mode, presetId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update active preset: ' + err.message });
  }
});

router.post('/config/provider', (req, res) => {
  const { provider } = req.body;
  if (!provider || !provider.id || !provider.name || !provider.type) {
    return res.status(400).json({ error: 'Provider ID, name, and type are required' });
  }
  try {
    const result = saveProviderProfile(provider);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save provider profile: ' + err.message });
  }
});

router.delete('/config/provider/:id', (req, res) => {
  const providerId = req.params.id;
  if (!providerId) {
    return res.status(400).json({ error: 'Provider ID is required' });
  }
  try {
    const result = deleteProviderProfile(providerId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete provider profile: ' + err.message });
  }
});

router.post('/config/active-provider', (req, res) => {
  const { providerId } = req.body;
  if (!providerId) {
    return res.status(400).json({ error: 'Provider ID is required' });
  }
  try {
    const result = setActiveProviderProfile(providerId);
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

router.post('/config/preset', (req, res) => {
  const { mode, preset } = req.body;
  if (!mode || !preset || !preset.name) {
    return res.status(400).json({ error: 'Mode and preset name are required' });
  }
  try {
    const data = saveCustomPreset(mode as 'single' | 'multi', preset);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to save custom preset: ' + err.message });
  }
});

router.delete('/config/preset/:mode/:id', (req, res) => {
  const { mode, id } = req.params;
  if (!mode || !id) {
    return res.status(400).json({ error: 'Mode and preset ID are required' });
  }
  try {
    const data = deleteCustomPreset(mode as 'single' | 'multi', id);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete custom preset: ' + err.message });
  }
});

// Running instances monitor
router.get('/instances', (req, res) => {
  const emptyResult = { subagents: [], superagents: [] };
  let responded = false;

  const safeSend = (data: any) => {
    if (responded) return;
    responded = true;
    res.json(data);
  };

  const request = http.get('http://127.0.0.1:7888/api/instances', { timeout: 1500 }, (resp) => {
    let body = '';
    resp.on('data', chunk => { body += chunk; });
    resp.on('end', () => {
      try {
        safeSend(JSON.parse(body));
      } catch {
        safeSend(emptyResult);
      }
    });
  });

  request.on('error', () => {
    safeSend(emptyResult);
  });

  request.on('timeout', () => {
    request.destroy();
    safeSend(emptyResult);
  });
});

// Checklist tasks monitor (task.md)
router.get('/tasks', (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const emptyResult = { tasks: [], missing: true };
  let responded = false;

  const safeSend = (data: any) => {
    if (responded) return;
    responded = true;
    res.json(data);
  };

  const url = `http://127.0.0.1:7888/api/tasks?workspace=${encodeURIComponent(workspace)}`;
  const request = http.get(url, {
    headers: { 'x-workspace-path': workspace },
    timeout: 1500
  }, (resp) => {
    let body = '';
    resp.on('data', chunk => { body += chunk; });
    resp.on('end', () => {
      try {
        safeSend(JSON.parse(body));
      } catch {
        safeSend(emptyResult);
      }
    });
  });

  request.on('error', () => { safeSend(emptyResult); });
  request.on('timeout', () => { request.destroy(); safeSend(emptyResult); });
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

export default router;
