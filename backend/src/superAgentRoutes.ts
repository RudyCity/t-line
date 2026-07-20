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
router.get('/history', (req, res) => {
  try {
    const history = getCliPromptHistory();
    res.json({ history });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to read CLI history: ' + e.message });
  }
});

router.post('/history', (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Prompt text is required' });
  }
  try {
    saveCliPromptHistory(text);
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
  const request = http.get('http://127.0.0.1:7888/api/instances', { timeout: 1500 }, (resp) => {
    let body = '';
    resp.on('data', chunk => { body += chunk; });
    resp.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        res.json(parsed);
      } catch {
        res.json({ subagents: [], superagents: [] });
      }
    });
  });

  request.on('error', () => {
    res.json({ subagents: [], superagents: [] });
  });

  request.on('timeout', () => {
    request.destroy();
    res.json({ subagents: [], superagents: [] });
  });
});

// Helper to fetch and clean session history from SuperAgent server
async function fetchSessionsFromSuperAgentServer(workspace: string): Promise<any[] | null> {
  return new Promise((resolve) => {
    const req = http.get(
      `http://127.0.0.1:7888/api/history/sessions?workspace=${encodeURIComponent(workspace)}`,
      {
        headers: { 'x-workspace-path': workspace },
        timeout: 2500
      },
      (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            if (data && data.success && Array.isArray(data.sessions)) {
              const cleanedSessions: any[] = [];

              for (const s of data.sessions) {
                let title = 'Untitled Chat';
                const first = (s.firstChat || '').trim();
                const last = (s.lastChat || '').trim();

                const isNoise = (str: string) => {
                  if (!str) return true;
                  return (
                    str.startsWith('[RMemory') ||
                    str.startsWith('[TencentDB') ||
                    str.startsWith('[Emergency') ||
                    str.startsWith('[Context') ||
                    str.startsWith('[SYS]') ||
                    str.startsWith('<USER_REQUEST>') ||
                    str.includes('Agent Memory Context')
                  );
                };

                const cleanFirst = !isNoise(first) ? first.split('\n')[0] : '';
                const cleanLast = !isNoise(last) ? last.split('\n')[0] : '';

                if (cleanFirst && cleanLast) {
                  const firstShort = cleanFirst.length > 22 ? cleanFirst.slice(0, 22) + '...' : cleanFirst;
                  const lastShort = cleanLast.length > 22 ? cleanLast.slice(0, 22) + '...' : cleanLast;
                  title = firstShort === lastShort ? firstShort : `${firstShort} ➔ ${lastShort}`;
                } else if (cleanFirst) {
                  title = cleanFirst.length > 30 ? cleanFirst.slice(0, 30) + '...' : cleanFirst;
                } else if (s.displayName && !isNoise(s.displayName)) {
                  title = s.displayName;
                }

                const lastMod = s.lastModified ? new Date(s.lastModified).getTime() : Date.now();

                cleanedSessions.push({
                  id: s.id,
                  title,
                  createdAt: lastMod,
                  updatedAt: lastMod
                });
              }

              // Deduplicate overlapping / draft sessions
              const uniqueSessions: any[] = [];
              for (const curr of cleanedSessions) {
                const dupIndex = uniqueSessions.findIndex(existing => {
                  const titleMatch = existing.title === curr.title ||
                    existing.title.includes(curr.title) ||
                    curr.title.includes(existing.title);
                  const timeDiff = Math.abs(existing.updatedAt - curr.updatedAt);
                  return titleMatch || (timeDiff < 300000 && (existing.title === 'Untitled Chat' || curr.title === 'Untitled Chat'));
                });

                if (dupIndex >= 0) {
                  if (curr.title !== 'Untitled Chat' && uniqueSessions[dupIndex].title === 'Untitled Chat') {
                    uniqueSessions[dupIndex] = curr;
                  }
                } else {
                  uniqueSessions.push(curr);
                }
              }

              uniqueSessions.sort((a, b) => b.updatedAt - a.updatedAt);
              resolve(uniqueSessions);
              return;
            }
          } catch {}
          resolve(null);
        });
      }
    );

    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

// Chat Session history sync endpoints
router.get('/sessions', async (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
  try {
    // 1. Try fetching directly from SuperAgent HTTP server
    const serverSessions = await fetchSessionsFromSuperAgentServer(workspace);
    if (serverSessions) {
      const safeOffset = offset || 0;
      const paginated = limit ? serverSessions.slice(safeOffset, safeOffset + limit) : serverSessions;
      const hasMore = limit ? (safeOffset + limit) < serverSessions.length : false;
      return res.json({ sessions: paginated, totalCount: serverSessions.length, hasMore });
    }

    // 2. Fallback to direct SQLite DB reading
    const result = getWorkspaceSessions(workspace, limit, offset);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to read workspace sessions: ' + e.message });
  }
});

router.get('/sessions/:id', (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const sessionId = req.params.id;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
  const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
  try {
    const result = getSessionMessages(workspace, sessionId, limit, offset);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to read session messages: ' + e.message });
  }
});

router.post('/sessions', (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const { session, messages } = req.body;
  if (!session || !session.id || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Session metadata and messages array are required' });
  }
  try {
    saveWorkspaceSession(workspace, session, messages);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to save workspace session: ' + e.message });
  }
});

router.delete('/sessions/:id', (req, res) => {
  const workspace = (req.query.workspace as string) || '';
  const sessionId = req.params.id;
  try {
    deleteWorkspaceSession(workspace, sessionId);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to delete workspace session: ' + e.message });
  }
});

export default router;
