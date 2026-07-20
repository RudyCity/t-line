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
  if (msg.role !== 'system') return false;
  const textLower = (msg.text || '').toLowerCase();
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

// API Sync Helpers
async function apiGetSessions(workspace: string): Promise<ChatSession[] | null> {
  try {
    const res = await fetch(`/api/superagent/sessions?workspace=${encodeURIComponent(workspace)}`, {
      headers: getAuthHeader()
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.sessions)) return data.sessions;
    }
  } catch (e) {
    console.error('[SessionsAPI] GET sessions failed:', e);
  }
  return null;
}

async function apiGetSessionMessages(workspace: string, sessionId: string): Promise<SuperAgentMessage[] | null> {
  try {
    const res = await fetch(`/api/superagent/sessions/${encodeURIComponent(sessionId)}?workspace=${encodeURIComponent(workspace)}`, {
      headers: getAuthHeader()
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.messages)) return data.messages;
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

export function useSuperAgentSessions(workspace: string) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadWorkspaceSessions(workspace));
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const loaded = loadWorkspaceSessions(workspace);
    return loaded[0]?.id || `session_${Date.now()}`;
  });

  const [messages, setMessages] = useState<SuperAgentMessage[]>([]);
  const prevWorkspaceRef = useRef(workspace);
  const activeSessionIdRef = useRef(activeSessionId);

  // Keep activeSessionIdRef up to date
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // Initial Sync from Backend on switch/mount
  const syncSessions = useCallback(async (wsPath: string, preserveActiveId?: string) => {
    const apiSessions = await apiGetSessions(wsPath);
    if (apiSessions && apiSessions.length > 0) {
      setSessions(apiSessions);
      
      let activeId = apiSessions[0].id;
      if (preserveActiveId && apiSessions.some(s => s.id === preserveActiveId)) {
        activeId = preserveActiveId;
      }
      
      setActiveSessionId(activeId);
      const apiMsgs = await apiGetSessionMessages(wsPath, activeId);
      if (apiMsgs) {
        setMessages(apiMsgs);
        return;
      }
    }

    // Fallback to localStorage
    const localSessions = loadWorkspaceSessions(wsPath);
    setSessions(localSessions);
    
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
          return;
        }
      } catch (e) {}
    }
    setMessages([]);
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

  // Persist messages & update title/timestamp
  useEffect(() => {
    if (!activeSessionId) return;
    const wsKey = workspace || 'default';
    const msgKey = `superagent_messages_${wsKey}_${activeSessionId}`;

    if (messages && messages.length > 0) {
      // Local backup
      try {
        localStorage.setItem(msgKey, JSON.stringify(messages.slice(-300)));
      } catch (e) {}

      setSessions(prevSessions => {
        const targetIdx = prevSessions.findIndex(s => s.id === activeSessionId);
        if (targetIdx < 0) return prevSessions;

        const currentSession = prevSessions[targetIdx];
        let newTitle = currentSession.title;

        if (newTitle === 'New Chat') {
          const firstUserMsg = messages.find(m => m.role === 'user');
          if (firstUserMsg && firstUserMsg.text) {
            const line = firstUserMsg.text.trim().split('\n')[0];
            newTitle = line.length > 30 ? line.slice(0, 30) + '...' : line;
          }
        }

        const updated = [...prevSessions];
        const updatedSession = {
          ...currentSession,
          title: newTitle,
          updatedAt: Date.now()
        };
        updated[targetIdx] = updatedSession;
        updated.sort((a, b) => b.updatedAt - a.updatedAt);
        
        try {
          localStorage.setItem(`superagent_sessions_${wsKey}`, JSON.stringify(updated));
        } catch (e) {}

        // Save to backend disk
        apiSaveSession(workspace, updatedSession, messages);

        return updated;
      });
    }
  }, [messages, activeSessionId, workspace]);

  const handleSelectSession = useCallback(async (id: string) => {
    if (id === activeSessionId) return;
    setActiveSessionId(id);

    const apiMsgs = await apiGetSessionMessages(workspace, id);
    if (apiMsgs) {
      setMessages(apiMsgs);
      return;
    }

    const wsKey = workspace || 'default';
    const saved = localStorage.getItem(`superagent_messages_${wsKey}_${id}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      } catch (e) {}
    }
    setMessages([]);
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

    try {
      localStorage.setItem(`superagent_messages_${wsKey}_${newId}`, JSON.stringify([]));
    } catch (e) {}

    // Save empty chat session to backend
    apiSaveSession(workspace, newSession, []);
  }, [workspace]);

  const handleDeleteSession = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const wsKey = workspace || 'default';
    let remainingSessions: ChatSession[] = [];

    setSessions(prev => {
      remainingSessions = prev.filter(s => s.id !== id);
      try {
        localStorage.setItem(`superagent_sessions_${wsKey}`, JSON.stringify(remainingSessions));
        localStorage.removeItem(`superagent_messages_${wsKey}_${id}`);
      } catch (err) {}
      return remainingSessions;
    });

    // Delete session from backend
    apiDeleteSession(workspace, id);

    if (id === activeSessionId) {
      if (remainingSessions.length > 0) {
        const nextId = remainingSessions[0].id;
        setActiveSessionId(nextId);
        
        const apiMsgs = await apiGetSessionMessages(workspace, nextId);
        if (apiMsgs) {
          setMessages(apiMsgs);
          return;
        }

        const saved = localStorage.getItem(`superagent_messages_${wsKey}_${nextId}`);
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
              return;
            }
          } catch (err) {}
        }
        setMessages([]);
      } else {
        handleNewChat();
      }
    }
  }, [activeSessionId, handleNewChat, workspace]);

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
        apiGetSessionMessages(workspace, id).then(currentMsgs => {
          apiSaveSession(workspace, renamedSession, currentMsgs || messages);
        });
      }

      return updated;
    });
  }, [workspace, messages]);

  return {
    sessions,
    activeSessionId,
    messages,
    setMessages,
    handleSelectSession,
    handleNewChat,
    handleDeleteSession,
    handleRenameSession
  };
}
