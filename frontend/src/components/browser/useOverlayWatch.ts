import { useEffect, useState } from 'react';

const OVERLAY_SELECTOR = '.modal-overlay,[role="dialog"],[aria-modal="true"],[data-tline-overlay]';

/** Detects T-Line dialogs, drawers, and popovers that do not announce
 * themselves through `tline-hide-native-webview`. The embedded browser is a
 * native child window that paints above the WebView, so it must step aside
 * whenever such an overlay exists. */
export function useOverlayWatch(active: boolean): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!active) {
      setOpen(false);
      return;
    }
    let frame = 0;
    const evaluate = () => {
      frame = 0;
      setOpen(document.querySelector(OVERLAY_SELECTOR) !== null);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(evaluate);
    };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'aria-modal', 'data-tline-overlay'],
    });
    schedule();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [active]);

  return open;
}
