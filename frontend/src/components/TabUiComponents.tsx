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
  closeTerminal: (tabId: string) => void;
  handleCloseOtherTabs: (tabId: string) => void;
  handleCloseAllTabs: () => void;
  setActiveTabId: (tabId: string) => void;
  splitFocusedTerminal: (direction: 'vertical' | 'horizontal') => void;
}

export const TabContextMenu: React.FC<TabContextMenuProps> = ({
  tabContextMenu,
  tabs,
  closeTerminal,
  handleCloseOtherTabs,
  handleCloseAllTabs,
  setActiveTabId,
  splitFocusedTerminal
}) => {
  if (!tabContextMenu) return null;

  const targetTab = tabs.find(t => t.id === tabContextMenu.tabId);

  return (
    <div 
      className="terminal-context-menu"
      style={{
        position: 'fixed',
        top: tabContextMenu.y,
        left: tabContextMenu.x,
        zIndex: 1000
      }}
    >
      <button
        onClick={() => closeTerminal(tabContextMenu.tabId)}
        className="terminal-context-menu-item"
      >
        <span>Close Tab</span>
      </button>
      <button
        onClick={() => handleCloseOtherTabs(tabContextMenu.tabId)}
        className="terminal-context-menu-item"
      >
        <span>Close Other Tabs</span>
      </button>
      <button
        onClick={handleCloseAllTabs}
        className="terminal-context-menu-item"
      >
        <span>Close All Tabs</span>
      </button>
      {targetTab?.type === 'terminal' && (
        <>
          <div className="terminal-context-menu-separator" />
          <button
            onClick={() => {
              setActiveTabId(tabContextMenu.tabId);
              setTimeout(() => splitFocusedTerminal('vertical'), 50);
            }}
            className="terminal-context-menu-item"
          >
            <span>Split Pane Vertically</span>
          </button>
          <button
            onClick={() => {
              setActiveTabId(tabContextMenu.tabId);
              setTimeout(() => splitFocusedTerminal('horizontal'), 50);
            }}
            className="terminal-context-menu-item"
          >
            <span>Split Pane Horizontally</span>
          </button>
        </>
      )}
    </div>
  );
};
