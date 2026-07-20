import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';

const HISTORY_DB_PATH = path.join(os.homedir(), '.superagent-r', 'history.db');

// Lazy-init singleton DB connection
let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;
  try {
    _db = new Database(HISTORY_DB_PATH, { fileMustExist: true });
    _db.pragma('journal_mode = WAL');
    _db.pragma('busy_timeout = 5000');
    return _db;
  } catch (e) {
    console.error('[SessionManager] Failed to open history.db:', e);
    throw e;
  }
}

/** Gracefully close the DB on process exit */
export function closeSessionDb() {
  if (_db) {
    try { _db.close(); } catch {}
    _db = null;
  }
}

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
}

// ─── Helpers ──────────────────────────────────────────────────

/** Truncate large tool outputs to prevent UI lags */
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

function safeJsonParse(str: string | null | undefined): any {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}

// ─── Map SQLite rows → GUI messages ───────────────────────────

interface DbMessageRow {
  id: number;
  session_id: string;
  role: string;
  content: string;
  tool_calls: string | null;
  tool_results: string | null;
  reasoning: string | null;
  timestamp: number;
  sequence_order: number;
}

/** Map a single DB message row to one or more GUI SuperAgentMessages */
function mapDbRowToGuiMessages(row: DbMessageRow): SuperAgentMessage[] {
  const out: SuperAgentMessage[] = [];

  if (row.role === 'user') {
    out.push({ role: 'user', text: row.content || '' });
  } else if (row.role === 'assistant') {
    // 1. Thinking / reasoning
    if (row.reasoning) {
      out.push({ role: 'thought', text: row.reasoning });
    }
    // 2. Text content
    if (row.content) {
      out.push({ role: 'assistant', text: row.content });
    }
    // 3. Tool calls
    const toolCalls = safeJsonParse(row.tool_calls);
    if (Array.isArray(toolCalls)) {
      for (const tc of toolCalls) {
        if (tc && tc.name) {
          out.push({
            role: 'tool',
            text: `Invoking tool: ${tc.name}`,
            toolName: tc.name,
            args: tc.args || {}
          });
        }
      }
    }
  } else if (row.role === 'tool') {
    const toolResults = safeJsonParse(row.tool_results);
    if (Array.isArray(toolResults)) {
      for (const tr of toolResults) {
        out.push({
          role: 'tool',
          text: `Tool '${tr.name || 'tool'}' completed.`,
          toolName: tr.name || 'tool',
          result: truncateResult(tr.result !== undefined ? tr.result : '')
        });
      }
    } else if (row.content) {
      out.push({
        role: 'tool',
        text: 'Tool completed.',
        toolName: 'tool',
        result: truncateResult(row.content)
      });
    }
  } else if (row.role === 'system') {
    out.push({ role: 'system', text: row.content || '' });
  }

  return out;
}

// ─── Map GUI messages → SQLite insert rows ────────────────────

interface InsertMessageRow {
  role: string;
  content: string;
  tool_calls: string | null;
  tool_results: string | null;
  reasoning: string | null;
  timestamp: number;
  sequence_order: number;
}

function mapGuiToDbRows(msgs: SuperAgentMessage[]): InsertMessageRow[] {
  const rows: InsertMessageRow[] = [];
  const now = Date.now();

  for (let i = 0; i < msgs.length; i++) {
    const msg = msgs[i];
    const seq = i;

    if (msg.role === 'user') {
      rows.push({
        role: 'user', content: msg.text, tool_calls: null,
        tool_results: null, reasoning: null, timestamp: now, sequence_order: seq
      });
    } else if (msg.role === 'thought') {
      // Merge with next assistant message if available
      const next = msgs[i + 1];
      if (next && next.role === 'assistant') {
        rows.push({
          role: 'assistant', content: next.text, tool_calls: null,
          tool_results: null, reasoning: msg.text, timestamp: now, sequence_order: seq
        });
        i++; // skip next
      } else {
        rows.push({
          role: 'assistant', content: '', tool_calls: null,
          tool_results: null, reasoning: msg.text, timestamp: now, sequence_order: seq
        });
      }
    } else if (msg.role === 'assistant') {
      rows.push({
        role: 'assistant', content: msg.text, tool_calls: null,
        tool_results: null, reasoning: null, timestamp: now, sequence_order: seq
      });
    } else if (msg.role === 'tool') {
      if (msg.result !== undefined) {
        rows.push({
          role: 'tool', content: '', tool_calls: null,
          tool_results: JSON.stringify([{ name: msg.toolName, result: msg.result }]),
          reasoning: null, timestamp: now, sequence_order: seq
        });
      } else {
        // Tool invocation — attach to previous assistant row if possible
        const prev = rows[rows.length - 1];
        if (prev && prev.role === 'assistant') {
          const existing = safeJsonParse(prev.tool_calls) || [];
          existing.push({ name: msg.toolName, args: msg.args });
          prev.tool_calls = JSON.stringify(existing);
        } else {
          rows.push({
            role: 'assistant', content: '',
            tool_calls: JSON.stringify([{ name: msg.toolName, args: msg.args }]),
            tool_results: null, reasoning: null, timestamp: now, sequence_order: seq
          });
        }
      }
    } else if (msg.role === 'system') {
      rows.push({
        role: 'system', content: msg.text, tool_calls: null,
        tool_results: null, reasoning: null, timestamp: now, sequence_order: seq
      });
    }
  }

  return rows;
}

