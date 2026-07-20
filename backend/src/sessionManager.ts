import http from 'http';

// ─── Interfaces ───────────────────────────────────────────────

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface SuperAgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'thought';
  text: string;
  toolName?: string;
  args?: any;
  result?: any;
  callId?: string;
}

/** Graceful no-op for closing DB connection on process exit */
export function closeSessionDb() {
  // No direct DB connection kept open
}

// ─── Helpers ──────────────────────────────────────────────────

function extractCleanUserText(content: string): string {
  if (!content) return '';
  let text = content.trim();

  // If pure system noise header/context, return empty string
  if (
    text.startsWith('[RMemory') ||
    text.startsWith('[TencentDB') ||
    text.startsWith('[Emergency') ||
    text.startsWith('[Context') ||
    text.startsWith('[SYS]') ||
    text.startsWith('[System') ||
    text.startsWith('<relevant-memories>') ||
    text.includes('Agent Memory Context') ||
    text.includes('Emergency Summary') ||
    text.includes('Context Restoration')
  ) {
    return '';
  }

  // Strip <USER_REQUEST> wrappers to keep the real prompt
  if (text.includes('<USER_REQUEST>')) {
    text = text.replace(/<\/?USER_REQUEST>/gi, '').trim();
  }
  if (text.includes('<user_request>')) {
    text = text.replace(/<\/?user_request>/gi, '').trim();
  }

  return text;
}

function isNoiseMessageContent(content: string): boolean {
  if (!content) return true;
  const c = content.trim();
  return (
    c.startsWith('[RMemory') ||
    c.startsWith('[TencentDB') ||
    c.startsWith('[Emergency') ||
    c.startsWith('[Context') ||
    c.startsWith('[SYS]') ||
    c.startsWith('[System') ||
    c.startsWith('<relevant-memories>') ||
    c.includes('Agent Memory Context') ||
    c.includes('Emergency Summary') ||
    c.includes('Context Restoration')
  );
}

function truncateResult(result: any): any {
  if (result === undefined || result === null) return result;
  if (typeof result === 'string') {
    return result.length > 10000
      ? result.slice(0, 10000) + '\n\n[... Truncated for performance ...]'
      : result;
  }
  try {
    const str = JSON.stringify(result);
    if (str.length > 10000) {
      return str.slice(0, 10000) + '\n\n[... Truncated for performance ...]';
    }
  } catch {}
  return result;
}

