/**
 * presetUtils.ts
 * ──────────────
 * Thin HTTP-proxy layer to the SuperAgent server (port 7888).
 * Zero direct filesystem access to ~/.superagent-r — all config
 * reads and writes go through the SuperAgent REST API.
 */

const SUPERAGENT_BASE = 'http://127.0.0.1:7888';
const DEFAULT_TIMEOUT_MS = 5000;

// ─── Internal helper ───────────────────────────────────────────────────────

async function saRequest<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: unknown,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${SUPERAGENT_BASE}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const text = await res.text();

    // Guard against HTML error pages returned by stale processes
    if (text.trimStart().toLowerCase().startsWith('<!doctype') || text.trimStart().startsWith('<html')) {
      throw new Error(`SuperAgent returned an HTML error page (HTTP ${res.status}). Is it running?`);
    }

    let json: any;
    try { json = JSON.parse(text); } catch {
      throw new Error(`SuperAgent response is not valid JSON (HTTP ${res.status}): ${text.slice(0, 120)}`);
    }

    if (!res.ok) {
      throw new Error(json?.error || `SuperAgent HTTP ${res.status}`);
    }

    return json as T;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error(`SuperAgent request timed out after ${timeoutMs}ms (path: ${path})`);
    }
    if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
      throw new Error('SuperAgent server is not running (ECONNREFUSED on port 7888). Start the server first.');
    }
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface MergedPresetsResult {
  presets: { single: any[]; multi: any[] };
  activePresetId: { single: string; multi: string };
  providers: any[];
  activeProviderProfileId: string;
  settings?: Record<string, any>;
  trustedDirectories?: string[];
  superagentVersion?: string;
}

export interface McpServerEntry {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  status?: string;
  tools?: string[];
  error?: string;
}

// ─── Config: Read ─────────────────────────────────────────────────────────

/** Fetch the full config snapshot from SuperAgent (presets, providers, settings, active ids). */
export async function loadMergedPresets(): Promise<MergedPresetsResult> {
  const data = await saRequest<any>('GET', '/api/config');
  return {
    presets: data.presets || { single: [], multi: [] },
    activePresetId: data.activePresetId || { single: '', multi: '' },
    providers: Array.isArray(data.providers) ? data.providers : [],
    activeProviderProfileId: data.activeProviderProfileId || '',
    settings: data.settings || {},
    trustedDirectories: Array.isArray(data.trustedDirectories) ? data.trustedDirectories : [],
    superagentVersion: data.superagentVersion || data.version || '1.2.520'
  };
}

// ─── Presets ───────────────────────────────────────────────────────────────

/** Save (create or update) a custom preset via SuperAgent. */
export async function saveCustomPreset(
  mode: 'single' | 'multi',
  preset: { id: string; name: string; description?: string; models: any }
): Promise<MergedPresetsResult> {
  const data = await saRequest<any>('POST', '/api/config/preset', { mode, preset });
  return {
    presets: data.presets || { single: [], multi: [] },
    activePresetId: data.activePresetId || { single: '', multi: '' },
    providers: Array.isArray(data.providers) ? data.providers : [],
    activeProviderProfileId: data.activeProviderProfileId || ''
  };
}

/** Delete a custom preset via SuperAgent. */
export async function deleteCustomPreset(
  mode: 'single' | 'multi',
  presetId: string
): Promise<MergedPresetsResult> {
  const data = await saRequest<any>(
    'DELETE',
    `/api/config/preset/${encodeURIComponent(mode)}/${encodeURIComponent(presetId)}`
  );
  return {
    presets: data.presets || { single: [], multi: [] },
    activePresetId: data.activePresetId || { single: '', multi: '' },
    providers: Array.isArray(data.providers) ? data.providers : [],
    activeProviderProfileId: data.activeProviderProfileId || ''
  };
}

/** Set the active preset for a mode via SuperAgent. */
export async function setActivePreset(
  mode: 'single' | 'multi',
  presetId: string
): Promise<{ activePresetId: any; activeProviderProfileId: string }> {
  const data = await saRequest<any>('POST', '/api/config/active-preset', { mode, presetId });
  return {
    activePresetId: data.activePresetId || {},
    activeProviderProfileId: data.activeProviderProfileId || ''
  };
}

// ─── Provider Profiles ─────────────────────────────────────────────────────

/** Save (create or update) a provider profile via SuperAgent. */
export async function saveProviderProfile(
  provider: { id: string; name: string; type: string; apiKey: string; baseUrl?: string; models?: any }
): Promise<{ providers: any[]; activeProviderProfileId: string }> {
  const data = await saRequest<any>('POST', '/api/config/provider', { provider });
  return {
    providers: Array.isArray(data.providers) ? data.providers : [],
    activeProviderProfileId: data.activeProviderProfileId || ''
  };
}

