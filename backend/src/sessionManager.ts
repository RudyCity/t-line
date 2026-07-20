import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

const BASE_SESSIONS_DIR = path.join(os.homedir(), '.superagent', 'sessions');

function getWorkspaceHash(workspace: string): string {
  const wsKey = workspace || 'default';
  return crypto.createHash('md5').update(wsKey).digest('hex');
}

function ensureWorkspaceDir(workspace: string): string {
  const hash = getWorkspaceHash(workspace);
  const dir = path.join(BASE_SESSIONS_DIR, hash);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
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

export function getWorkspaceSessions(workspace: string): ChatSession[] {
  try {
    const dir = ensureWorkspaceDir(workspace);
    const listFile = path.join(dir, 'list.json');
    if (fs.existsSync(listFile)) {
      const content = fs.readFileSync(listFile, 'utf8');
      const sessions = JSON.parse(content || '[]');
      if (Array.isArray(sessions)) {
        return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
      }
    }
  } catch (e) {
    console.error('[SessionManager] Failed to read sessions:', e);
  }
  return [];
}

export function getSessionMessages(workspace: string, sessionId: string): SuperAgentMessage[] {
  try {
    const dir = ensureWorkspaceDir(workspace);
    const sessionFile = path.join(dir, `${sessionId}.json`);
    if (fs.existsSync(sessionFile)) {
      const content = fs.readFileSync(sessionFile, 'utf8');
      const messages = JSON.parse(content || '[]');
      if (Array.isArray(messages)) {
        return messages;
      }
    }
  } catch (e) {
    console.error(`[SessionManager] Failed to read session messages for ${sessionId}:`, e);
  }
  return [];
}

export function saveWorkspaceSession(
  workspace: string,
  session: ChatSession,
  messages: SuperAgentMessage[]
) {
  try {
    const dir = ensureWorkspaceDir(workspace);
    
    // Save messages
    const sessionFile = path.join(dir, `${session.id}.json`);
    fs.writeFileSync(sessionFile, JSON.stringify(messages, null, 2), 'utf8');

    // Update list
    const sessions = getWorkspaceSessions(workspace);
    const idx = sessions.findIndex(s => s.id === session.id);
    if (idx >= 0) {
      sessions[idx] = { ...sessions[idx], ...session, updatedAt: Date.now() };
    } else {
      sessions.push({ ...session, updatedAt: Date.now() });
    }

    sessions.sort((a, b) => b.updatedAt - a.updatedAt);
    const listFile = path.join(dir, 'list.json');
    fs.writeFileSync(listFile, JSON.stringify(sessions, null, 2), 'utf8');
  } catch (e) {
    console.error('[SessionManager] Failed to save session:', e);
  }
}

export function deleteWorkspaceSession(workspace: string, sessionId: string) {
  try {
    const dir = ensureWorkspaceDir(workspace);
    
    // Delete messages file
    const sessionFile = path.join(dir, `${sessionId}.json`);
    if (fs.existsSync(sessionFile)) {
      fs.unlinkSync(sessionFile);
    }

    // Update list
    const sessions = getWorkspaceSessions(workspace);
    const filtered = sessions.filter(s => s.id !== sessionId);
    const listFile = path.join(dir, 'list.json');
    fs.writeFileSync(listFile, JSON.stringify(filtered, null, 2), 'utf8');
  } catch (e) {
    console.error(`[SessionManager] Failed to delete session ${sessionId}:`, e);
  }
}
