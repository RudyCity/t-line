import React, { useState, useEffect, useCallback } from 'react';

export function useSidebarResize() {
  const [historyWidth, setHistoryWidth] = useState<number>(() => {
    const saved = localStorage.getItem('superagent_history_width');
    return saved ? Math.max(160, Math.min(500, parseInt(saved, 10))) : 256;
  });
  const [monitorWidth, setMonitorWidth] = useState<number>(() => {
    const saved = localStorage.getItem('superagent_monitor_width');
    return saved ? Math.max(180, Math.min(600, parseInt(saved, 10))) : 280;
  });
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const startResizingLeft = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeft(true);
  }, []);

  const startResizingRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingRight(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingLeft) {
        const newW = Math.max(160, Math.min(500, e.clientX));
        setHistoryWidth(newW);
        localStorage.setItem('superagent_history_width', newW.toString());
      } else if (isResizingRight) {
        const newW = Math.max(180, Math.min(600, window.innerWidth - e.clientX));
        setMonitorWidth(newW);
        localStorage.setItem('superagent_monitor_width', newW.toString());
      }
    };

    const handleMouseUp = () => {
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingLeft, isResizingRight]);

  return {
    historyWidth,
    monitorWidth,
    startResizingLeft,
    startResizingRight
  };
}
