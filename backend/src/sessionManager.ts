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

// ─── Helpers ──────────────────────────────────────────────────

export function closeSessionDb() {}

const NOISE_PREFIXES = ['[RMemory', '[TencentDB', '[Emergency', '[Context', '[SYS]', '[System', '[memory]', '[memory', '- [memory]', '-[memory]', '<relevant-memories>'];
const NOISE_SUBSTRINGS = ['Agent Memory Context', 'Emergency Summary', 'Context Restoration', '[memory]', '[SYS]'];

function isNoiseMessageContent(content: string): boolean {
  if (!content) return true;
  const c = content.trim();
  return NOISE_PREFIXES.some(p => c.startsWith(p)) || NOISE_SUBSTRINGS.some(s => c.includes(s));
}

const GENERIC_GREETINGS_REGEX = /^(hallo|hai|hello|hi|hey|p|ping|test|halo|selamat\s+(pagi|siang|sore|malam)|bro|gan|min)$/i;
const GENERIC_STOP_CMDS_REGEX = /^(stop|stop\s+semua|clear|exit|quit|cancel|batal|selesai|done|ok|sip|mantap|terima\s+kasih|thanks|thx)$/i;

export function cleanSessionTitle(title: string): string {
  if (!title) return 'New Chat';
  let t = title.trim();

  // Remove XML-like tags
  t = t.replace(/<[^>]+>/g, '');

  // Strip [Last: ...] or [First: ...] headers
  t = t.replace(/^.*?\[Last:\s*/gi, '');
  t = t.replace(/^\[First:.*?\]\s*(→|->|➔)?\s*/gi, '');

  // Handle legacy "Prompt Awal → Prompt Akhir" titles
  if (t.includes('→') || t.includes('➔') || t.includes('->')) {
    const parts = t.split(/\s*(?:→|➔|->)\s*/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const nonGreeting = parts.find(p => !GENERIC_GREETINGS_REGEX.test(p) && !GENERIC_STOP_CMDS_REGEX.test(p));
      t = nonGreeting || parts[0];
    }
  }

  // Remove memory/system bracketed tags
  t = t.replace(/(?:-\s*)?\[(?:memory|sys|system|context|rmemory|tencentdb|emergency)[^\]]*\]/gi, '');

  // Remove CLI prompt headers, role prefixes
  t = t.replace(/^(PS\s+)?[a-zA-Z]:\\[^>\n]+>\s*/gi, '');
  t = t.replace(/^PS\s+[a-zA-Z]:\\[^\s]+\s*(➔|->|→)?\s*/gi, '');
  t = t.replace(/^(User|Assistant|System):\s*/gi, '');

  // Remove leading slash commands
  t = t.replace(/^(\/[a-zA-Z0-9_-]+\s*)+/gi, '');

  // Clean leading/trailing hyphens, colons, pipes, dots, brackets, arrows, and whitespace
  t = t.replace(/^[\[\]\s\-:_|→➔>]+/, '');
  t = t.replace(/[\[\]\s\-:_|→➔>]+$/, '');

  // Convert raw path keys (e.g. D__backup_from_pc_asus...) into clean workspace names
  if (/^[a-zA-Z]:?__/i.test(t) || t.includes('__Documents_Development_')) {
    const parts = t.split('_').filter(p => p && !/^(d|backup|from|pc|asus|documents|development)$/i.test(p) && !/^\d+$/.test(p));
    t = parts.join('-') || 'Workspace Session';
  }

  // Deduplicate trailing fragments separated by ' - '
  if (t.includes(' - ')) {
    const parts = t.split(/\s+-\s+/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      const [first, second] = parts;
      if (second && (first.toLowerCase().includes(second.toLowerCase()) || second.length <= 3 || /^[a-z0-9]$/i.test(second))) {
        t = first;
      } else if (first) {
        t = first;
      }
    }
  }

  t = t.replace(/\s{2,}/g, ' ').trim();
  if (!t || t.toLowerCase() === 'new chat') return 'New Chat';
  return t;
}

