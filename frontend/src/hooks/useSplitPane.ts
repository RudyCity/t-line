import { useState, useRef, useCallback } from 'react';

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitPaneState {
  /** true jika split pane aktif */
  isSplit: boolean;
  /** arah split */
  direction: SplitDirection;
  /** ukuran panel pertama dalam persen (0-100) */
  splitRatio: number;
  /** ID tab yang aktif di pane kanan/bawah */
  secondaryTabId: string;
}

export interface UseSplitPaneReturn {
  splitState: SplitPaneState;
  splitHorizontal: (secondaryTabId: string) => void;
  splitVertical: (secondaryTabId: string) => void;
  closeSplit: () => void;
  setSplitRatio: (ratio: number) => void;
  startResizeSplit: (e: React.MouseEvent) => void;
}

const DEFAULT_STATE: SplitPaneState = {
  isSplit: false,
  direction: 'horizontal',
  splitRatio: 50,
  secondaryTabId: '',
};

/**
 * useSplitPane
 *
 * Manages split pane state for the t-line terminal manager.
 * Supports horizontal (side-by-side) and vertical (top-bottom) layouts.
 * Includes a drag-resize handler for adjusting the split ratio.
 */
export function useSplitPane(): UseSplitPaneReturn {
  const [splitState, setSplitState] = useState<SplitPaneState>(DEFAULT_STATE);

  const splitHorizontal = useCallback((secondaryTabId: string) => {
    setSplitState({
      isSplit: true,
      direction: 'horizontal',
      splitRatio: 50,
      secondaryTabId,
    });
  }, []);

  const splitVertical = useCallback((secondaryTabId: string) => {
    setSplitState({
      isSplit: true,
      direction: 'vertical',
      splitRatio: 50,
      secondaryTabId,
    });
  }, []);

  const closeSplit = useCallback(() => {
    setSplitState(DEFAULT_STATE);
  }, []);

  const setSplitRatio = useCallback((ratio: number) => {
    setSplitState(prev => ({ ...prev, splitRatio: Math.max(20, Math.min(80, ratio)) }));
  }, []);

  const isDragging = useRef(false);
  const dragStartPos = useRef(0);
  const dragStartRatio = useRef(50);

  const startResizeSplit = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartPos.current = splitState.direction === 'horizontal' ? e.clientX : e.clientY;
    dragStartRatio.current = splitState.splitRatio;

    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const containerEl = (e.currentTarget as HTMLElement).parentElement;
      if (!containerEl) return;

      const rect = containerEl.getBoundingClientRect();
      const totalSize = splitState.direction === 'horizontal' ? rect.width : rect.height;
      const currentPos = splitState.direction === 'horizontal' ? ev.clientX : ev.clientY;
      const startEdge = splitState.direction === 'horizontal' ? rect.left : rect.top;
      const newRatio = ((currentPos - startEdge) / totalSize) * 100;

      setSplitState(prev => ({
        ...prev,
        splitRatio: Math.max(20, Math.min(80, newRatio)),
      }));
    };

    const onUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [splitState.direction, splitState.splitRatio]);

  return {
    splitState,
    splitHorizontal,
    splitVertical,
    closeSplit,
    setSplitRatio,
    startResizeSplit,
  };
}
