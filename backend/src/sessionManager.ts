import fs from 'fs';
import path from 'path';
import os from 'os';

const CLI_HISTORY_DIR = path.join(os.homedir(), '.superagent-r', 'history');

function matchesWorkspace(dir1: string, dir2: string): boolean {
  if (!dir1 || !dir2) return false;
  const norm1 = path.normalize(dir1).toLowerCase().replace(/\\/g, '/');
  const norm2 = path.normalize(dir2).toLowerCase().replace(/\\/g, '/');
  return norm1 === norm2 || norm1.endsWith('/' + norm2) || norm2.endsWith('/' + norm1);
}

function getCliFolderName(workspace: string, timestamp: number): string {
  const norm = workspace.replace(/[^a-zA-Z0-9]/g, '_');
  return `${norm}_${timestamp}`;
}

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

// Memory Cache for history-metadata.json files
interface MetadataCache {
  mtime: number;
  data: any;
}

const metadataCache: Record<string, MetadataCache> = {
  single: { mtime: 0, data: {} },
  multi: { mtime: 0, data: {} }
};

function getMetadata(mode: 'single' | 'multi'): any {
  const metadataFile = path.join(CLI_HISTORY_DIR, mode, 'history-metadata.json');
  if (!fs.existsSync(metadataFile)) return {};

  try {
    const stats = fs.statSync(metadataFile);
    if (stats.mtimeMs > metadataCache[mode].mtime) {
      const content = fs.readFileSync(metadataFile, 'utf8');
      metadataCache[mode].data = JSON.parse(content || '{}');
      metadataCache[mode].mtime = stats.mtimeMs;
    }
    return metadataCache[mode].data;
  } catch (e) {
    console.error(`[SessionManager] Failed to read metadata for ${mode}:`, e);
    return {};
  }
}

// Truncate excessively large tool outputs to prevent lags
function truncateResult(result: any): any {
  if (result === undefined || result === null) return result;
  if (typeof result === 'string') {
    if (result.length > 10000) {
      return result.slice(0, 10000) + '\n\n[... Truncated for performance ...]';
    }
    return result;
  }
  try {
    const str = JSON.stringify(result);
    if (str.length > 10000) {
      return str.slice(0, 10000) + '\n\n[... Truncated for performance ...]';
    }
  } catch {}
  return result;
}

// Map CLI messages format to GUI Console format
export function mapCliToGuiMessages(cliMsgs: any[]): SuperAgentMessage[] {
  const guiMsgs: SuperAgentMessage[] = [];

  for (const msg of cliMsgs) {
    if (!msg || !msg.role) continue;

    if (msg.role === 'user') {
      guiMsgs.push({
        role: 'user',
        text: msg.content || msg.text || ''
      });
    } else if (msg.role === 'assistant') {
      // 1. Thought/Reasoning
      if (msg.reasoning) {
        guiMsgs.push({
          role: 'thought',
          text: msg.reasoning
        });
      }
      // 2. Assistant text content
      if (msg.content || msg.text) {
        guiMsgs.push({
          role: 'assistant',
          text: msg.content || msg.text || ''
        });
      }
      // 3. Tool Calls (Invoking tool)
      if (Array.isArray(msg.toolCalls)) {
        for (const tc of msg.toolCalls) {
          if (tc && tc.name) {
            guiMsgs.push({
              role: 'tool',
              text: `Invoking tool: ${tc.name}`,
              toolName: tc.name,
              args: tc.args || {}
            });
          }
        }
      }
    } else if (msg.role === 'tool') {
      // 4. Tool completion results (Truncated if too large)
      if (Array.isArray(msg.toolResults)) {
        for (const tr of msg.toolResults) {
          guiMsgs.push({
            role: 'tool',
            text: `Tool '${tr.name || 'tool'}' completed.`,
            toolName: tr.name || 'tool',
            result: truncateResult(tr.result !== undefined ? tr.result : (tr.content || ''))
          });
        }
      } else {
        guiMsgs.push({
          role: 'tool',
          text: `Tool completed.`,
          toolName: msg.toolName || 'tool',
          result: truncateResult(msg.result !== undefined ? msg.result : (msg.content || ''))
        });
      }
    } else if (msg.role === 'system') {
      guiMsgs.push({
        role: 'system',
        text: msg.content || msg.text || ''
      });
    }
  }

  return guiMsgs;
}