// ─── Public API ───────────────────────────────────────────────

/** Check if message content is internal noise or system injection */
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
    c.startsWith('<USER_REQUEST>') ||
    c.startsWith('<user_request>') ||
    c.includes('Agent Memory Context') ||
    c.includes('Emergency Summary') ||
    c.includes('Context Restoration')
  );
}

/** Format session title as First Chat ➔ Last Chat directly from SQLite messages */
function formatSessionTitleFromDb(db: any, sessionId: string, fallbackDisplayName?: string): string {
  try {
    const userMsgs = db.prepare(
      `SELECT content FROM messages WHERE session_id = ? AND role = 'user' AND content IS NOT NULL AND content != '' ORDER BY sequence_order ASC`
    ).all(sessionId) as { content: string }[];

    // Filter out memory context, emergency summaries & noise messages
    const realUserMsgs = userMsgs.filter(m => !isNoiseMessageContent(m.content));

    if (realUserMsgs.length === 0) {
      if (fallbackDisplayName && !fallbackDisplayName.includes('\\') && !fallbackDisplayName.includes('/') && !fallbackDisplayName.includes('RMemory') && !fallbackDisplayName.includes('Memory Context') && !fallbackDisplayName.includes('Emergency')) {
        return fallbackDisplayName;
      }
      return 'Untitled Chat';
    }

    const firstMsg = realUserMsgs[0].content.trim().split('\n')[0];
    const firstShort = firstMsg.length > 22 ? firstMsg.slice(0, 22) + '...' : firstMsg;

    if (realUserMsgs.length === 1) {
      return firstShort;
    }

    const lastMsg = realUserMsgs[realUserMsgs.length - 1].content.trim().split('\n')[0];
    const lastShort = lastMsg.length > 22 ? lastMsg.slice(0, 22) + '...' : lastMsg;

    if (firstShort === lastShort) {
      return firstShort;
    }

    return `${firstShort} ➔ ${lastShort}`;
  } catch (e) {
    return fallbackDisplayName || 'Untitled Chat';
  }
}

