import type { CoreReconnectNotice } from '../services/coreReconnectNotice';

export interface CoreReconnectBannerProps {
  notice: CoreReconnectNotice | null;
  canSend: boolean;
  onCheck: () => void;
  onResume: () => void;
}

/** Never offers an automatic replay/submit button for unknown chat outcomes. */
export function CoreReconnectBanner({ notice, canSend, onCheck, onResume }: CoreReconnectBannerProps) {
  if (!notice || notice.phase === 'connected') return null;
  return (
    <div role="status" aria-live="polite"
      className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-amber-500/30 bg-amber-500/10 text-xs">
      <span className="flex-1 min-w-[230px] text-[var(--text-main)]">{notice.message}</span>
      <button type="button" aria-label="Check Core connection"
        className="rounded-md border border-[var(--border-color)] px-3 py-1.5 hover:bg-[var(--bg-card)]"
        onClick={onCheck}>Check connection</button>
      {notice.phase === 'explicit_resume_required' && (
        <button type="button" aria-label="Resume saved session after worker crash"
          className="rounded-md border border-amber-500/50 px-3 py-1.5 font-semibold hover:bg-amber-500/15"
          disabled={!canSend} onClick={onResume}>Resume saved session</button>
      )}
      {notice.phase === 'review_required' && (
        <span className="text-amber-600 dark:text-amber-300">
          Inspect saved chat and tool results before submitting again.
        </span>
      )}
    </div>
  );
}
