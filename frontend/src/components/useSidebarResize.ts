import React, { useState, useEffect, useCallback } from 'react';

export function useSidebarResize(containerRef: React.RefObject<HTMLDivElement>) {
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
    e.stopPropagation();
    setIsResizingLeft(true);
  }, []);

  const startResizingRight = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingRight(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (isResizingLeft) {
        const calculatedWidth = e.clientX - rect.left;
        const newW = Math.max(160, Math.min(500, calculatedWidth));
        setHistoryWidth(newW);
        localStorage.setItem('superagent_history_width', newW.toString());
      } else if (isResizingRight) {
        const calculatedWidth = rect.right - e.clientX;
        const newW = Math.max(180, Math.min(600, calculatedWidth));
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
  }, [containerRef, isResizingLeft, isResizingRight]);

  return {
    historyWidth,
    monitorWidth,
    isResizingLeft,
    isResizingRight,
    startResizingLeft,
    startResizingRight
  };
}
