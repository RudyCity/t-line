import React, { useState, useEffect, useCallback, useRef } from 'react';

const STORAGE_KEY_DRAWER = 'tline_studio_drawer_width';
const STORAGE_KEY_INSPECTOR = 'tline_studio_inspector_width';
const STORAGE_KEY_TIMELINE = 'tline_studio_timeline_height';

export const DEFAULT_DRAWER_WIDTH = 310;
export const DEFAULT_INSPECTOR_WIDTH = 280;
export const DEFAULT_TIMELINE_HEIGHT = 280;

export const MIN_DRAWER_WIDTH = 200;
export const MAX_DRAWER_WIDTH = 550;

export const MIN_INSPECTOR_WIDTH = 220;
export const MAX_INSPECTOR_WIDTH = 480;

export const MIN_TIMELINE_HEIGHT = 160;
export const MAX_TIMELINE_HEIGHT = 650;

export function useStudioLayoutResize(containerRef: React.RefObject<HTMLElement | null>) {
  const [drawerWidth, setDrawerWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DRAWER);
      return saved ? Math.max(MIN_DRAWER_WIDTH, Math.min(MAX_DRAWER_WIDTH, parseInt(saved, 10))) : DEFAULT_DRAWER_WIDTH;
    } catch {
      return DEFAULT_DRAWER_WIDTH;
    }
  });

  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_INSPECTOR);
      return saved ? Math.max(MIN_INSPECTOR_WIDTH, Math.min(MAX_INSPECTOR_WIDTH, parseInt(saved, 10))) : DEFAULT_INSPECTOR_WIDTH;
    } catch {
      return DEFAULT_INSPECTOR_WIDTH;
    }
  });

  const [timelineHeight, setTimelineHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_TIMELINE);
      return saved ? Math.max(MIN_TIMELINE_HEIGHT, Math.min(MAX_TIMELINE_HEIGHT, parseInt(saved, 10))) : DEFAULT_TIMELINE_HEIGHT;
    } catch {
      return DEFAULT_TIMELINE_HEIGHT;
    }
  });

  const [isResizingDrawer, setIsResizingDrawer] = useState(false);
  const [isResizingInspector, setIsResizingInspector] = useState(false);
  const [isResizingTimeline, setIsResizingTimeline] = useState(false);

  const drawerWidthRef = useRef(drawerWidth);
  const inspectorWidthRef = useRef(inspectorWidth);
  const timelineHeightRef = useRef(timelineHeight);

  // Keep refs in sync
  useEffect(() => {
    drawerWidthRef.current = drawerWidth;
  }, [drawerWidth]);

  useEffect(() => {
    inspectorWidthRef.current = inspectorWidth;
  }, [inspectorWidth]);

  useEffect(() => {
    timelineHeightRef.current = timelineHeight;
  }, [timelineHeight]);

  const startResizingDrawer = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingDrawer(true);
  }, []);

  const startResizingInspector = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingInspector(true);
  }, []);

  const startResizingTimeline = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingTimeline(true);
  }, []);

  const resetDrawerWidth = useCallback(() => {
    setDrawerWidth(DEFAULT_DRAWER_WIDTH);
    drawerWidthRef.current = DEFAULT_DRAWER_WIDTH;
    try {
      localStorage.setItem(STORAGE_KEY_DRAWER, String(DEFAULT_DRAWER_WIDTH));
    } catch {}
  }, []);

  const resetInspectorWidth = useCallback(() => {
    setInspectorWidth(DEFAULT_INSPECTOR_WIDTH);
    inspectorWidthRef.current = DEFAULT_INSPECTOR_WIDTH;
    try {
      localStorage.setItem(STORAGE_KEY_INSPECTOR, String(DEFAULT_INSPECTOR_WIDTH));
    } catch {}
  }, []);

  const resetTimelineHeight = useCallback(() => {
    setTimelineHeight(DEFAULT_TIMELINE_HEIGHT);
    timelineHeightRef.current = DEFAULT_TIMELINE_HEIGHT;
    try {
      localStorage.setItem(STORAGE_KEY_TIMELINE, String(DEFAULT_TIMELINE_HEIGHT));
    } catch {}
  }, []);

  const [currentPreset, setCurrentPreset] = useState<'default' | 'cinema' | 'timeline'>('default');

  const applyPreset = useCallback(
    (preset: 'default' | 'cinema' | 'timeline') => {
      let dw = DEFAULT_DRAWER_WIDTH;
      let iw = DEFAULT_INSPECTOR_WIDTH;
      let th = DEFAULT_TIMELINE_HEIGHT;

      if (preset === 'cinema') {
        dw = 240;
        iw = 240;
        th = 180;
      } else if (preset === 'timeline') {
        dw = 240;
        iw = 240;
        th = 460;
      }

      setDrawerWidth(dw);
      setInspectorWidth(iw);
      setTimelineHeight(th);
      setCurrentPreset(preset);

      drawerWidthRef.current = dw;
      inspectorWidthRef.current = iw;
      timelineHeightRef.current = th;

      const rootEl = containerRef.current;
      const drawerEl = rootEl?.querySelector('.studio-drawer-panel') as HTMLElement | null;
      const inspectorEl = rootEl?.querySelector('.studio-inspector-panel') as HTMLElement | null;
      const timelineEl = rootEl?.querySelector('.studio-timeline-dock') as HTMLElement | null;

      if (drawerEl) drawerEl.style.width = `${dw}px`;
      if (inspectorEl) inspectorEl.style.width = `${iw}px`;
      if (timelineEl) timelineEl.style.height = `${th}px`;

      try {
        localStorage.setItem(STORAGE_KEY_DRAWER, String(dw));
        localStorage.setItem(STORAGE_KEY_INSPECTOR, String(iw));
        localStorage.setItem(STORAGE_KEY_TIMELINE, String(th));
      } catch {}
    },
    [containerRef]
  );

  useEffect(() => {
    if (!isResizingDrawer && !isResizingInspector && !isResizingTimeline) return;

    let animId: number | null = null;
    const rootEl = containerRef.current;
    const drawerEl = rootEl?.querySelector('.studio-drawer-panel') as HTMLElement | null;
    const inspectorEl = rootEl?.querySelector('.studio-inspector-panel') as HTMLElement | null;
    const timelineEl = rootEl?.querySelector('.studio-timeline-dock') as HTMLElement | null;

    const origCursor = document.body.style.cursor;
    const origUserSelect = document.body.style.userSelect;
    if (isResizingDrawer || isResizingInspector) {
      document.body.style.cursor = 'col-resize';
    } else if (isResizingTimeline) {
      document.body.style.cursor = 'row-resize';
    }
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (animId !== null) return;
      animId = requestAnimationFrame(() => {
        animId = null;
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();

        if (isResizingDrawer) {
          // Rail is 56px wide (w-14)
          const calculatedWidth = e.clientX - rect.left - 56;
          const maxAllowed = Math.min(MAX_DRAWER_WIDTH, Math.max(MIN_DRAWER_WIDTH, rect.width * 0.45));
          const clamped = Math.max(MIN_DRAWER_WIDTH, Math.min(maxAllowed, calculatedWidth));
          drawerWidthRef.current = clamped;
          if (drawerEl) {
            drawerEl.style.width = `${clamped}px`;
          }
        } else if (isResizingInspector) {
          const calculatedWidth = rect.right - e.clientX;
          const maxAllowed = Math.min(MAX_INSPECTOR_WIDTH, Math.max(MIN_INSPECTOR_WIDTH, rect.width * 0.4));
          const clamped = Math.max(MIN_INSPECTOR_WIDTH, Math.min(maxAllowed, calculatedWidth));
          inspectorWidthRef.current = clamped;
          if (inspectorEl) {
            inspectorEl.style.width = `${clamped}px`;
          }
        } else if (isResizingTimeline) {
          const calculatedHeight = rect.bottom - e.clientY;
          const maxAllowed = Math.min(MAX_TIMELINE_HEIGHT, Math.max(MIN_TIMELINE_HEIGHT, rect.height * 0.7));
          const clamped = Math.max(MIN_TIMELINE_HEIGHT, Math.min(maxAllowed, calculatedHeight));
          timelineHeightRef.current = clamped;
          if (timelineEl) {
            timelineEl.style.height = `${clamped}px`;
          }
        }
      });
    };

    const handleMouseUp = () => {
      if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
      }
      document.body.style.cursor = origCursor;
      document.body.style.userSelect = origUserSelect;

      if (isResizingDrawer) {
        setIsResizingDrawer(false);
        setDrawerWidth(drawerWidthRef.current);
        try {
          localStorage.setItem(STORAGE_KEY_DRAWER, String(drawerWidthRef.current));
        } catch {}
      }
      if (isResizingInspector) {
        setIsResizingInspector(false);
        setInspectorWidth(inspectorWidthRef.current);
        try {
          localStorage.setItem(STORAGE_KEY_INSPECTOR, String(inspectorWidthRef.current));
        } catch {}
      }
      if (isResizingTimeline) {
        setIsResizingTimeline(false);
        setTimelineHeight(timelineHeightRef.current);
        try {
          localStorage.setItem(STORAGE_KEY_TIMELINE, String(timelineHeightRef.current));
        } catch {}
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (animId !== null) cancelAnimationFrame(animId);
      document.body.style.cursor = origCursor;
      document.body.style.userSelect = origUserSelect;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingDrawer, isResizingInspector, isResizingTimeline, containerRef]);

  return {
    drawerWidth,
    inspectorWidth,
    timelineHeight,
    isResizingDrawer,
    isResizingInspector,
    isResizingTimeline,
    isResizingAny: isResizingDrawer || isResizingInspector || isResizingTimeline,
    startResizingDrawer,
    startResizingInspector,
    startResizingTimeline,
    resetDrawerWidth,
    resetInspectorWidth,
    resetTimelineHeight,
    currentPreset,
    applyPreset,
  };
}
