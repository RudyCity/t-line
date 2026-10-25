import { useCallback, useEffect, useState } from 'react';
import { Monitor, RefreshCw, Square, Link2, Copy, Eye } from 'lucide-react';
import ManagedBrowserLivePreview from './ManagedBrowserLivePreview';
import { gatewayPairingInstructions, type ManagedBrowserGatewayPairing } from './managedBrowserGateway';
import { matchingGatewayClaim, type GatewayClaimProjection } from './managedGatewaySessions';
import { DEFAULT_MANAGED_PROFILE, safeManagedLaunchUrl,
  type ManagedBrowserRuntime, type ManagedBrowserAvailability, type ManagedBrowserTarget } from './managedBrowserTypes';

const getInvoke = (): ((name: string, args?: Record<string, unknown>) => Promise<any>) | null =>
  (window as any).__TAURI__?.core?.invoke ?? null;

/** Experimental real-window manager. No password, cookies or CDP endpoint is persisted in React. */
export default function ManagedBrowserPanel({ active, initialUrl, onSendToAgent }: {
  active: boolean; initialUrl: string; onSendToAgent?: (instruction: string) => boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState<ManagedBrowserAvailability | null>(null);
  const [runtimes, setRuntimes] = useState<ManagedBrowserRuntime[]>([]);
  const [profileId, setProfileId] = useState(DEFAULT_MANAGED_PROFILE);
  const [targets, setTargets] = useState<ManagedBrowserTarget[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pairing, setPairing] = useState('');
  const [pairedRuntime, setPairedRuntime] = useState<ManagedBrowserGatewayPairing | null>(null);
  const [gatewayClaim, setGatewayClaim] = useState<GatewayClaimProjection | null>(null);
  const [registeredUntil, setRegisteredUntil] = useState<number | null>(null);
  const [previewTarget, setPreviewTarget] = useState<{
    profileId: string; generation: string; targetId: string;
  } | null>(null);
  const selected = runtimes.find(r => r.profileId === profileId);

  const refresh = useCallback(async () => {
    const invoke = getInvoke();
    if (!invoke) return;
    try {
      const [discovery, status] = await Promise.all([
        invoke('managed_browser_discover'), invoke('managed_browser_status'),
      ]);
      setAvailable(discovery);
      setRuntimes(status);
    } catch (err) { setError(String(err)); }
  }, []);
  const refreshTargets = useCallback(async (runtime: ManagedBrowserRuntime) => {
    const invoke = getInvoke();
    if (!invoke || !runtime.debuggingAvailable) { setTargets([]); return; }
    try {
      const data = await invoke('managed_browser_targets',
        { profileId: runtime.profileId, generation: runtime.generation });
      setTargets(data);
    } catch (err) { setError(String(err)); setTargets([]); }
  }, []);
  useEffect(() => {
    if (!active || !expanded || !getInvoke()) return;
    void refresh();
    const timer = window.setInterval(() => { if (!busy) void refresh(); }, 5000);
    return () => window.clearInterval(timer);
  }, [active, expanded, busy, refresh]);
  useEffect(() => {
    if (!pairedRuntime) return;
    if (!selected || selected.generation !== pairedRuntime.generation ||
        selected.lifecycle !== 'ready' || !selected.debuggingAvailable) {
      setPairing('');
      setPairedRuntime(null);
      setGatewayClaim(null);
      setRegisteredUntil(null);
    }
  }, [selected?.generation, selected?.lifecycle, selected?.debuggingAvailable, pairedRuntime?.generation]);
  useEffect(() => {
    if (!previewTarget) return;
    if (!active || !enabled || !selected || selected.profileId !== previewTarget.profileId ||
        selected.generation !== previewTarget.generation || selected.lifecycle !== 'ready' ||
        !selected.debuggingAvailable || !targets.some(tab => tab.id === previewTarget.targetId)) {
      setPreviewTarget(null);
    }
  }, [active, enabled, selected?.profileId, selected?.generation, selected?.lifecycle,
    selected?.debuggingAvailable, targets, previewTarget?.targetId]);
  // Keep the Core directory announcement short-lived and revalidate the owned
  // native browser/target on each refresh; no background registration on hidden tabs.
  useEffect(() => {
    if (!active || !expanded || !enabled || !pairedRuntime || !registeredUntil) return;
    let cancelled = false;
    const update = async () => {
      const invoke = getInvoke();
      if (!invoke) return;
      try {
        const receipt = await invoke('managed_browser_gateway_register', {
          profileId: pairedRuntime.profileId, generation: pairedRuntime.generation,
          targetId: pairedRuntime.targetId,
        }) as { registered: boolean; expiresAt: number };
        if (!cancelled) setRegisteredUntil(receipt.registered ? receipt.expiresAt : null);
      } catch {
        if (!cancelled) {
          setRegisteredUntil(null);
          setError('Managed browser Core registration expired or is unavailable. Pair again before assigning an agent.');
        }
      }
    };
    const timer = window.setInterval(() => { void update(); }, 45_000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [active, expanded, enabled, pairedRuntime?.port, pairedRuntime?.targetId, pairedRuntime?.generation, !!registeredUntil]);
  useEffect(() => {
    if (!active || !expanded || !enabled || !pairedRuntime) return;
    let cancelled = false;
    const update = async () => {
      try {
        const response = await fetch('/api/superagent/browser/sessions', {
          credentials: 'same-origin', cache: 'no-store',
        });
        if (!response.ok) throw new Error('Gateway session monitor unavailable.');
        const current = matchingGatewayClaim(pairedRuntime, await response.json());
        if (!cancelled) setGatewayClaim(current);
      } catch {
        if (!cancelled) setGatewayClaim(null);
      }
    };
    void update();
    const poll = window.setInterval(() => { void update(); }, 5000);
    return () => { cancelled = true; window.clearInterval(poll); };
  }, [active, expanded, enabled, pairedRuntime?.port, pairedRuntime?.targetId, pairedRuntime?.generation]);
  useEffect(() => {
    if (!active || !expanded || !enabled) return;
    if (selected) void refreshTargets(selected);
    else setTargets([]);
  }, [active, expanded, enabled, selected?.generation, selected?.debuggingAvailable, profileId, refreshTargets]);

  async function launch() {
    const invoke = getInvoke();
    if (!invoke || !enabled || busy || selected) return;
    if (!window.confirm('Start a separate Chrome process with a T-Line-managed profile and a local CDP debugging endpoint? Only enable this on a trusted computer.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      let initial = 'about:blank';
      try { initial = safeManagedLaunchUrl(initialUrl); }
      catch { setMessage('The active URL was not passed to Chrome because it contains sensitive parameters.'); }
      await invoke('managed_browser_launch', { profileId, initialUrl: initial });
      await refresh();
      setMessage('Managed browser opened in a separate real Chrome window.');
    } catch (err) { setError(String(err)); await refresh(); }
    finally { setBusy(false); }
  }
  async function pairTarget(target: ManagedBrowserTarget) {
    const invoke = getInvoke();
    if (!invoke || !selected || busy || !enabled) return;
    if (!window.confirm('Share local managed-browser target details for an authorized SuperAgent agent to claim through the existing CDP gateway? The agent must still claim or request access.')) return;
    setBusy(true); setError(''); setPairing(''); setRegisteredUntil(null);
    try {
      const info = await invoke('managed_browser_gateway_pairing', {
        profileId: selected.profileId, generation: selected.generation, targetId: target.id,
      }) as ManagedBrowserGatewayPairing;
      const instruction = gatewayPairingInstructions(info);
      setPairing(instruction);
      setPairedRuntime(info);
      setGatewayClaim(null);
      let registered = false;
      try {
        const receipt = await invoke('managed_browser_gateway_register', {
          profileId: info.profileId, generation: info.generation, targetId: info.targetId,
        }) as { registered: boolean; expiresAt: number };
        registered = receipt.registered === true && receipt.expiresAt > Date.now();
        setRegisteredUntil(registered ? receipt.expiresAt : null);
      } catch {
        setError('Core registration is unavailable. Manual gateway instructions remain available; automatic assignment was not sent.');
      }
      const handedOff = registered && onSendToAgent?.(instruction) === true;
      setMessage(handedOff
        ? 'Pairing instruction routed to your workspace assistant. Gateway claim will appear once the agent attaches.'
        : 'Verified gateway handoff prepared. Copy the instruction into T-Line chat to have SuperAgent attach through its MCP gateway.');
    } catch (err) { setError(String(err)); }
    finally { setBusy(false); }
  }
  async function copyPairing() {
    if (!pairing) return;
    try { await navigator.clipboard.writeText(pairing); setMessage('Gateway instructions copied for the assistant.'); }
    catch { setError('Clipboard access denied. Select and copy the instructions manually.'); }
  }
  async function stop() {
    const invoke = getInvoke();
    if (!invoke || busy || !selected) return;
    if (!window.confirm('Force-close only the Chrome process launched by T-Line for this profile? Unsaved browser work may be lost.')) return;
    setBusy(true); setError('');
    try {
      await invoke('managed_browser_stop', { profileId, generation: selected.generation });
      setTargets([]);
      setPreviewTarget(null);
      setPairing('');
      setPairedRuntime(null);
      setGatewayClaim(null);
      setRegisteredUntil(null);
      await refresh();
      setMessage('Owned Chrome process stopped.');
    } catch (err) { setError(String(err)); }
    finally { setBusy(false); }
  }
  if (!active) return null;
  return (
    <section aria-label="Managed browser" className="shrink-0 border-b border-[var(--border-color)] bg-[var(--bg-card)] p-2 text-xs">
      <button type="button" aria-label="Toggle managed browser" aria-expanded={expanded}
        className="flex w-full items-center gap-2 text-left" onClick={() => setExpanded(v => !v)}>
        <Monitor size={14} className="text-purple-400" />
        <strong>Managed Browser</strong>
        <span className="text-[var(--text-muted)]">Real Chrome window · experimental</span>
      </button>
      {expanded && (
        <div className="mt-2 space-y-2 border-t border-[var(--border-color)] pt-2">
          {!getInvoke() ? <p>Native T-Line desktop is required for managed browser controls.</p> : (
            <>
              <p className="text-[var(--text-muted)]">Opens Chrome separately with an isolated profile. Select Preview to show opt-in, read-only live snapshots within T-Line. Agent control still requires an authorized gateway claim; Chrome is not embedded natively.</p>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={enabled} onChange={e => {
                  setEnabled(e.target.checked);
                  if (!e.target.checked) {
                    setPairing(''); setPairedRuntime(null); setGatewayClaim(null); setRegisteredUntil(null); setPreviewTarget(null);
                  }
                }}
                  aria-label="Enable managed browser" />
                Enable managed browser controls
              </label>
              {enabled && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <label htmlFor="managed-profile">Profile</label>
                    <select id="managed-profile" value={profileId} onChange={e => { setProfileId(e.target.value); setTargets([]); setPairing(''); setPairedRuntime(null); setGatewayClaim(null); setRegisteredUntil(null); setPreviewTarget(null); }}
                      className="rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-1">
                      <option value="default-managed">Default managed</option>
                      <option value="research">Research</option>
                      <option value="testing">Testing</option>
                       <option value="recovery">Recovery (fresh isolated profile)</option>
                    </select>
                    <button type="button" aria-label="Refresh managed browser" onClick={() => void refresh()}
                      className="rounded border border-[var(--border-color)] p-1"><RefreshCw size={14} /></button>
                  </div>
                  <div role="status">
                    {available?.available ? 'Installed Chrome detected' : 'Installed Chrome unavailable'}
                    {selected ? ' · ' + selected.lifecycle + (selected.debuggingAvailable ? ' · CDP ready' : ' · CDP unavailable') : ' · stopped'}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy || !!selected || !available?.available} onClick={() => void launch()}
                      className="rounded bg-purple-600 px-2 py-1.5 text-white disabled:opacity-40">Launch Chrome</button>
                    <button type="button" disabled={busy || !selected} onClick={() => void stop()}
                      className="inline-flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1.5 disabled:opacity-40">
                      <Square size={12} /> Stop owned browser
                    </button>
                    <button type="button" disabled={!selected || selected.lifecycle !== 'ready' || busy} onClick={() => { if (selected) void refreshTargets(selected); }}
                      className="rounded border border-[var(--border-color)] px-2 py-1.5 disabled:opacity-40">Refresh tabs</button>
                  </div>
                  {selected?.lifecycle === 'disconnected' && (
                    <p role="alert" className="text-amber-500">
                      Chrome is still owned by T-Line, but its verified CDP endpoint is unavailable.
                      Stop the owned browser or choose a fresh recovery profile; existing profile data will not be copied.
                    </p>
                  )}
                  {profileId === 'recovery' && !selected && (
                    <p className="text-[var(--text-muted)]">The recovery profile starts empty. Previous browser profile data remains untouched.</p>
                  )}
                  {selected && <p className="font-mono text-[10px] text-[var(--text-muted)]">
                    {selected.profileId + ' · generation ' + selected.generation.slice(0, 24)}</p>}
                  {targets.length > 0 && (
                    <div aria-label="Managed browser targets" className="max-h-32 space-y-1 overflow-auto">
                      {targets.map(target => (
                        <div key={target.id} className="flex items-center gap-2 rounded border border-[var(--border-color)] p-1">
                          <span className="min-w-0 flex-1 truncate">{target.title || 'Untitled'} · {target.url}</span>
                          <button type="button" aria-label={'Preview ' + (target.title || target.id)}
                            disabled={busy || selected?.lifecycle !== 'ready' || !selected.debuggingAvailable}
                            onClick={() => {
                              if (!selected) return;
                              setPreviewTarget({
                                profileId: selected.profileId, generation: selected.generation, targetId: target.id,
                              });
                            }}
                            className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1 disabled:opacity-40">
                            <Eye size={12} /> Preview
                          </button>
                          <button type="button" aria-label={'Pair agent with ' + (target.title || target.id)}
                            disabled={busy || selected?.lifecycle !== 'ready' || !selected.debuggingAvailable} onClick={() => void pairTarget(target)}
                            className="inline-flex shrink-0 items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1 disabled:opacity-40">
                            <Link2 size={12} /> Pair agent
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {previewTarget && selected?.generation === previewTarget.generation &&
                    selected?.profileId === previewTarget.profileId && selected.lifecycle === 'ready' &&
                    <ManagedBrowserLivePreview key={previewTarget.generation + previewTarget.targetId}
                      profileId={previewTarget.profileId} generation={previewTarget.generation}
                      targetId={previewTarget.targetId} active={active && enabled && expanded}
                      onClose={() => setPreviewTarget(null)}/>}
                  {pairing && (
                    <div className="space-y-1">
                      <p role="status" aria-label="Native Core registration">
                        {registeredUntil && registeredUntil > Date.now()
                          ? 'Native runtime registered with local Core (no CDP claim issued)'
                          : 'Core registration not confirmed; manual pairing only'}
                      </p>
                      <p aria-label="Gateway claim status" role="status" className="text-[var(--text-muted)]">
                        {gatewayClaim
                          ? 'Gateway claim observed · ' + gatewayClaim.agentId + ' · ' + gatewayClaim.mode +
                            ' · participants ' + (gatewayClaim.participants?.length ?? 0)
                          : 'No active gateway claim observed for this target. Pairing is not an agent connection.'}
                      </p>
                      <label htmlFor="managed-pairing-instructions" className="text-[var(--text-muted)]">
                        Verified MCP gateway handoff (assistant request or manual copy)
                      </label>
                      <textarea id="managed-pairing-instructions" readOnly rows={6} value={pairing}
                        className="w-full resize-y rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-2 font-mono text-[10px]" />
                      <button type="button" onClick={() => void copyPairing()}
                        className="inline-flex items-center gap-1 rounded border border-[var(--border-color)] px-2 py-1">
                        <Copy size={12} /> Copy for assistant
                      </button>
                    </div>
                  )}
                  {error && <p role="alert" className="text-red-400">{error}</p>}
                  {message && <p role="status" className="text-[var(--text-muted)]">{message}</p>}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
