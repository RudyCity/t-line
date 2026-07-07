import { useEffect } from 'react';
import { Terminal } from '@xterm/xterm';
import { isMobileDevice } from '../components/TerminalHelpers';

interface UseTerminalTouchMappingProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  terminalRef: React.RefObject<Terminal | null>;
  onFocusRef: React.RefObject<(() => void) | undefined> | React.MutableRefObject<(() => void) | undefined>;
}

export function useTerminalTouchMapping({
  containerRef,
  terminalRef,
  onFocusRef,
}: UseTerminalTouchMappingProps) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        touchStartTime = Date.now();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 1) {
        const touch = e.changedTouches[0];
        const distX = touch.clientX - touchStartX;
        const distY = touch.clientY - touchStartY;
        const duration = Date.now() - touchStartTime;

        // Detect a quick tap without much dragging
        if (Math.abs(distX) < 10 && Math.abs(distY) < 10 && duration < 300) {
          const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
          if (target && container.contains(target)) {
            // Exclude input/button/select/anchor tags
            if (
              target.closest('input') ||
              target.closest('button') ||
              target.closest('select') ||
              target.closest('a')
            ) {
              return;
            }

            e.preventDefault();
            e.stopPropagation();

            const mouseOpts = {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: touch.clientX,
              clientY: touch.clientY,
              screenX: touch.screenX,
              screenY: touch.screenY,
              button: 0,
              buttons: 1,
            };

            // Dispatch simulated mouse events so xterm.js captures them at the exact clicked cell position
            const mDown = new MouseEvent('mousedown', mouseOpts);
            target.dispatchEvent(mDown);

            const mUp = new MouseEvent('mouseup', { ...mouseOpts, buttons: 0 });
            target.dispatchEvent(mUp);

            const click = new MouseEvent('click', { ...mouseOpts, buttons: 0 });
            target.dispatchEvent(click);

            // Keep xterm.js focused & inputmode="none" (disables native keyboard, allowing tline virtual keyboard)
            if (terminalRef.current) {
              terminalRef.current.focus();
              if (terminalRef.current.textarea) {
                terminalRef.current.textarea.setAttribute('inputmode', 'none');
                terminalRef.current.textarea.focus();
              }
            }
            onFocusRef.current?.();
            if (isMobileDevice) {
              window.dispatchEvent(new CustomEvent('tline-terminal-focus'));
            }
          }
        }
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [containerRef, terminalRef, onFocusRef]);
}