function extractCleanUserText(content: string): string {
  if (!content) return '';
  let text = content.trim();

  // If text starts with injected memory/context noise, extract the actual prompt lines
  const lines = text.split('\n');
  const cleanLines = lines.filter(line => {
    const l = line.trim();
    if (!l) return false;
    if (NOISE_PREFIXES.some(p => l.startsWith(p))) return false;
    if (NOISE_SUBSTRINGS.some(s => l.includes(s))) return false;
    return true;
  });

  if (cleanLines.length > 0) {
    text = cleanLines.join(' ').trim();
  }

  if (text.includes('<USER_REQUEST>') || text.includes('<user_request>')) {
    text = text.replace(/<\/?user_request>/gi, '').trim();
  }

  text = cleanSessionTitle(text);
  if (isNoiseMessageContent(text)) return '';
  return text;
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
      'x-workspace-path': wsPath,
      'x-client-mode': 'tline'
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
        const rawFirst = (s.firstChat || '').replace(/^(User|Assistant|System):\s*/i, '').trim();
        const rawLast = (s.lastChat || '').replace(/^(User|Assistant|System):\s*/i, '').trim();

        const cleanFirst = extractCleanUserText(rawFirst).split('\n')[0].trim();
        const cleanLast = extractCleanUserText(rawLast).split('\n')[0].trim();

        const firstSubstantive = cleanFirst && !GENERIC_GREETINGS_REGEX.test(cleanFirst) ? cleanFirst : null;
        const lastSubstantive = cleanLast && !GENERIC_GREETINGS_REGEX.test(cleanLast) && !GENERIC_STOP_CMDS_REGEX.test(cleanLast) ? cleanLast : null;

        const candidate = firstSubstantive || cleanFirst || lastSubstantive || cleanLast || (
          s.displayName && 
          !isNoiseMessageContent(s.displayName) && 
          s.displayName !== s.id && 
          !s.displayName.startsWith('sess/') && 
          !s.displayName.startsWith('sess_') && 
          !s.displayName.startsWith('session_') ? s.displayName : ''
        );

        title = cleanSessionTitle(candidate);
        if (title.length > 45) {
          title = title.slice(0, 45).trim() + '...';
        }

        title = cleanSessionTitle(title);
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
    // Fetch history messages directly from SuperAgent server (FAST lookup without blocking init)
    const response = await requestSuperAgentServer(`/api/history?sessionId=${encodeURIComponent(actualId)}`, 'GET', undefined, workspace);

    if (response && response.success && Array.isArray(response.messages)) {
      const guiMsgs: SuperAgentMessage[] = [];

      for (const rawMsg of response.messages) {
        if (!rawMsg) continue;
        const role = rawMsg.role || 'assistant';
        const content = rawMsg.content || rawMsg.text || '';

        if (role !== 'tool' && role !== 'thought' && isNoiseMessageContent(content)) continue;

        const thoughtText = rawMsg.reasoning || rawMsg.thought || rawMsg.thinking || (role === 'thought' ? content : null);
        if (thoughtText) {
          guiMsgs.push({ role: 'thought', text: thoughtText });
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
        } else if (Array.isArray(rawMsg.toolResults) && rawMsg.toolResults.length > 0) {
          const first = rawMsg.toolResults[0];
          rawResult = (typeof first === 'object' && first !== null && first.result !== undefined) ? first.result : first;
        } else if (Array.isArray(rawMsg.tool_results) && rawMsg.tool_results.length > 0) {
          const first = rawMsg.tool_results[0];
          rawResult = (typeof first === 'object' && first !== null && first.result !== undefined) ? first.result : first;
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

/** Save a session and sync title & messages to SuperAgent Server SQLite database */
export async function saveWorkspaceSession(
  workspace: string,
  session: ChatSession,
  messages: SuperAgentMessage[]
) {
  try {
    let sessionId = session.id;
    if (sessionId.includes('::')) {
      sessionId = sessionId.split('::')[1];
    }
    // Persist session title & messages metadata directly to SuperAgent SQLite database
    const cleanTitle = extractCleanUserText(session.title);
    const titleToSave = cleanTitle && cleanTitle !== 'New Chat' ? cleanTitle : session.title;
    
    await requestSuperAgentServer('/api/history/session', 'POST', {
      session: {
        id: sessionId,
        title: titleToSave,
        updatedAt: session.updatedAt || Date.now()
      },
      messages: Array.isArray(messages) ? messages : []
    }, workspace);
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

