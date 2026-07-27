import { useState } from 'react';
import { Bookmark, Trash, AlertTriangle, X, Folder, FolderOpen, ChevronDown, ChevronRight, Edit2, Save } from 'lucide-react';
import { BookmarkItem } from './browserUrlUtils';

interface BookmarksDropdownProps {
  showBookmarksDropdown: boolean;
  setShowBookmarksDropdown: (show: boolean) => void;
  bookmarksDropdownRef: any;
  bookmarks: BookmarkItem[];
  clearAllBookmarks: () => void;
  handleNavigateToBookmark: (url: string) => void;
  removeBookmark: (id: string) => void;
  updateBookmark?: (id: string, name: string, folder?: string) => void;
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
  updateBookmark,
}: BookmarksDropdownProps) {
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editFolder, setEditFolder] = useState('');

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

  function toggleFolder(folderName: string) {
    setExpandedFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  }

  function startEdit(bookmark: BookmarkItem) {
    setEditingId(bookmark.id);
    setEditName(bookmark.name);
    setEditFolder(bookmark.folder || '');
  }

  function saveEdit(id: string) {
    if (updateBookmark) {
      updateBookmark(id, editName, editFolder.trim() || undefined);
    }
    setEditingId(null);
  }

  // Group bookmarks by folder
  const groups: Record<string, BookmarkItem[]> = {};
  const ungrouped: BookmarkItem[] = [];

  bookmarks.forEach(b => {
    if (b.folder && b.folder.trim()) {
      const folderKey = b.folder.trim();
      if (!groups[folderKey]) {
        groups[folderKey] = [];
      }
      groups[folderKey].push(b);
    } else {
      ungrouped.push(b);
    }
  });

  return (
    <div className="relative" ref={bookmarksDropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setShowBookmarksDropdown(!showBookmarksDropdown)}
        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
          showBookmarksDropdown
            ? 'bg-purple-600/20 border-purple-500 text-purple-400 '
            : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
        }`}
        title="Saved URLs / Bookmarks"
      >
        <Bookmark size={15} />
      </button>

      {/* Dropdown Panel */}
      {showBookmarksDropdown && (
        <div
          className="absolute right-0 mt-2 w-72 border border-[var(--border-color)] rounded-xl  z-[9999] p-2 flex flex-col"
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
                className="mx-3 rounded-xl border border-[var(--border-color)] p-4 flex flex-col gap-3 "
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
          <div className="max-h-64 overflow-y-auto flex flex-col gap-1 pr-1 scrollbar-thin">
            {bookmarks.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] text-center py-4 select-none">
                No saved URLs. Click the star in the URL bar to save.
              </div>
            ) : (
              <>
                {/* Foldered Groups */}
                {Object.entries(groups).map(([folderName, folderBookmarks]) => {
                  const isExpanded = expandedFolders[folderName] !== false; // default expanded
                  return (
                    <div key={folderName} className="flex flex-col gap-1 border-b border-[var(--border-color)]/20 pb-1 mb-1">
                      {/* Folder Title */}
                      <button
                        type="button"
                        onClick={() => toggleFolder(folderName)}
                        className="flex items-center gap-1.5 px-2 py-1 hover:bg-[var(--bg-card-hover)]/40 rounded text-left text-xs font-semibold text-purple-400 cursor-pointer"
                      >
                        {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        {isExpanded ? <FolderOpen size={12} /> : <Folder size={12} />}
                        <span className="truncate">{folderName}</span>
                        <span className="text-[9px] text-[var(--text-muted)]">({folderBookmarks.length})</span>
                      </button>

                      {/* Folder Content */}
                      {isExpanded && (
                        <div className="pl-4 flex flex-col gap-1">
                          {folderBookmarks.map(bookmark => (
                            <BookmarkRow
                              key={bookmark.id}
                              bookmark={bookmark}
                              editingId={editingId}
                              editName={editName}
                              editFolder={editFolder}
                              setEditName={setEditName}
                              setEditFolder={setEditFolder}
                              startEdit={startEdit}
                              saveEdit={saveEdit}
                              setEditingId={setEditingId}
                              handleNavigateToBookmark={handleNavigateToBookmark}
                              handleConfirmDelete={handleConfirmDelete}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Ungrouped/Root Bookmarks */}
                {ungrouped.length > 0 && (
                  <div className="flex flex-col gap-1">
                    {ungrouped.map(bookmark => (
                      <BookmarkRow
                        key={bookmark.id}
                        bookmark={bookmark}
                        editingId={editingId}
                        editName={editName}
                        editFolder={editFolder}
                        setEditName={setEditName}
                        setEditFolder={setEditFolder}
                        startEdit={startEdit}
                        saveEdit={saveEdit}
                        setEditingId={setEditingId}
                        handleNavigateToBookmark={handleNavigateToBookmark}
                        handleConfirmDelete={handleConfirmDelete}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface BookmarkRowProps {
  bookmark: BookmarkItem;
  editingId: string | null;
  editName: string;
  editFolder: string;
  setEditName: (val: string) => void;
  setEditFolder: (val: string) => void;
  startEdit: (bookmark: BookmarkItem) => void;
  saveEdit: (id: string) => void;
  setEditingId: (id: string | null) => void;
  handleNavigateToBookmark: (url: string) => void;
  handleConfirmDelete: (id: string, name: string) => void;
}

function BookmarkRow({
  bookmark,
  editingId,
  editName,
  editFolder,
  setEditName,
  setEditFolder,
  startEdit,
  saveEdit,
  setEditingId,
  handleNavigateToBookmark,
  handleConfirmDelete,
}: BookmarkRowProps) {
  const isEditing = editingId === bookmark.id;

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1.5 p-2 rounded-lg bg-[var(--bg-main)]/60 border border-[var(--border-color)]">
        <input
          type="text"
          value={editName}
          onChange={e => setEditName(e.target.value)}
          placeholder="Name"
          className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] rounded px-1.5 py-0.5 focus:outline-none text-[var(--text-main)]"
        />
        <input
          type="text"
          value={editFolder}
          onChange={e => setEditFolder(e.target.value)}
          placeholder="Folder (kosongkan jika tanpa folder)"
          className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] rounded px-1.5 py-0.5 focus:outline-none text-[var(--text-main)]"
        />
        <div className="flex justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setEditingId(null)}
            className="px-2 py-0.5 text-[9px] rounded border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => saveEdit(bookmark.id)}
            className="flex items-center gap-0.5 px-2 py-0.5 text-[9px] bg-purple-600 hover:bg-purple-500 text-white rounded cursor-pointer"
          >
            <Save size={10} />
            Simpan
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-1 p-1.5 rounded hover:bg-[var(--bg-card-hover)] group transition-all cursor-pointer">
      <button
        type="button"
        onClick={() => handleNavigateToBookmark(bookmark.url)}
        className="flex-1 text-left min-w-0 cursor-pointer"
      >
        <div className="text-[11px] font-medium text-[var(--text-main)] truncate group-hover:text-purple-400 transition-colors">
          {bookmark.name}
        </div>
        <div className="text-[9px] text-[var(--text-muted)] truncate">
          {bookmark.url}
        </div>
      </button>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">
        <button
          type="button"
          onClick={() => startEdit(bookmark)}
          className="p-1 rounded hover:bg-purple-500/10 text-[var(--text-muted)] hover:text-purple-400 cursor-pointer"
          title="Edit bookmark"
        >
          <Edit2 size={11} />
        </button>
        <button
          type="button"
          onClick={() => handleConfirmDelete(bookmark.id, bookmark.name)}
          className="p-1 rounded hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 cursor-pointer"
          title="Delete bookmark"
        >
          <Trash size={11} />
        </button>
      </div>
    </div>
  );
}
