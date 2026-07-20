import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatSession } from './SuperAgentHistorySidebar';
import { getAuthHeader } from './SuperAgentConsoleUtils';

export interface SuperAgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'thought';
  text: string;
  toolName?: string;
  args?: any;
  result?: any;
}

export function isSystemNoiseMsg(msg: { role: string; text?: string }): boolean {
  if (!msg || !msg.text) return false;
  const text = msg.text.trim();

  // Filter out injected memory context, emergency summaries & prompt headers
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
    return true;
  }

  if (msg.role !== 'system') return false;
  const textLower = text.toLowerCase();
  return (
    textLower.includes('websocket') ||
    textLower.includes('connected to superagent') ||
    textLower.includes('starting superagent') ||
    textLower.includes('superagent ready') ||
    textLower.includes('restarting bridge') ||
    textLower.includes('model preset changed') ||
    textLower.includes('workspace switched') ||
    textLower.includes('mode switched') ||
    textLower.includes('flags set')
  );
}

export function loadWorkspaceSessions(wsPath: string): ChatSession[] {
  const wsKey = wsPath || 'default';
  const sessionsKey = `superagent_sessions_${wsKey}`;
  const savedSessionsStr = localStorage.getItem(sessionsKey);
  
  let loadedSessions: ChatSession[] = [];
  if (savedSessionsStr) {
    try {
      loadedSessions = JSON.parse(savedSessionsStr);
    } catch (e) {
      console.error('Failed to parse superagent_sessions:', e);
    }
  }

  // Migration logic from single session storage key
  if (loadedSessions.length === 0) {
    const legacyKey = `superagent_messages_${wsKey}`;
    const legacySaved = localStorage.getItem(legacyKey);
    let legacyMsgs: SuperAgentMessage[] | null = null;
    if (legacySaved) {
      try { legacyMsgs = JSON.parse(legacySaved); } catch (e) {}
    }

    const initialSessionId = `session_${Date.now()}`;
    let initialTitle = 'New Chat';
    if (Array.isArray(legacyMsgs) && legacyMsgs.length > 0) {
      const firstUserMsg = legacyMsgs.find(m => m.role === 'user');
      if (firstUserMsg && firstUserMsg.text) {
        const line = firstUserMsg.text.trim().split('\n')[0];
        initialTitle = line.length > 30 ? line.slice(0, 30) + '...' : line;
      } else {
        initialTitle = 'Chat 1';
      }
    }

    const defaultSession: ChatSession = {
      id: initialSessionId,
      title: initialTitle,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    loadedSessions = [defaultSession];
    try {
      localStorage.setItem(sessionsKey, JSON.stringify(loadedSessions));
      if (Array.isArray(legacyMsgs) && legacyMsgs.length > 0) {
        localStorage.setItem(`superagent_messages_${wsKey}_${initialSessionId}`, JSON.stringify(legacyMsgs));
        localStorage.removeItem(legacyKey);
      }
    } catch (e) {}
  }

  return loadedSessions;
}

import { wsManager } from '../services/websocket';

interface PaginatedSessionsResponse {
  sessions: ChatSession[];
  totalCount: number;
  hasMore: boolean;
}

const SESSION_PAGE_SIZE = 30;

// API Sync Helpers
async function apiGetSessions(
  workspace: string,
  limit?: number,
  offset?: number
): Promise<PaginatedSessionsResponse | null> {
  try {
    let url = `/api/superagent/sessions?workspace=${encodeURIComponent(workspace)}`;
    if (limit !== undefined) url += `&limit=${limit}`;
    if (offset !== undefined) url += `&offset=${offset}`;
    const res = await fetch(url, { headers: getAuthHeader() });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.sessions)) {
        return {
          sessions: data.sessions,
          totalCount: data.totalCount ?? data.sessions.length,
          hasMore: data.hasMore ?? false
        };
      }
    }
  } catch (e) {
    console.error('[SessionsAPI] GET sessions failed:', e);
  }
  return null;
}

