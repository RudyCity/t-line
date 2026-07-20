import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ChatSession } from './SuperAgentHistorySidebar';

export interface SuperAgentMessage {
  role: 'user' | 'assistant' | 'system' | 'tool' | 'thought';
  text: string;
  toolName?: string;
  args?: any;
  result?: any;
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

export function useSuperAgentSessions(workspace: string) {
  const [sessions, setSessions] = useState<ChatSession[]>(() => loadWorkspaceSessions(workspace));
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const loaded = loadWorkspaceSessions(workspace);
    return loaded[0]?.id || `session_${Date.now()}`;
  });

  const [messages, setMessages] = useState<SuperAgentMessage[]>(() => {
    try {
      const loaded = loadWorkspaceSessions(workspace);
      const activeId = loaded[0]?.id;
      if (activeId) {
        const savedMsgs = localStorage.getItem(`superagent_messages_${workspace || 'default'}_${activeId}`);
        if (savedMsgs) {
          const parsed = JSON.parse(savedMsgs);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {}
    return [{ role: 'system', text: 'SuperAgent ready. Connected to t-line workspace context.' }];
  });

  const prevWorkspaceRef = useRef(workspace);

  // Sync state on workspace changes
  useEffect(() => {
    if (prevWorkspaceRef.current !== workspace) {
      prevWorkspaceRef.current = workspace;
      const loaded = loadWorkspaceSessions(workspace);
      setSessions(loaded);
      const activeId = loaded[0]?.id || `session_${Date.now()}`;
      setActiveSessionId(activeId);

      const wsKey = workspace || 'default';
      const saved = localStorage.getItem(`superagent_messages_${wsKey}_${activeId}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            return;
          }
        } catch (e) {}
      }
      setMessages([{ role: 'system', text: `SuperAgent ready. Workspace: ${workspace || 'Default'}` }]);
    }
  }, [workspace]);

  // Persist messages & update title/timestamp
  useEffect(() => {
    if (!activeSessionId) return;
    const wsKey = workspace || 'default';
    const msgKey = `superagent_messages_${wsKey}_${activeSessionId}`;

    if (messages && messages.length > 0) {
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
        updated[targetIdx] = {
          ...currentSession,
          title: newTitle,
          updatedAt: Date.now()
        };
        updated.sort((a, b) => b.updatedAt - a.updatedAt);
        try {
          localStorage.setItem(`superagent_sessions_${wsKey}`, JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }
  }, [messages, activeSessionId, workspace]);

  const handleSelectSession = useCallback((id: string) => {
    if (id === activeSessionId) return;
    setActiveSessionId(id);
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
    setMessages([{ role: 'system', text: 'SuperAgent ready. Connected to session.' }]);
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

    const initialMsgs: SuperAgentMessage[] = [{ role: 'system', text: `SuperAgent ready. Workspace: ${workspace || 'Default'}` }];
    setMessages(initialMsgs);

    try {
      localStorage.setItem(`superagent_messages_${wsKey}_${newId}`, JSON.stringify(initialMsgs));
    } catch (e) {}
  }, [workspace]);

  const handleDeleteSession = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const wsKey = workspace || 'default';
    let remainingSessions: ChatSession[] = [];

    setSessions(prev => {
      remainingSessions = prev.filter(s => s.id !== id);
      try {
        localStorage.setItem(`superagent_sessions_${wsKey}`, JSON.stringify(remainingSessions));
        localStorage.removeItem(`superagent_messages_${wsKey}_${id}`);
      } catch (e) {}
      return remainingSessions;
    });

    if (id === activeSessionId) {
      if (remainingSessions.length > 0) {
        const nextId = remainingSessions[0].id;
        setActiveSessionId(nextId);
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
        setMessages([{ role: 'system', text: 'SuperAgent ready.' }]);
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
      return updated;
    });
  }, [workspace]);

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
