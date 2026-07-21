import fs from 'fs';
import path from 'path';
import os from 'os';

function getConfigFilePath(filename: string): string {
  const override = process.env.SUPERAGENT_CONFIG_DIR?.trim();
  return override
    ? path.resolve(override, filename)
    : path.join(os.homedir(), '.superagent-r', filename);
}

export function getModelConfigPath(): string {
  return getConfigFilePath('model-config.json');
}

export function getModelPresetsPath(): string {
  return getConfigFilePath('model-presets.json');
}

function parseModelString(val: string): { providerProfileId: string; model: string } | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const match = val.match(/^([^@:]+)[@:](.+)$/);
  if (match && !match[1].includes('/')) {
    return { providerProfileId: match[1], model: match[2] };
  }
  return { providerProfileId: '', model: val };
}

function normalizeCliPreset(p: any, mode: 'single' | 'multi') {
  if (!p || typeof p !== 'object') return null;
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  if (!name) return null;

  const rawModels = p.models && typeof p.models === 'object' ? p.models : {};
  let structuredModels: any = { subagentDetails: {} };

  if (mode === 'single') {
    const mainKey = rawModels.MODEL_SINGLE_SUPERAGENT || rawModels.MODEL_SINGLE || rawModels.MODEL || '';
    const subDefaultKey = rawModels.MODEL_SINGLE_SUBAGENT || rawModels.MODEL_MULTI_SUBAGENT || '';
    structuredModels.superagent = parseModelString(mainKey);
    structuredModels.subagentDefault = parseModelString(subDefaultKey);
  } else {
    const masterKey = rawModels.MODEL_MULTI_MASTER || '';
    const superagentKey = rawModels.MODEL_MULTI_SUPERAGENT || rawModels.MODEL || '';
    const subDefaultKey = rawModels.MODEL_MULTI_SUBAGENT || '';
    structuredModels.master = parseModelString(masterKey);
    structuredModels.superagent = parseModelString(superagentKey);
    structuredModels.subagentDefault = parseModelString(subDefaultKey);
  }

  for (const [k, v] of Object.entries(rawModels)) {
    if (typeof v === 'string' && (k.startsWith('MODEL_MULTI_SUBAGENT_') || k.startsWith('MODEL_SINGLE_SUBAGENT_'))) {
      if (k.endsWith('_VISION')) continue;
      const type = k.replace(/^MODEL_(MULTI|SINGLE)_SUBAGENT_/, '').toLowerCase();
      structuredModels.subagentDetails[type] = parseModelString(v);
    }
  }

  return {
    id: name.toLowerCase(),
    name: name,
    description: p.description || 'Custom model preset.',
    models: {
      ...rawModels,
      ...structuredModels
    }
  };
}

