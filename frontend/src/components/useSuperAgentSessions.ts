import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatSession } from './SuperAgentHistorySidebar';
import { getAuthHeader, cleanSessionTitle, GENERIC_GREETINGS_REGEX, GENERIC_STOP_CMDS_REGEX } from './SuperAgentConsoleUtils';

export interface SuperAgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'thought' | 'connection';
  text: string;
  toolName?: string;
  args?: any;
  result?: any;
}

export function isSystemNoiseMsg(msg: { role: string; text?: string }): boolean {
  if (!msg || !msg.text) return false;
  // Tool and thought messages are process steps and MUST NEVER be filtered as system noise
  if (msg.role === 'tool' || msg.role === 'thought') return false;
  const text = msg.text.trim();

  // Filter out injected memory context, emergency summaries & prompt headers
  if (
    text.startsWith('[RMemory') ||
    text.startsWith('[TencentDB') ||
    text.startsWith('[Emergency') ||
    text.startsWith('[Context') ||
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
    textLower.includes('connected to superagent server') ||
    textLower.includes('starting superagent server on port') ||
    textLower.includes('superagent ready') ||
    textLower.includes('restarting bridge') ||
    textLower.includes('model preset changed') ||
    textLower.includes('workspace switched') ||
    textLower.includes('mode switched') ||
    textLower.includes('flags set')
  );
}

export function getNormalizedWsKey(wsPath: string): string {
  if (!wsPath) return 'default';
  let normalized = wsPath.trim();
  if (/^\/[a-zA-Z]\//.test(normalized)) {
    normalized = normalized[1] + ':' + normalized.slice(2);
  }
  return normalized.replace(/\\/g, '/').toLowerCase();
}

