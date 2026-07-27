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

    document.body.classList.add('is-resizing');

    let animationFrameId: number | null = null;
    let latestWidth = startWidth;

    // Direct DOM manipulation during drag for zero-lag CSS variable sizing
    const drawerEl = document.querySelector('.sidebar-drawer-content') as HTMLElement | null;

    const doDrag = (mouseMoveEvent: MouseEvent) => {
      const newWidth = startWidth + (mouseMoveEvent.clientX - startX);
      if (newWidth >= 200 && newWidth <= 600) {
        latestWidth = newWidth;
        if (drawerEl) {
          drawerEl.style.width = `${newWidth - 48}px`;
        }
        if (animationFrameId === null) {
          animationFrameId = requestAnimationFrame(() => {
            animationFrameId = null;
          });
        }
      }
    };

    const stopDrag = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      document.body.classList.remove('is-resizing');
      setSidebarWidth(latestWidth);
      localStorage.setItem('tline-sidebar-width', latestWidth.toString());
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
