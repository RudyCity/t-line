import fs from 'fs';
import path from 'path';
import os from 'os';

export function getModelConfigPath(): string {
  const override = process.env.SUPERAGENT_CONFIG_DIR?.trim();
  if (override) {
    return path.resolve(override, 'model-config.json');
  }
  return path.join(os.homedir(), '.superagent-r', 'model-config.json');
}

export function getModelPresetsPath(): string {
  const override = process.env.SUPERAGENT_CONFIG_DIR?.trim();
  if (override) {
    return path.resolve(override, 'model-presets.json');
  }
  return path.join(os.homedir(), '.superagent-r', 'model-presets.json');
}

function parseModelString(val: string): { providerProfileId: string; model: string } | undefined {
  if (!val || typeof val !== 'string') return undefined;
  const atIdx = val.indexOf('@');
  if (atIdx > 0) {
    return { providerProfileId: val.substring(0, atIdx), model: val.substring(atIdx + 1) };
  }
  const colonIdx = val.indexOf(':');
  if (colonIdx > 0 && !val.substring(0, colonIdx).includes('/')) {
    return { providerProfileId: val.substring(0, colonIdx), model: val.substring(colonIdx + 1) };
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
    activePresetId: configData.activePresetId || { single: '', multi: '' }
  };
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
    if (!configData.presets) configData.presets = { single: [], multi: [] };
    if (!configData.presets[mode]) configData.presets[mode] = [];

    const existingIndex = configData.presets[mode].findIndex(
      (p: any) => p.id?.toLowerCase() === presetId.toLowerCase() || p.name?.toLowerCase() === presetId.toLowerCase()
    );
    if (existingIndex !== -1) {
      configData.presets[mode][existingIndex] = targetPreset;
    } else {
      configData.presets[mode].push(targetPreset);
    }

    if (!configData.activePreset) configData.activePreset = {};
    configData.activePreset[mode] = targetPreset;

    const mainModelConfig = targetPreset.models?.master || targetPreset.models?.superagent;
    let mainProfile = typeof mainModelConfig === 'object' ? mainModelConfig?.providerProfileId : '';
    if (!mainProfile && targetPreset.models) {
      const rawString = targetPreset.models.MODEL_MULTI_MASTER || targetPreset.models.MODEL_SINGLE_SUPERAGENT || targetPreset.models.MODEL || '';
      if (typeof rawString === 'string' && rawString.includes('@')) {
        mainProfile = rawString.split('@')[0];
      }
    }

    if (mainProfile) {
      configData.activeProviderProfileId = mainProfile;
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(configData, null, 2), 'utf8');
  return {
    activePresetId: configData.activePresetId,
    activeProviderProfileId: configData.activeProviderProfileId
  };
}
