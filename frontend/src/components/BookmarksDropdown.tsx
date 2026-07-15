import React, { useState } from 'react';
import { Bookmark, Trash, AlertTriangle, X } from 'lucide-react';
import { BookmarkItem } from './browserUrlUtils';

interface BookmarksDropdownProps {
  showBookmarksDropdown: boolean;
  setShowBookmarksDropdown: (show: boolean) => void;
  bookmarksDropdownRef: React.RefObject<HTMLDivElement>;
  bookmarks: BookmarkItem[];
  clearAllBookmarks: () => void;
  handleNavigateToBookmark: (url: string) => void;
  removeBookmark: (id: string) => void;
}

interface ConfirmState {
  type: 'clear-all' | 'delete';
  bookmarkId?: string;
  bookmarkName?: string;
}

export default function BookmarksDropdown({
  showBookmarksDropdown,
  setShowBookmarksDropdown,
  bookmarksDropdownRef,
  bookmarks,
  clearAllBookmarks,
  handleNavigateToBookmark,
  removeBookmark,
}: BookmarksDropdownProps) {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  function handleConfirmClearAll() {
    setConfirm({ type: 'clear-all' });
  }

  function handleConfirmDelete(id: string, name: string) {
    setConfirm({ type: 'delete', bookmarkId: id, bookmarkName: name });
  }

  function handleConfirmOk() {
    if (!confirm) return;
    if (confirm.type === 'clear-all') {
      clearAllBookmarks();
    } else if (confirm.type === 'delete' && confirm.bookmarkId) {
      removeBookmark(confirm.bookmarkId);
    }
    setConfirm(null);
  }

  function handleConfirmCancel() {
    setConfirm(null);
  }

  return (
    <div className="relative" ref={bookmarksDropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setShowBookmarksDropdown(!showBookmarksDropdown)}
        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
          showBookmarksDropdown
            ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.25)]'
            : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
        }`}
        title="Saved URLs / Bookmarks"
      >
        <Bookmark size={15} />
      </button>

      {/* Dropdown Panel */}
      {showBookmarksDropdown && (
        <div
          className="absolute right-0 mt-2 w-64 border border-[var(--border-color)] rounded-xl shadow-2xl z-[9999] p-2 flex flex-col"
          style={{ backgroundColor: 'rgb(17, 24, 39)' }}
        >
          {/* Header */}
          <div className="text-xs font-semibold text-[var(--text-muted)] border-b border-[var(--border-color)] pb-2 mb-2 px-2 flex justify-between items-center select-none">
            <span>Saved URLs &amp; Domains</span>
            {bookmarks.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="text-[10px] text-red-400 hover:text-red-300 font-semibold cursor-pointer transition-colors"
              >
                Clear All
              </button>
            )}
          </div>

          {/* Confirm Modal (inline) */}
          {confirm && (
            <div
              className="absolute inset-0 z-[10000] flex items-center justify-center rounded-xl"
              style={{ backgroundColor: 'rgba(10, 15, 28, 0.92)' }}
            >
              <div
                className="mx-3 rounded-xl border border-[var(--border-color)] p-4 flex flex-col gap-3 shadow-xl"
                style={{ backgroundColor: 'rgb(17, 24, 39)' }}
              >
                {/* Icon + Message */}
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-red-500/10 border border-red-500/30">
                    <AlertTriangle size={14} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-main)] leading-snug">
                      {confirm.type === 'clear-all'
                        ? 'Hapus semua bookmark?'
                        : 'Hapus bookmark ini?'}
                    </p>
                    <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-snug">
                      {confirm.type === 'clear-all'
                        ? `${bookmarks.length} bookmark akan dihapus permanen.`
                        : `"${confirm.bookmarkName}" akan dihapus permanen.`}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleConfirmCancel}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-all cursor-pointer"
                  >
                    <X size={10} />
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmOk}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-red-500/90 hover:bg-red-500 text-white transition-all cursor-pointer"
                  >
                    <Trash size={10} />
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bookmark List */}
          <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-1 scrollbar-thin">
            {bookmarks.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] text-center py-4 select-none">
                No saved URLs. Click the star in the URL bar to save.
              </div>
            ) : (
              bookmarks.map((bookmark) => (
                <div
                  key={bookmark.id}
                  className="flex items-center justify-between gap-1 p-2 rounded-lg hover:bg-[var(--bg-card-hover)] group transition-all cursor-pointer"
                >
                  <button
                    type="button"
                    onClick={() => handleNavigateToBookmark(bookmark.url)}
                    className="flex-1 text-left min-w-0 cursor-pointer"
                  >
                    <div className="text-xs font-medium text-[var(--text-main)] truncate group-hover:text-purple-400 transition-colors">
                      {bookmark.name}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">
                      {bookmark.url}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmDelete(bookmark.id, bookmark.name)}
                    className="p-1 rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                    title="Delete bookmark"
                  >
                    <Trash size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