interface PaginatedMessagesResponse {
  messages: SuperAgentMessage[];
  totalCount: number;
  hasMore: boolean;
}

const PAGE_SIZE = 50;

async function apiGetSessionMessages(
  workspace: string,
  sessionId: string,
  limit?: number,
  offset?: number
): Promise<PaginatedMessagesResponse | null> {
  try {
    let url = `/api/superagent/sessions/${encodeURIComponent(sessionId)}?workspace=${encodeURIComponent(workspace)}`;
    if (limit !== undefined) url += `&limit=${limit}`;
    if (offset !== undefined) url += `&offset=${offset}`;
    const res = await fetch(url, { headers: getAuthHeader() });
    if (res.ok) {
      const data = await res.json();
      // Handle both old format (just {messages}) and new format ({messages, totalCount, hasMore})
      if (Array.isArray(data.messages)) {
        return {
          messages: data.messages,
          totalCount: data.totalCount ?? data.messages.length,
          hasMore: data.hasMore ?? false
        };
      }
    }
  } catch (e) {
    console.error('[SessionsAPI] GET messages failed:', e);
  }
  return null;
}

async function apiSaveSession(workspace: string, session: ChatSession, messages: SuperAgentMessage[]): Promise<boolean> {
  try {
    const res = await fetch(`/api/superagent/sessions?workspace=${encodeURIComponent(workspace)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      body: JSON.stringify({ session, messages })
    });
    return res.ok;
  } catch (e) {
    console.error('[SessionsAPI] POST save failed:', e);
  }
  return false;
}

async function apiDeleteSession(workspace: string, sessionId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/superagent/sessions/${encodeURIComponent(sessionId)}?workspace=${encodeURIComponent(workspace)}`, {
      method: 'DELETE',
      headers: getAuthHeader()
    });
    return res.ok;
  } catch (e) {
    console.error('[SessionsAPI] DELETE failed:', e);
  }
  return false;
}

export function getCleanUserText(rawText: string): string {
  if (!rawText) return '';
  let text = rawText.trim();
  if (text.includes('<USER_REQUEST>')) {
    text = text.replace(/<\/?USER_REQUEST>/gi, '').trim();
  }
  if (text.includes('<user_request>')) {
    text = text.replace(/<\/?user_request>/gi, '').trim();
  }
  return text;
}

export function generateSessionTitle(messages: SuperAgentMessage[]): string {
  const userMsgs = messages.filter(m => m.role === 'user' && m.text && !isSystemNoiseMsg(m));
  if (userMsgs.length === 0) return 'New Chat';

  const cleanFirst = getCleanUserText(userMsgs[0].text).split('\n')[0];
  const firstShort = cleanFirst.length > 22 ? cleanFirst.slice(0, 22) + '...' : cleanFirst;

  if (userMsgs.length === 1) {
    return firstShort || 'New Chat';
  }

  const cleanLast = getCleanUserText(userMsgs[userMsgs.length - 1].text).split('\n')[0];
  const lastShort = cleanLast.length > 22 ? cleanLast.slice(0, 22) + '...' : cleanLast;

  if (firstShort === lastShort) {
    return firstShort || 'New Chat';
  }

  return `${firstShort} ➔ ${lastShort}`;
}