/** Deduplicate and purge redundant GUI and duplicate CLI sessions */
function cleanDuplicateWorkspaceSessions(db: any, normalizedWs: string) {
  try {
    const rows = db.prepare(
      `SELECT id, display_name, message_count, created_at, last_modified
       FROM sessions
       WHERE LOWER(REPLACE(working_directory, '\\', '/')) = ?
       ORDER BY created_at DESC`
    ).all(normalizedWs) as any[];

    if (rows.length < 2) return;

    const idsToDelete: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const rowA = rows[i];
      if (idsToDelete.includes(rowA.id)) continue;

      for (let j = i + 1; j < rows.length; j++) {
        const rowB = rows[j];
        if (idsToDelete.includes(rowB.id)) continue;

        const isGuiA = rowA.id.startsWith('session_');
        const isGuiB = rowB.id.startsWith('session_');

        const titleA = formatSessionTitleFromDb(db, rowA.id, rowA.display_name);
        const titleB = formatSessionTitleFromDb(db, rowB.id, rowB.display_name);

        const timeDiff = Math.abs((rowA.created_at || 0) - (rowB.created_at || 0));

        // 1. One is temporary GUI session and the other is CLI session
        if ((isGuiA || isGuiB) && !(isGuiA && isGuiB)) {
          const guiRow = isGuiA ? rowA : rowB;

          if (
            guiRow.message_count === 0 ||
            (titleA === titleB && titleA !== 'Untitled Chat' && titleA !== 'New Chat') ||
            (timeDiff < 300000 && (titleA === titleB || titleA === 'Untitled Chat' || titleB === 'Untitled Chat'))
          ) {
            idsToDelete.push(guiRow.id);
          }
        } 
        // 2. Both are GUI or both are CLI sessions with identical titles or close timestamps
        else {
          if (titleA === titleB && titleA !== 'Untitled Chat' && titleA !== 'New Chat') {
            // Keep the one with more messages or newer timestamp
            const countA = rowA.message_count || 0;
            const countB = rowB.message_count || 0;
            if (countA >= countB) {
              idsToDelete.push(rowB.id);
            } else {
              idsToDelete.push(rowA.id);
            }
          } else if (timeDiff < 60000 && (titleA === 'Untitled Chat' || titleB === 'Untitled Chat')) {
            const emptyRow = (rowA.message_count || 0) === 0 ? rowA : ((rowB.message_count || 0) === 0 ? rowB : null);
            if (emptyRow) {
              idsToDelete.push(emptyRow.id);
            }
          }
        }
      }
    }

    if (idsToDelete.length > 0) {
      const deleteStmt = db.prepare('DELETE FROM sessions WHERE id = ?');
      const deleteMsgsStmt = db.prepare('DELETE FROM messages WHERE session_id = ?');
      db.transaction(() => {
        for (const id of idsToDelete) {
          deleteMsgsStmt.run(id);
          deleteStmt.run(id);
        }
      })();
    }
  } catch (e) {
    console.error('[SessionManager] cleanDuplicateWorkspaceSessions error:', e);
  }
}

/** Get paginated sessions for a given workspace path */
export function getWorkspaceSessions(
  workspace: string,
  limit?: number,
  offset?: number
): { sessions: ChatSession[]; totalCount: number; hasMore: boolean } {
  try {
    const db = getDb();
    const normalizedWs = path.normalize(workspace).replace(/\\/g, '/').toLowerCase();

    // Clean duplicates first
    cleanDuplicateWorkspaceSessions(db, normalizedWs);

    // Get total count first
    let countRow = db.prepare(
      `SELECT COUNT(*) as cnt FROM sessions WHERE LOWER(REPLACE(working_directory, '\\', '/')) = ?`
    ).get(normalizedWs) as any;
    let totalCount = countRow?.cnt || 0;

    let isExact = true;
    if (totalCount === 0) {
      isExact = false;
      const likePattern = `%${workspace.replace(/\\/g, '%').replace(/\//g, '%')}%`;
      countRow = db.prepare(
        `SELECT COUNT(*) as cnt FROM sessions WHERE working_directory LIKE ?`
      ).get(likePattern) as any;
      totalCount = countRow?.cnt || 0;
    }

    let rows: any[];
    if (limit && limit > 0) {
      const safeOffset = offset || 0;
      if (isExact) {
        rows = db.prepare(
          `SELECT id, display_name, message_count, last_modified, created_at
           FROM sessions
           WHERE LOWER(REPLACE(working_directory, '\\', '/')) = ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`
        ).all(normalizedWs, limit, safeOffset) as any[];
      } else {
        const likePattern = `%${workspace.replace(/\\/g, '%').replace(/\//g, '%')}%`;
        rows = db.prepare(
          `SELECT id, display_name, message_count, last_modified, created_at
           FROM sessions
           WHERE working_directory LIKE ?
           ORDER BY created_at DESC
           LIMIT ? OFFSET ?`
        ).all(likePattern, limit, safeOffset) as any[];
      }
    } else {
      if (isExact) {
        rows = db.prepare(
          `SELECT id, display_name, message_count, last_modified, created_at
           FROM sessions
           WHERE LOWER(REPLACE(working_directory, '\\', '/')) = ?
           ORDER BY created_at DESC`
        ).all(normalizedWs) as any[];
      } else {
        const likePattern = `%${workspace.replace(/\\/g, '%').replace(/\//g, '%')}%`;
        rows = db.prepare(
          `SELECT id, display_name, message_count, last_modified, created_at
           FROM sessions
           WHERE working_directory LIKE ?
           ORDER BY created_at DESC`
        ).all(likePattern) as any[];
      }
    }

    const sessions = rows.map(r => ({
      id: r.id,
      title: formatSessionTitleFromDb(db, r.id, r.display_name),
      createdAt: r.created_at || r.last_modified,
      updatedAt: r.last_modified
    }));

    const safeOffset = offset || 0;
    const hasMore = limit ? (safeOffset + limit) < totalCount : false;

    return { sessions, totalCount, hasMore };
  } catch (e) {
    console.error('[SessionManager] getWorkspaceSessions error:', e);
    return { sessions: [], totalCount: 0, hasMore: false };
  }
}