export function loadWorkspaceSessions(wsPath: string): ChatSession[] {
  const wsKey = getNormalizedWsKey(wsPath);
  const sessionsKey = `superagent_sessions_${wsKey}`;
  const savedSessionsStr = localStorage.getItem(sessionsKey);
  
  let loadedSessions: ChatSession[] = [];
  if (savedSessionsStr) {
    try {
      loadedSessions = JSON.parse(savedSessionsStr);
    } catch (e) {
      console.error('Failed to parse superagent_sessions:', e);
    }
  } else {
    // Migration logic from single session storage key ONLY if legacy messages exist
    const legacyKey = `superagent_messages_${wsKey}`;
    const legacySaved = localStorage.getItem(legacyKey);
    let legacyMsgs: SuperAgentMessage[] | null = null;
    if (legacySaved) {
      try { legacyMsgs = JSON.parse(legacySaved); } catch (e) {}
    }

    if (Array.isArray(legacyMsgs) && legacyMsgs.length > 0) {
      const initialSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      let initialTitle = 'New Chat';
      const firstUserMsg = legacyMsgs.find(m => m.role === 'user');
      if (firstUserMsg && firstUserMsg.text) {
        const line = firstUserMsg.text.trim().split('\n')[0];
        initialTitle = line.length > 30 ? line.slice(0, 30) + '...' : line;
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
        localStorage.setItem(`superagent_messages_${wsKey}_${initialSessionId}`, JSON.stringify(legacyMsgs));
        localStorage.removeItem(legacyKey);
      } catch (e) {}
    }
  }

  if (loadedSessions.length === 0) {
    const initialSessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const defaultSession: ChatSession = {
      id: initialSessionId,
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    loadedSessions = [defaultSession];
    try {
      localStorage.setItem(sessionsKey, JSON.stringify(loadedSessions));
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

const SESSION_PAGE_SIZE = 200;

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
          sessions: data.sessions.map((s: any) => {
            const rawTime = s.updatedAt || s.createdAt || s.lastModified || Date.now();
            const parsedTime = typeof rawTime === 'number' && !isNaN(rawTime) ? rawTime : (new Date(rawTime).getTime() || Date.now());
            const createdTime = typeof s.createdAt === 'number' && !isNaN(s.createdAt) ? s.createdAt : parsedTime;
            const titleCandidate = s.title || s.displayName || 'New Chat';
            return {
              id: s.id,
              title: cleanSessionTitle(titleCandidate),
              createdAt: createdTime,
              updatedAt: parsedTime
            };
          }),
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
  offset?: number,
  signal?: AbortSignal
): Promise<PaginatedMessagesResponse | null> {
  try {
    let url = `/api/superagent/sessions/${encodeURIComponent(sessionId)}?workspace=${encodeURIComponent(workspace)}`;
    if (limit !== undefined) url += `&limit=${limit}`;
    if (offset !== undefined) url += `&offset=${offset}`;
    const res = await fetch(url, { headers: getAuthHeader(), signal });
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
  } catch (e: any) {
    if (e?.name !== 'AbortError') {
      console.error('[SessionsAPI] GET messages failed:', e);
    }
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

export async function apiSearchSessions(workspace: string, query: string): Promise<any[]> {
  if (!query || !query.trim()) return [];
  try {
    const res = await fetch(`/api/superagent/sessions/search?workspace=${encodeURIComponent(workspace)}&q=${encodeURIComponent(query.trim())}`, {
      headers: getAuthHeader()
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data.results) ? data.results : [];
    }
  } catch (e) {
    console.error('[SessionsAPI] FTS search failed:', e);
  }
  return [];
}

export function getCleanUserText(rawText: string): string {
  if (!rawText) return '';
  let text = rawText.trim();

  // Strip noise lines (e.g. [Context Restoration], [RMemory...], [SYS])
  const lines = text.split('\n');
  const cleanLines = lines.filter(line => {
    const l = line.trim();
    if (!l) return false;
    if (l.startsWith('[RMemory') || l.startsWith('[TencentDB') || l.startsWith('[Emergency') || l.startsWith('[Context') || l.startsWith('[SYS]') || l.startsWith('[System') || l.startsWith('<relevant-memories>')) return false;
    if (l.startsWith('IMPORTANT:') || l.startsWith('USER_REQUEST') || l.startsWith('<USER_REQUEST>') || l.startsWith('<user_request>')) return false;
    if (l.includes('Agent Memory Context') || l.includes('Emergency Summary') || l.includes('Context Restoration')) return false;
    return true;
  });

  if (cleanLines.length > 0) {
    text = cleanLines.join(' ').trim();
  }

  // Strip XML tags like <USER_REQUEST>, <user_request>, etc.
  text = text.replace(/<\/?user_request>/gi, '').replace(/<\/?USER_REQUEST>/gi, '').replace(/<[^>]+>/g, '').trim();

  // Strip leading CLI prompt headers (e.g. PS D:\path... > or PS C:\...)
  text = text.replace(/^(PS\s+)?[a-zA-Z]:\\[^>\n]+>\s*/gi, '').trim();
  text = text.replace(/^PS\s+[a-zA-Z]:\\[^\s]+\s*(➔|->)?\s*/gi, '').trim();
  text = text.replace(/^\[First:.*?\]\s*(→|➔)\s*\[Last:\s*/gi, '').trim();

  // Strip slash commands at the start of prompt (e.g. /non-linear-debugging /pragmatic-minimalism)
  text = text.replace(/^(\/[a-zA-Z0-9_-]+\s*)+/g, '').trim();

  return text;
}

export function generateSessionTitle(messages: SuperAgentMessage[]): string {
  const userMsgs = messages.filter(m => m.role === 'user' && m.text && !isSystemNoiseMsg(m));
  if (userMsgs.length === 0) return 'New Chat';

  const cleanPrompts: string[] = [];
  for (const msg of userMsgs) {
    const cleanText = getCleanUserText(msg.text);
    if (cleanText) {
      const firstLine = cleanText.split('\n')[0].trim();
      if (firstLine && !cleanPrompts.includes(firstLine)) {
        cleanPrompts.push(firstLine);
      }
    }
  }

  if (cleanPrompts.length === 0) return 'New Chat';

  // Find the first substantive prompt (not a generic greeting or generic stop command)
  const substantivePrompt = cleanPrompts.find(p => {
    const cleaned = cleanSessionTitle(p);
    return cleaned && !GENERIC_GREETINGS_REGEX.test(cleaned) && !GENERIC_STOP_CMDS_REGEX.test(cleaned);
  });

  const selected = substantivePrompt || cleanPrompts[0];
  const finalTitle = cleanSessionTitle(selected);

  return finalTitle.length > 45 ? finalTitle.slice(0, 45).trim() + '...' : finalTitle;
}

/** Helper to prune old cached session messages from localStorage (LRU strategy, keeping max 25 sessions) */
function pruneOldSessionCaches(wsKey: string, activeSessionIds: string[], maxKeep = 25) {
  try {
    const keepSet = new Set(activeSessionIds.slice(0, maxKeep));
    const prefix = `superagent_messages_${wsKey}_`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const sessId = key.replace(prefix, '');
        if (!keepSet.has(sessId)) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (e) {}
}

export function useSuperAgentSessions(workspace: string) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadWorkspaceSessions(workspace));
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const loaded = loadWorkspaceSessions(workspace);
    return loaded[0]?.id || `session_${Date.now()}`;
  });

  const [pinnedSessionIds, setPinnedSessionIds] = useState<string[]>(() => {
    const wsKey = workspace || 'default';
    const saved = localStorage.getItem(`superagent_pinned_sessions_${wsKey}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const handleTogglePinSession = useCallback((id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const wsKey = workspace || 'default';
    setPinnedSessionIds(prev => {
      const isPinned = prev.includes(id);
      const next = isPinned ? prev.filter(pId => pId !== id) : [id, ...prev];
      try {
        localStorage.setItem(`superagent_pinned_sessions_${wsKey}`, JSON.stringify(next));
      } catch (err) {}
      return next;
    });
  }, [workspace]);

  const [messages, setMessages] = useState<SuperAgentMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const currentOffsetRef = useRef(0);

  const [hasMoreSessions, setHasMoreSessions] = useState(false);
  const [loadingMoreSessions, setLoadingMoreSessions] = useState(false);
  const currentSessionOffsetRef = useRef(0);

  const prevWorkspaceRef = useRef(workspace);
  const activeSessionIdRef = useRef(activeSessionId);
  const loadedSessionIdRef = useRef<string | null>(activeSessionId || null);
  const loadedMessagesSessionIdRef = useRef<string | null>(activeSessionId || null);
  const deletedSessionIdsRef = useRef<Set<string>>(new Set());
  const lastSeenMessageCountRef = useRef<Record<string, number>>({});
  const selectSessionAbortControllerRef = useRef<AbortController | null>(null);
  const saveDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep activeSessionIdRef up to date
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const setMessagesWithRef = useCallback((val: React.SetStateAction<SuperAgentMessage[]>) => {
    loadedMessagesSessionIdRef.current = activeSessionIdRef.current;
    setMessages(val);
  }, []);

  // Initial Sync from Backend on switch/mount
  const syncSessions = useCallback(async (wsPath: string, preserveActiveId?: string) => {
    const workspaceChanged = prevWorkspaceRef.current !== wsPath;
    const localSessions = loadWorkspaceSessions(wsPath);
    const res = await apiGetSessions(wsPath, SESSION_PAGE_SIZE, 0);
    if (res && res.sessions.length > 0) {
      const validServerSessions = res.sessions.filter(s => !deletedSessionIdsRef.current.has(s.id));
      setSessions(prev => {
        const baseSessions = workspaceChanged ? localSessions : prev;
        const prevMap = new Map(baseSessions.map(s => [s.id, s]));
        const serverIds = new Set(validServerSessions.map(s => s.id));
        const localOnly = baseSessions.filter(s => !serverIds.has(s.id) && !deletedSessionIdsRef.current.has(s.id));

        const mergedServerSessions = validServerSessions.map(serverSession => {
          const localSession = prevMap.get(serverSession.id);
          // Preserve local title if local session has a non-default title and server returns generic "New Chat"
          if (
            localSession &&
            localSession.title &&
            localSession.title !== 'New Chat' &&
            (!serverSession.title || serverSession.title === 'New Chat')
          ) {
            // Push local clean title to backend so server stays synced
            apiSaveSession(wsPath, { ...serverSession, title: localSession.title }, []);
            return { ...serverSession, title: localSession.title };
          }
          return serverSession;
        });

        return [...localOnly, ...mergedServerSessions];
      });
      setHasMoreSessions(res.hasMore);
      currentSessionOffsetRef.current = SESSION_PAGE_SIZE;
      
      const targetActiveId = preserveActiveId || 
        (!workspaceChanged ? activeSessionIdRef.current : undefined) || 
        (validServerSessions[0]?.id) ||
        (localSessions[0]?.id);
      
      if (targetActiveId && validServerSessions.some(s => s.id === targetActiveId)) {
        activeSessionIdRef.current = targetActiveId;
        setActiveSessionId(targetActiveId);
        loadedMessagesSessionIdRef.current = targetActiveId;
        const result = await apiGetSessionMessages(wsPath, targetActiveId, PAGE_SIZE, 0);
        if (result && result.messages.length > 0) {
          setMessages(result.messages);
          loadedMessagesSessionIdRef.current = targetActiveId;
          setHasMore(result.hasMore);
          currentOffsetRef.current = PAGE_SIZE;
          loadedSessionIdRef.current = targetActiveId;
          return;
        } else {
          const wsKey = wsPath || 'default';
          const saved = localStorage.getItem(`superagent_messages_${wsKey}_${targetActiveId}`);
          if (saved) {
            try {
              const parsed = JSON.parse(saved);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setMessages(parsed);
                loadedMessagesSessionIdRef.current = targetActiveId;
                setHasMore(false);
                loadedSessionIdRef.current = targetActiveId;
                return;
              }
            } catch (e) {}
          }
          if (result) {
            setMessages(result.messages);
            loadedMessagesSessionIdRef.current = targetActiveId;
            setHasMore(result.hasMore);
            currentOffsetRef.current = PAGE_SIZE;
            loadedSessionIdRef.current = targetActiveId;
            return;
          }
        }
      } else if (targetActiveId && !deletedSessionIdsRef.current.has(targetActiveId)) {
        // Target active ID is a local-only session (e.g., brand new chat)
        activeSessionIdRef.current = targetActiveId;
        setActiveSessionId(targetActiveId);
        const wsKey = wsPath || 'default';
        const saved = localStorage.getItem(`superagent_messages_${wsKey}_${targetActiveId}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) {
              setMessages(parsed);
              loadedMessagesSessionIdRef.current = targetActiveId;
              setHasMore(false);
              currentOffsetRef.current = 0;
              loadedSessionIdRef.current = targetActiveId;
              return;
            }
          } catch (e) {}
        }
        setMessages([]);
        loadedMessagesSessionIdRef.current = targetActiveId;
        setHasMore(false);
        currentOffsetRef.current = 0;
        loadedSessionIdRef.current = targetActiveId;
        return;
      }
    }

    // Fallback to localStorage
    const fallbackSessions = workspaceChanged ? localSessions : loadWorkspaceSessions(wsPath);
    setSessions(fallbackSessions);
    setHasMoreSessions(false);
    currentSessionOffsetRef.current = 0;
    
    let localActiveId = '';
    if (preserveActiveId && fallbackSessions.some(s => s.id === preserveActiveId)) {
      localActiveId = preserveActiveId;
    } else if (!workspaceChanged && activeSessionIdRef.current && fallbackSessions.some(s => s.id === activeSessionIdRef.current)) {
      localActiveId = activeSessionIdRef.current;
    } else if (fallbackSessions.length > 0) {
      localActiveId = fallbackSessions[0].id;
    } else {
      localActiveId = `session_${Date.now()}`;
    }
    setActiveSessionId(localActiveId);
    
    const wsKey = wsPath || 'default';
    const saved = localStorage.getItem(`superagent_messages_${wsKey}_${localActiveId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setMessages(parsed);
          loadedMessagesSessionIdRef.current = localActiveId;
          setHasMore(false);
          currentOffsetRef.current = 0;
          loadedSessionIdRef.current = localActiveId;
          return;
        }
      } catch (e) {}
    }
    // Only reset messages if we switched away to a different session
    if (loadedSessionIdRef.current !== localActiveId) {
      setMessages([]);
      loadedMessagesSessionIdRef.current = localActiveId;
    }
    setHasMore(false);
    currentOffsetRef.current = 0;
    loadedSessionIdRef.current = localActiveId;
  }, []);

  // Sync on workspace changes
  useEffect(() => {
    syncSessions(workspace);
    prevWorkspaceRef.current = workspace;
  }, [workspace, syncSessions]);

  // Listen for real-time history file updates from server (e.g. from CLI execution)
  useEffect(() => {
    const handleWsMessage = (payload: any) => {
      if (payload && payload.type === 'superagent-sessions-changed') {
        if (payload.action === 'delete' && payload.sessionId) {
          setSessions(prev => prev.filter(s => s.id !== payload.sessionId));
        } else if (payload.action === 'update' && payload.sessionId && payload.title) {
          setSessions(prev => prev.map(s => s.id === payload.sessionId ? { ...s, title: cleanSessionTitle(payload.title), updatedAt: Date.now() } : s));
        } else {
          syncSessions(workspace, activeSessionIdRef.current);
        }
      }
    };
    wsManager.addGlobalMessageListener(handleWsMessage);
    return () => {
      wsManager.removeGlobalMessageListener(handleWsMessage);
    };
  }, [workspace, syncSessions]);

  // Persist messages & update title ONLY when loadedMessagesSessionIdRef matches activeSessionId (Debounced)
  useEffect(() => {
    if (!activeSessionId) return;
    if (loadedMessagesSessionIdRef.current !== activeSessionId) return; // Isolated check!

    const wsKey = workspace || 'default';
    const msgKey = `superagent_messages_${wsKey}_${activeSessionId}`;

    if (saveDebounceTimerRef.current) {
      clearTimeout(saveDebounceTimerRef.current);
    }

    if (messages && messages.length > 0) {
      saveDebounceTimerRef.current = setTimeout(() => {
        // Local backup (only last 300 messages)
        try {
          localStorage.setItem(msgKey, JSON.stringify(messages.slice(-300)));
        } catch (e) {}

        const newTitle = generateSessionTitle(messages);
        const prevCount = lastSeenMessageCountRef.current[activeSessionId];
        const isNewMessageAdded = prevCount !== undefined && messages.length > prevCount;
        lastSeenMessageCountRef.current[activeSessionId] = messages.length;

        setSessions(prevSessions => {
          const targetIdx = prevSessions.findIndex(s => s.id === activeSessionId);
          if (targetIdx < 0) {
            const lastMsgTime = (messages[messages.length - 1] as any)?.timestamp;
            const inferredTime = lastMsgTime ? new Date(lastMsgTime).getTime() : Date.now();
            const newSession: ChatSession = {
              id: activeSessionId,
              title: newTitle,
              createdAt: inferredTime,
              updatedAt: isNewMessageAdded ? Date.now() : inferredTime
            };
            const updated = [newSession, ...prevSessions];
            try {
              localStorage.setItem(`superagent_sessions_${wsKey}`, JSON.stringify(updated));
            } catch (e) {}
            apiSaveSession(workspace, newSession, messages);
            pruneOldSessionCaches(wsKey, updated.map(s => s.id));
            return updated;
          }

          const currentSession = prevSessions[targetIdx];
          // Only update title automatically if existing title is generic ("New Chat" or missing)
          const isDefaultTitle = !currentSession.title || currentSession.title === 'New Chat';
          const effectiveTitle = (isDefaultTitle && newTitle !== 'New Chat') ? newTitle : currentSession.title;
          const isTitleChanged = currentSession.title !== effectiveTitle;

          // Skip if title is unchanged AND no new message was added
          if (!isTitleChanged && !isNewMessageAdded) {
            return prevSessions;
          }

          const updated = [...prevSessions];
          const updatedSession = {
            ...currentSession,
            title: effectiveTitle,
            updatedAt: isNewMessageAdded ? Date.now() : currentSession.updatedAt
          };
          updated[targetIdx] = updatedSession;

          try {
            localStorage.setItem(`superagent_sessions_${wsKey}`, JSON.stringify(updated));
          } catch (e) {}

          // Save to backend disk
          apiSaveSession(workspace, updatedSession, messages);
          pruneOldSessionCaches(wsKey, updated.map(s => s.id));

          return updated;
        });
      }, 400); // 400ms debounce
    }

    return () => {
      if (saveDebounceTimerRef.current) {
        clearTimeout(saveDebounceTimerRef.current);
      }
    };
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
    if (!id) return;
    if (id === activeSessionIdRef.current && loadedSessionIdRef.current === id && messages.length > 0) return;

    // Abort previous session fetch in-flight if user switches session quickly
    if (selectSessionAbortControllerRef.current) {
      selectSessionAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    selectSessionAbortControllerRef.current = abortController;

    activeSessionIdRef.current = id;
    setActiveSessionId(id);
    loadedSessionIdRef.current = id;
    loadedMessagesSessionIdRef.current = id;
    currentOffsetRef.current = 0;

    // Fast-path: Immediately load local cached messages for 0ms UI render latency
    const wsKey = workspace || 'default';
    const saved = localStorage.getItem(`superagent_messages_${wsKey}_${id}`);
    let loadedFromLocal = false;
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          loadedMessagesSessionIdRef.current = id;
          setHasMore(false);
          lastSeenMessageCountRef.current[id] = parsed.length;
          loadedFromLocal = true;
        }
      } catch (e) {}
    }

    // Asynchronously fetch fresh session messages from backend server
    const result = await apiGetSessionMessages(workspace, id, PAGE_SIZE, 0, abortController.signal);
    // Guard against race condition: user switched session while network request was in-flight
    if (activeSessionIdRef.current !== id || abortController.signal.aborted) return;

    if (result && Array.isArray(result.messages) && result.messages.length > 0) {
      setMessages(prev => {
        // Incremental merge check: avoid re-rendering if arrays match exactly
        if (prev.length === result.messages.length && JSON.stringify(prev) === JSON.stringify(result.messages)) {
          return prev;
        }
        return result.messages;
      });
      loadedMessagesSessionIdRef.current = id;
      setHasMore(result.hasMore);
      currentOffsetRef.current = PAGE_SIZE;
      lastSeenMessageCountRef.current[id] = result.messages.length;
      try {
        localStorage.setItem(`superagent_messages_${wsKey}_${id}`, JSON.stringify(result.messages.slice(-300)));
      } catch (e) {}
    } else if (!loadedFromLocal) {
      setMessages(result?.messages || []);
      loadedMessagesSessionIdRef.current = id;
      setHasMore(false);
      lastSeenMessageCountRef.current[id] = 0;
    }
  }, [workspace, messages.length]);

  const handleNewChat = useCallback((): string => {
    const newId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const wsKey = getNormalizedWsKey(workspace);
    setSessions(prev => {
      const nextSessions = [newSession, ...prev];
      try {
        localStorage.setItem(`superagent_sessions_${wsKey}`, JSON.stringify(nextSessions));
      } catch (e) {}
      return nextSessions;
    });

    setActiveSessionId(newId);
    setMessages([]);
    loadedMessagesSessionIdRef.current = newId;
    setHasMore(false);
    currentOffsetRef.current = 0;
    loadedSessionIdRef.current = newId;

    try {
      localStorage.setItem(`superagent_messages_${wsKey}_${newId}`, JSON.stringify([]));
    } catch (e) {}

    // Register session on backend server
    apiSaveSession(workspace, newSession, []);
    return newId;
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
          loadedMessagesSessionIdRef.current = nextId;
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
              loadedMessagesSessionIdRef.current = nextId;
              setHasMore(false);
              loadedSessionIdRef.current = nextId;
              return;
            }
          } catch (err) {}
        }
        setMessages([]);
        loadedMessagesSessionIdRef.current = nextId;
        setHasMore(false);
        loadedSessionIdRef.current = nextId;
      } else {
        setActiveSessionId('');
        setMessages([]);
        loadedMessagesSessionIdRef.current = '';
        setHasMore(false);
        currentOffsetRef.current = 0;
        loadedSessionIdRef.current = '';
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
    setMessages: setMessagesWithRef,
    hasMore,
    loadingMore,
    loadMoreMessages,
    hasMoreSessions,
    loadingMoreSessions,
    loadMoreSessions,
    handleSelectSession,
    handleNewChat,
    handleDeleteSession,
    handleRenameSession,
    pinnedSessionIds,
    handleTogglePinSession
  };
}
