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
}

// ─── Config: Read ─────────────────────────────────────────────────────────

/** Fetch the full config snapshot from SuperAgent (presets, providers, active ids). */
export async function loadMergedPresets(): Promise<MergedPresetsResult> {
  const data = await saRequest<any>('GET', '/api/config');
  return {
    presets: data.presets || { single: [], multi: [] },
    activePresetId: data.activePresetId || { single: '', multi: '' },
    providers: Array.isArray(data.providers) ? data.providers : [],
    activeProviderProfileId: data.activeProviderProfileId || ''
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