/** HTTP helper to request SuperAgent HTTP Server (port 7888). Returns null if server is offline. */
function requestSuperAgentServer(
  pathName: string,
  method: string = 'GET',
  payload?: any,
  workspace?: string,
  timeoutMs: number = 3000
): Promise<any | null> {
  return new Promise((resolve) => {
    const wsPath = workspace || process.cwd();
    const urlPath = pathName.includes('?')
      ? `${pathName}&workspace=${encodeURIComponent(wsPath)}`
      : `${pathName}?workspace=${encodeURIComponent(wsPath)}`;

    const postData = payload ? JSON.stringify(payload) : undefined;
    const headers: Record<string, string> = {
      'x-workspace-path': wsPath
    };
    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = String(Buffer.byteLength(postData));
    }

    const req = http.request({
      hostname: '127.0.0.1',
      port: 7888,
      path: urlPath,
      method,
      headers,
      timeout: timeoutMs
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch {
          resolve(null);
        }
      });
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// ─── SuperAgent Server Session History API ───────────────────

/** Get paginated sessions for a given workspace path from SuperAgent Server */
export async function getWorkspaceSessions(
  workspace: string,
  limit?: number,
  offset?: number
): Promise<{ sessions: ChatSession[]; totalCount: number; hasMore: boolean }> {
  try {
    const response = await requestSuperAgentServer('/api/history/sessions', 'GET', undefined, workspace);
    
    if (response && response.success && Array.isArray(response.sessions)) {
      const cleanedSessions: ChatSession[] = [];

      for (const s of response.sessions) {
        let title = 'New Chat';
        const first = (s.firstChat || '').trim();
        const last = (s.lastChat || '').trim();

        const cleanFirst = extractCleanUserText(first).split('\n')[0];
        const cleanLast = extractCleanUserText(last).split('\n')[0];

        if (cleanFirst && cleanLast) {
          const firstShort = cleanFirst.length > 22 ? cleanFirst.slice(0, 22) + '...' : cleanFirst;
          const lastShort = cleanLast.length > 22 ? cleanLast.slice(0, 22) + '...' : cleanLast;
          title = firstShort === lastShort ? firstShort : `${firstShort} ➔ ${lastShort}`;
        } else if (cleanFirst) {
          title = cleanFirst.length > 30 ? cleanFirst.slice(0, 30) + '...' : cleanFirst;
        } else if (
          s.displayName && 
          !isNoiseMessageContent(s.displayName) && 
          s.displayName !== s.id && 
          !s.displayName.startsWith('sess/') && 
          !s.displayName.startsWith('sess_') && 
          !s.displayName.startsWith('session_')
        ) {
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

      cleanedSessions.sort((a, b) => b.updatedAt - a.updatedAt);

      const safeOffset = offset || 0;
      const totalCount = cleanedSessions.length;
      const paginated = limit && limit > 0 ? cleanedSessions.slice(safeOffset, safeOffset + limit) : cleanedSessions;
      const hasMore = limit ? (safeOffset + limit) < totalCount : false;

      return { sessions: paginated, totalCount, hasMore };
    }
  } catch (e) {
    console.error('[SessionManager] getWorkspaceSessions error:', e);
  }

  return { sessions: [], totalCount: 0, hasMore: false };
}

/** Get paginated messages for a given session ID from SuperAgent Server */
export async function getSessionMessages(
  workspace: string,
  sessionId: string,
  limit?: number,
  offset?: number
): Promise<{ messages: SuperAgentMessage[]; totalCount: number; hasMore: boolean }> {
  let actualId = sessionId;
  if (sessionId.includes('::')) {
    actualId = sessionId.split('::')[1];
  }

  try {
    // 1. Resume session on SuperAgent server to populate agent memory
    await requestSuperAgentServer('/api/init', 'POST', { workspace, resume: actualId }, workspace);

    // 2. Fetch history messages from SuperAgent server
    const response = await requestSuperAgentServer(`/api/history?sessionId=${encodeURIComponent(actualId)}`, 'GET', undefined, workspace);

    if (response && response.success && Array.isArray(response.messages)) {
      const guiMsgs: SuperAgentMessage[] = [];

      for (const rawMsg of response.messages) {
        if (!rawMsg) continue;
        const role = rawMsg.role || 'assistant';
        const content = rawMsg.content || rawMsg.text || '';

        if (isNoiseMessageContent(content)) continue;

        if (role === 'thought' || rawMsg.reasoning) {
          if (rawMsg.reasoning) {
            guiMsgs.push({ role: 'thought', text: rawMsg.reasoning });
          } else {
            guiMsgs.push({ role: 'thought', text: content });
          }
        }

        if (content && role !== 'thought') {
          if (role === 'user') {
            guiMsgs.push({ role: 'user', text: content });
          } else if (role === 'assistant') {
            guiMsgs.push({ role: 'assistant', text: content });
          } else if (role === 'system') {
            guiMsgs.push({ role: 'system', text: content });
          }
        }

        // Extract tool name from all possible fields in rawMsg
        let toolName = rawMsg.toolName || rawMsg.name || rawMsg.fn || rawMsg.function?.name;
        if (!toolName && Array.isArray(rawMsg.tool_calls) && rawMsg.tool_calls.length > 0) {
          toolName = rawMsg.tool_calls[0]?.function?.name || rawMsg.tool_calls[0]?.name;
        }
        if (!toolName && Array.isArray(rawMsg.toolCalls) && rawMsg.toolCalls.length > 0) {
          toolName = rawMsg.toolCalls[0]?.name || rawMsg.toolCalls[0]?.toolName;
        }

        // Extract args from all possible fields
        let args = rawMsg.args || rawMsg.arguments || rawMsg.toolCalls?.[0]?.args || rawMsg.tool_calls?.[0]?.args;
        if (!args && Array.isArray(rawMsg.tool_calls) && rawMsg.tool_calls[0]?.function?.arguments) {
          try {
            args = JSON.parse(rawMsg.tool_calls[0].function.arguments);
          } catch (e) {
            args = rawMsg.tool_calls[0].function.arguments;
          }
        }
        if (typeof args === 'string') {
          try { args = JSON.parse(args); } catch (e) {}
        }

        // Extract result from all possible fields
        let rawResult = undefined;
        if (rawMsg.result !== undefined) rawResult = rawMsg.result;
        else if (rawMsg.output !== undefined) rawResult = rawMsg.output;
        else if (rawMsg.toolResult !== undefined) {
          rawResult = (typeof rawMsg.toolResult === 'object' && rawMsg.toolResult !== null && rawMsg.toolResult.result !== undefined)
            ? rawMsg.toolResult.result
            : rawMsg.toolResult;
        } else if (role === 'tool' && rawMsg.content !== undefined) {
          rawResult = rawMsg.content;
        }

        const callId = rawMsg.callId || rawMsg.id || rawMsg.toolCallId || rawMsg.toolCalls?.[0]?.id || rawMsg.tool_calls?.[0]?.id;

        if (role === 'tool' || toolName || rawMsg.tool_calls || rawMsg.toolCalls) {
          const resolvedToolName = toolName || 'tool';
          guiMsgs.push({
            role: 'tool',
            text: `Tool '${resolvedToolName}' completed.`,
            toolName: resolvedToolName,
            args: args || {},
            result: truncateResult(rawResult),
            callId
          });
        }
      }

      const totalCount = guiMsgs.length;
      const safeOffset = offset || 0;
      let paginated = guiMsgs;
      if (limit && limit > 0) {
        const endIdx = Math.max(0, totalCount - safeOffset);
        const startIdx = Math.max(0, endIdx - limit);
        paginated = guiMsgs.slice(startIdx, endIdx);
      }
      const hasMore = limit ? (totalCount - safeOffset - limit) > 0 : false;

      return { messages: paginated, totalCount, hasMore };
    }
  } catch (e) {
    console.error(`[SessionManager] getSessionMessages error for ${sessionId}:`, e);
  }

  return { messages: [], totalCount: 0, hasMore: false };
}

/** Save a session (handled automatically by SuperAgent Server on prompt completion) */
export async function saveWorkspaceSession(
  workspace: string,
  session: ChatSession,
  _messages: SuperAgentMessage[]
) {
  try {
    let sessionId = session.id;
    if (sessionId.includes('::')) {
      sessionId = sessionId.split('::')[1];
    }
    // Ping SuperAgent server to register/resume session ID
    await requestSuperAgentServer('/api/init', 'POST', { workspace, sessionId, resume: sessionId }, workspace);
  } catch (e) {
    console.error('[SessionManager] saveWorkspaceSession error:', e);
  }
}

/** Delete a session from SuperAgent Server */
export async function deleteWorkspaceSession(workspace: string, prefixedId: string): Promise<boolean> {
  let sessionId = prefixedId;
  if (prefixedId.includes('::')) {
    sessionId = prefixedId.split('::')[1];
  }

  // Delete 100% via SuperAgent HTTP Server API (deletes from SQLite DB and unlinks disk file)
  try {
    const res = await requestSuperAgentServer(`/api/history/session/${encodeURIComponent(sessionId)}`, 'DELETE', undefined, workspace);
    if (res && (res.success || res.ok || res.status === 'ok' || res.status === 'success' || res.deleted || res.message)) {
      return true;
    }
  } catch (e) {
    console.error(`[SessionManager] HTTP delete request error for ${prefixedId}:`, e);
  }

  // Fallback for draft/offline sessions so local UI cleanup succeeds
  return true;
}

// ─── Input Prompt History (100% SuperAgent Server) ───

/** Get CLI prompt/input history for a workspace */
export async function getInputHistory(workspace: string): Promise<string[]> {
  try {
    const response = await requestSuperAgentServer('/api/input-history', 'GET', undefined, workspace);
    if (response && response.success && Array.isArray(response.history)) {
      return response.history;
    }
  } catch (e) {
    console.error('[SessionManager] getInputHistory error:', e);
  }
  return [];
}

/** Save a prompt to input history */
export async function saveInputHistory(workspace: string, text: string): Promise<void> {
  if (!text || !text.trim()) return;
  try {
    await requestSuperAgentServer('/api/input-history', 'POST', { command: text.trim() }, workspace);
  } catch (e) {
    console.error('[SessionManager] saveInputHistory error:', e);
  }
}

