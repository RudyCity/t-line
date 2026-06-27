import { useState, useCallback } from 'react';

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitPaneState {
  /** true jika split pane aktif */
  isSplit: boolean;
  /** arah split */
  direction: SplitDirection;
  /** ID tab yang aktif di pane kanan/bawah */
  secondaryTabId: string;
}

export interface UseSplitPaneReturn {
  splitState: SplitPaneState;
  splitHorizontal: (secondaryTabId: string) => void;
  splitVertical: (secondaryTabId: string) => void;
  closeSplit: () => void;
}

const DEFAULT_STATE: SplitPaneState = {
  isSplit: false,
  direction: 'horizontal',
  secondaryTabId: '',
};

/**
 * useSplitPane
 *
 * Manages split pane state for the t-line terminal manager.
 * Supports horizontal (side-by-side) and vertical (top-bottom) layouts.
 */
export function useSplitPane(): UseSplitPaneReturn {
  const [splitState, setSplitState] = useState<SplitPaneState>(DEFAULT_STATE);

  const splitHorizontal = useCallback((secondaryTabId: string) => {
    setSplitState({
      isSplit: true,
      direction: 'horizontal',
      secondaryTabId,
    });
  }, []);

  const splitVertical = useCallback((secondaryTabId: string) => {
    setSplitState({
      isSplit: true,
      direction: 'vertical',
      secondaryTabId,
    });
  }, []);

  const closeSplit = useCallback(() => {
    setSplitState(DEFAULT_STATE);
  }, []);

  return {
    splitState,
    splitHorizontal,
    splitVertical,
    closeSplit,
  };
}