export function loadMergedPresets() {
  const configPath = getModelConfigPath();
  const presetsPath = getModelPresetsPath();

  let configData: any = {};
  if (fs.existsSync(configPath)) {
    try {
      configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
      console.error('[PresetUtils] Failed to parse model-config.json:', e);
    }
  }

  const result: { single: any[]; multi: any[] } = {
    single: [...(configData.presets?.single || [])],
    multi: [...(configData.presets?.multi || [])]
  };

  if (fs.existsSync(presetsPath)) {
    try {
      const presetsData = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
      if (presetsData && typeof presetsData === 'object' && !Array.isArray(presetsData)) {
        for (const mode of ['single', 'multi'] as const) {
          const cliList = Array.isArray(presetsData[mode]) ? presetsData[mode] : [];
          for (const rawPreset of cliList) {
            const normalized = normalizeCliPreset(rawPreset, mode);
            if (normalized) {
              const existingIndex = result[mode].findIndex(
                item => item.id?.toLowerCase() === normalized.id || item.name?.toLowerCase() === normalized.id
              );
              if (existingIndex !== -1) {
                result[mode][existingIndex] = { ...result[mode][existingIndex], ...normalized };
              } else {
                result[mode].push(normalized);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('[PresetUtils] Failed to parse model-presets.json:', e);
    }
  }

  return {
    presets: result,
    activePresetId: configData.activePresetId || { single: '', multi: '' },
    providers: Array.isArray(configData.providers) ? configData.providers : [],
    activeProviderProfileId: configData.activeProviderProfileId || ''
  };
}

export function saveProviderProfile(provider: { id: string; name: string; type: string; apiKey: string; baseUrl?: string; models?: any }) {
  const configPath = getModelConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let configData: any = {};
  if (fs.existsSync(configPath)) {
    try {
      configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      configData = {};
    }
  }

  if (!Array.isArray(configData.providers)) {
    configData.providers = [];
  }

  const existingIdx = configData.providers.findIndex((p: any) => p.id === provider.id);
  if (existingIdx !== -1) {
    configData.providers[existingIdx] = { ...configData.providers[existingIdx], ...provider };
  } else {
    configData.providers.push(provider);
  }

  if (!configData.activeProviderProfileId && provider.id) {
    configData.activeProviderProfileId = provider.id;
  }

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
  return {
    providers: configData.providers,
    activeProviderProfileId: configData.activeProviderProfileId
  };
}

export function deleteProviderProfile(providerId: string) {
  const configPath = getModelConfigPath();
  if (!fs.existsSync(configPath)) return;

  const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (Array.isArray(configData.providers)) {
    configData.providers = configData.providers.filter((p: any) => p.id !== providerId);
    if (configData.activeProviderProfileId === providerId) {
      configData.activeProviderProfileId = configData.providers[0]?.id || '';
    }
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
  }

  return {
    providers: configData.providers || [],
    activeProviderProfileId: configData.activeProviderProfileId || ''
  };
}

export function setActiveProviderProfile(providerId: string) {
  const configPath = getModelConfigPath();
  if (!fs.existsSync(configPath)) {
    throw new Error('SuperAgent config file not found');
  }

  const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  configData.activeProviderProfileId = providerId;
  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');

  return {
    activeProviderProfileId: configData.activeProviderProfileId
  };
}

export function saveCustomPreset(mode: 'single' | 'multi', preset: { id: string; name: string; description?: string; models: any }) {
  const configPath = getModelConfigPath();
  const dir = path.dirname(configPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let configData: any = {};
  if (fs.existsSync(configPath)) {
    try {
      configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      configData = {};
    }
  }

  if (!configData.presets) configData.presets = { single: [], multi: [] };
  if (!configData.presets[mode]) configData.presets[mode] = [];

  const presetId = preset.id || preset.name.toLowerCase().replace(/\s+/g, '-');
  const normalizedPreset = {
    id: presetId,
    name: preset.name,
    description: preset.description || 'Custom model preset.',
    models: preset.models || {}
  };

  const existingIndex = configData.presets[mode].findIndex((p: any) => p.id === presetId);
  if (existingIndex !== -1) {
    configData.presets[mode][existingIndex] = normalizedPreset;
  } else {
    configData.presets[mode].push(normalizedPreset);
  }

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
  return loadMergedPresets();
}

export function deleteCustomPreset(mode: 'single' | 'multi', presetId: string) {
  const configPath = getModelConfigPath();
  if (!fs.existsSync(configPath)) return loadMergedPresets();

  const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (configData.presets && Array.isArray(configData.presets[mode])) {
    configData.presets[mode] = configData.presets[mode].filter((p: any) => p.id !== presetId);
    if (configData.activePresetId?.[mode] === presetId) {
      configData.activePresetId[mode] = '';
    }
    fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
  }

  return loadMergedPresets();
}

export function setActivePreset(mode: 'single' | 'multi', presetId: string) {
  const configPath = getModelConfigPath();
  if (!fs.existsSync(configPath)) {
    throw new Error('SuperAgent config file not found');
  }

  const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const merged = loadMergedPresets();
  const availablePresets = merged.presets[mode] || [];

  const targetPreset = availablePresets.find(
    p => p.id?.toLowerCase() === presetId.toLowerCase() || p.name?.toLowerCase() === presetId.toLowerCase()
  );

  if (!configData.activePresetId) configData.activePresetId = {};
  configData.activePresetId[mode] = presetId;

  if (targetPreset) {
    const configuredProviders = Array.isArray(configData.providers) ? configData.providers : [];
    const validProviderIds = configuredProviders.map((p: any) => p.id).filter(Boolean);
    const firstProviderWithKey = configuredProviders.find((p: any) => p.apiKey && p.apiKey.trim())?.id || validProviderIds[0] || '';

    const mainModelConfig = targetPreset.models?.master || targetPreset.models?.superagent;
    let mainProfile = typeof mainModelConfig === 'object' ? mainModelConfig?.providerProfileId : '';
    if (!mainProfile && targetPreset.models) {
      const rawString = targetPreset.models.MODEL_MULTI_MASTER || targetPreset.models.MODEL_SINGLE_SUPERAGENT || targetPreset.models.MODEL || '';
      if (typeof rawString === 'string' && rawString.includes('@')) {
        mainProfile = rawString.split('@')[0];
      }
    }

    let effectiveProfile = configData.activeProviderProfileId;
    if (mainProfile && validProviderIds.includes(mainProfile)) {
      effectiveProfile = mainProfile;
    } else if (!validProviderIds.includes(effectiveProfile)) {
      effectiveProfile = firstProviderWithKey;
    }

    configData.activeProviderProfileId = effectiveProfile;

    const fixTierConfig = (tierConfig: any) => {
      if (!tierConfig || typeof tierConfig !== 'object') return tierConfig;
      const profile = tierConfig.providerProfileId && validProviderIds.includes(tierConfig.providerProfileId)
        ? tierConfig.providerProfileId
        : effectiveProfile;
      return { ...tierConfig, providerProfileId: profile };
    };

    const structuredModels: any = { subagentDetails: {} };
    if (targetPreset.models?.superagent) structuredModels.superagent = fixTierConfig(targetPreset.models.superagent);
    if (targetPreset.models?.subagentDefault) structuredModels.subagentDefault = fixTierConfig(targetPreset.models.subagentDefault);
    if (targetPreset.models?.master) structuredModels.master = fixTierConfig(targetPreset.models.master);

    if (targetPreset.models?.subagentDetails) {
      for (const [subName, subConfig] of Object.entries(targetPreset.models.subagentDetails)) {
        structuredModels.subagentDetails[subName] = fixTierConfig(subConfig);
      }
    }

    const updatedPreset = {
      id: targetPreset.id || presetId.toLowerCase(),
      name: targetPreset.name || presetId,
      description: targetPreset.description || 'Custom model preset.',
      models: {
        ...targetPreset.models,
        ...structuredModels
      }
    };

    if (!configData.presets) configData.presets = { single: [], multi: [] };
    if (!configData.presets[mode]) configData.presets[mode] = [];

    const existingIndex = configData.presets[mode].findIndex(
      (p: any) => p.id?.toLowerCase() === presetId.toLowerCase() || p.name?.toLowerCase() === presetId.toLowerCase()
    );
    if (existingIndex !== -1) {
      configData.presets[mode][existingIndex] = updatedPreset;
    } else {
      configData.presets[mode].push(updatedPreset);
    }

    if (!configData.activePreset) configData.activePreset = {};
    configData.activePreset[mode] = updatedPreset;
  }

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
  return {
    activePresetId: configData.activePresetId,
    activeProviderProfileId: configData.activeProviderProfileId
  };
}

const DEFAULT_PROVIDER_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini', 'gpt-4-turbo'],
  anthropic: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  gemini: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  deepseek: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
  openrouter: ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'google/gemini-2.5-flash', 'deepseek/deepseek-r1'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'deepseek-r1-distill-llama-70b'],
  mistral: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
  ollama: ['llama3.2', 'qwen2.5-coder', 'deepseek-r1', 'mistral', 'phi4', 'codellama'],
  azure: ['gpt-4o', 'gpt-4o-mini']
};

export async function getProviderModels(providerId: string): Promise<{ models: string[]; providerType: string; isRealFetched: boolean; error?: string }> {
  const configPath = getModelConfigPath();
  if (!fs.existsSync(configPath)) {
    return { models: DEFAULT_PROVIDER_MODELS.openai, providerType: 'openai', isRealFetched: false, error: 'Config file not found' };
  }

  try {
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const providers = Array.isArray(configData.providers) ? configData.providers : [];
    const provider = providers.find((p: any) => p.id === providerId) || providers[0];

    if (!provider) {
      return { models: DEFAULT_PROVIDER_MODELS.openai, providerType: 'openai', isRealFetched: false, error: 'Provider profile not found' };
    }

    const providerType = (provider.type || 'openai').toLowerCase();
    const defaultModels = DEFAULT_PROVIDER_MODELS[providerType] || DEFAULT_PROVIDER_MODELS.openai;
    let fetchedModels: string[] = [];
    let isRealFetched = false;
    let fetchError: string | undefined = undefined;

    const apiKey = (provider.apiKey || '').trim();
    let baseUrl = (provider.baseUrl || '').trim().replace(/\/+$/, '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      if (providerType === 'ollama') {
        const url = baseUrl ? (baseUrl.endsWith('/api/tags') ? baseUrl : `${baseUrl}/api/tags`) : 'http://localhost:11434/api/tags';
        const resp = await fetch(url, { signal: controller.signal });
        if (resp.ok) {
          const data: any = await resp.json();
          if (Array.isArray(data.models)) {
            fetchedModels = data.models.map((m: any) => m.name || m.model).filter(Boolean);
            isRealFetched = fetchedModels.length > 0;
          }
        } else {
          fetchError = `Ollama returned HTTP ${resp.status}`;
        }
      } else if (providerType === 'anthropic') {
        if (!apiKey) {
          fetchError = 'API Key is missing for Anthropic';
        } else {
          const url = baseUrl ? (baseUrl.endsWith('/models') ? baseUrl : `${baseUrl}/v1/models`) : 'https://api.anthropic.com/v1/models';
          const resp = await fetch(url, {
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01'
            },
            signal: controller.signal
          });
          if (resp.ok) {
            const data: any = await resp.json();
            const rawList = Array.isArray(data.data) ? data.data : (Array.isArray(data.models) ? data.models : []);
            fetchedModels = rawList.map((m: any) => m.id || m.name).filter(Boolean);
            isRealFetched = fetchedModels.length > 0;
          } else {
            fetchError = `Anthropic API returned HTTP ${resp.status}`;
          }
        }
      } else if (providerType === 'gemini') {
        if (!apiKey) {
          fetchError = 'API Key is missing for Gemini';
        } else {
          const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
          const resp = await fetch(url, { signal: controller.signal });
          if (resp.ok) {
            const data: any = await resp.json();
            if (Array.isArray(data.models)) {
              fetchedModels = data.models
                .map((m: any) => (m.name || '').replace(/^models\//, ''))
                .filter((name: string) => name && name.includes('gemini'));
              isRealFetched = fetchedModels.length > 0;
            }
          } else {
            fetchError = `Gemini API returned HTTP ${resp.status}`;
          }
        }
      } else {
        // OpenAI, DeepSeek, OpenRouter, Groq, Mistral, Azure, Custom REST
        if (!apiKey && providerType !== 'custom') {
          fetchError = `API Key is missing for ${providerType}`;
        } else {
          if (!baseUrl) {
            if (providerType === 'openai') baseUrl = 'https://api.openai.com/v1';
            else if (providerType === 'deepseek') baseUrl = 'https://api.deepseek.com/v1';
            else if (providerType === 'openrouter') baseUrl = 'https://openrouter.ai/api/v1';
            else if (providerType === 'groq') baseUrl = 'https://api.groq.com/openai/v1';
            else if (providerType === 'mistral') baseUrl = 'https://api.mistral.ai/v1';
          }
          if (baseUrl) {
            const url = baseUrl.endsWith('/models') ? baseUrl : `${baseUrl}/models`;
            const headers: Record<string, string> = {};
            if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
            if (providerType === 'azure') headers['api-key'] = apiKey;

            const resp = await fetch(url, { headers, signal: controller.signal });
            if (resp.ok) {
              const data: any = await resp.json();
              const rawList = Array.isArray(data.data) ? data.data : (Array.isArray(data.models) ? data.models : []);
              fetchedModels = rawList.map((m: any) => m.id || m.name).filter(Boolean);
              isRealFetched = fetchedModels.length > 0;
            } else {
              fetchError = `${providerType} API returned HTTP ${resp.status}`;
            }
          }
        }
      }
    } catch (e: any) {
      fetchError = e.name === 'AbortError' ? 'Provider request timed out (5s)' : e.message;
    } finally {
      clearTimeout(timeoutId);
    }

    const combined = isRealFetched
      ? Array.from(new Set([...fetchedModels, ...defaultModels]))
      : defaultModels;

    return {
      models: combined,
      providerType,
      isRealFetched,
      error: fetchError
    };
  } catch (e: any) {
    return { models: DEFAULT_PROVIDER_MODELS.openai, providerType: 'openai', isRealFetched: false, error: e.message };
  }
}