export function useSuperAgentSessions(workspace: string) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadWorkspaceSessions(workspace));
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const loaded = loadWorkspaceSessions(workspace);
    return loaded[0]?.id || `session_${Date.now()}`;
  });

  const [messages, setMessages] = useState<SuperAgentMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const currentOffsetRef = useRef(0);

  const [hasMoreSessions, setHasMoreSessions] = useState(false);
  const [loadingMoreSessions, setLoadingMoreSessions] = useState(false);
  const currentSessionOffsetRef = useRef(0);

  const prevWorkspaceRef = useRef(workspace);
  const activeSessionIdRef = useRef(activeSessionId);
  const loadedSessionIdRef = useRef<string | null>(null);
  const deletedSessionIdsRef = useRef<Set<string>>(new Set());

  // Keep activeSessionIdRef up to date
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Initial Sync from Backend on switch/mount
  const syncSessions = useCallback(async (wsPath: string, preserveActiveId?: string) => {
    const res = await apiGetSessions(wsPath, SESSION_PAGE_SIZE, 0);
    if (res && res.sessions.length > 0) {
      const validServerSessions = res.sessions.filter(s => !deletedSessionIdsRef.current.has(s.id));
      setSessions(prev => {
        const prevMap = new Map(prev.map(s => [s.id, s]));
        const serverIds = new Set(validServerSessions.map(s => s.id));
        const localOnly = prev.filter(s => !serverIds.has(s.id) && !deletedSessionIdsRef.current.has(s.id));

        const mergedServerSessions = validServerSessions.map(serverSession => {
          const localSession = prevMap.get(serverSession.id);
          // Preserve local title if local session has a non-default title and server returns generic "New Chat"
          if (
            localSession &&
            localSession.title &&
            localSession.title !== 'New Chat' &&
            (!serverSession.title || serverSession.title === 'New Chat')
          ) {
            return { ...serverSession, title: localSession.title };
          }
          return serverSession;
        });

        return [...localOnly, ...mergedServerSessions];
      });
      setHasMoreSessions(res.hasMore);
      currentSessionOffsetRef.current = SESSION_PAGE_SIZE;
      
      const targetActiveId = preserveActiveId || activeSessionIdRef.current || (validServerSessions[0]?.id);
      
      if (targetActiveId && validServerSessions.some(s => s.id === targetActiveId)) {
        setActiveSessionId(targetActiveId);
        const result = await apiGetSessionMessages(wsPath, targetActiveId, PAGE_SIZE, 0);
        if (result) {
          setMessages(result.messages);
          setHasMore(result.hasMore);
          currentOffsetRef.current = PAGE_SIZE;
          loadedSessionIdRef.current = targetActiveId;
          return;
        }
      } else if (targetActiveId && !deletedSessionIdsRef.current.has(targetActiveId)) {
        // Target active ID is a local-only session (e.g., brand new chat)
        setActiveSessionId(targetActiveId);
        loadedSessionIdRef.current = targetActiveId;
        return;
      }
    }

    // Fallback to localStorage
    const localSessions = loadWorkspaceSessions(wsPath);
    setSessions(localSessions);
    setHasMoreSessions(false);
    currentSessionOffsetRef.current = 0;
    
    let localActiveId = localSessions[0]?.id || `session_${Date.now()}`;
    if (preserveActiveId && localSessions.some(s => s.id === preserveActiveId)) {
      localActiveId = preserveActiveId;
    }
    setActiveSessionId(localActiveId);
    
    const wsKey = wsPath || 'default';
    const saved = localStorage.getItem(`superagent_messages_${wsKey}_${localActiveId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
          setHasMore(false);
          currentOffsetRef.current = 0;
          loadedSessionIdRef.current = localActiveId;
          return;
        }
      } catch (e) {}
    }
    setMessages([]);
    setHasMore(false);
    currentOffsetRef.current = 0;
    loadedSessionIdRef.current = localActiveId;
  }, []);

  // Sync on workspace changes
  useEffect(() => {
    prevWorkspaceRef.current = workspace;
    syncSessions(workspace);
  }, [workspace, syncSessions]);

  // Listen for real-time history file updates from server (e.g. from CLI execution)
  useEffect(() => {
    const handleWsMessage = (payload: any) => {
      if (payload && payload.type === 'superagent-sessions-changed') {
        syncSessions(workspace, activeSessionIdRef.current);
      }
    };
    wsManager.addGlobalMessageListener(handleWsMessage);
    return () => {
      wsManager.removeGlobalMessageListener(handleWsMessage);
    };
  }, [workspace, syncSessions]);

  // Persist messages & update title ONLY when loadedSessionIdRef matches activeSessionId
  useEffect(() => {
    if (!activeSessionId) return;
    if (loadedSessionIdRef.current !== activeSessionId) return; // Isolated check!

    const wsKey = workspace || 'default';
    const msgKey = `superagent_messages_${wsKey}_${activeSessionId}`;

    if (messages && messages.length > 0) {
      // Local backup (only last 300 messages)
      try {
        localStorage.setItem(msgKey, JSON.stringify(messages.slice(-300)));
      } catch (e) {}

      const newTitle = generateSessionTitle(messages);

      setSessions(prevSessions => {
        const targetIdx = prevSessions.findIndex(s => s.id === activeSessionId);
        if (targetIdx < 0) return prevSessions;

        const currentSession = prevSessions[targetIdx];

        // Skip if title is unchanged
        if (currentSession.title === newTitle) {
          return prevSessions;
        }

        const updated = [...prevSessions];
        const updatedSession = {
          ...currentSession,
          title: newTitle,
          updatedAt: Date.now()
        };
        updated[targetIdx] = updatedSession;
        
        try {
          localStorage.setItem(`superagent_sessions_${wsKey}`, JSON.stringify(updated));
        } catch (e) {}

        // Save to backend disk
        apiSaveSession(workspace, updatedSession, messages);

        return updated;
      });
    }
  }, [messages, activeSessionId, workspace]);

  /** Load older messages (prepend to current list) */
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMore || !activeSessionId) return;
    setLoadingMore(true);

    try {
      const result = await apiGetSessionMessages(
        workspace, activeSessionId, PAGE_SIZE, currentOffsetRef.current
      );
      if (result && result.messages.length > 0) {
        setMessages(prev => [...result.messages, ...prev]);
        currentOffsetRef.current += PAGE_SIZE;
        setHasMore(result.hasMore);
      } else {
        // Fallback to local storage if API returned empty or failed
        const wsKey = workspace || 'default';
        const saved = localStorage.getItem(`superagent_messages_${wsKey}_${activeSessionId}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > currentOffsetRef.current) {
              const endIdx = Math.max(0, parsed.length - currentOffsetRef.current);
              const startIdx = Math.max(0, endIdx - PAGE_SIZE);
              const older = parsed.slice(startIdx, endIdx);
              if (older.length > 0) {
                setMessages(prev => [...older, ...prev]);
                currentOffsetRef.current += PAGE_SIZE;
                setHasMore(parsed.length - currentOffsetRef.current > 0);
                return;
              }
            }
          } catch (err) {}
        }
        setHasMore(false);
      }
    } catch (e) {
      console.error('[Sessions] loadMoreMessages error:', e);
    } finally {
      setLoadingMore(false);
    }
  }, [workspace, activeSessionId, hasMore, loadingMore]);

  const handleSelectSession = useCallback(async (id: string) => {
    if (id === activeSessionId) return;
    setActiveSessionId(id);
    currentOffsetRef.current = 0;

    const result = await apiGetSessionMessages(workspace, id, PAGE_SIZE, 0);
    if (result) {
      setMessages(result.messages);
      setHasMore(result.hasMore);
      currentOffsetRef.current = PAGE_SIZE;
      loadedSessionIdRef.current = id;
      return;
    }

    const wsKey = workspace || 'default';
    const saved = localStorage.getItem(`superagent_messages_${wsKey}_${id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setHasMore(false);
          loadedSessionIdRef.current = id;
          return;
        }
      } catch (e) {}
    }
    setMessages([]);
    setHasMore(false);
    loadedSessionIdRef.current = id;
  }, [activeSessionId, workspace]);

  const handleNewChat = useCallback(() => {
    const newId = `session_${Date.now()}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const wsKey = workspace || 'default';
    setSessions(prev => {
      const nextSessions = [newSession, ...prev];
      try {
        localStorage.setItem(`superagent_sessions_${wsKey}`, JSON.stringify(nextSessions));
      } catch (e) {}
      return nextSessions;
    });

    setActiveSessionId(newId);
    setMessages([]);
    setHasMore(false);
    currentOffsetRef.current = 0;
    loadedSessionIdRef.current = newId;

    try {
      localStorage.setItem(`superagent_messages_${wsKey}_${newId}`, JSON.stringify([]));
    } catch (e) {}

    // Register session on backend server
    apiSaveSession(workspace, newSession, []);
  }, [workspace]);

  const handleDeleteSession = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const wsKey = workspace || 'default';
    deletedSessionIdsRef.current.add(id);

    // Call backend API to delete session
    const success = await apiDeleteSession(workspace, id);
    if (!success) {
      deletedSessionIdsRef.current.delete(id);
      window.dispatchEvent(new CustomEvent('tline-toast', {
        detail: { message: 'Gagal menghapus session chat' }
      }));
      return;
    }

    let remainingSessions: ChatSession[] = [];
    setSessions(prev => {
      remainingSessions = prev.filter(s => s.id !== id);
      try {
        localStorage.setItem(`superagent_sessions_${wsKey}`, JSON.stringify(remainingSessions));
        localStorage.removeItem(`superagent_messages_${wsKey}_${id}`);
      } catch (err) {}
      return remainingSessions;
    });

    window.dispatchEvent(new CustomEvent('tline-toast', {
      detail: { message: 'Session chat berhasil dihapus' }
    }));

    if (id === activeSessionIdRef.current) {
      if (remainingSessions.length > 0) {
        const nextId = remainingSessions[0].id;
        setActiveSessionId(nextId);
        
        const result = await apiGetSessionMessages(workspace, nextId, PAGE_SIZE, 0);
        if (result) {
          setMessages(result.messages);
          setHasMore(result.hasMore);
          currentOffsetRef.current = PAGE_SIZE;
          loadedSessionIdRef.current = nextId;
          return;
        }

        const saved = localStorage.getItem(`superagent_messages_${wsKey}_${nextId}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
              setHasMore(false);
              loadedSessionIdRef.current = nextId;
              return;
            }
          } catch (err) {}
        }
        setMessages([]);
        setHasMore(false);
        loadedSessionIdRef.current = nextId;
      } else {
        handleNewChat();
      }
    }
  }, [handleNewChat, workspace]);

  const handleRenameSession = useCallback((id: string, newTitle: string) => {
    const wsKey = workspace || 'default';
    setSessions(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, title: newTitle } : s);
      try {
        localStorage.setItem(`superagent_sessions_${wsKey}`, JSON.stringify(updated));
      } catch (e) {}

      // Find the session and update it on backend
      const renamedSession = updated.find(s => s.id === id);
      if (renamedSession) {
        // Fetch current session messages to preserve them
        apiGetSessionMessages(workspace, id).then(result => {
          apiSaveSession(workspace, renamedSession, result?.messages || messages);
        });
      }

      return updated;
    });
  }, [workspace, messages]);

  /** Load older sessions (append to sidebar list) */
  const loadMoreSessions = useCallback(async () => {
    if (loadingMoreSessions || !hasMoreSessions) return;
    setLoadingMoreSessions(true);

    try {
      const res = await apiGetSessions(
        workspace, SESSION_PAGE_SIZE, currentSessionOffsetRef.current
      );
      if (res && res.sessions.length > 0) {
        setSessions(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const uniqueNew = res.sessions.filter(s => !existingIds.has(s.id));
          return [...prev, ...uniqueNew];
        });
        currentSessionOffsetRef.current += SESSION_PAGE_SIZE;
        setHasMoreSessions(res.hasMore);
      } else {
        setHasMoreSessions(false);
      }
    } catch (e) {
      console.error('[Sessions] loadMoreSessions error:', e);
    } finally {
      setLoadingMoreSessions(false);
    }
  }, [workspace, hasMoreSessions, loadingMoreSessions]);

  return {
    sessions,
    activeSessionId,
    messages,
    setMessages,
    hasMore,
    loadingMore,
    loadMoreMessages,
    hasMoreSessions,
    loadingMoreSessions,
    loadMoreSessions,
    handleSelectSession,
    handleNewChat,
    handleDeleteSession,
    handleRenameSession
  };
}
