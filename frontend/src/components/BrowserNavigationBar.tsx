import React from 'react';
import { Globe, RotateCw, ExternalLink, MousePointer, ArrowLeft, ArrowRight, Monitor, Tablet, Smartphone, Minus, Plus, Star, History, Camera, Moon, Sun } from 'lucide-react';
import BookmarksDropdown from './BookmarksDropdown';
import HistoryDropdown, { HistoryItem } from './HistoryDropdown';
import { BookmarkItem } from './browserUrlUtils';

export interface BrowserNavigationBarProps {
  urlInput: string;
  setUrlInput: (val: string) => void;
  activeUrl: string;
  isLoading: boolean;
  isInspecting: boolean;
  toggleInspect: () => void;
  forceDarkMode: boolean;
  setForceDarkMode: React.Dispatch<React.SetStateAction<boolean>>;
  deviceMode: 'desktop' | 'tablet' | 'mobile';
  setDeviceMode: (mode: 'desktop' | 'tablet' | 'mobile') => void;
  zoomFactor: number;
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handleZoomReset: () => void;
  handleBack: () => void;
  handleForward: () => void;
  handleReload: (forceBypassCache?: boolean) => void;
  handleNavigate: (e: React.FormEvent) => void;
  bookmarks: BookmarkItem[];
  showBookmarksDropdown: boolean;
  setShowBookmarksDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  bookmarksDropdownRef: any;
  handleNavigateToBookmark: (url: string) => void;
  removeBookmark: (id: string) => void;
  updateBookmark: (id: string, name: string, folder?: string) => void;
  clearAllBookmarks: () => void;
  history: HistoryItem[];
  showHistoryDropdown: boolean;
  setShowHistoryDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  historyDropdownRef: any;
  handleNavigateToHistory: (url: string) => void;
  removeHistoryItem: (id: string) => void;
  clearAllHistory: () => void;
  isCurrentBookmarked: boolean;
  toggleBookmarkCurrent: () => void;
  showAddBookmarkPopover: boolean;
  setShowAddBookmarkPopover: (val: boolean) => void;
  newBookmarkName: string;
  setNewBookmarkName: (val: string) => void;
  newBookmarkFolder: string;
  setNewBookmarkFolder: (val: string) => void;
  newBookmarkPopoverRef: any;
  handleSaveNewBookmark: () => void;
  handleCaptureScreenshot: () => void;
  openInSystemBrowser: (url: string) => void;
  isTauri: boolean;
}

