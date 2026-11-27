import { useRef } from 'react';
import { Globe, Layers, MonitorSmartphone } from 'lucide-react';
import BrowserToolbar from './BrowserToolbar';
import BrowserAgentBar from './BrowserAgentBar';
import { useBrowserRuntime } from './useBrowserRuntime';

/** Full browser surface: a genuine installed Chromium-family browser window
 * docked into the T-Line UI. Rendering, input, media, zoom and find-in-page are
 * provided by the real engine; T-Line owns hosting, navigation, and handoff. */
export default function BrowserSurface({
  tabId,
  isActive,
  initialUrl,
  onUpdateUrl,
  onSendToAgent,
}: {
  tabId: string;
  isActive: boolean;
  initialUrl: string;
  onUpdateUrl?: (url: string) => void;
  onSendToAgent?: (instruction: string) => boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const runtime = useBrowserRuntime({
    active: isActive,
    tabId,
    initialUrl,
    viewportRef,
    onUrlChange: onUpdateUrl,
    onSendToAgent,
  });

  if (!runtime.supported) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
        <MonitorSmartphone size={20} className="text-[var(--text-muted)]" aria-hidden />
        <p className="text-xs font-medium text-[var(--text-main)]">Native T-Line desktop is required</p>
        <p className="max-w-md text-[11px] text-[var(--text-muted)]">
          The embedded browser hosts a real installed Chrome/Edge/Brave window, which needs the desktop runtime.
        </p>
      </div>
    );
  }

  const docked = runtime.session?.docked === true;
  const ready = runtime.session?.lifecycle === 'ready';

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[var(--bg-main)] text-[var(--text-main)]">
      <BrowserToolbar runtime={runtime} />
      <BrowserAgentBar runtime={runtime} />

      {runtime.targets.length > 1 && (
        <div role="tablist" aria-label="Browser tabs inside the app"
          className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1">
          {runtime.targets.map((target) => {
            const selected = runtime.selectedTargetId === target.id;
            return (
              <button key={target.id} type="button" role="tab" aria-selected={selected}
                onClick={() => runtime.selectTarget(target.id)}
                className={`inline-flex max-w-52 shrink-0 items-center gap-1 rounded-[4px] border px-2 py-1 text-[10px] transition-colors ${
                  selected
                    ? 'border-[var(--color-primary)] text-[var(--text-main)]'
                    : 'border-transparent text-[var(--text-muted)] hover:border-[var(--border-color)] hover:text-[var(--text-main)]'
                }`}>
                <span className="truncate">{target.title || target.url || 'Tab'}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* The native browser window is positioned exactly over this element. */}
        <div ref={viewportRef} data-browser-dock="viewport"
          className="relative min-h-0 flex-1 overflow-hidden bg-[var(--bg-main)]">
          {!docked && (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
              <Globe size={22} className="text-[var(--text-muted)]" aria-hidden />
              <p className="text-xs font-medium text-[var(--text-main)]">
                {runtime.session ? 'Browser is running in its own window' : 'No browser running for this tab'}
              </p>
              <p className="max-w-md text-[11px] text-[var(--text-muted)]">
                {runtime.session
                  ? 'Use “Bring to front” to interact with it, or stop it and reopen embedded inside T-Line.'
                  : 'Open a real installed browser embedded in this tab. It uses an isolated profile and a loopback DevTools endpoint for agent control.'}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[var(--border-color)] px-2 py-1 font-mono text-[10px] text-[var(--text-muted)]">
        <Layers size={10} aria-hidden />
        <span>profile {runtime.profileId}</span>
        {runtime.session && <span>gen {runtime.session.generation.slice(0, 22)}</span>}
        {ready && <span>tabs {runtime.targets.length}</span>}
        {runtime.telemetry && (
          <span className="tabular-nums">
            RSS {Math.round(runtime.telemetry.rssBytes / 1_048_576)} MiB � CPU {runtime.telemetry.cpuPercent.toFixed(0)}%
          </span>
        )}
        <span className="flex-1" />
        {runtime.error && (
          <button type="button" role="alert" onClick={() => runtime.clearError()}
            className="text-red-400 underline decoration-dotted">
            {runtime.error} · dismiss
          </button>
        )}
        {!runtime.error && runtime.notice && (
          <button type="button" role="status" onClick={() => runtime.clearNotice()}
            className="text-[var(--text-muted)] underline decoration-dotted">
            {runtime.notice}
          </button>
        )}
      </div>
    </div>
  );
}
