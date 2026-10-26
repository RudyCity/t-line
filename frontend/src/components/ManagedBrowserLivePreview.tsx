import { useEffect, useState } from 'react';
import { EyeOff, RefreshCw } from 'lucide-react';

export type ManagedBrowserFrame = {
  targetId: string;
  dataUrl: string;
  capturedAt: number;
};
type BrowserStreamEvent = ManagedBrowserFrame & {
  streamId: string;
  transport: 'screencast' | 'snapshot';
};
export function isSafeManagedFrame(frame: unknown, expectedTarget: string): frame is ManagedBrowserFrame {
  if (!frame || typeof frame !== 'object') return false;
  const value = frame as Partial<ManagedBrowserFrame>;
  return value.targetId === expectedTarget &&
    typeof value.capturedAt === 'number' && Number.isFinite(value.capturedAt) &&
    typeof value.dataUrl === 'string' && value.dataUrl.length < 2_000_050 &&
    /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(value.dataUrl);
}
export function isSafeBrowserStreamEvent(
  event: unknown, streamId: string, targetId: string,
): event is BrowserStreamEvent {
  return !!event && typeof event === 'object' &&
    (event as Partial<BrowserStreamEvent>).streamId === streamId &&
    ['screencast', 'snapshot'].includes((event as Partial<BrowserStreamEvent>).transport || '') &&
    isSafeManagedFrame(event, targetId);
}

/** Bounded CDP screencast preferred; snapshot fallback if unavailable.
 * Only a primary native Tauri WebView receives frames. Never stores pixels. */
export default function ManagedBrowserLivePreview({
  profileId, generation, targetId, active, onClose,
}: {
  profileId: string; generation: string; targetId: string;
  active: boolean; onClose: () => void;
}) {
  const [frame, setFrame] = useState<ManagedBrowserFrame | null>(null);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [mode, setMode] = useState<'connecting' | 'screencast' | 'snapshot' | 'paused'>('connecting');
  useEffect(() => {
    setFrame(null);
    setError('');
    if (!active) return;
    let cancelled = false;
    let busy = false;
    let starting = false;
    let streamId: string | null = null;
    let lastFrameAt = 0;
    let polling: number | undefined;
    let watchdog: number | undefined;
    let unlisten: (() => void) | undefined;
    const host = (window as any).__TAURI__;
    const invoke = host?.core?.invoke;
    const listen = host?.event?.listen;

    const stopPolling = () => {
      if (polling !== undefined) window.clearInterval(polling);
      polling = undefined;
    };
    const stopStream = () => {
      const id = streamId;
      streamId = null;
      if (id && typeof invoke === 'function') {
        void invoke('managed_browser_stream_stop', { streamId: id }).catch(() => {});
      }
    };
    const snapshot = async () => {
      if (cancelled || busy || document.hidden || typeof invoke !== 'function') return;
      busy = true;
      if (!cancelled) setCapturing(true);
      try {
        const next = await invoke('managed_browser_capture', { profileId, generation, targetId });
        if (cancelled || document.hidden || streamId && Date.now() - lastFrameAt < 3500) return;
        if (!isSafeManagedFrame(next, targetId)) throw new Error('Invalid local browser screenshot.');
        setFrame(next);
        setError('');
      } catch (err) {
        if (!cancelled && !document.hidden) {
          setFrame(null);
          setError(err instanceof Error ? err.message : 'Browser preview disconnected.');
        }
      } finally {
        busy = false;
        if (!cancelled) setCapturing(false);
      }
    };
    const startFallback = () => {
      if (cancelled || document.hidden || polling !== undefined) return;
      setMode('snapshot');
      void snapshot();
      polling = window.setInterval(() => { void snapshot(); }, 1500);
    };
    const startStream = async () => {
      if (cancelled || document.hidden || starting || streamId) return;
      if (typeof invoke !== 'function') {
        setError('Native desktop is required for preview.');
        return;
      }
      if (typeof listen !== 'function') { startFallback(); return; }
      starting = true;
      setMode('connecting');
      try {
        if (!unlisten) {
          unlisten = await listen('managed-browser:frame', (event: { payload?: unknown }) => {
            if (cancelled || document.hidden || !streamId ||
                !isSafeBrowserStreamEvent(event?.payload, streamId, targetId)) return;
            lastFrameAt = Date.now();
            setFrame(event.payload as ManagedBrowserFrame);
            setError('');
            setMode((event.payload as BrowserStreamEvent).transport);
            stopPolling();
          });
          if (cancelled) { unlisten?.(); unlisten = undefined; return; }
        }
        if (cancelled || document.hidden) return;
        const receipt = await invoke('managed_browser_stream_start', { profileId, generation, targetId });
        if (!receipt || typeof receipt.streamId !== 'string' ||
            !/^[0-9]+-[0-9]+$/.test(receipt.streamId)) {
          throw new Error('Invalid native screencast session.');
        }
        if (cancelled || document.hidden) {
          void invoke('managed_browser_stream_stop', { streamId: receipt.streamId }).catch(() => {});
          return;
        }
        streamId = receipt.streamId;
        lastFrameAt = Date.now();
        if (watchdog !== undefined) window.clearInterval(watchdog);
        watchdog = window.setInterval(() => {
          if (!cancelled && !document.hidden && Date.now() - lastFrameAt > 4500) {
            startFallback();
          }
        }, 1000);
      } catch {
        if (!cancelled && !document.hidden) startFallback();
      } finally {
        starting = false;
      }
    };
    const visibility = () => {
      if (document.hidden) {
        stopPolling();
        stopStream();
        setFrame(null);
        setMode('paused');
      } else if (!cancelled) {
        void startStream();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    void startStream();
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', visibility);
      if (watchdog !== undefined) window.clearInterval(watchdog);
      stopPolling();
      stopStream();
      unlisten?.();
    };
  }, [active, profileId, generation, targetId]);

  if (!active) return null;
  return (
    <section aria-label="Managed browser live preview"
      className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] px-2 py-1.5">
        <span className="inline-flex items-center gap-1 font-semibold">
          <RefreshCw size={12} className={capturing ? 'animate-spin' : ''} />
          Live preview · read-only · {mode}
        </span>
        <button type="button" onClick={onClose}
          className="inline-flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1"
          aria-label="Close live preview"><EyeOff size={12}/> Close preview</button>
      </div>
      {frame
        ? <img alt="Live screenshot of the selected T-Line-managed browser tab"
            className="mx-auto block max-h-[420px] w-full object-contain" src={frame.dataUrl}/>
        : <div className="flex min-h-36 items-center justify-center text-[var(--text-muted)]">
            {error || 'Connecting to the owned browser tab…'}
          </div>}
      {error && frame && <p role="alert" className="px-2 py-1 text-amber-500">{error}</p>}
      <p className="px-2 py-1 text-[10px] text-[var(--text-muted)]">
        Native CDP streams are capped at 5 FPS; offscreen Chrome uses a persistent
        snapshot fallback. Hidden windows pause capture. No page controls or frame storage.
      </p>
    </section>
  );
}
