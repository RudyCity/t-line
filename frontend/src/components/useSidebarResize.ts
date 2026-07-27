import React, { useState, useEffect, useCallback, useRef } from 'react';

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

  const historyWidthRef = useRef(historyWidth);
  const monitorWidthRef = useRef(monitorWidth);

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
    let animationFrameId: number | null = null;
    const leftPanelEl = containerRef.current?.querySelector('.superagent-history-panel') as HTMLElement | null;
    const rightPanelEl = containerRef.current?.querySelector('.superagent-monitor-panel') as HTMLElement | null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();

      if (isResizingLeft) {
        const calculatedWidth = e.clientX - rect.left;
        const newW = Math.max(160, Math.min(500, calculatedWidth));
        historyWidthRef.current = newW;
        if (leftPanelEl) {
          leftPanelEl.style.width = `${newW}px`;
        }
      } else if (isResizingRight) {
        const calculatedWidth = rect.right - e.clientX;
        const newW = Math.max(180, Math.min(600, calculatedWidth));
        monitorWidthRef.current = newW;
        if (rightPanelEl) {
          rightPanelEl.style.width = `${newW}px`;
        }
      }
    };

    const handleMouseUp = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
      if (isResizingLeft) {
        setHistoryWidth(historyWidthRef.current);
        localStorage.setItem('superagent_history_width', historyWidthRef.current.toString());
      }
      if (isResizingRight) {
        setMonitorWidth(monitorWidthRef.current);
        localStorage.setItem('superagent_monitor_width', monitorWidthRef.current.toString());
      }
      setIsResizingLeft(false);
      setIsResizingRight(false);
    };

    if (isResizingLeft || isResizingRight) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.classList.add('is-resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.classList.remove('is-resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.classList.remove('is-resizing');
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
