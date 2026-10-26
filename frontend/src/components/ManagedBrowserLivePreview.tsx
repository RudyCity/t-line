import { useEffect, useRef, useState } from 'react';
import { EyeOff, RefreshCw } from 'lucide-react';

export type ManagedBrowserFrame = {
  targetId: string;
  dataUrl: string;
  capturedAt: number;
};
type BrowserStreamEvent = ManagedBrowserFrame & {
  streamId: string;
  transport: 'screencast' | 'snapshot';
  sequence: number;
};
type BrowserStreamStats = {
  streamId: string;
  sent: number;
  acknowledged: number;
  dropped: number;
  inFlight: boolean;
  lastAckMs: number | null;
  elapsedMs: number;
  hostCpuPercent?: number;
  hostRssBytes?: number;
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
    Number.isSafeInteger((event as Partial<BrowserStreamEvent>).sequence) &&
    (event as BrowserStreamEvent).sequence > 0 &&
    ['screencast', 'snapshot'].includes((event as Partial<BrowserStreamEvent>).transport || '') &&
    isSafeManagedFrame(event, targetId);
}

/** Bounded CDP screencast preferred; snapshot fallback if unavailable.
 * Only a primary native Tauri WebView receives frames. Never stores pixels. */
export type BrowserInputAction =
  | { type: 'click' | 'move'; x: number; y: number }
  | { type: 'scroll'; x: number; y: number; delta_y: number }
  | { type: 'text'; text: string }
  | { type: 'key'; key: string }
  | { type: 'navigate'; url: string }
  | { type: 'back' | 'forward' | 'reload' };