/** Get paginated messages for a given session ID */
export function getSessionMessages(
  _workspace: string,
  sessionId: string,
  limit?: number,
  offset?: number
): { messages: SuperAgentMessage[]; totalCount: number; hasMore: boolean } {
  let actualId = sessionId;
  if (sessionId.includes('::')) {
    actualId = sessionId.split('::')[1];
  }

  try {
    const db = getDb();

    // Get total row count first
    const countRow = db.prepare(
      `SELECT COUNT(*) as cnt FROM messages WHERE session_id = ?`
    ).get(actualId) as any;
    const totalDbRows = countRow?.cnt || 0;

    let rows: DbMessageRow[];
    if (limit && limit > 0) {
      // Paginated: fetch from the END (newest messages first page).
      // offset=0 means the latest `limit` messages.
      const safeOffset = offset || 0;
      // We fetch in reverse: skip the newest `safeOffset` rows, take `limit` rows from the end
      // SQL: ORDER BY sequence_order DESC LIMIT ? OFFSET ? — then reverse in JS
      rows = db.prepare(
        `SELECT id, session_id, role, content, tool_calls, tool_results, reasoning, timestamp, sequence_order
         FROM messages
         WHERE session_id = ?
         ORDER BY sequence_order DESC
         LIMIT ? OFFSET ?`
      ).all(actualId, limit, safeOffset) as DbMessageRow[];
      rows.reverse(); // back to chronological order
    } else {
      // No pagination — return all
      rows = db.prepare(
        `SELECT id, session_id, role, content, tool_calls, tool_results, reasoning, timestamp, sequence_order
         FROM messages
         WHERE session_id = ?
         ORDER BY sequence_order ASC`
      ).all(actualId) as DbMessageRow[];
    }

    const guiMsgs: SuperAgentMessage[] = [];
    for (const row of rows) {
      guiMsgs.push(...mapDbRowToGuiMessages(row));
    }

    const safeOffset = offset || 0;
    const hasMore = limit ? (safeOffset + limit) < totalDbRows : false;

    return { messages: guiMsgs, totalCount: totalDbRows, hasMore };
  } catch (e) {
    console.error(`[SessionManager] getSessionMessages error for ${sessionId}:`, e);
    return { messages: [], totalCount: 0, hasMore: false };
  }
}

