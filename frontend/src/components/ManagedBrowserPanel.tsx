import { useCallback, useEffect, useRef, useState } from 'react';
import { Monitor, RefreshCw, Square, Link2, Copy, Eye, ArrowLeft, ArrowRight, Star } from 'lucide-react';
import ManagedBrowserLivePreview, { type BrowserInputAction } from './ManagedBrowserLivePreview';
import { gatewayPairingInstructions, type ManagedBrowserGatewayPairing } from './managedBrowserGateway';
import { matchingGatewayClaim, type GatewayClaimProjection } from './managedGatewaySessions';
import { DEFAULT_MANAGED_PROFILE, safeManagedLaunchUrl,
  type ManagedBrowserRuntime, type ManagedBrowserAvailability, type ManagedBrowserTarget } from './managedBrowserTypes';

const getInvoke = (): ((name: string, args?: Record<string, unknown>) => Promise<any>) | null =>
  (window as any).__TAURI__?.core?.invoke ?? null;

/** Experimental real-window manager. No password, cookies or CDP endpoint is persisted in React. */
export default function ManagedBrowserPanel({ active, initialUrl, onSendToAgent, onEmbeddedChange }: {
  active: boolean; initialUrl: string; onSendToAgent?: (instruction: string) => boolean;
  onEmbeddedChange?: (embedded: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [embedded, setEmbedded] = useState(false);
  const [address, setAddress] = useState('');
  const [savedUrls, setSavedUrls] = useState<string[]>(() => {
    try {
      const data = JSON.parse(localStorage.getItem('tline-chrome-bookmarks') || '[]');
      return Array.isArray(data) ? data.filter((item): item is string => typeof item === 'string').slice(0, 100) : [];
    } catch { return []; }
  });
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
  // Preserve event order across async IPC calls. Native execution remains
  // serialized as a second layer of protection for click-then-type flows.
  const inputQueue = useRef<Promise<void>>(Promise.resolve());
  const inputEpoch = useRef(0);
  const selected = runtimes.find(r => r.profileId === profileId);
  const currentTarget = targets.find(target => target.id === previewTarget?.targetId);
  const embeddedReady = !!(active && expanded && enabled && embedded && selected?.embedded &&
    selected.lifecycle === 'ready' && selected.debuggingAvailable && currentTarget);
  useEffect(() => {
    inputEpoch.current += 1;
  }, [selected?.generation, previewTarget?.targetId, embeddedReady]);
  useEffect(() => {
    onEmbeddedChange?.(embeddedReady);
  }, [embeddedReady, onEmbeddedChange]);
  useEffect(() => {
    if (currentTarget?.url && document.activeElement?.getAttribute('aria-label') !== 'Chrome address') {
      setAddress(currentTarget.url);
    }
  }, [currentTarget?.url]);
  useEffect(() => {
    try { localStorage.setItem('tline-chrome-bookmarks', JSON.stringify(savedUrls)); }
    catch { /* saving bookmarks is optional */ }
  }, [savedUrls]);
  const sendEmbeddedInput = (interaction: BrowserInputAction) => {
    if (!embeddedReady || !selected || !currentTarget) return Promise.resolve();
    const invoke = getInvoke();
    if (!invoke) return Promise.resolve();
    const request = {
      profileId: selected.profileId, generation: selected.generation,
      targetId: currentTarget.id, interaction,
    };
    const epoch = inputEpoch.current;
    const runtime = selected;
    const execute = async () => {
      // Queued input from an old tab must never reach a newly selected tab.
      if (epoch !== inputEpoch.current) return;
      try {
        await invoke('managed_browser_interact', request);
        if (epoch !== inputEpoch.current) return;
        setError('');
        if (['navigate', 'back', 'forward', 'reload'].includes(interaction.type)) {
          window.setTimeout(() => {
            if (epoch === inputEpoch.current) void refreshTargets(runtime);
          }, 500);
        }
      } catch (err) {
        if (epoch === inputEpoch.current) {
          setError('Chrome interaction failed: ' + String(err));
        }
      }
    };
    inputQueue.current = inputQueue.current.then(execute, execute);
    return inputQueue.current;
  };

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
  useEffect(() => {
    if (!embedded || !active || !selected?.embedded || selected.lifecycle !== 'ready') return;
    const timer = window.setInterval(() => { void refreshTargets(selected); }, 2500);
    return () => window.clearInterval(timer);
  }, [active, embedded, selected?.generation, selected?.embedded, selected?.lifecycle, refreshTargets]);
  useEffect(() => {
    if (!embedded || !selected?.embedded || selected.lifecycle !== 'ready' ||
        previewTarget || targets.length === 0) return;
    setPreviewTarget({
      profileId: selected.profileId, generation: selected.generation, targetId: targets[0].id,
    });
  }, [embedded, selected?.embedded, selected?.generation, selected?.lifecycle, targets, previewTarget]);

  async function launch(inside = false) {
    const invoke = getInvoke();
    if (!invoke || !enabled || busy || selected) return;
    if (!window.confirm(inside
      ? 'Start an isolated, headless Chrome controlled inside T-Line? This opens a local CDP endpoint. Only enable on a trusted computer.'
      : 'Start a separate Chrome process with a T-Line-managed profile and a local CDP debugging endpoint? Only enable this on a trusted computer.')) return;
    setBusy(true); setError(''); setMessage('');
    try {
      let initial = 'about:blank';
      try { initial = safeManagedLaunchUrl(initialUrl); }
      catch { setMessage('The active URL was not passed to Chrome because it contains sensitive parameters.'); }
      await invoke('managed_browser_launch', inside
        ? { profileId, initialUrl: initial, embedded: true }
        : { profileId, initialUrl: initial });
      await refresh();
      if (inside) setEmbedded(true);
      setMessage(inside
        ? 'Chrome is running inside the T-Line browser surface.'
        : 'Managed browser opened in a separate real Chrome window.');
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
      setEmbedded(false);
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
    <section aria-label="Managed browser"
      className={`border-b border-[var(--border-color)] bg-[var(--bg-card)] p-2 text-xs ${embeddedReady ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'shrink-0'}`}>
      <button type="button" aria-label="Toggle managed browser" aria-expanded={expanded}
        className="flex w-full items-center gap-2 text-left" onClick={() => {
          if (embedded) setEmbedded(false);
          setExpanded(v => !v);
        }}>
        <Monitor size={14} className="text-purple-400" />
        <strong>Managed Browser</strong>
        <span className="text-[var(--text-muted)]">{embeddedReady ? 'Embedded Chrome · interactive' : 'Real Chrome · experimental'}</span>
      </button>
      {expanded && (
        <div className={`mt-2 space-y-2 border-t border-[var(--border-color)] pt-2 ${embeddedReady ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : ''}`}>
          {!getInvoke() ? <p>Native T-Line desktop is required for managed browser controls.</p> : (
            <>
              {!embeddedReady && <p className="text-[var(--text-muted)]">Start Chrome inside T-Line for interactive browsing, or open a separate Chrome window. Both use isolated profiles; agent control still requires an authorized gateway claim.</p>}
              <label className={embeddedReady ? 'hidden' : 'inline-flex items-center gap-2'}>
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
                  <div className={embeddedReady ? 'hidden' : 'flex flex-wrap items-center gap-2'}>
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
                  <div role="status" className={embeddedReady ? 'hidden' : ''}>
                    {available?.available ? 'Installed Chrome detected' : 'Installed Chrome unavailable'}
                    {selected ? ' · ' + selected.lifecycle + (selected.debuggingAvailable ? ' · CDP ready' : ' · CDP unavailable') : ' · stopped'}
                  </div>
                  <div className={embeddedReady ? 'hidden' : 'flex flex-wrap gap-2'}>
                    <button type="button" disabled={busy || !!selected || !available?.available} onClick={() => void launch()}
                      className="rounded bg-purple-600 px-2 py-1.5 text-white disabled:opacity-40">Launch Chrome</button>
                    <button type="button" disabled={busy || !!selected || !available?.available}
                      onClick={() => void launch(true)} className="rounded bg-purple-600 px-2 py-1.5 text-white disabled:opacity-40">
                      Open Chrome inside T-Line
                    </button>
                    {selected?.embedded && !embedded && selected.lifecycle === 'ready' &&
                      <button type="button" onClick={() => { setExpanded(true); setEmbedded(true); }}
                        className="rounded border border-purple-500 px-2 py-1.5 text-purple-400">Resume embedded Chrome</button>}
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
                  {selected && !embeddedReady && <p className="font-mono text-[10px] text-[var(--text-muted)]">
                    {selected.profileId + ' · generation ' + selected.generation.slice(0, 24)}</p>}
                  {targets.length > 0 && (
                    <div aria-label="Managed browser targets" className={embeddedReady ? 'hidden' : 'max-h-32 space-y-1 overflow-auto'}>
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
                  {embeddedReady && currentTarget && (
                    <form aria-label="Embedded Chrome navigation" className="flex items-center gap-1"
                      onSubmit={event => {
                        event.preventDefault();
                        const candidate = /^(https?:\/\/)/i.test(address) ? address : 'https://' + address;
                        try {
                          const url = new URL(candidate);
                          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
                            throw new Error('Invalid Chrome URL');
                          }
                          void sendEmbeddedInput({ type: 'navigate', url: url.href });
                        } catch { setError('Enter a valid HTTP(S) address.'); }
                      }}>
                      <button type="button" aria-label="Chrome Back" onClick={() => void sendEmbeddedInput({ type: 'back' })}><ArrowLeft size={16}/></button>
                      <button type="button" aria-label="Chrome Forward" onClick={() => void sendEmbeddedInput({ type: 'forward' })}><ArrowRight size={16}/></button>
                      <button type="button" aria-label="Chrome Reload" onClick={() => void sendEmbeddedInput({ type: 'reload' })}><RefreshCw size={15}/></button>
                      <input aria-label="Chrome address" value={address}
                        onChange={event => setAddress(event.target.value)}
                        className="min-w-0 flex-1 rounded border border-[var(--border-color)] bg-[var(--bg-main)] p-1.5"/>
                      <button type="submit" className="rounded border border-[var(--border-color)] px-2 py-1">Go</button>
                      {targets.length > 1 && <select aria-label="Chrome tabs"
                        value={currentTarget.id} className="max-w-28 bg-[var(--bg-main)] p-1"
                        onChange={event => {
                          if (selected && targets.some(tab => tab.id === event.target.value)) {
                            setPreviewTarget({ profileId: selected.profileId, generation: selected.generation, targetId: event.target.value });
                          }
                        }}>
                        {targets.map(tab => <option key={tab.id} value={tab.id}>{tab.title || tab.url || 'Tab'}</option>)}
                      </select>}
                      <button type="button" aria-label="Bookmark Chrome page" onClick={() => {
                        const url = currentTarget.url;
                        setSavedUrls(previous => previous.includes(url)
                          ? previous.filter(item => item !== url) : [...previous, url].slice(-100));
                      }}><Star size={15} fill={savedUrls.includes(currentTarget.url) ? 'currentColor' : 'none'}/></button>
                      <select aria-label="Chrome bookmarks" className="max-w-28 bg-[var(--bg-main)] p-1"
                        value="" onChange={event => { if (event.target.value) void sendEmbeddedInput({ type: 'navigate', url: event.target.value }); }}>
                        <option value="">Bookmarks</option>
                        {savedUrls.map(url => <option key={url} value={url}>{url}</option>)}
                      </select>
                    </form>
                  )}
                  {previewTarget && selected?.generation === previewTarget.generation &&
                    selected?.profileId === previewTarget.profileId && selected.lifecycle === 'ready' &&
                    <ManagedBrowserLivePreview key={previewTarget.generation + previewTarget.targetId}
                      profileId={previewTarget.profileId} generation={previewTarget.generation}
                      targetId={previewTarget.targetId} active={active && enabled && expanded}
                      interactive={embeddedReady} fill={embeddedReady}
                      onInteraction={action => { void sendEmbeddedInput(action); }}
                      onClose={() => {
                        setPreviewTarget(null);
                        if (embedded) setEmbedded(false);
                      }}/>}
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
                  {message && !embeddedReady && <p role="status" className="text-[var(--text-muted)]">{message}</p>}
                </>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