export default function BrowserNavigationBar({
  urlInput,
  setUrlInput,
  activeUrl,
  isLoading,
  isInspecting,
  toggleInspect,
  forceDarkMode,
  setForceDarkMode,
  deviceMode,
  setDeviceMode,
  zoomFactor,
  handleZoomIn,
  handleZoomOut,
  handleZoomReset,
  handleBack,
  handleForward,
  handleReload,
  handleNavigate,
  bookmarks,
  showBookmarksDropdown,
  setShowBookmarksDropdown,
  bookmarksDropdownRef,
  handleNavigateToBookmark,
  removeBookmark,
  updateBookmark,
  clearAllBookmarks,
  history,
  showHistoryDropdown,
  setShowHistoryDropdown,
  historyDropdownRef,
  handleNavigateToHistory,
  removeHistoryItem,
  clearAllHistory,
  isCurrentBookmarked,
  toggleBookmarkCurrent,
  showAddBookmarkPopover,
  setShowAddBookmarkPopover,
  newBookmarkName,
  setNewBookmarkName,
  newBookmarkFolder,
  setNewBookmarkFolder,
  newBookmarkPopoverRef,
  handleSaveNewBookmark,
  handleCaptureScreenshot,
  openInSystemBrowser,
  isTauri
}: BrowserNavigationBarProps) {
  return (
    <div className="relative z-50 flex items-center justify-between gap-4 px-4 py-2 bg-[var(--bg-card)]/80 backdrop-blur-md border-b border-[var(--border-color)] select-none">
      
      {/* Left Section: Navigation Controls */}
      <div className="flex items-center gap-1">
        <div className="flex items-center bg-[var(--bg-main)]/50 border border-[var(--border-color)] rounded-lg p-0.5">
          <button 
            onClick={handleBack}
            className="p-1.5 rounded-md hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all cursor-pointer"
            title="Go back"
          >
            <ArrowLeft size={14} />
          </button>

          <button 
            onClick={handleForward}
            className="p-1.5 rounded-md hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all cursor-pointer"
            title="Go forward"
          >
            <ArrowRight size={14} />
          </button>

          <button 
            onClick={(e) => handleReload(e.shiftKey)}
            className="p-1.5 rounded-md hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all cursor-pointer"
            title="Reload page (Shift+Click for Hard Reload)"
          >
            <RotateCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Center Section: URL Bar */}
      <div className="flex-1 max-w-2xl">
        <form onSubmit={handleNavigate} className="w-full flex items-center">
          <div className="flex-1 relative flex items-center bg-[var(--bg-main)]/60 hover:bg-[var(--bg-main)]/90 focus-within:bg-[var(--bg-main)] focus-within:ring-2 focus-within:ring-purple-500/20 transition-all border border-[var(--border-color)] focus-within:border-purple-500/50 rounded-full px-3 py-1">
            
            <Globe size={14} className="text-purple-400/80 shrink-0" />
            
            <input 
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter application URL (e.g., localhost:3000)"
              className="w-full bg-transparent text-xs py-1 px-1 focus:outline-none text-[var(--text-main)] placeholder-[var(--text-muted)] border-none"
            />

            <div className="flex items-center gap-1.5 shrink-0 relative">
              {activeUrl && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={toggleBookmarkCurrent}
                    className={`p-1.5 rounded-lg border transition-colors cursor-pointer bg-[var(--bg-main)] border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] ${
                      isCurrentBookmarked ? 'text-amber-400 border-amber-500/30 bg-amber-500/10' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                    title={isCurrentBookmarked ? "Manage bookmark" : "Bookmark this page"}
                  >
                    <Star size={14} fill={isCurrentBookmarked ? "currentColor" : "none"} />
                  </button>

                  {showAddBookmarkPopover && (
                    <div
                      ref={newBookmarkPopoverRef}
                      className="absolute right-0 top-full mt-2 w-64 bg-gray-900 border border-[var(--border-color)] rounded-xl shadow-2xl p-3 z-[9999] flex flex-col gap-2"
                      style={{ backgroundColor: 'rgb(17, 24, 39)' }}
                    >
                      <div className="text-[10px] font-semibold text-purple-400">
                        {isCurrentBookmarked ? 'Edit Bookmark' : 'Tambah Bookmark'}
                      </div>
                      <input
                        type="text"
                        value={newBookmarkName}
                        onChange={(e) => setNewBookmarkName(e.target.value)}
                        placeholder="Nama Bookmark"
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] rounded px-2 py-1 focus:outline-none text-[var(--text-main)]"
                      />
                      <input
                        type="text"
                        value={newBookmarkFolder}
                        onChange={(e) => setNewBookmarkFolder(e.target.value)}
                        placeholder="Folder (opsional)"
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] text-[10px] rounded px-2 py-1 focus:outline-none text-[var(--text-main)]"
                      />
                      <div className="flex justify-end gap-2 mt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddBookmarkPopover(false)}
                          className="px-2.5 py-1 text-[9px] rounded border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                        >
                          Batal
                        </button>
                        <button
                          type="button"
                          onClick={handleSaveNewBookmark}
                          className="px-2.5 py-1 text-[9px] bg-purple-600 hover:bg-purple-500 text-white rounded cursor-pointer font-semibold"
                        >
                          Simpan
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <BookmarksDropdown
                showBookmarksDropdown={showBookmarksDropdown}
                setShowBookmarksDropdown={setShowBookmarksDropdown}
                bookmarksDropdownRef={bookmarksDropdownRef}
                bookmarks={bookmarks}
                clearAllBookmarks={clearAllBookmarks}
                handleNavigateToBookmark={handleNavigateToBookmark}
                removeBookmark={removeBookmark}
                updateBookmark={updateBookmark}
              />

              <div className="relative" ref={historyDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
                  className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                    showHistoryDropdown
                      ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.25)]'
                      : 'bg-[var(--bg-main)] border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
                  }`}
                  title="Riwayat Browser / History"
                >
                  <History size={15} />
                </button>
                
                <HistoryDropdown
                  showHistoryDropdown={showHistoryDropdown}
                  setShowHistoryDropdown={setShowHistoryDropdown}
                  historyDropdownRef={historyDropdownRef}
                  history={history}
                  clearAllHistory={clearAllHistory}
                  handleNavigateToHistory={handleNavigateToHistory}
                  removeHistoryItem={removeHistoryItem}
                />
              </div>
            </div>

          </div>
        </form>
      </div>

      {/* Right Section: View, Zoom, & Dev Actions */}
      <div className="flex items-center gap-3">
        
        <div className="flex items-center bg-[var(--bg-main)]/50 border border-[var(--border-color)] rounded-lg p-0.5">
          <button
            type="button"
            onClick={() => setDeviceMode('desktop')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              deviceMode === 'desktop'
                ? 'bg-purple-500/20 text-purple-400 font-semibold animate-none'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
            }`}
            title="Desktop View"
          >
            <Monitor size={13} />
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode('tablet')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              deviceMode === 'tablet'
                ? 'bg-purple-500/20 text-purple-400 font-semibold animate-none'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
            }`}
            title="Tablet View"
          >
            <Tablet size={13} />
          </button>
          <button
            type="button"
            onClick={() => setDeviceMode('mobile')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              deviceMode === 'mobile'
                ? 'bg-purple-500/20 text-purple-400 font-semibold animate-none'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
            }`}
            title="Mobile View"
          >
            <Smartphone size={13} />
          </button>
        </div>

        <div className="flex items-center bg-[var(--bg-main)]/50 border border-[var(--border-color)] rounded-lg p-0.5">
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] cursor-pointer"
            title="Zoom Out"
          >
            <Minus size={13} />
          </button>
          <span 
            onClick={handleZoomReset}
            className="text-[10px] font-mono px-2 min-w-[36px] text-center text-[var(--text-muted)] cursor-pointer hover:text-[var(--text-main)] transition-colors select-none"
            title="Reset zoom to 100% (Click to reset)"
          >
            {Math.round(zoomFactor * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] cursor-pointer"
            title="Zoom In"
          >
            <Plus size={13} />
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setForceDarkMode(prev => !prev)}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              forceDarkMode 
                ? 'bg-purple-500/20 border-purple-500 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.2)]' 
                : 'bg-[var(--bg-main)]/50 border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
            }`}
            title="Force Dark Mode"
          >
            {forceDarkMode ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <button 
            onClick={handleCaptureScreenshot}
            className="p-1.5 rounded-lg bg-[var(--bg-main)]/50 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-all cursor-pointer"
            title="Ambil Screenshot Viewport"
          >
            <Camera size={14} />
          </button>

          <button
            onClick={toggleInspect}
            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
              isInspecting 
                ? 'bg-purple-500/20 border-purple-500 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.2)]'
                : 'bg-[var(--bg-main)]/50 border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
            }`}
            title="Inspect Element (Click and select items to inspect)"
          >
            <MousePointer size={14} className={isInspecting ? 'animate-pulse' : ''} />
          </button>

          {isTauri && (
            <button 
              onClick={() => openInSystemBrowser(activeUrl)}
              className="p-1.5 rounded-lg bg-[var(--bg-main)]/50 border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)] transition-all cursor-pointer"
              title="Open in default system browser"
            >
              <ExternalLink size={14} />
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