/** Save (insert or update) a session and its messages */
export function saveWorkspaceSession(
  workspace: string,
  session: ChatSession,
  messages: SuperAgentMessage[]
) {
  let sessionId = session.id;
  if (sessionId.includes('::')) {
    sessionId = sessionId.split('::')[1];
  }

  try {
    const db = getDb();
    const now = Date.now();
    const preview = messages.find(m => m.role === 'user')?.text || '(no user messages)';
    const normalizedWs = path.normalize(workspace).replace(/\\/g, '/').toLowerCase();

    // If saving a temporary session_ ID, check if a CLI D__... session already exists for this workspace
    if (sessionId.startsWith('session_')) {
      const cliSession = db.prepare(
        `SELECT id FROM sessions
         WHERE LOWER(REPLACE(working_directory, '\\', '/')) = ?
         AND id NOT LIKE 'session_%'
         ORDER BY created_at DESC
         LIMIT 1`
      ).get(normalizedWs) as any;

      if (cliSession && cliSession.id) {
        const cliTitle = formatSessionTitleFromDb(db, cliSession.id, '');
        const currentTitle = session.title;
        // If titles match or CLI session was created within 60s, adopt the CLI session ID
        if (cliTitle === currentTitle || (session.createdAt && Math.abs(session.createdAt - now) < 60000)) {
          sessionId = cliSession.id;
        }
      }
    }

    // Resolve workspace_id from workspaces table
    const wsRow = db.prepare(
      `SELECT id FROM workspaces WHERE LOWER(REPLACE(path, '\\', '/')) = ?`
    ).get(normalizedWs) as any;
    const workspaceId = wsRow?.id || null;

    // Upsert session
    db.prepare(`
      INSERT INTO sessions (id, file_path, display_name, message_count, last_modified, preview, working_directory, created_at, updated_at, workspace_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        message_count = excluded.message_count,
        last_modified = excluded.last_modified,
        preview = excluded.preview,
        updated_at = excluded.updated_at
    `).run(
      sessionId, sessionId, session.title,
      messages.length, now, preview, workspace,
      session.createdAt || now, now, workspaceId
    );

    // Replace messages: delete old, insert new in a transaction
    const insertMsg = db.prepare(`
      INSERT INTO messages (session_id, role, content, tool_calls, tool_results, reasoning, timestamp, sequence_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const deleteOld = db.prepare('DELETE FROM messages WHERE session_id = ?');
    const dbRows = mapGuiToDbRows(messages);

    const transaction = db.transaction(() => {
      deleteOld.run(sessionId);
      for (const row of dbRows) {
        insertMsg.run(
          sessionId, row.role, row.content, row.tool_calls,
          row.tool_results, row.reasoning, row.timestamp, row.sequence_order
        );
      }
    });

    transaction();
  } catch (e) {
    console.error('[SessionManager] saveWorkspaceSession error:', e);
  }
}

/** Delete a session (CASCADE deletes messages too) */
export function deleteWorkspaceSession(_workspace: string, prefixedId: string) {
  let sessionId = prefixedId;
  if (prefixedId.includes('::')) {
    sessionId = prefixedId.split('::')[1];
  }

  try {
    const db = getDb();
    db.pragma('foreign_keys = ON');
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId);
  } catch (e) {
    console.error(`[SessionManager] deleteWorkspaceSession error for ${prefixedId}:`, e);
  }
}

// ─── Input History (replaces superAgentBridge file-based) ─────

/** Get CLI prompt/input history for a workspace */
export function getInputHistory(workspace: string): string[] {
  try {
    const db = getDb();
    const normalizedWs = path.normalize(workspace).replace(/\\/g, '/').toLowerCase();

    const wsRow = db.prepare(
      `SELECT id FROM workspaces WHERE LOWER(REPLACE(path, '\\', '/')) = ?`
    ).get(normalizedWs) as any;

    if (!wsRow) {
      return getFileFallbackHistory();
    }

    const rows = db.prepare(
      `SELECT command FROM input_history WHERE workspace_id = ? ORDER BY id ASC`
    ).all(wsRow.id) as any[];

    return rows.map(r => r.command);
  } catch (e) {
    console.error('[SessionManager] getInputHistory error:', e);
    return getFileFallbackHistory();
  }
}

/** Save a prompt to input history */
export function saveInputHistory(workspace: string, text: string) {
  if (!text || !text.trim()) return;
  const cleanText = text.trim();

  try {
    const db = getDb();
    const normalizedWs = path.normalize(workspace).replace(/\\/g, '/').toLowerCase();

    const wsRow = db.prepare(
      `SELECT id FROM workspaces WHERE LOWER(REPLACE(path, '\\', '/')) = ?`
    ).get(normalizedWs) as any;

    if (!wsRow) return;

    db.prepare(
      `INSERT INTO input_history (workspace_id, command, timestamp) VALUES (?, ?, ?)`
    ).run(wsRow.id, cleanText, Date.now());
  } catch (e) {
    console.error('[SessionManager] saveInputHistory error:', e);
  }
}

/** File-based fallback for input history (legacy) */
function getFileFallbackHistory(): string[] {
  try {
    const fs = require('fs');
    const filePath = path.join(os.homedir(), '.superagent_history');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      return content.split('\n').map((s: string) => s.trim()).filter(Boolean);
    }
  } catch {}
  return [];
}
