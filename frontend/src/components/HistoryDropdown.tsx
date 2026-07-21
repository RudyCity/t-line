import React, { useState } from 'react';
import { History, Trash, X, Search, Clock } from 'lucide-react';

export interface HistoryItem {
  id: string;
  name: string;
  url: string;
  timestamp: number;
}

interface HistoryDropdownProps {
  showHistoryDropdown: boolean;
  setShowHistoryDropdown: (show: boolean) => void;
  historyDropdownRef: any;
  history: HistoryItem[];
  clearAllHistory: () => void;
  handleNavigateToHistory: (url: string) => void;
  removeHistoryItem: (id: string) => void;
}

const HistoryDropdown: React.FC<HistoryDropdownProps> = ({
  showHistoryDropdown,
  setShowHistoryDropdown,
  historyDropdownRef,
  history,
  clearAllHistory,
  handleNavigateToHistory,
  removeHistoryItem
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  if (!showHistoryDropdown) return null;

  const filteredHistory = history.filter(
    item =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.url.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (ts: number) => {
    try {
      return new Date(ts).toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (_) {
      return '';
    }
  };

  return (
    <div
      ref={historyDropdownRef}
      className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[380px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-main)]/40">
        <div className="flex items-center gap-2">
          <History size={14} className="text-purple-400" />
          <span className="text-xs font-semibold text-[var(--text-main)]">Riwayat Browser</span>
        </div>
        <button
          type="button"
          onClick={() => setShowHistoryDropdown(false)}
          className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-[var(--border-color)] flex items-center gap-1.5 bg-[var(--bg-main)]/20">
        <Search size={12} className="text-[var(--text-muted)] ml-1" />
        <input
          type="text"
          placeholder="Cari riwayat..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent border-none text-[11px] focus:outline-none text-[var(--text-main)] placeholder-[var(--text-muted)]"
        />
      </div>

      {/* History Items List */}
      <div className="flex-1 overflow-y-auto min-h-[100px]">
        {filteredHistory.length === 0 ? (
          <div className="p-8 text-center text-[var(--text-muted)] text-[11px]">
            Tidak ada riwayat penelusuran.
          </div>
        ) : (
          <div className="divide-y divide-[var(--border-color)]/40">
            {filteredHistory.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between p-2.5 hover:bg-[var(--bg-card-hover)] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => {
                    handleNavigateToHistory(item.url);
                    setShowHistoryDropdown(false);
                  }}
                  className="flex-1 text-left min-w-0 pr-2 cursor-pointer"
                >
                  <p className="text-[11px] font-medium text-[var(--text-main)] truncate">
                    {item.name}
                  </p>
                  <p className="text-[9px] text-[var(--text-muted)] truncate select-all">
                    {item.url}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5 text-[8px] text-[var(--text-muted)] font-mono">
                    <Clock size={8} />
                    <span>{formatTime(item.timestamp)}</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => removeHistoryItem(item.id)}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                  title="Hapus dari riwayat"
                >
                  <Trash size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer / Clear Action */}
      {history.length > 0 && (
        <div className="p-2 border-t border-[var(--border-color)] bg-[var(--bg-main)]/20 flex justify-end">
          {confirmClear ? (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-amber-400 font-medium">Yakin hapus semua?</span>
              <button
                type="button"
                onClick={() => {
                  clearAllHistory();
                  setConfirmClear(false);
                }}
                className="px-2 py-1 text-[9px] font-semibold text-white bg-red-600 hover:bg-red-500 rounded transition-colors cursor-pointer"
              >
                Ya
              </button>
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="px-2 py-1 text-[9px] font-semibold text-[var(--text-main)] bg-[var(--bg-main)] hover:bg-[var(--bg-card-hover)] rounded border border-[var(--border-color)] transition-colors cursor-pointer"
              >
                Batal
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="text-[9px] font-medium text-red-400 hover:text-red-300 transition-colors cursor-pointer flex items-center gap-1"
            >
              <Trash size={10} />
              Bersihkan Semua
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryDropdown;
