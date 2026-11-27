import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Globe, RefreshCw } from 'lucide-react';
import { TabData } from '../hooks/useTerminals';
import BrowserSurface from './browser/BrowserSurface';
import { normalizeAddress } from './browser/browserUrl';
import { openInSystemBrowser } from './browserUrlUtils';

interface BrowserTabProps {
  tab: TabData;
  isActive: boolean;
  onUpdateTabName?: (newName: string) => void;
  onUpdateTabUrl?: (newUrl: string) => void;
  onManagedBrowserHandoff?: (instruction: string) => boolean;
}

function isNativeDesktop(): boolean {
  return typeof window !== 'undefined' &&
    (window as unknown as { __TAURI__?: unknown }).__TAURI__ !== undefined;
}

/** Web-only fallback preview used when T-Line runs in a plain browser during
 * development. The desktop build always hosts a genuine installed browser. */
function WebPreview({
  isActive,
  initialUrl,
  onUpdateUrl,
}: {
  isActive: boolean;
  initialUrl: string;
  onUpdateUrl?: (url: string) => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [address, setAddress] = useState(initialUrl);
  const [frameKey, setFrameKey] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!initialUrl) return;
    setUrl(initialUrl);
    setAddress(initialUrl);
  }, [initialUrl]);

  return (
    <div className="flex h-full w-full flex-col bg-[var(--bg-main)] text-[var(--text-main)]"
      style={{ display: isActive ? 'flex' : 'none' }}>
      <form className="flex shrink-0 items-center gap-1 border-b border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1.5"
        onSubmit={(event) => {
          event.preventDefault();
          const next = normalizeAddress(address);
          if (!next) {
            setError('Enter a valid HTTP(S) address.');
            return;
          }
          setError('');
          setUrl(next);
          onUpdateUrl?.(next);
        }}>
        <button type="button" aria-label="Reload preview" onClick={() => setFrameKey((key) => key + 1)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-muted)] hover:bg-[var(--bg-main)] hover:text-[var(--text-main)]">
          <RefreshCw size={13} />
        </button>
        <input aria-label="Preview address" value={address} spellCheck={false}
          onChange={(event) => setAddress(event.target.value)}
          className="h-7 min-w-0 flex-1 rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-main)] px-2 font-mono text-[11px] outline-none focus:border-[var(--color-primary)]" />
        <button type="submit" className="h-7 rounded-[6px] border border-[var(--border-color)] px-2 text-[11px]">Go</button>
        <button type="button" aria-label="Open in system browser" onClick={() => openInSystemBrowser(url)}
          className="inline-flex h-7 items-center gap-1 rounded-[6px] border border-[var(--border-color)] px-2 text-[11px]">
          <ExternalLink size={12} /> System
        </button>
      </form>
      {error && <p role="alert" className="px-2 py-1 text-[11px] text-red-400">{error}</p>}
      <div className="relative min-h-0 flex-1">
        {url ? (
          <iframe key={frameKey} title="T-Line web preview" src={url}
            className="absolute inset-0 h-full w-full border-none bg-[var(--bg-main)]" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Globe size={20} className="text-[var(--text-muted)]" aria-hidden />
            <p className="text-xs text-[var(--text-muted)]">Enter an address to preview a local app in the browser build.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** One T-Line browser tab. The desktop build embeds a real installed browser;
 * the web build keeps a plain preview so development flows still work. */
export default function BrowserTab({ tab, isActive, onUpdateTabUrl, onManagedBrowserHandoff }: BrowserTabProps) {
  const native = useMemo(() => isNativeDesktop(), []);
  const initialUrl = tab.url || '';

  if (!native) {
    return <WebPreview isActive={isActive} initialUrl={initialUrl} onUpdateUrl={onUpdateTabUrl} />;
  }

  return (
    <div className="h-full w-full" style={{ display: isActive ? 'block' : 'none' }}>
      <BrowserSurface
        key={tab.id}
        tabId={tab.id}
        isActive={isActive}
        initialUrl={initialUrl}
        onUpdateUrl={onUpdateTabUrl}
        onSendToAgent={onManagedBrowserHandoff}
      />
    </div>
  );
}
