/**
 * Typed read-only desktop command transport.
 * Never forwards slash text to chat, shell or a generic HTTP proxy.
 */
type AuthHeaders = () => Record<string, string>;
export type ParityCommand = { action: 'daemon.status' | 'gateway.status' | 'capabilities'; raw: string };

export function parseParityCommand(text: string): ParityCommand | null {
  const trimmed = text.trim().toLowerCase();
  if (/^\/daemon(?:\s|$)/.test(trimmed)) return {
    action: 'daemon.status', raw: trimmed,
  };
  if (/^\/gateway(?:\s|$)/.test(trimmed)) return {
    action: 'gateway.status', raw: trimmed,
  };
  if (trimmed === '/parity') return { action: 'capabilities', raw: trimmed };
  return null;
}

export async function runParityCommand(
  text: string,
  workspace: string,
  auth: AuthHeaders,
  request: typeof fetch = fetch,
): Promise<string> {
  const parsed = parseParityCommand(text);
  if (!parsed) return 'Not a supported desktop parity command.';
  if (parsed.action === 'daemon.status' && !['/daemon', '/daemon status'].includes(parsed.raw)) {
    return 'Only /daemon status is supported in T-Line. Job lists, runs and mutations remain CLI-only until workspace scoping is implemented.';
  }
  if (parsed.action === 'gateway.status' && !['/gateway', '/gateway status'].includes(parsed.raw)) {
    return 'Only /gateway status is supported in T-Line. Gateway secrets/configuration and writes remain CLI-only.';
  }
  if (!workspace) return 'Select a workspace before querying SuperAgent capabilities.';
  const base = '/api/superagent/parity/';
  const suffix = '?workspace=' + encodeURIComponent(workspace);
  try {
    const header = auth();
    const manifestResponse = await request(base + 'capabilities' + suffix, { headers: header });
    if (!manifestResponse.ok) return `SuperAgent capability negotiation failed (HTTP ${manifestResponse.status}). Restart T-Line/SuperAgent with a compatible build.`;
    const manifest = await manifestResponse.json();
    if (manifest?.server !== 'superagent' || manifest?.schemaVersion !== 1 || !Array.isArray(manifest?.httpActions)) {
      return 'Incompatible SuperAgent capability manifest. No command was executed.';
    }
    if (parsed.action === 'capabilities') {
      const count = Array.isArray(manifest.commands) ? manifest.commands.length : 0;
      const supported = manifest.httpActions.map((a: { id?: string }) => a.id).filter(Boolean);
      return `SuperAgent runtime ${String(manifest.version || 'unknown')} — ${count} CLI commands, ${supported.length} declared read-only desktop actions:\n${supported.join(', ')}\nOther commands are not automatically executable from T-Line.`;
    }
    if (!manifest.httpActions.some((item: { id?: string; method?: string }) =>
      item.id === parsed.action && item.method === 'GET')) {
      return `${parsed.action} is not supported by the active SuperAgent server. No command was sent.`;
    }
    const response = await request(base + parsed.action + suffix, { headers: header });
    if (!response.ok) return `SuperAgent ${parsed.action} failed (HTTP ${response.status}).`;
    const body = await response.json();
    if (parsed.action === 'daemon.status') {
      if (body?.success !== true || typeof body.running !== 'boolean') {
        return 'Invalid daemon status from active SuperAgent server.';
      }
      return [
        'SuperAgent Daemon (read-only)',
        'Running: ' + (body.running ? 'yes' : 'no'),
        'Active jobs: ' + String(body.activeJobsCount ?? 'unknown'),
        'Uptime: ' + String(body.uptime ?? 'unknown') + 's',
      ].join('\n');
    }
    if (body?.success !== true || typeof body.enabled !== 'boolean') {
      return 'Invalid gateway status from active SuperAgent server.';
    }
    const channels = body.channels && typeof body.channels === 'object'
      ? Object.entries(body.channels).slice(0, 12).map(([name, value]) => {
          const v = value as { enabled?: boolean; configured?: boolean };
          return `${name}: ${v.enabled ? 'enabled' : 'disabled'}, ${v.configured ? 'configured' : 'not configured'}`;
        }) : [];
    return ['SuperAgent Gateway (read-only)', 'Enabled: ' + (body.enabled ? 'yes' : 'no'), ...channels].join('\n');
  } catch (error: any) {
    return 'Cannot query SuperAgent capability: ' + String(error?.message || error).slice(0, 200);
  }
}
