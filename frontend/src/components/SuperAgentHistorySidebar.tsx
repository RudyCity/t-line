import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Search, History, Download, Pin, PinOff } from 'lucide-react';
import { cleanSessionTitle } from './SuperAgentConsoleUtils';

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

interface SuperAgentHistorySidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  pinnedSessionIds?: string[];
  onTogglePinSession?: (id: string, e?: React.MouseEvent) => void;
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
  pinnedSessionIds = [],
  onTogglePinSession,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  onRenameSession,
  onExportSession,
  hasMoreSessions: _hasMoreSessions,
  loadingMoreSessions: _loadingMoreSessions,
  onLoadMoreSessions: _onLoadMoreSessions,
  isProcessing = false,
}: SuperAgentHistorySidebarProps) {
  const [searchQuery, setSearchQuery]       = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [editingId, setEditingId]           = useState<string | null>(null);
  const [editTitle, setEditTitle]           = useState('');
  const [deletingId, setDeletingId]         = useState<string | null>(null);
  const [exportMenuId, setExportMenuId]     = useState<string | null>(null);
  const [groupLimits, setGroupLimits]       = useState<Record<string, number>>({});
  const exportMenuRef                       = useRef<HTMLDivElement>(null);

  const handleExpandGroup = (label: string) => {
    setGroupLimits(prev => ({
      ...prev,
      [label]: (prev[label] || 5) + 5
    }));
  };

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
    // Self-contained download fallback with toast notification
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
      window.dispatchEvent(new CustomEvent('tline-toast', {
        detail: { message: `Ekspor chat .${ext} berhasil diunduh` }
      }));
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

  const pinnedSet = useMemo(() => new Set(pinnedSessionIds), [pinnedSessionIds]);

  const { pinnedSessions, groupedUnpinnedSessions, totalFiltered } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? sessions.filter(s => s.title.toLowerCase().includes(q))
      : sessions;

    const pinned: ChatSession[] = [];
    const unpinned: ChatSession[] = [];

    for (const s of filtered) {
      if (pinnedSet.has(s.id)) {
        pinned.push(s);
      } else {
        unpinned.push(s);
      }
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayStart = todayStart - (24 * 60 * 60 * 1000);
    const sevenDaysAgoStart = todayStart - (6 * 24 * 60 * 60 * 1000);

    const today: ChatSession[] = [];
    const yesterday: ChatSession[] = [];
    const last7Days: ChatSession[] = [];
    const older: ChatSession[] = [];

    for (const s of unpinned) {
      const time = s.updatedAt || s.createdAt || Date.now();
      if (time >= todayStart) {
        today.push(s);
      } else if (time >= yesterdayStart) {
        yesterday.push(s);
      } else if (time >= sevenDaysAgoStart) {
        last7Days.push(s);
      } else {
        older.push(s);
      }
    }

    return {
      pinnedSessions: pinned,
      groupedUnpinnedSessions: [
        { label: 'Hari Ini', items: today },
        { label: 'Kemarin', items: yesterday },
        { label: '7 Hari Terakhir', items: last7Days },
        { label: 'Lebih Lama', items: older }
      ].filter(g => g.items.length > 0),
      totalFiltered: filtered.length
    };
  }, [sessions, searchQuery, pinnedSet]);

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

  const renderSessionCard = (session: ChatSession, isPinned: boolean) => {
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
                <div className="flex items-center gap-1 min-w-0">
                  {isPinned && (
                    <span title="Pinned chat"><Pin className="w-3 h-3 text-amber-400 shrink-0 rotate-45" /></span>
                  )}
                  <span className="truncate text-xs leading-tight">{cleanSessionTitle(session.title)}</span>
                </div>
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
                {/* Pin / Unpin Button */}
                {onTogglePinSession && (
                  <button
                    onClick={(e) => onTogglePinSession(session.id, e)}
                    className={`p-1 rounded transition ${isPinned ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-400 hover:text-amber-300'}`}
                    title={isPinned ? "Unpin chat" : "Pin chat to top"}
                  >
                    {isPinned ? <PinOff className="w-3 h-3" /> : <Pin className="w-3 h-3" />}
                  </button>
                )}

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

      {/* Session List with Pinned Section and Temporal Grouping (Limit 5 per Category) */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-3 custom-scrollbar">
        {totalFiltered === 0 ? (
          <div className="p-4 text-center text-[var(--text-muted)] text-xs italic">
            {searchQuery ? 'No matching chats' : 'No chat history'}
          </div>
        ) : (
          <>
            {/* Pinned Section */}
            {pinnedSessions.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] font-semibold tracking-wider text-amber-400 uppercase">
                  <Pin className="w-3 h-3 rotate-45" />
                  <span>Pinned ({pinnedSessions.length})</span>
                </div>
                <div className="space-y-1">
                  {pinnedSessions.map(session => renderSessionCard(session, true))}
                </div>
              </div>
            )}

            {/* Grouped Unpinned Sessions by Temporal Sections (Max 5 per category initially) */}
            {groupedUnpinnedSessions.map(group => {
              const limit = searchQuery ? group.items.length : (groupLimits[group.label] || 5);
              const visibleItems = group.items.slice(0, limit);
              const remainingCount = group.items.length - visibleItems.length;

              return (
                <div key={group.label} className="space-y-1">
                  <div className="flex items-center justify-between px-1 py-0.5 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                    <span>{group.label}</span>
                    <span className="font-mono text-[9px] text-[var(--text-muted)]/60">({group.items.length})</span>
                  </div>
                  <div className="space-y-1">
                    {visibleItems.map(session => renderSessionCard(session, false))}
                  </div>
                  {remainingCount > 0 && !searchQuery && (
                    <div className="px-1 pt-0.5">
                      <button
                        onClick={() => handleExpandGroup(group.label)}
                        className="text-[11px] text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] hover:underline cursor-pointer transition font-medium flex items-center gap-1 py-0.5"
                      >
                        + Muat {Math.min(5, remainingCount)} lagi ({remainingCount} tersisa)
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
