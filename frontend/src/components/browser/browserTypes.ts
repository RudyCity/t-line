/** Typed contract between the trusted T-Line UI and the embedded real browser.
 * Every value that crosses the Tauri/HTTP boundary is validated before use. */

export type BrowserEngine = {
  id: string;
  name: string;
  family: string;
  executable: string;
};

export type BrowserLifecycle = 'starting' | 'ready' | 'disconnected' | 'exited';

export type BrowserSessionStatus = {
  profileId: string;
  generation: string;
  lifecycle: BrowserLifecycle;
  debuggingAvailable: boolean;
  engineId: string;
  engineName: string;
  docked: boolean;
};

export type BrowserTarget = {
  id: string;
  title: string;
  url: string;
  devtoolsUrl: string;
};

export type BrowserPairing = {
  profileId: string;
  generation: string;
  port: number;
  targetId: string;
  engineId: string;
};

export type DockBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ControlMode = 'human' | 'agent';

const LIFECYCLES: BrowserLifecycle[] = ['starting', 'ready', 'disconnected', 'exited'];
const ID = /^[A-Za-z0-9_-]{1,128}$/;
const PROFILE = /^[a-z0-9][a-z0-9_-]{0,39}$/;

/** Stable, valid, per-tab profile identifier: one isolated browser per tab. */
export function tabProfileId(tabId: string): string {
  const slug = tabId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 32);
  return ('p' + slug).slice(0, 40) || 'pdefault';
}

export function isBrowserSession(value: unknown): value is BrowserSessionStatus {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<BrowserSessionStatus>;
  return typeof session.profileId === 'string' && PROFILE.test(session.profileId) &&
    typeof session.generation === 'string' && session.generation.length <= 96 &&
    typeof session.lifecycle === 'string' && LIFECYCLES.includes(session.lifecycle as BrowserLifecycle) &&
    typeof session.debuggingAvailable === 'boolean' &&
    typeof session.engineId === 'string' && typeof session.engineName === 'string' &&
    typeof session.docked === 'boolean';
}

export function isBrowserTarget(value: unknown): value is BrowserTarget {
  if (!value || typeof value !== 'object') return false;
  const target = value as Partial<BrowserTarget>;
  return typeof target.id === 'string' && ID.test(target.id) &&
    typeof target.title === 'string' && target.title.length <= 160 &&
    typeof target.url === 'string' && target.url.length <= 8192 &&
    typeof target.devtoolsUrl === 'string' && /^http:\/\/127\.0\.0\.1:\d+\/devtools\//.test(target.devtoolsUrl);
}

export function isBrowserPairing(value: unknown): value is BrowserPairing {
  if (!value || typeof value !== 'object') return false;
  const pairing = value as Partial<BrowserPairing>;
  return typeof pairing.profileId === 'string' && PROFILE.test(pairing.profileId) &&
    typeof pairing.generation === 'string' && pairing.generation.length <= 96 &&
    typeof pairing.targetId === 'string' && ID.test(pairing.targetId) &&
    Number.isSafeInteger(pairing.port) && Number(pairing.port) >= 1024 && Number(pairing.port) <= 65535 &&
    typeof pairing.engineId === 'string';
}

/** Shape of the read-only SuperAgent CDP session projection used for claim status. */
export type GatewayClaim = {
  agentId: string;
  mode: 'isolated' | 'shared';
  participants: number;
};

export function matchingGatewayClaim(port: number, targetId: string, payload: unknown): GatewayClaim | null {
  if (!payload || typeof payload !== 'object') return null;
  const sessions = (payload as { sessions?: unknown }).sessions;
  if (!Array.isArray(sessions)) return null;
  for (const entry of sessions) {
    if (!entry || typeof entry !== 'object') continue;
    const session = entry as Record<string, unknown>;
    if (session.port !== port || session.targetId !== targetId) continue;
    if (typeof session.agentId !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:@-]{0,95}$/.test(session.agentId)) continue;
    const participants = Array.isArray(session.participants) ? session.participants.length : 1;
    return {
      agentId: session.agentId,
      mode: session.mode === 'shared' ? 'shared' : 'isolated',
      participants,
    };
  }
  return null;
}

/** Read-only bookmark entry coming from the embedded browser's own profile. */
export type ProfileBookmark = {
  name: string;
  url: string;
};

/** Memory and CPU of the exact owned browser process. */
export type BrowserTelemetry = {
  pid: number;
  rssBytes: number;
  cpuPercent: number;
};

export function isProfileBookmark(value: unknown): value is ProfileBookmark {
  if (!value || typeof value !== 'object') return false;
  const bookmark = value as Partial<ProfileBookmark>;
  return typeof bookmark.name === 'string' && bookmark.name.length <= 200 &&
    typeof bookmark.url === 'string' && bookmark.url.length <= 8192 &&
    /^https?:\/\//i.test(bookmark.url);
}

export function isBrowserTelemetry(value: unknown): value is BrowserTelemetry {
  if (!value || typeof value !== 'object') return false;
  const telemetry = value as Partial<BrowserTelemetry>;
  return Number.isSafeInteger(telemetry.pid) && Number(telemetry.pid) > 0 &&
    Number.isFinite(telemetry.rssBytes) && Number(telemetry.rssBytes) >= 0 &&
    Number.isFinite(telemetry.cpuPercent) && Number(telemetry.cpuPercent) >= 0;
}