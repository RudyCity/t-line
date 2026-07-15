import React from 'react';
import { Bookmark, Trash } from 'lucide-react';
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

export default function BookmarksDropdown({
  showBookmarksDropdown,
  setShowBookmarksDropdown,
  bookmarksDropdownRef,
  bookmarks,
  clearAllBookmarks,
  handleNavigateToBookmark,
  removeBookmark,
}: BookmarksDropdownProps) {
  return (
    <div className="relative" ref={bookmarksDropdownRef}>
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

      {showBookmarksDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl z-[100] backdrop-blur-md p-2 flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="text-xs font-semibold text-[var(--text-muted)] border-b border-[var(--border-color)] pb-2 mb-2 px-2 flex justify-between items-center select-none">
            <span>Saved URLs & Domains</span>
            {bookmarks.length > 0 && (
              <button
                type="button"
                onClick={clearAllBookmarks}
                className="text-[10px] text-red-400 hover:text-red-300 font-semibold cursor-pointer transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
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
                    onClick={() => removeBookmark(bookmark.id)}
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
