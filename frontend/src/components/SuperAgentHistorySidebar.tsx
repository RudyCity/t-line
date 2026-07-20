import React, { useState, useMemo } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Search, History } from 'lucide-react';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface SuperAgentHistorySidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string, e: React.MouseEvent) => void;
  onRenameSession?: (id: string, newTitle: string) => void;
}

export function SuperAgentHistorySidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession
}: SuperAgentHistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredSessions = useMemo(() => {
    if (!searchQuery.trim()) return sessions;
    const q = searchQuery.toLowerCase();
    return sessions.filter(s => s.title.toLowerCase().includes(q));
  }, [sessions, searchQuery]);

  const handleStartRename = (session: ChatSession, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveRename = (id: string, e?: React.FormEvent) => {
    e?.preventDefault();
    if (editTitle.trim() && onRenameSession) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = () => {
    setEditingId(null);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="w-full bg-[#090c14] border-r border-zinc-800/80 flex flex-col h-full shrink-0 select-none font-sans text-xs">
      {/* Sidebar Header with History Title & Action Icon Buttons */}
      <div className="p-2.5 px-3 border-b border-zinc-800/80 flex items-center justify-between min-h-[44px]">
        <div className="flex items-center gap-2 font-semibold text-xs text-zinc-200 tracking-wide">
          <History className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>History</span>
          <span className="text-[10px] text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded-full border border-indigo-800/60 font-mono">
            {sessions.length}
          </span>
        </div>

        {/* Action Icon Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSearchDropdown(prev => !prev)}
            className={`p-1.5 rounded-md border transition cursor-pointer ${
              showSearchDropdown || searchQuery
                ? 'bg-indigo-950/80 border-indigo-700 text-indigo-300 shadow-sm'
                : 'bg-[#121622] border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title={showSearchDropdown ? "Close search" : "Search history"}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onNewChat}
            className="p-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 border border-indigo-500 text-white shadow-sm hover:shadow transition cursor-pointer flex items-center gap-1 font-medium text-[11px]"
            title="New Chat"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search Input Dropdown Panel */}
      {showSearchDropdown && (
        <div className="p-2 border-b border-zinc-800/80 bg-[#0c0f1a] transition-all duration-150">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-[#121622] border border-zinc-800 rounded-md pl-8 pr-7 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/80 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-zinc-500 hover:text-zinc-300 p-0.5"
                title="Clear search filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Session List */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1 custom-scrollbar">
        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-zinc-500 text-xs italic">
            {searchQuery ? 'No matching chats' : 'No chat history'}
          </div>
        ) : (
          filteredSessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = editingId === session.id;

            return (
              <div
                key={session.id}
                onClick={() => onSelectSession(session.id)}
                className={`group relative flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                  isActive
                    ? 'bg-indigo-950/50 border-l-2 border-indigo-500 text-indigo-100 font-medium shadow-sm'
                    : 'text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200 border-l-2 border-transparent'
                }`}
              >
                {isEditing ? (
                  <form
                    onSubmit={(e) => handleSaveRename(session.id, e)}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 w-full"
                  >
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      autoFocus
                      className="flex-1 bg-[#161b26] border border-indigo-500 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="p-1 text-emerald-400 hover:text-emerald-300 rounded"
                      title="Save title"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelRename}
                      className="p-1 text-zinc-400 hover:text-zinc-300 rounded"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-400' : 'text-zinc-500 group-hover:text-zinc-400'}`} />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-xs leading-tight">{session.title}</span>
                        <span className="text-[10px] text-zinc-500 font-mono mt-0.5">{formatTimestamp(session.updatedAt)}</span>
                      </div>
                    </div>

                    {/* Action Buttons on Hover */}
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      {onRenameSession && (
                        <button
                          onClick={(e) => handleStartRename(session, e)}
                          className="p-1 text-zinc-400 hover:text-indigo-300 rounded transition"
                          title="Rename chat"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        onClick={(e) => onDeleteSession(session.id, e)}
                        className="p-1 text-zinc-400 hover:text-rose-400 rounded transition"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
