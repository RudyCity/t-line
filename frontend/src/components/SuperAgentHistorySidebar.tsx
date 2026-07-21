import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Search, History, Download } from 'lucide-react';

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
  onExportSession?: (id: string, format: 'json' | 'markdown') => void;
  hasMoreSessions?: boolean;
  loadingMoreSessions?: boolean;
  onLoadMoreSessions?: () => void;
  isProcessing?: boolean;
}

export function SuperAgentHistorySidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onExportSession,
  hasMoreSessions,
  loadingMoreSessions,
  onLoadMoreSessions,
  isProcessing = false,
}: SuperAgentHistorySidebarProps) {
  const [searchQuery, setSearchQuery]       = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [editTitle, setEditTitle]           = useState('');
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [exportMenuId, setExportMenuId]     = useState<string | null>(null);
  const exportMenuRef                       = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleExport = async (sessionId: string, format: 'json' | 'markdown', e: React.MouseEvent) => {
    e.stopPropagation();
    setExportMenuId(null);
    if (onExportSession) {
      onExportSession(sessionId, format);
      return;
    }
    // Self-contained download fallback
    try {
      const url = `/api/superagent/sessions/${encodeURIComponent(sessionId)}/export?format=${format}`;
      const res = await fetch(url);
      const text = await res.text();
      const ext = format === 'markdown' ? 'md' : 'json';
      const blob = new Blob([text], { type: format === 'markdown' ? 'text/markdown' : 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `session-${sessionId.slice(0, 8)}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {}
  };

  const handleStartDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
  };

  const handleConfirmDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(null);
    onDeleteSession(id, e);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(null);
  };

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
    <div className="w-full bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col h-full shrink-0 select-none font-sans text-xs">
      {/* Sidebar Header with History Title & Action Icon Buttons */}
      <div className="p-2.5 px-3 border-b border-[var(--border-color)] flex items-center justify-between min-h-[44px]">
        <div className="flex items-center gap-2 font-semibold text-xs text-[var(--text-main)] tracking-wide">
          <History className="w-4 h-4 text-[var(--color-primary)] shrink-0" />
          <span>History</span>
          <span className="text-[10px] text-[var(--color-primary)] bg-[var(--color-primary-glow)] px-1.5 py-0.5 rounded-full border border-[var(--color-primary)]/40 font-mono">
            {sessions.length}
          </span>
        </div>

        {/* Action Icon Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setShowSearchDropdown(prev => !prev)}
            className={`p-1.5 rounded-md border transition cursor-pointer ${
              showSearchDropdown || searchQuery
                ? 'bg-[var(--color-primary-glow)] border-[var(--color-primary)] text-[var(--color-primary)] shadow-sm'
                : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
            title={showSearchDropdown ? "Close search" : "Search history"}
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onNewChat}
            className="p-1.5 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] border border-[var(--color-primary)] text-white shadow-sm hover:shadow transition cursor-pointer flex items-center gap-1 font-medium text-[11px]"
            title="New Chat"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search Input Dropdown Panel */}
      {showSearchDropdown && (
        <div className="p-2 border-b border-[var(--border-color)] bg-[var(--panel-header-bg)] transition-all duration-150">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder="Filter chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md pl-8 pr-7 py-1 text-xs text-[var(--text-main)] placeholder:[var(--text-muted)] focus:outline-none focus:border-[var(--color-primary)] transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5"
                title="Clear search filter"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Session List */}
      <div
        className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1 custom-scrollbar"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (
            el.scrollHeight - el.scrollTop - el.clientHeight < 60 &&
            hasMoreSessions &&
            !loadingMoreSessions &&
            !searchQuery &&
            onLoadMoreSessions
          ) {
            onLoadMoreSessions();
          }
        }}
      >
        {filteredSessions.length === 0 ? (
          <div className="p-4 text-center text-[var(--text-muted)] text-xs italic">
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
                    ? 'bg-[var(--color-primary-glow)] text-[var(--text-main)] font-medium shadow-sm'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-overlay-hover)] hover:text-[var(--text-main)]'
                } ${isActive && isProcessing ? 'ring-1 ring-[var(--color-primary)]/30 shadow-[0_0_8px_rgba(99,102,241,0.15)]' : ''}`}
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
                      className="flex-1 bg-[var(--bg-card)] border border-[var(--color-primary)] rounded px-1.5 py-0.5 text-xs text-[var(--text-main)] focus:outline-none"
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
                      className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </form>
                ) : deletingId === session.id ? (
                  <div className="flex items-center justify-between w-full px-1 text-xs">
                    <span className="text-rose-400 font-medium text-[11px] truncate">Hapus chat?</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => handleConfirmDelete(session.id, e)}
                        className="px-1.5 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-semibold transition"
                        title="Ya, hapus"
                      >
                        Hapus
                      </button>
                      <button
                        onClick={handleCancelDelete}
                        className="px-1.5 py-0.5 bg-[var(--bg-card)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-main)] rounded text-[10px] transition"
                        title="Batal"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)] group-hover:text-[var(--text-main)]'}`} />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate text-xs leading-tight">{session.title}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{formatTimestamp(session.updatedAt)}</span>
                      </div>
                    </div>

                    {/* Loading dots or Action Buttons on Hover */}
                    {isActive && isProcessing ? (
                      <span className="flex items-center gap-0.5 shrink-0 ml-1">
                        <span className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1 h-1 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    ) : (
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                        {/* Export dropdown */}
                        <div className="relative" ref={exportMenuId === session.id ? exportMenuRef : undefined}>
                          <button
                            onClick={e => { e.stopPropagation(); setExportMenuId(exportMenuId === session.id ? null : session.id); }}
                            className="p-1 text-zinc-400 hover:text-sky-300 rounded transition"
                            title="Export session"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                          {exportMenuId === session.id && (
                            <div className="absolute right-0 bottom-full mb-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg shadow-lg z-50 overflow-hidden min-w-[110px]">
                              <button
                                onClick={e => handleExport(session.id, 'json', e)}
                                className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] transition flex items-center gap-1.5"
                              >
                                <span className="font-mono text-[10px] text-amber-400">JSON</span> Export
                              </button>
                              <button
                                onClick={e => handleExport(session.id, 'markdown', e)}
                                className="w-full text-left px-3 py-1.5 text-[11px] text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] transition flex items-center gap-1.5"
                              >
                                <span className="font-mono text-[10px] text-blue-400">.MD</span> Markdown
                              </button>
                            </div>
                          )}
                        </div>
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
                          onClick={(e) => handleStartDelete(session.id, e)}
                          className="p-1 text-zinc-400 hover:text-rose-400 rounded transition"
                          title="Delete chat"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })
        )}

        {/* Loading indicator for loading more sessions */}
        {hasMoreSessions && !searchQuery && (
          <div className="p-2 text-center text-zinc-500 text-[11px]">
            {loadingMoreSessions ? (
              <span className="animate-pulse">Loading older chats...</span>
            ) : (
              <button
                onClick={() => onLoadMoreSessions && onLoadMoreSessions()}
                className="text-indigo-400 hover:text-indigo-300 transition"
              >
                Load more chats...
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
