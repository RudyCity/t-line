export type ManagedBrowserEngine = 'system-chrome' | 'managed-chromium';
export type ManagedBrowserLifecycle = 'stopped' | 'starting' | 'ready' | 'disconnected' | 'exited' | 'stopping';
export type ManagedBrowserRuntime = {
  profileId: string;
  generation: string;
  lifecycle: ManagedBrowserLifecycle;
  debuggingAvailable: boolean;
  engine: ManagedBrowserEngine;
  embedded?: boolean;
};
export type ManagedBrowserAvailability = {
  available: boolean;
  engine: ManagedBrowserEngine;
  executable?: string | null;
  featureEnabled: boolean;
};
export type ManagedBrowserTarget = { id: string; title: string; url: string };
export const DEFAULT_MANAGED_PROFILE = 'default-managed';
export function isValidManagedProfile(id: string): boolean {
  return /^[a-z0-9][a-z0-9_-]{0,39}$/.test(id);
}
export function safeManagedLaunchUrl(url: string): string {
  if (!url || url === 'about:blank') return 'about:blank';
  if (url.length > 2048) throw new Error('URL too long');
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password ||
      parsed.search || parsed.hash) {
    throw new Error('Use an HTTP(S) URL without credentials, query parameters or fragments');
  }
  return parsed.toString();
}
