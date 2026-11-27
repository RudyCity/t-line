import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isBrowserPairing,
  isBrowserSession,
  isBrowserTarget,
  isBrowserTelemetry,
  isProfileBookmark,
  matchingGatewayClaim,
  tabProfileId,
  type BrowserEngine,
  type BrowserPairing,
  type BrowserSessionStatus,
  type BrowserTarget,
  type BrowserTelemetry,
  type ControlMode,
  type GatewayClaim,
  type ProfileBookmark,
} from './browserTypes';
import { normalizeAddress } from './browserUrl';
import { useDockBridge } from './useDockBridge';
import { useOverlayWatch } from './useOverlayWatch';

type Invoke = (name: string, args?: Record<string, unknown>) => Promise<unknown>;

export function tauriInvoke(): Invoke | null {
  const host = (window as unknown as { __TAURI__?: { core?: { invoke?: unknown } } }).__TAURI__;
  const invoke = host?.core?.invoke;
  return typeof invoke === 'function' ? (invoke as Invoke) : null;
}

/** Instruction handed to the T-Line assistant so its existing CDP tool can
 * claim the very tab the user is looking at. No credential is included. */
export function gatewayInstruction(pairing: BrowserPairing): string {
  return [
    'Connect to my T-Line embedded browser through the existing SuperAgent CDP gateway.',
    'The native desktop verified this target belongs to the active browser generation.',
    `Use superagent_browser_gateway with action=discover, port=${pairing.port},`,
    `then action=claim, port=${pairing.port}, targetId=${pairing.targetId}.`,
    'Do not control other targets or ports. Respect session ownership and human control.',
    `Profile: ${pairing.profileId}. Generation: ${pairing.generation}. Engine: ${pairing.engineId}.`,
  ].join('\n');
}

async function backendPost(path: string, body: unknown): Promise<Record<string, unknown>> {
  const token = localStorage.getItem('token') || '';
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('The local Core rejected this browser handoff.');
  return (await response.json()) as Record<string, unknown>;
}

export type BrowserRuntime = ReturnType<typeof useBrowserRuntime>;

/** Owns one embedded real browser for one T-Line browser tab.
 *
 * The browser is a genuine installed Chrome/Edge/Brave/Chromium process with an
 * isolated profile and a loopback CDP endpoint. T-Line provides window hosting,
 * navigation controls, and the verified agent handoff; it never streams pixels. */
