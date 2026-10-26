import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, Trash2, Check, RefreshCw, Layers, ShieldCheck, Edit3, Cpu } from 'lucide-react';
import { ProviderProfile } from './SuperAgentLoginManager';
import { ModelPreset, SubagentRoleOverride, COMMON_SUBAGENT_ROLES } from './SuperAgentPresetManager';

interface SuperAgentPresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPreset: ModelPreset | null;
  selectedMode: 'single' | 'multi';
  providers: ProviderProfile[];
  onSavePreset: (mode: 'single' | 'multi', preset: { id: string; name: string; description?: string; models: any }) => Promise<void>;
  providerModelsCache: Record<string, string[]>;
  providerFetchStatus: Record<string, { isRealFetched: boolean; error?: string; count?: number }>;
  loadingModelsMap: Record<string, boolean>;
  fetchProviderModels: (providerId: string, force?: boolean) => Promise<void>;
}

export const SuperAgentPresetModal: React.FC<SuperAgentPresetModalProps> = ({
  isOpen,
  onClose,
  editingPreset,
  selectedMode,
  providers,
  onSavePreset,
  providerModelsCache,
  providerFetchStatus,
  loadingModelsMap,
  fetchProviderModels
}) => {
  // Preset Info State
  const [presetName, setPresetName] = useState('');
  const [presetDesc, setPresetDesc] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Main Agent Model Config
  const [mainProviderId, setMainProviderId] = useState('');
  const [mainModel, setMainModel] = useState('gemini-2.5-flash');
  const [isMainModelCustom, setIsMainModelCustom] = useState(false);

  // Subagent Default Model Config
  const [isSubDefaultSameAsMain, setIsSubDefaultSameAsMain] = useState(true);
  const [subDefaultProviderId, setSubDefaultProviderId] = useState('');
  const [subDefaultModel, setSubDefaultModel] = useState('gemini-2.5-flash');
  const [isSubDefaultModelCustom, setIsSubDefaultModelCustom] = useState(false);

  // Specialized Subagent Overrides
  const [subagentOverrides, setSubagentOverrides] = useState<SubagentRoleOverride[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    if (editingPreset) {
      setPresetName(editingPreset.name);
      setPresetDesc(editingPreset.description || '');

      const m = editingPreset.models || {};
      const mainConfig = selectedMode === 'multi' ? (m.master || m.superagent) : m.superagent;
      const subDefaultConfig = m.subagentDefault;
      const details = m.subagentDetails || {};

      let mProvider = typeof mainConfig === 'object' ? (mainConfig?.providerProfileId || '') : '';
      let mModelStr = typeof mainConfig === 'object' ? (mainConfig?.model || '') : (typeof mainConfig === 'string' ? mainConfig : '');
      if (!mModelStr) {
        const flat = selectedMode === 'multi' ? (m.MODEL_MULTI_MASTER || m.MODEL_MULTI_SUPERAGENT || m.MODEL) : (m.MODEL_SINGLE_SUPERAGENT || m.MODEL_SINGLE || m.MODEL);
        if (typeof flat === 'string' && flat) {
          if (flat.includes('@')) {
            const at = flat.indexOf('@');
            mProvider = flat.substring(0, at);
            mModelStr = flat.substring(at + 1);
          } else {
            mModelStr = flat;
          }
        }
      }
      setMainProviderId(mProvider);
      setMainModel(mModelStr);
      setIsMainModelCustom(!!mModelStr && !['gemini-2.5-flash', 'gpt-4o', 'claude-3-5-sonnet-20241022'].includes(mModelStr));

      let sProvider = typeof subDefaultConfig === 'object' ? (subDefaultConfig?.providerProfileId || '') : '';
      let sModelStr = typeof subDefaultConfig === 'object' ? (subDefaultConfig?.model || '') : (typeof subDefaultConfig === 'string' ? subDefaultConfig : '');
      if (!sModelStr) {
        const flat = selectedMode === 'multi' ? m.MODEL_MULTI_SUBAGENT : (m.MODEL_SINGLE_SUBAGENT || m.MODEL_MULTI_SUBAGENT);
        if (typeof flat === 'string' && flat) {
          if (flat.includes('@')) {
            const at = flat.indexOf('@');
            sProvider = flat.substring(0, at);
            sModelStr = flat.substring(at + 1);
          } else {
            sModelStr = flat;
          }
        }
      }

      // Check if subagent default is configured identically to main superagent
      const isIdentical = !sModelStr || (sProvider === mProvider && sModelStr === mModelStr);
      setIsSubDefaultSameAsMain(isIdentical);

      setSubDefaultProviderId(sProvider || mProvider);
      setSubDefaultModel(sModelStr || mModelStr);
      setIsSubDefaultModelCustom(!!sModelStr && !['gemini-2.5-flash', 'gpt-4o-mini', 'claude-3-5-haiku-20241022'].includes(sModelStr));

      // Overrides
      const loadedOverrides: SubagentRoleOverride[] = [];
      if (details && typeof details === 'object') {
        for (const [roleName, roleConfig] of Object.entries(details)) {
          const rc: any = roleConfig;
          const rProvider = typeof rc === 'object' ? (rc?.providerProfileId || '') : '';
          const rModelStr = typeof rc === 'object' ? (rc?.model || '') : (typeof rc === 'string' ? rc : '');
          loadedOverrides.push({
            role: roleName,
            providerProfileId: rProvider,
            model: rModelStr,
            isCustomModel: true
          });
        }
      }
      setSubagentOverrides(loadedOverrides);
    } else {
      setPresetName('');
      setPresetDesc('');
      const defaultP = providers[0]?.id || '';
      setMainProviderId(defaultP);
      setMainModel('gemini-2.5-flash');
      setIsMainModelCustom(false);

      setIsSubDefaultSameAsMain(true);
      setSubDefaultProviderId(defaultP);
      setSubDefaultModel('gemini-2.5-flash');
      setIsSubDefaultModelCustom(false);

      setSubagentOverrides([]);
    }
    setSaveError(null);
  }, [isOpen, editingPreset, selectedMode, providers]);

  // Sync subagent config whenever main agent config changes if "Same as Main SuperAgent" is checked
  const handleMainProviderChange = (newProviderId: string) => {
    setMainProviderId(newProviderId);
    if (newProviderId) fetchProviderModels(newProviderId, true);
    if (isSubDefaultSameAsMain) {
      setSubDefaultProviderId(newProviderId);
    }
  };

  const handleMainModelChange = (newModel: string) => {
    setMainModel(newModel);
    if (isSubDefaultSameAsMain) {
      setSubDefaultModel(newModel);
    }
  };

  const handleToggleSameAsMain = (checked: boolean) => {
    setIsSubDefaultSameAsMain(checked);
    if (checked) {
      setSubDefaultProviderId(mainProviderId);
      setSubDefaultModel(mainModel);
      setIsSubDefaultModelCustom(isMainModelCustom);
    }
  };

  const handleAddOverride = () => {
    const defaultRole = COMMON_SUBAGENT_ROLES.find(r => !subagentOverrides.some(o => o.role === r.id))?.id || 'coder';
    const pId = providers[0]?.id || '';
    setSubagentOverrides(prev => [...prev, { role: defaultRole, providerProfileId: pId, model: 'gemini-2.5-flash', isCustomModel: false }]);
  };

  const handleUpdateOverride = (index: number, field: keyof SubagentRoleOverride, value: any) => {
    setSubagentOverrides(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    if (field === 'providerProfileId' && value) {
      fetchProviderModels(value, true);
    }
  };

  const handleRemoveOverride = (index: number) => {
    setSubagentOverrides(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;

    setIsSubmitting(true);
    setSaveError(null);
    try {
      const mProvider = mainProviderId;
      const sDefaultProvider = isSubDefaultSameAsMain ? mainProviderId : subDefaultProviderId;
      const sDefaultModelStr = isSubDefaultSameAsMain ? mainModel.trim() : subDefaultModel.trim();

      const structuredModels: any = {
        superagent: { providerProfileId: mProvider, model: mainModel.trim() },
        subagentDefault: { providerProfileId: sDefaultProvider, model: sDefaultModelStr },
        subagentDetails: {}
      };

      if (selectedMode === 'single') {
        if (mainModel.trim()) {
          structuredModels.MODEL_SINGLE_SUPERAGENT = mProvider ? `${mProvider}@${mainModel.trim()}` : mainModel.trim();
        }
        if (sDefaultModelStr) {
          structuredModels.MODEL_SINGLE_SUBAGENT = sDefaultProvider ? `${sDefaultProvider}@${sDefaultModelStr}` : sDefaultModelStr;
        }
      } else {
        structuredModels.master = { providerProfileId: mProvider, model: mainModel.trim() };
        if (mainModel.trim()) {
          structuredModels.MODEL_MULTI_MASTER = mProvider ? `${mProvider}@${mainModel.trim()}` : mainModel.trim();
        }
        if (sDefaultModelStr) {
          structuredModels.MODEL_MULTI_SUBAGENT = sDefaultProvider ? `${sDefaultProvider}@${sDefaultModelStr}` : sDefaultModelStr;
        }
      }

      subagentOverrides.forEach(ov => {
        if (ov.role && (ov.model.trim() || ov.providerProfileId)) {
          structuredModels.subagentDetails[ov.role.toLowerCase()] = {
            providerProfileId: ov.providerProfileId || '',
            model: ov.model.trim()
          };
        }
      });

      const targetId = editingPreset?.id || presetName.toLowerCase().replace(/\s+/g, '-');

      await onSavePreset(selectedMode, {
        id: targetId,
        name: presetName.trim(),
        description: presetDesc.trim() || 'Custom cross-provider model preset.',
        models: structuredModels
      });
      onClose();
    } catch (e: any) {
      console.error('Failed to save preset:', e);
      setSaveError(e.message || 'Failed to save custom preset');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-[var(--text-main)]">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
          <h4 className="font-semibold text-[var(--text-main)] text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[var(--color-primary)]" />
            {editingPreset ? 'Edit' : 'Create'} Cross-Provider Model Preset ({selectedMode.toUpperCase()})
          </h4>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
            ✕
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-4 overflow-y-auto flex-1 pr-1">
          {saveError && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-2.5 rounded-lg text-xs font-medium">
              ⚠️ {saveError}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-muted)]">Preset Name</label>
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g. Multi-Provider Master & Coder"
                className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-main)] text-xs outline-none focus:border-[var(--color-primary)]"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-muted)]">Description</label>
              <input
                type="text"
                value={presetDesc}
                onChange={(e) => setPresetDesc(e.target.value)}
                placeholder="OpenAI Master, Anthropic Coder, Gemini Researcher"
                className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-main)] text-xs outline-none focus:border-[var(--color-primary)]"
              />
            </div>
          </div>

          {/* Section 1: Main SuperAgent Model */}
          <div className="bg-[var(--bg-sidebar)] p-3.5 rounded-xl border border-[var(--border-color)] space-y-2.5">
            <div className="flex items-center gap-2 font-semibold text-[var(--text-main)] text-xs">
              <ShieldCheck className="w-4 h-4 text-[var(--color-primary)]" />
              <span>Main SuperAgent Model Config</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-[var(--text-muted)]">Provider Profile</label>
                  <button
                    type="button"
                    onClick={() => fetchProviderModels(mainProviderId, true)}
                    className="text-[10px] text-[var(--color-primary)] hover:underline flex items-center gap-1 font-medium"
                    title="Fetch real models directly from provider API endpoint"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingModelsMap[mainProviderId] ? 'animate-spin' : ''}`} />
                    <span>Fetch Live API</span>
                  </button>
                </div>
                <select
                  value={mainProviderId}
                  onChange={(e) => handleMainProviderChange(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] text-xs outline-none focus:border-[var(--color-primary)]"
                >
                  <option value="" className="bg-[#18181b] text-white py-1">-- Not Set (Use Global Active Profile) --</option>
                  {providers.map(p => {
                    const pType = p.type || (p as any).provider || '';
                    return (
                      <option key={p.id} value={p.id} className="bg-[#18181b] text-white py-1">
                        {p.name}{pType ? ` (${pType})` : ''}
                      </option>
                    );
                  })}
                </select>
                {mainProviderId && providerFetchStatus[mainProviderId] && (
                  <p className={`text-[9px] ${providerFetchStatus[mainProviderId]?.isRealFetched ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {providerFetchStatus[mainProviderId]?.isRealFetched
                      ? `🟢 Live models fetched (${providerFetchStatus[mainProviderId]?.count} models)`
                      : `⚠️ Provider Defaults (${providerFetchStatus[mainProviderId]?.error || 'Add API key to fetch live'})`}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-[var(--text-muted)]">Model Name</label>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isMainModelCustom;
                      setIsMainModelCustom(next);
                      if (isSubDefaultSameAsMain) setIsSubDefaultModelCustom(next);
                    }}
                    className="text-[10px] text-[var(--color-primary)] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isMainModelCustom ? 'Select from List' : 'Custom Input'}</span>
                  </button>
                </div>

                {isMainModelCustom ? (
                  <input
                    type="text"
                    value={mainModel}
                    onChange={(e) => handleMainModelChange(e.target.value)}
                    placeholder="Type custom model string e.g. gpt-4o-2024-08-06"
                    className="w-full bg-[var(--bg-card)] border border-[var(--color-primary)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] font-mono text-xs outline-none"
                    autoFocus
                  />
                ) : (
                  <select
                    value={mainModel}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsMainModelCustom(true);
                        if (isSubDefaultSameAsMain) setIsSubDefaultModelCustom(true);
                      } else {
                        handleMainModelChange(e.target.value);
                      }
                    }}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] font-mono text-xs outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="" className="bg-[#18181b] text-white py-1">-- Not Set (Use Default Model) --</option>
                    {(providerModelsCache[mainProviderId] || ['gemini-2.5-flash', 'gpt-4o', 'claude-3-5-sonnet-20241022']).map(m => (
                      <option key={m} value={m} className="bg-[#18181b] text-white py-1">{m}</option>
                    ))}
                    <option value="__custom__" className="bg-[#18181b] text-white py-1">✏️ Custom Model (Type manual string)...</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Subagent Default Config */}
          <div className="bg-[var(--bg-sidebar)] p-3.5 rounded-xl border border-[var(--border-color)] space-y-2.5">
            <div className="flex items-center justify-between font-semibold text-[var(--text-main)] text-xs">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--color-primary)]" />
                <span>Subagent Default Model Config</span>
              </div>
              <label
                className="flex items-center gap-1.5 text-[11px] font-normal text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer select-none py-0.5 px-2 rounded-md hover:bg-[var(--surface-overlay-hover)] transition-colors border border-transparent hover:border-[var(--border-color)]"
                title="Centang untuk menyamakan provider dan model subagent dengan Main SuperAgent"
              >
                <input
                  type="checkbox"
                  checked={isSubDefaultSameAsMain}
                  onChange={(e) => handleToggleSameAsMain(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[var(--border-color)] text-[var(--color-primary)] focus:ring-[var(--color-primary)] cursor-pointer accent-[var(--color-primary)]"
                />
                <span>Same as Main SuperAgent</span>
              </label>
            </div>

            {isSubDefaultSameAsMain && (
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/20 text-[11px] text-[var(--text-main)]">
                <Check className="w-3.5 h-3.5 text-[var(--color-primary)] shrink-0" />
                <span className="text-[var(--text-muted)]">
                  Mengikuti konfigurasi Main SuperAgent:{' '}
                  <strong className="text-[var(--color-primary)] font-mono">{mainModel || 'Not Set'}</strong>
                  {mainProviderId ? ` (${providers.find(p => p.id === mainProviderId)?.name || mainProviderId})` : ''}
                </span>
              </div>
            )}

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 transition-opacity ${isSubDefaultSameAsMain ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-[var(--text-muted)]">Provider Profile</label>
                  <button
                    type="button"
                    disabled={isSubDefaultSameAsMain}
                    onClick={() => fetchProviderModels(subDefaultProviderId, true)}
                    className="text-[10px] text-[var(--color-primary)] hover:underline flex items-center gap-1 font-medium disabled:opacity-40"
                    title="Fetch real models directly from provider API endpoint"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingModelsMap[subDefaultProviderId] ? 'animate-spin' : ''}`} />
                    <span>Fetch Live API</span>
                  </button>
                </div>
                <select
                  disabled={isSubDefaultSameAsMain}
                  value={subDefaultProviderId}
                  onChange={(e) => {
                    setSubDefaultProviderId(e.target.value);
                    if (e.target.value) fetchProviderModels(e.target.value, true);
                  }}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] text-xs outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--bg-sidebar)] disabled:cursor-not-allowed"
                >
                  <option value="" className="bg-[#18181b] text-white py-1">-- Not Set (Use Global Active Profile) --</option>
                  {providers.map(p => {
                    const pType = p.type || (p as any).provider || '';
                    return (
                      <option key={p.id} value={p.id} className="bg-[#18181b] text-white py-1">
                        {p.name}{pType ? ` (${pType})` : ''}
                      </option>
                    );
                  })}
                </select>
                {subDefaultProviderId && providerFetchStatus[subDefaultProviderId] && (
                  <p className={`text-[9px] ${providerFetchStatus[subDefaultProviderId]?.isRealFetched ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {providerFetchStatus[subDefaultProviderId]?.isRealFetched
                      ? `🟢 Live models fetched (${providerFetchStatus[subDefaultProviderId]?.count} models)`
                      : `⚠️ Provider Defaults (${providerFetchStatus[subDefaultProviderId]?.error || 'Add API key to fetch live'})`}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-[var(--text-muted)]">Model Name</label>
                  <button
                    type="button"
                    disabled={isSubDefaultSameAsMain}
                    onClick={() => setIsSubDefaultModelCustom(!isSubDefaultModelCustom)}
                    className="text-[10px] text-[var(--color-primary)] hover:underline flex items-center gap-1 font-medium cursor-pointer disabled:opacity-40"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>{isSubDefaultModelCustom ? 'Select from List' : 'Custom Input'}</span>
                  </button>
                </div>

                {isSubDefaultModelCustom ? (
                  <input
                    type="text"
                    disabled={isSubDefaultSameAsMain}
                    value={subDefaultModel}
                    onChange={(e) => setSubDefaultModel(e.target.value)}
                    placeholder="Type custom subagent default model"
                    className="w-full bg-[var(--bg-card)] border border-[var(--color-primary)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] font-mono text-xs outline-none disabled:bg-[var(--bg-sidebar)] disabled:cursor-not-allowed"
                    autoFocus
                  />
                ) : (
                  <select
                    disabled={isSubDefaultSameAsMain}
                    value={subDefaultModel}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setIsSubDefaultModelCustom(true);
                      } else {
                        setSubDefaultModel(e.target.value);
                      }
                    }}
                    className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] font-mono text-xs outline-none focus:border-[var(--color-primary)] disabled:bg-[var(--bg-sidebar)] disabled:cursor-not-allowed"
                  >
                    <option value="" className="bg-[#18181b] text-white py-1">-- Not Set (Use Default Model) --</option>
                    {(providerModelsCache[subDefaultProviderId] || ['gemini-2.5-flash', 'gpt-4o-mini', 'claude-3-5-haiku-20241022']).map(m => (
                      <option key={m} value={m} className="bg-[#18181b] text-white py-1">{m}</option>
                    ))}
                    <option value="__custom__" className="bg-[#18181b] text-white py-1">✏️ Custom Model (Type manual string)...</option>
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Specialized Subagent Roles */}
          <div className="bg-[var(--bg-sidebar)] p-3.5 rounded-xl border border-[var(--border-color)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-[var(--text-main)] text-xs">
                <Cpu className="w-4 h-4 text-[var(--color-primary)]" />
                <span>Specialized Subagent Role Overrides</span>
              </div>
              <button
                type="button"
                onClick={handleAddOverride}
                className="px-2.5 py-1 bg-[var(--color-primary-glow)] hover:bg-[var(--surface-overlay-hover)] text-[var(--color-primary)] border border-[var(--color-primary)]/40 rounded-lg text-[11px] transition flex items-center gap-1 font-medium cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Add Subagent Role
              </button>
            </div>

            {subagentOverrides.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)] text-center py-2 italic">
                No subagent role overrides added. Subagents will use Subagent Default model configuration.
              </p>
            ) : (
              <div className="space-y-2.5">
                {subagentOverrides.map((ov, idx) => {
                  const availModels = providerModelsCache[ov.providerProfileId || subDefaultProviderId] || ['gemini-2.5-flash', 'gpt-4o', 'claude-3-5-sonnet-20241022'];

                  return (
                    <div key={idx} className="bg-[var(--bg-card)] p-3 rounded-lg border border-[var(--border-color)] flex flex-col md:flex-row items-center gap-2.5">
                      <div className="w-full md:w-1/3 space-y-0.5">
                        <label className="text-[9px] text-[var(--text-muted)]">Subagent Role</label>
                        <select
                          value={ov.role}
                          onChange={(e) => handleUpdateOverride(idx, 'role', e.target.value)}
                          className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md px-2 py-1 text-[var(--text-main)] text-xs capitalize outline-none focus:border-[var(--color-primary)]"
                        >
                          {COMMON_SUBAGENT_ROLES.map(r => (
                            <option key={r.id} value={r.id} className="bg-[#18181b] text-white py-1">{r.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full md:w-1/3 space-y-0.5">
                        <label className="text-[9px] text-[var(--text-muted)]">Provider Profile</label>
                        <select
                          value={ov.providerProfileId}
                          onChange={(e) => handleUpdateOverride(idx, 'providerProfileId', e.target.value)}
                          className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md px-2 py-1 text-[var(--text-main)] text-xs outline-none focus:border-[var(--color-primary)]"
                        >
                          <option value="" className="bg-[#18181b] text-white py-1">-- Not Set (Inherit Default Profile) --</option>
                          {providers.map(p => {
                            const pType = p.type || (p as any).provider || '';
                            return (
                              <option key={p.id} value={p.id} className="bg-[#18181b] text-white py-1">
                                {p.name}{pType ? ` (${pType})` : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div className="w-full md:w-1/3 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] text-[var(--text-muted)]">Model Name</label>
                          <button
                            type="button"
                            onClick={() => handleUpdateOverride(idx, 'isCustomModel', !ov.isCustomModel)}
                            className="text-[9px] text-[var(--color-primary)] hover:underline flex items-center gap-0.5"
                          >
                            <Edit3 className="w-2.5 h-2.5" />
                            <span>{ov.isCustomModel ? 'List' : 'Custom'}</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-1">
                          {ov.isCustomModel ? (
                            <input
                              type="text"
                              value={ov.model}
                              onChange={(e) => handleUpdateOverride(idx, 'model', e.target.value)}
                              placeholder="e.g. claude-3-5-sonnet-20241022"
                              className="w-full bg-[var(--bg-sidebar)] border border-[var(--color-primary)] rounded-md px-2 py-1 text-[var(--text-main)] font-mono text-[11px] outline-none"
                              autoFocus
                            />
                          ) : (
                            <select
                              value={ov.model}
                              onChange={(e) => {
                                if (e.target.value === '__custom__') {
                                  handleUpdateOverride(idx, 'isCustomModel', true);
                                } else {
                                  handleUpdateOverride(idx, 'model', e.target.value);
                                }
                              }}
                              className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-md px-2 py-1 text-[var(--text-main)] font-mono text-[11px] outline-none focus:border-[var(--color-primary)]"
                            >
                              <option value="" className="bg-[#18181b] text-white py-1">-- Not Set (Use Default Model) --</option>
                              {availModels.map(m => (
                                <option key={m} value={m} className="bg-[#18181b] text-white py-1">{m}</option>
                              ))}
                              <option value="__custom__" className="bg-[#18181b] text-white py-1">✏️ Custom Model...</option>
                            </select>
                          )}

                          <button
                            type="button"
                            onClick={() => handleRemoveOverride(idx)}
                            className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-md transition shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)] font-medium text-xs cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer transition"
            >
              {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save Preset
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
