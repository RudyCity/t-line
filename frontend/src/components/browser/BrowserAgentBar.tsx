import { Bot, Hand, Link2, ShieldAlert } from 'lucide-react';
import type { BrowserRuntime } from './useBrowserRuntime';

/** Verified human/agent handoff for the embedded real browser.
 *
 * The agent connects through SuperAgent's existing CDP gateway; T-Line only
 * proves the live tab identity and never forwards CDP credentials to the page.
 * Human input always stays physically available because the real browser owns
 * its own input path. */
export default function BrowserAgentBar({ runtime }: { runtime: BrowserRuntime }) {
  const { session, activeTarget, controlMode, claim, pairing, registeredUntil, busy } = runtime;
  if (!session || !activeTarget) return null;
  const registered = registeredUntil !== null && registeredUntil > Date.now();

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[var(--border-color)] bg-[var(--bg-main)] px-2 py-1.5">
      <span className="inline-flex items-center gap-1 rounded-[4px] border border-[var(--border-color)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">
        <Bot size={11} aria-hidden />
        {controlMode === 'human' ? 'Human hold · agent writes paused'
          : claim ? `Agent attached · ${claim.agentId} · ${claim.mode}`
          : registered ? 'Core registered · awaiting claim'
          : 'No agent handoff yet'}
      </span>
      {claim && (
        <span className="font-mono text-[10px] text-[var(--text-muted)]">
          participants {claim.participants}
        </span>
      )}
      <span className="flex-1" />
      <button type="button" disabled={busy} onClick={() => void runtime.connectAgent()}
        className="inline-flex h-6 items-center gap-1 rounded-[6px] border border-[var(--color-primary)] px-2 text-[10px] text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)] hover:text-white disabled:opacity-40">
        <Link2 size={11} /> {pairing ? 'Reconnect agent' : 'Connect agent'}
      </button>
      {controlMode !== 'human' ? (
        <button type="button" disabled={busy} onClick={() => void runtime.setMode('human')}
          className="inline-flex h-6 items-center gap-1 rounded-[6px] border border-[var(--border-color)] px-2 text-[10px] text-[var(--text-main)] transition-colors hover:border-amber-400 hover:text-amber-300 disabled:opacity-40">
          <Hand size={11} /> Take control
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => void runtime.setMode('agent')}
          className="inline-flex h-6 items-center gap-1 rounded-[6px] border border-[var(--border-color)] px-2 text-[10px] text-[var(--text-main)] transition-colors hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-40">
          <Bot size={11} /> Return to agent
        </button>
      )}
      <span className="inline-flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
        <ShieldAlert size={10} aria-hidden /> Human verification (reCAPTCHA) stays manual.
      </span>
    </div>
  );
}
