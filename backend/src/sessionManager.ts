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

/** Get all sessions for a given workspace path */
export function getWorkspaceSessions(workspace: string): ChatSession[] {
  try {
    const db = getDb();
    const normalizedWs = path.normalize(workspace).replace(/\\/g, '/').toLowerCase();

    // Try exact match first, then LIKE match
    let rows = db.prepare(
      `SELECT id, display_name, message_count, last_modified, created_at
       FROM sessions
       WHERE LOWER(REPLACE(working_directory, '\\', '/')) = ?
       ORDER BY last_modified DESC`
    ).all(normalizedWs) as any[];

    if (rows.length === 0) {
      const likePattern = `%${workspace.replace(/\\/g, '%').replace(/\//g, '%')}%`;
      rows = db.prepare(
        `SELECT id, display_name, message_count, last_modified, created_at
         FROM sessions
         WHERE working_directory LIKE ?
         ORDER BY last_modified DESC`
      ).all(likePattern) as any[];
    }

    return rows.map(r => ({
      id: r.id,
      title: r.display_name || 'Untitled CLI Chat',
      createdAt: r.created_at || r.last_modified,
      updatedAt: r.last_modified
    }));
  } catch (e) {
    console.error('[SessionManager] getWorkspaceSessions error:', e);
    return [];
  }
}

/** Get all messages for a given session ID */
export function getSessionMessages(_workspace: string, sessionId: string): SuperAgentMessage[] {
  let actualId = sessionId;
  if (sessionId.includes('::')) {
    actualId = sessionId.split('::')[1];
  }

  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT id, session_id, role, content, tool_calls, tool_results, reasoning, timestamp, sequence_order
       FROM messages
       WHERE session_id = ?
       ORDER BY sequence_order ASC`
    ).all(actualId) as DbMessageRow[];

    const guiMsgs: SuperAgentMessage[] = [];
    for (const row of rows) {
      guiMsgs.push(...mapDbRowToGuiMessages(row));
    }
    return guiMsgs;
  } catch (e) {
    console.error(`[SessionManager] getSessionMessages error for ${sessionId}:`, e);
    return [];
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

    // Resolve workspace_id from workspaces table
    const normalizedWs = path.normalize(workspace).replace(/\\/g, '/').toLowerCase();
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