export default function ManagedBrowserLivePreview({
  profileId, generation, targetId, active, onClose, interactive = false, fill = false, controlOwner, onInteraction,
}: {
  profileId: string; generation: string; targetId: string;
  active: boolean; onClose: () => void;
  interactive?: boolean; fill?: boolean; controlOwner?: 'human' | 'agent' | null;
  onInteraction?: (action: BrowserInputAction) => void;
}) {
  const [frame, setFrame] = useState<(ManagedBrowserFrame | BrowserStreamEvent) | null>(null);
  const [fps, setFps] = useState(0);
  const [stats, setStats] = useState<BrowserStreamStats | null>(null);
  const [desktopMemoryMib, setDesktopMemoryMib] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [inputError, setInputError] = useState('');
  const wheelFrame = useRef<number | null>(null);
  const pendingWheel = useRef<{ x: number; y: number; delta_y: number } | null>(null);
  useEffect(() => () => {
    if (wheelFrame.current !== null) window.cancelAnimationFrame(wheelFrame.current);
    wheelFrame.current = null;
    pendingWheel.current = null;
  }, [targetId, active, interactive]);
  const [mode, setMode] = useState<'connecting' | 'screencast' | 'snapshot' | 'paused'>('connecting');
  useEffect(() => {
    setFrame(null);
    setError('');
    setFps(0);
    setStats(null);
    setDesktopMemoryMib(null);
    if (!active) return;
    let cancelled = false;
    let busy = false;
    let starting = false;
    let streamId: string | null = null;
    let lastFrameAt = 0;
    let polling: number | undefined;
    let watchdog: number | undefined;
    let memoryTimer: number | undefined;
    let unlisten: (() => void) | undefined;
    let earlyFrame: BrowserStreamEvent | null = null;
    const recentFrames: number[] = [];
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
      earlyFrame = null;
      recentFrames.length = 0;
      setStats(null);
      setFps(0);
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
    const acceptFrame = (next: BrowserStreamEvent) => {
      lastFrameAt = Date.now();
      recentFrames.push(lastFrameAt);
      while (recentFrames.length > 12) recentFrames.shift();
      if (recentFrames.length >= 2) {
        const elapsed = recentFrames[recentFrames.length - 1] - recentFrames[0];
        if (elapsed > 0) setFps(Math.round((recentFrames.length - 1) * 1000 / elapsed * 10) / 10);
      }
      setFrame(next);
      setError('');
      setMode(next.transport);
      stopPolling();
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
            if (cancelled || document.hidden) return;
            if (!streamId && starting && event?.payload && typeof event.payload === 'object') {
              const incoming = event.payload as Partial<BrowserStreamEvent>;
              if (typeof incoming.streamId === 'string' &&
                  /^[0-9]+-[0-9]+$/.test(incoming.streamId) &&
                  isSafeBrowserStreamEvent(event.payload, incoming.streamId, targetId)) {
                // Start may emit frame #1 before its receipt resolves. Retain
                // exactly one bounded frame; verify its stream ID on receipt.
                earlyFrame = event.payload as BrowserStreamEvent;
              }
              return;
            }
            if (streamId && isSafeBrowserStreamEvent(event?.payload, streamId, targetId)) {
              acceptFrame(event.payload as BrowserStreamEvent);
            }
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
        const currentStreamId: string = receipt.streamId;
        streamId = currentStreamId;
        lastFrameAt = Date.now();
        if (earlyFrame && isSafeBrowserStreamEvent(earlyFrame, currentStreamId, targetId)) {
          acceptFrame(earlyFrame);
        }
        earlyFrame = null;
        if (watchdog !== undefined) window.clearInterval(watchdog);
        watchdog = window.setInterval(() => {
          if (cancelled || document.hidden) return;
          if (Date.now() - lastFrameAt > 4500) { startFallback(); return; }
          if (streamId && typeof invoke === 'function') {
            const current = streamId;
            void invoke('managed_browser_stream_stats', { streamId: current })
              .then((value: BrowserStreamStats) => {
                if (!cancelled && !document.hidden && streamId === current &&
                    value?.streamId === current && Number.isSafeInteger(value?.sent) &&
                    Number.isSafeInteger(value?.acknowledged) && Number.isSafeInteger(value?.dropped)) {
                  setStats(value);
                }
              }).catch(() => {});
          }
        }, 2000);
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
    const sampleMemory = async () => {
      if (cancelled || document.hidden || typeof invoke !== 'function') return;
      try {
        const metrics = await invoke('get_memory_usage') as { desktopTotal?: number };
        if (!cancelled && !document.hidden && typeof metrics?.desktopTotal === 'number' &&
            Number.isFinite(metrics.desktopTotal) && metrics.desktopTotal >= 0) {
          setDesktopMemoryMib(Math.round(metrics.desktopTotal / (1024 * 1024)));
        }
      } catch { /* Desktop telemetry is optional; preview must still work. */ }
    };
    document.addEventListener('visibilitychange', visibility);
    void startStream();
    void sampleMemory();
    memoryTimer = window.setInterval(() => { void sampleMemory(); }, 15_000);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', visibility);
      if (watchdog !== undefined) window.clearInterval(watchdog);
      if (memoryTimer !== undefined) window.clearInterval(memoryTimer);
      stopPolling();
      stopStream();
      unlisten?.();
    };
  }, [active, profileId, generation, targetId]);

  // Acknowledge only after React commits this frame and the next paint is
  // scheduled. One native frame may be unacknowledged at any given time.
  useEffect(() => {
    if (!active || !frame || !('sequence' in frame) || !frame.sequence ||
        !('streamId' in frame) || document.hidden) return;
    const { streamId, sequence } = frame;
    const paint = window.requestAnimationFrame(() => {
      if (document.hidden) return;
      const invoke = (window as any).__TAURI__?.core?.invoke;
      if (typeof invoke === 'function') {
        void invoke('managed_browser_stream_ack', { streamId, sequence }).catch(() => {});
      }
    });
    return () => window.cancelAnimationFrame(paint);
  }, [active, frame]);

  const coords = (image: HTMLImageElement, clientX: number, clientY: number) => {
    const bounds = image.getBoundingClientRect();
    if (!image.naturalWidth || !image.naturalHeight || !bounds.width || !bounds.height) return null;
    const scale = Math.min(bounds.width / image.naturalWidth, bounds.height / image.naturalHeight);
    const padX = (bounds.width - image.naturalWidth * scale) / 2;
    const padY = (bounds.height - image.naturalHeight * scale) / 2;
    const x = (clientX - bounds.left - padX) / scale;
    const y = (clientY - bounds.top - padY) / scale;
    if (x < 0 || y < 0 || x >= image.naturalWidth || y >= image.naturalHeight) return null;
    return { x: Math.round(x), y: Math.round(y) };
  };
  const sendInput = (action: BrowserInputAction) => {
    if (!interactive || !active || !onInteraction) return;
    try { onInteraction(action); setInputError(''); }
    catch { setInputError('Cannot send input to Chrome.'); }
  };
  const specialKeys = new Set(['Enter', 'Backspace', 'Tab', 'Escape', 'Delete', 'ArrowLeft',
    'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']);
  if (!active) return null;
  return (
    <section aria-label="Managed browser live preview"
      className={`overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)] ${fill ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] px-2 py-1.5">
        <span className="inline-flex items-center gap-1 font-semibold">
          <RefreshCw size={12} className={capturing ? 'animate-spin' : ''} />
          {fill ? (controlOwner === 'agent' ? 'Chrome inside T-Line · agent enabled' : 'Chrome inside T-Line · human') : 'Live preview · read-only'} · {mode}
        </span>
        <button type="button" onClick={onClose}
          className="inline-flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1"
          aria-label="Close live preview"><EyeOff size={12}/> Close preview</button>
      </div>
      <div role={interactive ? 'application' : undefined}
        aria-label={interactive ? 'Interactive Chrome viewport' : undefined}
        tabIndex={interactive ? 0 : undefined}
        className={fill ? 'flex min-h-0 flex-1 items-center justify-center outline-none focus:ring-2 focus:ring-purple-500/30' : 'outline-none'}
        onKeyDown={event => {
          if (!interactive || !onInteraction || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
          if (specialKeys.has(event.key)) {
            event.preventDefault();
            sendInput({ type: 'key', key: event.key });
          } else if (event.key.length === 1 && event.key !== ' ') {
            event.preventDefault();
            sendInput({ type: 'text', text: event.key });
          } else if (event.key === ' ') {
            event.preventDefault();
            sendInput({ type: 'key', key: ' ' });
          }
        }}>
        {frame
          ? <img alt="Live screenshot of the selected T-Line-managed browser tab"
              draggable={false} src={frame.dataUrl}
              className={fill ? 'block h-full max-h-full w-full select-none object-contain' :
                'mx-auto block max-h-[420px] w-full select-none object-contain'}
              style={{ cursor: interactive ? 'pointer' : undefined }}
              onClick={event => {
                if (!interactive) return;
                event.currentTarget.parentElement?.focus();
                const at = coords(event.currentTarget, event.clientX, event.clientY);
                if (at) sendInput({ type: 'click', ...at });
              }}
              onWheel={event => {
                if (!interactive) return;
                const at = coords(event.currentTarget, event.clientX, event.clientY);
                if (at) {
                  event.preventDefault();
                  // Coalesce high-frequency wheel events into one native IPC
                  // request per paint, keeping the serialized CDP input queue
                  // free for clicks and keyboard events.
                  const previous = pendingWheel.current;
                  pendingWheel.current = {
                    ...at,
                    delta_y: Math.max(-2000, Math.min(2000, (previous?.delta_y ?? 0) + event.deltaY)),
                  };
                  if (wheelFrame.current === null) {
                    wheelFrame.current = window.requestAnimationFrame(() => {
                      wheelFrame.current = null;
                      const wheel = pendingWheel.current;
                      pendingWheel.current = null;
                      if (wheel) sendInput({ type: 'scroll', ...wheel });
                    });
                  }
                }
              }}/>
          : <div className="flex min-h-36 items-center justify-center text-[var(--text-muted)]">
              {error || 'Connecting to the owned browser tab…'}
            </div>}
      </div>
      {inputError && <p role="alert" className="px-2 py-1 text-amber-400">{inputError}</p>}
      {error && frame && <p role="alert" className="px-2 py-1 text-amber-500">{error}</p>}
      {stats && <p role="status" className="px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]">
        {fps.toFixed(1)} FPS · {stats.sent} sent · {stats.acknowledged} ACK · {stats.dropped} dropped
        {stats.lastAckMs !== null ? ` · ${stats.lastAckMs} ms ACK` : ''}
        {typeof stats.hostCpuPercent === 'number' && Number.isFinite(stats.hostCpuPercent)
          ? ` · Host CPU ${stats.hostCpuPercent.toFixed(1)}%` : ''}
        {typeof stats.hostRssBytes === 'number' && Number.isFinite(stats.hostRssBytes)
          ? ` · Host RAM ${Math.round(stats.hostRssBytes / (1024 * 1024))} MiB` : ''}
        {desktopMemoryMib !== null ? ` · Desktop+WebView ${desktopMemoryMib} MiB` : ''}
      </p>}
      <p className="px-2 py-1 text-[10px] text-[var(--text-muted)]">
        {interactive
          ? 'Click the page to focus it. Keyboard and scroll are forwarded only to this verified embedded Chrome tab. The stream pauses when hidden.'
          : 'Native CDP streams are capped at 5 FPS; offscreen Chrome uses a persistent snapshot fallback. Hidden windows pause capture. No page controls or frame storage.'}
      </p>
    </section>
  );
}