// Map GUI Console messages to CLI format
export function mapGuiToCliMessages(guiMsgs: SuperAgentMessage[]): any[] {
  const cliMsgs: any[] = [];

  for (let i = 0; i < guiMsgs.length; i++) {
    const msg = guiMsgs[i];
    if (msg.role === 'user') {
      cliMsgs.push({
        role: 'user',
        content: msg.text,
        timestamp: Date.now()
      });
    } else if (msg.role === 'thought') {
      const next = guiMsgs[i + 1];
      if (next && next.role === 'assistant') {
        cliMsgs.push({
          role: 'assistant',
          content: next.text,
          reasoning: msg.text,
          timestamp: Date.now()
        });
        i++; // skip next assistant message
      } else {
        cliMsgs.push({
          role: 'assistant',
          content: '',
          reasoning: msg.text,
          timestamp: Date.now()
        });
      }
    } else if (msg.role === 'assistant') {
      cliMsgs.push({
        role: 'assistant',
        content: msg.text,
        timestamp: Date.now()
      });
    } else if (msg.role === 'tool') {
      if (msg.result !== undefined) {
        cliMsgs.push({
          role: 'tool',
          content: '',
          toolResults: [{
            name: msg.toolName,
            result: msg.result
          }],
          timestamp: Date.now()
        });
      } else {
        const last = cliMsgs[cliMsgs.length - 1];
        if (last && last.role === 'assistant') {
          if (!last.toolCalls) last.toolCalls = [];
          last.toolCalls.push({
            name: msg.toolName,
            args: msg.args
          });
        } else {
          cliMsgs.push({
            role: 'assistant',
            content: '',
            toolCalls: [{
              name: msg.toolName,
              args: msg.args
            }],
            timestamp: Date.now()
          });
        }
      }
    } else if (msg.role === 'system') {
      cliMsgs.push({
        role: 'system',
        content: msg.text,
        timestamp: Date.now()
      });
    }
  }

  return cliMsgs;
}

