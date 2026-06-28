import React from 'react';
import { Plus, Terminal as TerminalIcon, FileCode, Settings, LogOut, X } from 'lucide-react';
import { TabData, TerminalInstanceData, WorkspaceInfo } from '../hooks/useTerminals';

interface RightSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  tabs: TabData[];
  activeTabId: string;
  setActiveTabId: (id: string) => void;
  openTerminal: (name: string, cwd: string) => void;
  closeTerminal: (id: string, e: React.MouseEvent) => void;
  workspaces: WorkspaceInfo[];
  panelWorkspace: WorkspaceInfo | null;
  terminalInstances: Record<string, TerminalInstanceData>;
  setShowSettingsModal: (show: boolean) => void;
  handleLogout: () => void;
}

export function RightSidebar({
  isOpen,
  onClose,
  tabs,
  activeTabId,
  setActiveTabId,
  openTerminal,
  closeTerminal,
  workspaces,
  panelWorkspace,
  terminalInstances,
  setShowSettingsModal,
  handleLogout
}: RightSidebarProps) {
  return (
    <div className={`right-sidebar ${isOpen ? 'right-sidebar-open' : ''}`}>
      {/* Header */}
      <div className="sidebar-header flex items-center justify-between" style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex items-center gap-2">
          <TerminalIcon size={16} className="text-purple-400 shrink-0" />
          <span className="logo-text" style={{ fontSize: '1.05rem', fontWeight: 600 }}>Menu</span>
        </div>
        <button className="action-btn" onClick={onClose} title="Close Menu">
          <X size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6" style={{ scrollbarWidth: 'none' }}>
        {/* Active Tabs Section */}
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Active Tabs</span>
            <button
              className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              onClick={() => {
                openTerminal('Shell', panelWorkspace?.path || workspaces[0]?.path || '');
                onClose();
              }}
            >
              <Plus size={12} />
              <span>New Tab</span>
            </button>
          </div>

          <div className="flex flex-col gap-2">
            {tabs.map(t => {
              const isFile = t.type === 'file';
              const focusedInst = !isFile && t.focusedTerminalId ? terminalInstances[t.focusedTerminalId] : null;
              const shellType = focusedInst?.shellType || '';
              const isActive = activeTabId === t.id;

              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setActiveTabId(t.id);
                    onClose();
                  }}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-purple-600/10 border-purple-500/30 text-purple-200 shadow-sm'
                      : 'bg-slate-900/40 border-white/5 text-slate-400 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {isFile ? (
                      <FileCode size={13} className={isActive ? 'text-purple-400' : 'text-slate-400'} />
                    ) : (
                      <TerminalIcon size={13} className={isActive ? 'text-purple-400' : 'text-slate-400'} />
                    )}
                    <span className="text-xs font-semibold truncate">{t.name}</span>
                    {shellType && (
                      <span className="text-[9px] font-mono opacity-50">({shellType})</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTerminal(t.id, e);
                    }}
                    className="text-slate-500 hover:text-red-400 p-0.5 rounded transition-colors text-sm font-bold"
                  >
                    ×
                  </button>
                </div>
              );
            })}
            {tabs.length === 0 && (
              <div className="text-center py-8 text-xs text-slate-500 font-medium">No active tabs</div>
            )}
          </div>
        </div>

        {/* Quick Actions Section */}
        <div className="flex flex-col gap-2 pt-4 border-t border-white/5">
          <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Actions</span>
          <button
            className="flex items-center gap-3 p-3 rounded-lg border bg-slate-900/40 border-white/5 text-slate-300 hover:bg-slate-800/40 transition-all text-xs font-medium cursor-pointer w-full text-left"
            onClick={() => {
              setShowSettingsModal(true);
              onClose();
            }}
          >
            <Settings size={14} className="text-slate-400" />
            <span>Settings</span>
          </button>
          <button
            className="flex items-center gap-3 p-3 rounded-lg border bg-slate-900/40 border-white/5 text-red-400 hover:bg-red-950/20 border-red-500/10 transition-all text-xs font-medium cursor-pointer w-full text-left"
            onClick={() => {
              handleLogout();
              onClose();
            }}
          >
            <LogOut size={14} className="text-red-400" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
