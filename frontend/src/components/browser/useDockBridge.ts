import { useEffect, useRef } from 'react';
import type { BrowserSessionStatus, DockBounds } from './browserTypes';

type Invoke = (name: string, args?: Record<string, unknown>) => Promise<unknown>;

/** Keeps the real browser window glued to the trusted UI viewport.
 *
 * The native side reparents the browser's top-level window; this hook only
 * reports the rectangle it must occupy and whether it is currently visible.
 * Visibility is withdrawn for tab switches, overlays, and hidden documents so
 * the embedded surface never covers T-Line dialogs or dropdowns. */
export function useDockBridge({
  invoke,
  session,
  active,
  viewportRef,
  overlaysOpen,
}: {
  invoke: Invoke | null;
  session: BrowserSessionStatus | null;
  active: boolean;
  viewportRef: React.RefObject<HTMLDivElement>;
  overlaysOpen: boolean;
}) {
  const visibleRef = useRef(false);
  const profileId = session?.profileId ?? '';
  const generation = session?.generation ?? '';
  const docked = session?.docked === true;

  useEffect(() => {
    if (!invoke || !docked || !profileId || !generation) return;
    const element = viewportRef.current;
    if (!element) return;
    let frame = 0;
    const report = () => {
      frame = 0;
      const rect = element.getBoundingClientRect();
      if (rect.width < 16 || rect.height < 16) return;
      const bounds: DockBounds = {
        x: Math.max(0, Math.round(rect.left)),
        y: Math.max(0, Math.round(rect.top)),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      void invoke('browser_dock_bounds', { profileId, generation, bounds }).catch(() => {});
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(report);
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(element);
    window.addEventListener('resize', schedule);
    schedule();
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [invoke, docked, profileId, generation, viewportRef]);

  useEffect(() => {
    if (!invoke || !docked || !profileId || !generation) return;
    const update = () => {
      const visible = active && !document.hidden && !overlaysOpen;
      if (visible === visibleRef.current) return;
      visibleRef.current = visible;
      void invoke('browser_dock_visible', { profileId, generation, visible }).catch(() => {});
    };
    const handleHideEvent = (event: Event) => {
      const detail = (event as CustomEvent<{ hide?: boolean }>).detail;
      if (detail?.hide) {
        visibleRef.current = false;
        void invoke('browser_dock_visible', { profileId, generation, visible: false }).catch(() => {});
      } else {
        update();
      }
    };
    document.addEventListener('visibilitychange', update);
    window.addEventListener('tline-hide-native-webview', handleHideEvent);
    update();
    return () => {
      document.removeEventListener('visibilitychange', update);
      window.removeEventListener('tline-hide-native-webview', handleHideEvent);
      if (visibleRef.current) {
        visibleRef.current = false;
        void invoke('browser_dock_visible', { profileId, generation, visible: false }).catch(() => {});
      }
    };
  }, [invoke, docked, profileId, generation, active, overlaysOpen]);
}