export function useBrowserRuntime({
  active,
  tabId,
  initialUrl,
  viewportRef,
  onUrlChange,
  onSendToAgent,
}: {
  active: boolean;
  tabId: string;
  initialUrl: string;
  viewportRef: React.RefObject<HTMLDivElement>;
  onUrlChange?: (url: string) => void;
  onSendToAgent?: (instruction: string) => boolean;
}) {
  const invoke = useMemo(() => tauriInvoke(), []);
  const profileId = useMemo(() => tabProfileId(tabId), [tabId]);
  const [engines, setEngines] = useState<BrowserEngine[]>([]);
  const [engineId, setEngineId] = useState('');
  const [session, setSession] = useState<BrowserSessionStatus | null>(null);
  const [targets, setTargets] = useState<BrowserTarget[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [address, setAddress] = useState(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pairing, setPairing] = useState<BrowserPairing | null>(null);
  const [registeredUntil, setRegisteredUntil] = useState<number | null>(null);
  const [controlMode, setControlMode] = useState<ControlMode | null>(null);
  const [claim, setClaim] = useState<GatewayClaim | null>(null);
  const [localOverlaysOpen, setLocalOverlaysOpen] = useState(false);
  const [telemetry, setTelemetry] = useState<BrowserTelemetry | null>(null);
  const editingRef = useRef(false);
  const activeTarget = targets.find((target) => target.id === selectedTargetId) ?? null;
  const modalOpen = useOverlayWatch(active);
  const overlaysOpen = localOverlaysOpen || modalOpen;

  useDockBridge({ invoke, session, active, viewportRef, overlaysOpen });

  const refreshSessions = useCallback(async () => {
    if (!invoke) return;
    try {
      const raw = await invoke('browser_sessions');
      if (!Array.isArray(raw)) return;
      const next = raw.filter(isBrowserSession).find((item) => item.profileId === profileId) ?? null;
      setSession(next);
    } catch {
      setSession(null);
    }
  }, [invoke, profileId]);

  useEffect(() => {
    if (!invoke) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await invoke('browser_engines');
        if (!cancelled && Array.isArray(raw)) {
          setEngines(
            raw.filter(
              (engine): engine is BrowserEngine =>
                !!engine &&
                typeof engine === 'object' &&
                typeof (engine as BrowserEngine).id === 'string' &&
                typeof (engine as BrowserEngine).name === 'string',
            ),
          );
        }
      } catch {
        if (!cancelled) setEngines([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoke]);

  useEffect(() => {
    if (!invoke) return;
    void refreshSessions();
    if (!active) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshSessions();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [invoke, active, refreshSessions]);

  const refreshTargets = useCallback(async () => {
    if (!invoke || !session?.debuggingAvailable) {
      setTargets([]);
      return;
    }
    try {
      const raw = await invoke('browser_targets', {
        profileId: session.profileId,
        generation: session.generation,
      });
      const next = Array.isArray(raw) ? raw.filter(isBrowserTarget) : [];
      setTargets(next);
      setSelectedTargetId((current) =>
        current && next.some((target) => target.id === current) ? current : next[0]?.id ?? null,
      );
    } catch {
      setTargets([]);
    }
  }, [invoke, session?.debuggingAvailable, session?.profileId, session?.generation]);

  useEffect(() => {
    void refreshTargets();
    if (!active || !session?.debuggingAvailable) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) void refreshTargets();
    }, 3000);
    return () => window.clearInterval(timer);
  }, [active, refreshTargets, session?.debuggingAvailable]);

  useEffect(() => {
    if (!activeTarget || editingRef.current) return;
    setAddress(activeTarget.url === 'about:blank' ? '' : activeTarget.url);
  }, [activeTarget?.url]);

  const launch = useCallback(
    async (docked: boolean) => {
      if (!invoke || busy || session) return;
      setBusy(true);
      setError('');
      setNotice('');
      try {
        const status = await invoke('browser_launch', {
          engineId: engineId || null,
          profileId,
          url: normalizeAddress(address) ?? 'about:blank',
          docked,
        });
        if (status && typeof status === 'object') setSession(status as BrowserSessionStatus);
        setNotice(docked ? 'Real browser embedded in T-Line.' : 'Browser opened in its own window.');
        await refreshSessions();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        await refreshSessions();
      } finally {
        setBusy(false);
      }
    },
    [invoke, busy, session, engineId, profileId, address, refreshSessions],
  );

  const stop = useCallback(async () => {
    if (!invoke || !session || busy) return;
    setBusy(true);
    setError('');
    try {
      await invoke('browser_stop', { profileId: session.profileId, generation: session.generation });
      setTargets([]);
      setSelectedTargetId(null);
      setPairing(null);
      setRegisteredUntil(null);
      setControlMode(null);
      setClaim(null);
      setNotice('Owned browser stopped.');
      await refreshSessions();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [invoke, session, busy, refreshSessions]);

  const act = useCallback(
    async (action: 'back' | 'forward' | 'reload') => {
      if (!invoke || !session || !activeTarget) return;
      try {
        await invoke('browser_act', {
          profileId: session.profileId,
          generation: session.generation,
          targetId: activeTarget.id,
          action,
        });
        window.setTimeout(() => void refreshTargets(), 350);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [invoke, session, activeTarget, refreshTargets],
  );

  const navigate = useCallback(
    async (input: string) => {
      const address = normalizeAddress(input);
      if (!address) {
        setError('Enter a valid HTTP(S) address.');
        return;
      }
      if (!invoke || !session || !activeTarget) {
        setError('Open the browser before navigating.');
        return;
      }
      setError('');
      try {
        await invoke('browser_act', {
          profileId: session.profileId,
          generation: session.generation,
          targetId: activeTarget.id,
          action: 'navigate',
          url: address,
        });
        setAddress(address);
        onUrlChange?.(address);
        window.setTimeout(() => void refreshTargets(), 400);
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      }
    },
    [invoke, session, activeTarget, onUrlChange, refreshTargets],
  );

  const openDevtools = useCallback(async () => {
    if (!activeTarget) return;
    try {
      const token = localStorage.getItem('token') || '';
      const response = await fetch('/api/browser/open', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ url: activeTarget.devtoolsUrl }),
      });
      if (!response.ok) throw new Error('DevTools could not be opened.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [activeTarget]);

  const focusWindow = useCallback(async () => {
    if (!invoke || !session) return;
    await invoke('browser_focus', { profileId: session.profileId, generation: session.generation }).catch(() => {});
  }, [invoke, session]);

  const undock = useCallback(async () => {
    if (!invoke || !session) return;
    try {
      await invoke('browser_undock', { profileId: session.profileId, generation: session.generation });
      setNotice('Browser moved to its own window. Dock it again by relaunching.');
      await refreshSessions();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [invoke, session, refreshSessions]);

  const register = useCallback(async (): Promise<BrowserPairing | null> => {
    if (!invoke || !session || !activeTarget) return null;
    const raw = await invoke('browser_pairing', {
      profileId: session.profileId,
      generation: session.generation,
      targetId: activeTarget.id,
    });
    if (!isBrowserPairing(raw)) throw new Error('Invalid verified browser pairing response.');
    try {
      await backendPost('/api/superagent/browser/managed/register', {
        profileId: raw.profileId,
        generation: raw.generation,
        port: raw.port,
        targetId: raw.targetId,
      });
      setRegisteredUntil(Date.now() + 90_000);
    } catch {
      setRegisteredUntil(null);
    }
    setPairing(raw);
    return raw;
  }, [invoke, session, activeTarget]);

  const connectAgent = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const verified = await register();
      if (!verified) throw new Error('Open a browser tab before connecting an agent.');
      const handedOff = onSendToAgent?.(gatewayInstruction(verified)) === true;
      setNotice(
        handedOff
          ? 'Agent handoff sent to your assistant. It must still claim this exact tab.'
          : 'Verified handoff prepared. Send the instruction to your assistant to let it claim this tab.',
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }, [busy, register, onSendToAgent]);

  const setMode = useCallback(
    async (mode: ControlMode) => {
      if (!session || !activeTarget || busy) return;
      setBusy(true);
      setError('');
      try {
        const verified = pairing ?? (await register());
        if (!verified) throw new Error('Register the tab with the local Core first.');
        const result = await backendPost('/api/superagent/browser/managed/control', {
          profileId: verified.profileId,
          generation: verified.generation,
          port: verified.port,
          targetId: verified.targetId,
          mode,
        });
        if (result.mode !== mode) throw new Error('Core did not confirm the control mode.');
        setControlMode(mode);
        setNotice(mode === 'human'
          ? 'Agent writes are paused. You have full control of this tab.'
          : 'Agent writes may resume. Human input stays available.');
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        setBusy(false);
      }
    },
    [session, activeTarget, busy, pairing, register],
  );

  // Keep the short-lived Core registration alive while the user is on this tab.
  useEffect(() => {
    if (!pairing || !active || !invoke) return;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      void (async () => {
        try {
          await backendPost('/api/superagent/browser/managed/register', {
            profileId: pairing.profileId,
            generation: pairing.generation,
            port: pairing.port,
            targetId: pairing.targetId,
          });
          setRegisteredUntil(Date.now() + 90_000);
        } catch {
          setRegisteredUntil(null);
        }
      })();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [pairing, active, invoke]);

  useEffect(() => {
    if (!pairing || !active) return;
    let cancelled = false;
    const update = async () => {
      try {
        const response = await fetch('/api/superagent/browser/sessions', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('unavailable');
        const payload = await response.json();
        if (!cancelled) setClaim(matchingGatewayClaim(pairing.port, pairing.targetId, payload));
      } catch {
        if (!cancelled) setClaim(null);
      }
    };
    void update();
    const timer = window.setInterval(() => void update(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [pairing, active]);

  useEffect(() => {
    if (!invoke || !active || !session?.debuggingAvailable) {
      setTelemetry(null);
      return;
    }
    let cancelled = false;
    const sample = async () => {
      if (document.hidden) return;
      try {
        const raw = await invoke('browser_telemetry', { profileId: session.profileId });
        if (!cancelled) setTelemetry(isBrowserTelemetry(raw) ? raw : null);
      } catch {
        if (!cancelled) setTelemetry(null);
      }
    };
    void sample();
    const timer = window.setInterval(() => void sample(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [invoke, active, session?.debuggingAvailable, session?.profileId]);

  useEffect(() => {
    setPairing(null);
    setRegisteredUntil(null);
    setControlMode(null);
    setClaim(null);
  }, [session?.generation]);

  const loadProfileBookmarks = useCallback(async (): Promise<ProfileBookmark[]> => {
    if (!invoke || !session) return [];
    try {
      const raw = await invoke('browser_bookmarks', { profileId: session.profileId });
      return Array.isArray(raw) ? raw.filter(isProfileBookmark) : [];
    } catch {
      return [];
    }
  }, [invoke, session?.profileId]);

  return {
    supported: !!invoke,
    engines,
    engineId,
    setEngineId,
    profileId,
    session,
    targets,
    activeTarget,
    selectedTargetId,
    selectTarget: setSelectedTargetId,
    address,
    setAddress,
    markEditing: (editing: boolean) => {
      editingRef.current = editing;
    },
    busy,
    error,
    notice,
    clearError: () => setError(''),
    clearNotice: () => setNotice(''),
    setOverlaysOpen: setLocalOverlaysOpen,
    overlaysOpen,
    modalOpen,
    telemetry,
    loadProfileBookmarks,
    launch,
    stop,
    act,
    navigate,
    openDevtools,
    focusWindow,
    undock,
    connectAgent,
    setMode,
    controlMode,
    claim,
    pairing,
    registeredUntil,
    refreshTargets,
    refreshSessions,
  };
}