export function getWorkspaceSessions(workspace: string): ChatSession[] {
  const sessions: ChatSession[] = [];
  const modes = ['single', 'multi'] as const;

  for (const mode of modes) {
    const metadata = getMetadata(mode);
    for (const [key, value] of Object.entries(metadata)) {
      const val = value as any;
      if (val && val.workingDirectory && matchesWorkspace(val.workingDirectory, workspace)) {
        const parts = key.split('_');
        const tsStr = parts[parts.length - 1];
        const timestamp = parseInt(tsStr, 10) || val.mtimeMs || Date.now();

        sessions.push({
          id: `${mode}::${key}`,
          title: val.displayName || val.preview || 'Untitled CLI Chat',
          createdAt: timestamp,
          updatedAt: val.mtimeMs || timestamp
        });
      }
    }
  }

  return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getSessionMessages(workspace: string, prefixedId: string): SuperAgentMessage[] {
  let mode = 'single';
  let sessionId = prefixedId;

  if (prefixedId.includes('::')) {
    const parts = prefixedId.split('::');
    mode = parts[0];
    sessionId = parts[1];
  }

  try {
    const sessionFile = path.join(CLI_HISTORY_DIR, mode, sessionId, `${sessionId}.json`);
    if (fs.existsSync(sessionFile)) {
      const content = fs.readFileSync(sessionFile, 'utf8');
      const data = JSON.parse(content || '{}');
      const rawMessages = data.messages || [];
      return mapCliToGuiMessages(rawMessages);
    }
  } catch (e) {
    console.error(`[SessionManager] Failed to read messages for ${prefixedId}:`, e);
  }
  return [];
}

export function saveWorkspaceSession(
  workspace: string,
  session: ChatSession,
  messages: SuperAgentMessage[]
) {
  let mode = 'single';
  let sessionId = session.id;

  if (session.id.includes('::')) {
    const parts = session.id.split('::');
    mode = parts[0];
    sessionId = parts[1];
  } else {
    // New session from GUI
    const timestamp = session.createdAt || Date.now();
    sessionId = getCliFolderName(workspace, timestamp);
    session.id = `${mode}::${sessionId}`;
  }

  try {
    const dir = path.join(CLI_HISTORY_DIR, mode, sessionId);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const sessionFile = path.join(dir, `${sessionId}.json`);
    const cliMsgs = mapGuiToCliMessages(messages);
    const sessionData = {
      messages: cliMsgs,
      planState: 'IDLE',
      workingDirectory: workspace
    };
    fs.writeFileSync(sessionFile, JSON.stringify(sessionData, null, 2), 'utf8');

    const metadataFile = path.join(dir, 'metadata.json');
    const metadataJson = {
      mtimeMs: Date.now(),
      displayName: session.title,
      messageCount: cliMsgs.length,
      preview: messages.find(m => m.role === 'user')?.text || '(no user messages)',
      workingDirectory: workspace
    };
    fs.writeFileSync(metadataFile, JSON.stringify(metadataJson, null, 2), 'utf8');

    const globalMetadataFile = path.join(CLI_HISTORY_DIR, mode, 'history-metadata.json');
    let globalMetadata: any = {};
    if (fs.existsSync(globalMetadataFile)) {
      try {
        globalMetadata = JSON.parse(fs.readFileSync(globalMetadataFile, 'utf8') || '{}');
      } catch {}
    }
    globalMetadata[sessionId] = {
      mtimeMs: Date.now(),
      displayName: session.title,
      messageCount: cliMsgs.length,
      preview: metadataJson.preview,
      workingDirectory: workspace
    };
    fs.writeFileSync(globalMetadataFile, JSON.stringify(globalMetadata, null, 2), 'utf8');
    
    // Invalidate memory cache so next read picks it up
    metadataCache[mode].mtime = 0;
  } catch (e) {
    console.error('[SessionManager] Failed to save session:', e);
  }
}

export function deleteWorkspaceSession(workspace: string, prefixedId: string) {
  let mode = 'single';
  let sessionId = prefixedId;

  if (prefixedId.includes('::')) {
    const parts = prefixedId.split('::');
    mode = parts[0];
    sessionId = parts[1];
  }

  try {
    const dir = path.join(CLI_HISTORY_DIR, mode, sessionId);
    if (fs.existsSync(dir)) {
      const sessionFile = path.join(dir, `${sessionId}.json`);
      if (fs.existsSync(sessionFile)) fs.unlinkSync(sessionFile);
      const metadataFile = path.join(dir, 'metadata.json');
      if (fs.existsSync(metadataFile)) fs.unlinkSync(metadataFile);
      try {
        fs.rmdirSync(dir);
      } catch {}
    }

    const globalMetadataFile = path.join(CLI_HISTORY_DIR, mode, 'history-metadata.json');
    if (fs.existsSync(globalMetadataFile)) {
      try {
        const globalMetadata = JSON.parse(fs.readFileSync(globalMetadataFile, 'utf8') || '{}');
        delete globalMetadata[sessionId];
        fs.writeFileSync(globalMetadataFile, JSON.stringify(globalMetadata, null, 2), 'utf8');
      } catch {}
    }
    
    // Invalidate memory cache
    metadataCache[mode].mtime = 0;
  } catch (e) {
    console.error(`[SessionManager] Failed to delete session ${prefixedId}:`, e);
  }
}
