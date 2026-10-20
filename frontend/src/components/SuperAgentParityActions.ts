/**
 * Typed read-only desktop command transport.
 * Never forwards slash text to chat, shell or a generic HTTP proxy.
 */
type AuthHeaders = () => Record<string, string>;
export type ParityCommand = { action: 'daemon.status' | 'gateway.status' | 'mcp.status' | 'tools.catalog' | 'selfdev.status' | 'muse.status' | 'capabilities'; raw: string };

export function parseParityCommand(text: string): ParityCommand | null {
  const trimmed = text.trim().toLowerCase();
  if (/^\/daemon(?:\s|$)/.test(trimmed)) return {
    action: 'daemon.status', raw: trimmed,
  };
  if (/^\/gateway(?:\s|$)/.test(trimmed)) return {
    action: 'gateway.status', raw: trimmed,
  };
  for (const [prefix, action] of [
    ['/mcp', 'mcp.status'], ['/tools', 'tools.catalog'],
    ['/selfdev', 'selfdev.status'], ['/muse', 'muse.status'],
  ] as const) {
    if (trimmed === prefix || trimmed.startsWith(prefix + ' ')) return { action, raw: trimmed };
  }
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
  const inspectionForms: Record<string, string[]> = {
    'mcp.status': ['/mcp', '/mcp list', '/mcp status'],
    'tools.catalog': ['/tools', '/tools list'],
    'selfdev.status': ['/selfdev', '/selfdev status'],
    'muse.status': ['/muse status'],
  };
  if (parsed.action in inspectionForms && !inspectionForms[parsed.action].includes(parsed.raw)) {
    return `Only read-only ${inspectionForms[parsed.action].join(' or ')} is available in T-Line. No mutation was sent.`;
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
    if (parsed.action === 'mcp.status') {
      if (body?.success !== true || !Array.isArray(body.servers)) return 'Invalid MCP inspection response.';
      return ['MCP servers (runtime-global, read-only): ' + body.servers.length,
        ...body.servers.slice(0, 40).map((server: { name: string; status: string; toolCount: number; disabled: boolean }) =>
          `- ${String(server.name).slice(0, 80)}: ${server.disabled ? 'disabled' : String(server.status).slice(0, 50)} (${Number(server.toolCount) || 0} tools)`)
      ].join('\n');
    }
    if (parsed.action === 'tools.catalog') {
      if (body?.success !== true || !Array.isArray(body.tools)) return 'Invalid tool catalog response.';
      return ['SuperAgent tools (' + Number(body.count || 0) + ', names only):',
        ...body.tools.slice(0, 75).map((name: string) => '- ' + String(name).slice(0, 120)),
        ...(body.tools.length > 75 || body.truncated ? ['Additional tools omitted from display.'] : []),
      ].join('\n');
    }
    if (parsed.action === 'selfdev.status') {
      if (body?.success !== true || body.scope !== 'workspace') return 'Invalid workspace-scoped selfdev response.';
      const counts = body.lessonCounts || {};
      return ['SelfDev (current workspace, read-only)',
        'Enabled: ' + (body.enabled ? 'yes' : 'no'),
        'Opt-out: ' + (body.userOptOut ? 'yes' : 'no'),
        'Storage: ' + (body.storageAvailable ? 'available' : 'unavailable'),
        'Events: ' + String(body.eventCount ?? 'unknown'),
        'Lessons: ' + String(counts.active ?? 0) + ' active, ' + String(counts.candidate ?? 0) +
          ' candidate, ' + String(counts.retired ?? 0) + ' retired',
      ].join('\n');
    }
    if (parsed.action === 'muse.status') {
      if (body?.success !== true || body.scope !== 'workspace') return 'Invalid workspace-scoped Muse response.';
      const active = body.activeTask;
      return ['Muse (current workspace, read-only)',
        'Transport: ' + String(body.transport || 'unknown'),
        'Runner enabled: ' + (body.runnerEnabled ? 'yes' : 'no'),
        'Watcher active (process): ' + (body.watcherActive ? 'yes' : 'no'),
        'Active task: ' + (active ? String(active.taskId).slice(0, 120) + ' (unverified)' : 'none for this workspace'),
      ].join('\n');
    }
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
