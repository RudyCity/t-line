import { useCallback } from 'react';
import { TabData } from './useTerminals';
import { wsManager } from '../services/websocket';

export function useLayoutHelpers(
  sidebarWidth: number,
  setSidebarWidth: (width: number) => void,
  tabs: TabData[],
  setTabs: React.Dispatch<React.SetStateAction<TabData[]>>,
  activeTabId: string
) {
  const startResizing = useCallback((mouseDownEvent: React.MouseEvent) => {
    mouseDownEvent.preventDefault();
    const startWidth = sidebarWidth;
    const startX = mouseDownEvent.clientX;

    const doDrag = (mouseMoveEvent: MouseEvent) => {
      const newWidth = startWidth + (mouseMoveEvent.clientX - startX);
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
        localStorage.setItem('tline-sidebar-width', newWidth.toString());
      }
    };

    const stopDrag = () => {
      document.removeEventListener('mousemove', doDrag);
      document.removeEventListener('mouseup', stopDrag);
    };

    document.addEventListener('mousemove', doDrag);
    document.addEventListener('mouseup', stopDrag);
  }, [sidebarWidth, setSidebarWidth]);

  const handleMergeTab = useCallback((draggedId: string, direction: 'horizontal' | 'vertical') => {
    if (draggedId === activeTabId) return;
    const draggedTab = tabs.find(t => t.id === draggedId);
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (!draggedTab || !activeTab || draggedTab.type !== 'terminal' || activeTab.type !== 'terminal') return;

    const activeLayout = activeTab.layout;
    const draggedLayout = draggedTab.layout;
    if (!activeLayout || !draggedLayout) return;

    wsManager.unsubscribe(draggedTab.focusedTerminalId || draggedId);

    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== draggedId);
      return filtered.map(t => {
        if (t.id === activeTabId) {
          return {
            ...t,
            layout: {
              type: 'split',
              direction,
              first: activeLayout,
              second: draggedLayout
            },
            focusedTerminalId: draggedTab.focusedTerminalId
          };
        }
        return t;
      });
    });
  }, [tabs, activeTabId, setTabs]);

  return {
    startResizing,
    handleMergeTab
  };
}
