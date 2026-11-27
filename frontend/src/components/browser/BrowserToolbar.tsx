import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  ExternalLink,
  History,
  RefreshCw,
  Square,
  Star,
  Trash2,
  Wrench,
} from 'lucide-react';
import SelectMenu from './SelectMenu';
import type { BrowserRuntime } from './useBrowserRuntime';
import { addressLabel } from './browserUrl';

type Bookmark = { url: string; name: string; addedAt: number };
const BOOKMARKS_KEY = 'tline-real-browser-bookmarks';
const HISTORY_KEY = 'tline-real-browser-history';

function readList<T>(key: string): T[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(raw) ? (raw as T[]).slice(0, 80) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, value: unknown[]) {
  try {
    localStorage.setItem(key, JSON.stringify(value.slice(0, 80)));
  } catch {
    /* bookmarks and history are best effort */
  }
}

/** Toolbar for the embedded real browser. Zoom, find-in-page, downloads, print,
 * and page shortcuts are handled by the real engine itself; this row only owns
 * the T-Line level actions that need verified native commands. */
export default function BrowserToolbar({ runtime }: { runtime: BrowserRuntime }) {
  const { session, activeTarget, engines, engineId, busy } = runtime;
  const [bookmarks, setBookmarks] = useState<Bookmark[]>(() => readList<Bookmark>(BOOKMARKS_KEY));
  const [history, setHistory] = useState<Bookmark[]>(() => readList<Bookmark>(HISTORY_KEY));
  const [panel, setPanel] = useState<'none' | 'bookmarks' | 'history'>('none');
  const [confirmStop, setConfirmStop] = useState(false);
  const stopTimer = useRef<number | null>(null);

  useEffect(() => {
    runtime.setOverlaysOpen(panel !== 'none');
  }, [panel, runtime.setOverlaysOpen]);

  useEffect(() => () => {
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
  }, []);

  useEffect(() => {
    if (!activeTarget?.url || activeTarget.url === 'about:blank') return;
    setHistory((previous) => {
      if (previous[0]?.url === activeTarget.url) return previous;
      const next = [
        { url: activeTarget.url, name: addressLabel(activeTarget.url), addedAt: Date.now() },
        ...previous.filter((entry) => entry.url !== activeTarget.url),
      ].slice(0, 80);
      writeList(HISTORY_KEY, next);
      return next;
    });
  }, [activeTarget?.url]);

  const currentBookmarked = !!activeTarget && bookmarks.some((bookmark) => bookmark.url === activeTarget.url);
  const engineOptions = engines.map((engine) => ({ value: engine.id, label: engine.name }));
  const ready = !!session && session.lifecycle === 'ready';

  const toggleBookmark = () => {
    if (!activeTarget) return;
    setBookmarks((previous) => {
      const next = previous.some((bookmark) => bookmark.url === activeTarget.url)
        ? previous.filter((bookmark) => bookmark.url !== activeTarget.url)
        : [{ url: activeTarget.url, name: addressLabel(activeTarget.url), addedAt: Date.now() }, ...previous];
      writeList(BOOKMARKS_KEY, next);
      return next;
    });
  };

  const startStop = () => {
    if (!confirmStop) {
      setConfirmStop(true);
      stopTimer.current = window.setTimeout(() => setConfirmStop(false), 4000);
      return;
    }
    if (stopTimer.current) window.clearTimeout(stopTimer.current);
    setConfirmStop(false);
    void runtime.stop();
  };

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-b border-[var(--border-color)] bg-[var(--bg-card)] px-2 py-1.5">
      <form
        aria-label="Browser address"
        className="flex items-center gap-1"
        onSubmit={(event) => {
          event.preventDefault();
          void runtime.navigate(runtime.address);
        }}
      >
        <button type="button" aria-label="Back" disabled={!ready} onClick={() => void runtime.act('back')}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-main)] hover:text-[var(--text-main)] disabled:opacity-30">
          <ArrowLeft size={14} />
        </button>
        <button type="button" aria-label="Forward" disabled={!ready} onClick={() => void runtime.act('forward')}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-main)] hover:text-[var(--text-main)] disabled:opacity-30">
          <ArrowRight size={14} />
        </button>
        <button type="button" aria-label="Reload" disabled={!ready} onClick={() => void runtime.act('reload')}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-main)] hover:text-[var(--text-main)] disabled:opacity-30">
          <RefreshCw size={13} />
        </button>
        <input
          aria-label="Browser address input"
          value={runtime.address}
          placeholder="Search or enter address"
          spellCheck={false}
          onFocus={() => runtime.markEditing(true)}
          onBlur={() => runtime.markEditing(false)}
          onChange={(event) => runtime.setAddress(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              runtime.markEditing(false);
              runtime.setAddress(activeTarget?.url ?? '');
              event.currentTarget.blur();
            }
          }}
          className="h-7 min-w-0 flex-1 rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-main)] px-2 font-mono text-[11px] text-[var(--text-main)] outline-none focus:border-[var(--color-primary)]"
        />
        <button type="submit" disabled={!ready}
          className="h-7 rounded-[6px] border border-[var(--border-color)] px-2 text-[11px] text-[var(--text-main)] transition-colors hover:border-[var(--color-primary)] disabled:opacity-40">
          Go
        </button>
        <button type="button" aria-label={currentBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
          aria-pressed={currentBookmarked} disabled={!activeTarget} onClick={toggleBookmark}
          className="inline-flex h-7 w-7 items-center justify-center rounded-[6px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-main)] hover:text-[var(--text-main)] disabled:opacity-30">
          <Star size={13} fill={currentBookmarked ? 'currentColor' : 'none'} />
        </button>
        <button type="button" aria-label="Bookmarks" aria-expanded={panel === 'bookmarks'}
          onClick={() => setPanel((current) => (current === 'bookmarks' ? 'none' : 'bookmarks'))}
          className="inline-flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-[11px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-main)] hover:text-[var(--text-main)]">
          <Star size={12} /> <span className="tabular-nums">{bookmarks.length}</span>
        </button>
        <button type="button" aria-label="History" aria-expanded={panel === 'history'}
          onClick={() => setPanel((current) => (current === 'history' ? 'none' : 'history'))}
          className="inline-flex h-7 items-center gap-1 rounded-[6px] px-1.5 text-[11px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-main)] hover:text-[var(--text-main)]">
          <History size={12} /> <span className="tabular-nums">{history.length}</span>
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-1.5">
        {!session ? (
          <>
            <SelectMenu label="Browser engine" value={engineId} options={engineOptions}
              onChange={runtime.setEngineId} placeholder="Auto (first installed)" />
            <button type="button" disabled={busy} onClick={() => void runtime.launch(true)}
              className="h-7 rounded-[6px] bg-[var(--color-primary)] px-2.5 text-[11px] font-medium text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-40">
              Open real browser here
            </button>
            <button type="button" disabled={busy} onClick={() => void runtime.launch(false)}
              className="h-7 rounded-[6px] border border-[var(--border-color)] px-2 text-[11px] text-[var(--text-main)] transition-colors hover:border-[var(--color-primary)] disabled:opacity-40">
              Own window
            </button>
          </>
        ) : (
          <>
            <span role="status" className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border-color)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
              <span className={`h-1.5 w-1.5 rounded-full ${session.lifecycle === 'ready' ? 'bg-emerald-400' : 'bg-amber-400'}`} aria-hidden />
              {session.engineName} · {session.lifecycle}{session.debuggingAvailable ? ' · CDP' : ''}{session.docked ? ' · docked' : ' · own window'}
            </span>
            {!session.docked && (
              <button type="button" onClick={() => void runtime.focusWindow()}
                className="inline-flex h-7 items-center gap-1 rounded-[6px] border border-[var(--border-color)] px-2 text-[11px] text-[var(--text-main)] transition-colors hover:border-[var(--color-primary)]">
                <Eye size={12} /> Bring to front
              </button>
            )}
            {session.docked && (
              <button type="button" onClick={() => void runtime.undock()}
                className="inline-flex h-7 items-center gap-1 rounded-[6px] border border-[var(--border-color)] px-2 text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--text-main)]">
                <ExternalLink size={12} /> Undock
              </button>
            )}
            <button type="button" disabled={!activeTarget} onClick={() => void runtime.openDevtools()}
              className="inline-flex h-7 items-center gap-1 rounded-[6px] border border-[var(--border-color)] px-2 text-[11px] text-[var(--text-muted)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--text-main)] disabled:opacity-40">
              <Wrench size={12} /> DevTools
            </button>
            <button type="button" disabled={busy} onClick={startStop}
              className={`inline-flex h-7 items-center gap-1 rounded-[6px] border px-2 text-[11px] transition-colors disabled:opacity-40 ${
                confirmStop
                  ? 'border-red-500/60 bg-red-500/10 text-red-300'
                  : 'border-[var(--border-color)] text-[var(--text-muted)] hover:border-red-500/60 hover:text-red-300'
              }`}>
              <Square size={11} /> {confirmStop ? 'Confirm stop' : 'Stop'}
            </button>
          </>
        )}
      </div>

      {panel !== 'none' && (
        <div className="max-h-56 overflow-auto rounded-[6px] border border-[var(--border-color)] bg-[var(--bg-main)] p-1">
          <div className="flex items-center justify-between px-1 py-0.5">
            <span className="text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
              {panel === 'bookmarks' ? 'Bookmarks' : 'Recent pages'}
            </span>
            <button type="button"
              onClick={() => {
                if (panel === 'bookmarks') {
                  setBookmarks([]);
                  writeList(BOOKMARKS_KEY, []);
                } else {
                  setHistory([]);
                  writeList(HISTORY_KEY, []);
                }
              }}
              className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)] hover:text-red-300">
              <Trash2 size={10} /> Clear
            </button>
          </div>
          {(panel === 'bookmarks' ? bookmarks : history).length === 0 && (
            <p className="px-1 py-2 text-[11px] text-[var(--text-muted)]">
              {panel === 'bookmarks' ? 'No bookmarks yet.' : 'No pages visited yet.'}
            </p>
          )}
          {(panel === 'bookmarks' ? bookmarks : history).map((entry) => (
            <button key={entry.url} type="button" onClick={() => { setPanel('none'); void runtime.navigate(entry.url); }}
              className="block w-full truncate rounded-[4px] px-1.5 py-1 text-left text-[11px] text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-card)] hover:text-[var(--text-main)]">
              {entry.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
