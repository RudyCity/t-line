import React from 'react';
import { GitBranch } from 'lucide-react';

interface TabTooltipProps {
  activeTooltip: {
    x: number;
    y: number;
    title: string;
    branch?: string;
    path: string;
  } | null;
  tabContextMenu: any;
}

export const TabTooltip: React.FC<TabTooltipProps> = ({ activeTooltip, tabContextMenu }) => {
  if (!activeTooltip || tabContextMenu) return null;

  return (
    <div 
      className="tab-tooltip"
      style={{
        position: 'fixed',
        left: `${activeTooltip.x}px`,
        top: `${activeTooltip.y}px`,
        transform: 'translateX(-50%)',
        zIndex: 9999,
        pointerEvents: 'none'
      }}
    >
      <div className="tab-tooltip-title">{activeTooltip.title}</div>
      {activeTooltip.branch && (
        <div className="tab-tooltip-branch">
          <GitBranch size={10} className="shrink-0" />
          <span>{activeTooltip.branch}</span>
        </div>
      )}
      <div className="tab-tooltip-path">{activeTooltip.path}</div>
    </div>
  );
};

interface TabContextMenuProps {
  tabContextMenu: {
    x: number;
    y: number;
    tabId: string;
  } | null;
  tabs: any[];
  filteredTabs: any[];
  moveTab: (tabId: string, direction: 'left' | 'right') => void;
  closeTerminal: (tabId: string) => void;
  handleCloseOtherTabs: (tabId: string) => void;
  handleCloseAllTabs: () => void;
  setActiveTabId: (tabId: string) => void;
  splitFocusedTerminal: (direction: 'vertical' | 'horizontal') => void;
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
  tabContextMenu,
  tabs,
  filteredTabs,
  moveTab,
  closeTerminal,
  handleCloseOtherTabs,
  handleCloseAllTabs,
  setActiveTabId,
  splitFocusedTerminal
}) => {
  if (!tabContextMenu) return null;

  const targetTab = tabs.find(t => t.id === tabContextMenu.tabId);
  const targetIndex = filteredTabs.findIndex(t => t.id === tabContextMenu.tabId);
  const canMoveLeft = targetIndex > 0;
  const canMoveRight = targetIndex !== -1 && targetIndex < filteredTabs.length - 1;

  return (
    <div 
      className="terminal-ctx-menu"
      style={{
        position: 'fixed',
        top: tabContextMenu.y,
        left: tabContextMenu.x,
        zIndex: 1000
      }}
    >
      <button
        onClick={() => closeTerminal(tabContextMenu.tabId)}
        className="terminal-ctx-item"
      >
        <span className="terminal-ctx-label">Close Tab</span>
      </button>
      <button
        onClick={() => handleCloseOtherTabs(tabContextMenu.tabId)}
        className="terminal-ctx-item"
      >
        <span className="terminal-ctx-label">Close Other Tabs</span>
      </button>
      <button
        onClick={handleCloseAllTabs}
        className="terminal-ctx-item"
      >
        <span className="terminal-ctx-label">Close All Tabs</span>
      </button>

      {(canMoveLeft || canMoveRight) && (
        <>
          <div className="terminal-ctx-separator" />
          {canMoveLeft && (
            <button
              onClick={() => moveTab(tabContextMenu.tabId, 'left')}
              className="terminal-ctx-item"
            >
              <span className="terminal-ctx-label">Move Tab Left</span>
            </button>
          )}
          {canMoveRight && (
            <button
              onClick={() => moveTab(tabContextMenu.tabId, 'right')}
              className="terminal-ctx-item"
            >
              <span className="terminal-ctx-label">Move Tab Right</span>
            </button>
          )}
        </>
      )}

      {targetTab?.type === 'terminal' && (
        <>
          <div className="terminal-ctx-separator" />
          <button
            onClick={() => {
              setActiveTabId(tabContextMenu.tabId);
              setTimeout(() => splitFocusedTerminal('vertical'), 50);
            }}
            className="terminal-ctx-item"
          >
            <span className="terminal-ctx-label">Split Pane Vertically</span>
          </button>
          <button
            onClick={() => {
              setActiveTabId(tabContextMenu.tabId);
              setTimeout(() => splitFocusedTerminal('horizontal'), 50);
            }}
            className="terminal-ctx-item"
          >
            <span className="terminal-ctx-label">Split Pane Horizontally</span>
          </button>
        </>
      )}
    </div>
  );
};