/** Delete a provider profile via SuperAgent. */
export async function deleteProviderProfile(
  providerId: string
): Promise<{ providers: any[]; activeProviderProfileId: string }> {
  const data = await saRequest<any>(
    'DELETE',
    `/api/config/provider/${encodeURIComponent(providerId)}`
  );
  return {
    providers: Array.isArray(data.providers) ? data.providers : [],
    activeProviderProfileId: data.activeProviderProfileId || ''
  };
}

/** Switch the active provider profile via SuperAgent. */
export async function setActiveProviderProfile(
  providerId: string
): Promise<{ activeProviderProfileId: string }> {
  const data = await saRequest<any>('POST', '/api/config/active-provider', { providerId });
  return { activeProviderProfileId: data.activeProviderProfileId || providerId };
}

// ─── Provider Models ───────────────────────────────────────────────────────

/** Fetch available models for a provider (live or cached defaults) via SuperAgent. */
export async function getProviderModels(
  providerId: string
): Promise<{ models: string[]; providerType: string; isRealFetched: boolean; error?: string }> {
  const qs = providerId ? `?providerId=${encodeURIComponent(providerId)}` : '';
  const data = await saRequest<any>('GET', `/api/config/provider-models${qs}`, undefined, 8000);
  return {
    models: Array.isArray(data.models) ? data.models : [],
    providerType: data.providerType || 'openai',
    isRealFetched: !!data.isRealFetched,
    error: data.error
  };
}

// ─── Settings ──────────────────────────────────────────────────────────────

/** Partial-update system settings (merge) via SuperAgent. */
export async function updateSystemSettings(settings: Record<string, any>): Promise<{ success: boolean }> {
  const data = await saRequest<any>('POST', '/api/config', { settings });
  return { success: !!data.success };
}

// ─── MCP Server Config ─────────────────────────────────────────────────────

/** List all configured MCP servers with live connection status. */
export async function getMcpServers(): Promise<{ servers: McpServerEntry[] }> {
  const data = await saRequest<any>('GET', '/api/config/mcp');
  return { servers: Array.isArray(data.servers) ? data.servers : [] };
}

/** Add or update a MCP server entry. */
export async function saveMcpServer(
  server: { name: string; command: string; args?: string[]; env?: Record<string, string> }
): Promise<{ mcpServers: Record<string, any> }> {
  const data = await saRequest<any>('POST', '/api/config/mcp', server);
  return { mcpServers: data.mcpServers || {} };
}

/** Disconnect and reinitialize all MCP servers from current config. */
export async function reloadMcpServers(): Promise<{ servers: McpServerEntry[] }> {
  const data = await saRequest<any>('POST', '/api/config/mcp/reload');
  return { servers: Array.isArray(data.servers) ? data.servers : [] };
}

/** Remove a MCP server by name. */
export async function deleteMcpServer(name: string): Promise<{ mcpServers: Record<string, any> }> {
  const data = await saRequest<any>('DELETE', `/api/config/mcp/${encodeURIComponent(name)}`);
  return { mcpServers: data.mcpServers || {} };
}

// ─── Trusted Directories ───────────────────────────────────────────────────

/** Mark a directory as trusted in SuperAgent. */
export async function addTrustedDirectoryViaServer(dirPath: string): Promise<{ trustedDirectories: string[] }> {
  const data = await saRequest<any>('POST', '/api/config/trusted-directory', { path: dirPath });
  return { trustedDirectories: Array.isArray(data.trustedDirectories) ? data.trustedDirectories : [] };
}

/** Remove trust from a directory. */
export async function removeTrustedDirectory(dirPath: string): Promise<{ trustedDirectories: string[] }> {
  const data = await saRequest<any>('DELETE', '/api/config/trusted-directory', { path: dirPath });
  return { trustedDirectories: Array.isArray(data.trustedDirectories) ? data.trustedDirectories : [] };
}

// ─── Session Export / Import ───────────────────────────────────────────────

/** Export a session as raw text (JSON string or Markdown). */
export async function exportSessionContent(
  sessionId: string,
  format: 'json' | 'markdown' = 'json'
): Promise<string> {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 8000);
  try {
    const url = `${SUPERAGENT_BASE}/api/history/session/${encodeURIComponent(sessionId)}/export?format=${format}`;
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`SuperAgent HTTP ${res.status}`);
    return await res.text();
  } catch (err: any) {
    if (err.name === 'AbortError') throw new Error('Session export timed out');
    if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') throw new Error('SuperAgent server is not running');
    throw err;
  } finally {
    clearTimeout(tid);
  }
}

/** Import a session from a { session, messages } payload. */
export async function importSessionData(
  session: Record<string, any>,
  messages: Record<string, any>[]
): Promise<{ success: boolean; id: string }> {
  const data = await saRequest<any>('POST', '/api/history/import', { session, messages });
  return { success: !!data.success, id: data.id || '' };
}
