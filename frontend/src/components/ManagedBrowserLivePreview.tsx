import { useEffect, useState } from 'react';
import { EyeOff, RefreshCw } from 'lucide-react';

export type ManagedBrowserFrame = {
  targetId: string;
  dataUrl: string;
  capturedAt: number;
};
export function isSafeManagedFrame(frame: unknown, expectedTarget: string): frame is ManagedBrowserFrame {
  if (!frame || typeof frame !== 'object') return false;
  const value = frame as Partial<ManagedBrowserFrame>;
  return value.targetId === expectedTarget &&
    typeof value.capturedAt === 'number' && Number.isFinite(value.capturedAt) &&
    typeof value.dataUrl === 'string' && value.dataUrl.length < 2_000_050 &&
    /^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/=]+$/.test(value.dataUrl);
}

/** Local read-only Chrome pixels. One verified page, one frame at a time.
 * No interactive CDP commands, network image URLs, persisted screenshots,
 * saved passwords, or raw debugger sockets are exposed to the renderer. */
export default function ManagedBrowserLivePreview({
  profileId, generation, targetId, active, onClose,
}: {
  profileId: string; generation: string; targetId: string;
  active: boolean; onClose: () => void;
}) {
  const [frame, setFrame] = useState<ManagedBrowserFrame | null>(null);
  const [error, setError] = useState('');
  const [capturing, setCapturing] = useState(false);
  useEffect(() => {
    setFrame(null);
    setError('');
    if (!active) return;
    let cancelled = false;
    let inFlight = false;
    const capture = async () => {
      if (cancelled || inFlight || document.hidden) return;
      const invoke = (window as any).__TAURI__?.core?.invoke;
      if (typeof invoke !== 'function') { if (!cancelled) setError('Native desktop is required for live preview.'); return; }
      inFlight = true;
      if (!cancelled) setCapturing(true);
      try {
        const next = await invoke('managed_browser_capture', { profileId, generation, targetId });
        if (cancelled) return;
        if (!isSafeManagedFrame(next, targetId)) throw new Error('Invalid local browser screenshot.');
        setFrame(next);
        setError('');
      } catch (err) {
        if (!cancelled) {
          setFrame(null);
          setError(err instanceof Error ? err.message : 'Browser preview disconnected.');
        }
      } finally {
        inFlight = false;
        if (!cancelled) setCapturing(false);
      }
    };
    void capture();
    const timer = window.setInterval(() => { void capture(); }, 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [active, profileId, generation, targetId]);

  if (!active) return null;
  return (
    <section aria-label="Managed browser live preview"
      className="overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-main)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-color)] px-2 py-1.5">
        <span className="inline-flex items-center gap-1 font-semibold">
          <RefreshCw size={12} className={capturing ? 'animate-spin' : ''} />
          Live preview · read-only
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
        Read-only JPEG frames about every 1.5s. Chrome remains in a separate window.
        No clicks, typing, or scrolling are forwarded. Frames are not saved.
      </p>
    </section>
  );
}
