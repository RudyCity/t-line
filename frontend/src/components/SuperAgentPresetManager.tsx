import React, { useState, useEffect } from 'react';
import { Sparkles, Plus, Trash2, Check, Cpu, RefreshCw, Layers, ShieldCheck, Edit3, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ProviderProfile } from './SuperAgentLoginManager';

export interface ModelPreset {
  id: string;
  name: string;
  description: string;
  models: Record<string, { providerProfileId: string; model: string } | string | any>;
}

interface SuperAgentPresetManagerProps {
  presets: { single: ModelPreset[]; multi: ModelPreset[] };
  activePresetId: { single: string; multi: string };
  agentMode: 'single' | 'multi';
  providers: ProviderProfile[];
  onSelectPreset: (mode: 'single' | 'multi', presetId: string) => Promise<void>;
  onSaveCustomPreset: (mode: 'single' | 'multi', preset: { id: string; name: string; description?: string; models: any }) => Promise<void>;
  onDeleteCustomPreset: (mode: 'single' | 'multi', presetId: string) => Promise<void>;
}

interface SubagentRoleOverride {
  role: string;
  providerProfileId: string;
  model: string;
  isCustomModel?: boolean;
}

const COMMON_SUBAGENT_ROLES = [
  { id: 'coder', label: 'Coder (Coding & Refactoring)' },
  { id: 'researcher', label: 'Researcher (Search & Docs)' },
  { id: 'vision', label: 'Vision (Image Analysis & UI)' },
  { id: 'planner', label: 'Planner (Architecture & Tasks)' },
  { id: 'auditor', label: 'Auditor (Code Audit & Security)' },
  { id: 'writer', label: 'Writer (Documentation & Copy)' },
  { id: 'browser', label: 'Browser (Web Automation)' },
  { id: 'tester', label: 'Tester (QA & Unit Testing)' }
];

export const SuperAgentPresetManager: React.FC<SuperAgentPresetManagerProps> = ({
  presets,
  activePresetId,
  agentMode,
  providers,
  onSelectPreset,
  onSaveCustomPreset,
  onDeleteCustomPreset
}) => {
  const [selectedMode, setSelectedMode] = useState<'single' | 'multi'>(agentMode);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Custom Preset Form State
  const [presetName, setPresetName] = useState('');
  const [presetDesc, setPresetDesc] = useState('');
  
  // Main Agent Model Config
  const [mainProviderId, setMainProviderId] = useState('');
  const [mainModel, setMainModel] = useState('gemini-2.5-flash');
  const [isMainModelCustom, setIsMainModelCustom] = useState(false);

  // Subagent Default Model Config
  const [subDefaultProviderId, setSubDefaultProviderId] = useState('');
  const [subDefaultModel, setSubDefaultModel] = useState('gemini-2.5-flash');
  const [isSubDefaultModelCustom, setIsSubDefaultModelCustom] = useState(false);

  // Specialized Subagent Overrides
  const [subagentOverrides, setSubagentOverrides] = useState<SubagentRoleOverride[]>([]);

  // Provider Models Cache
  const [providerModelsCache, setProviderModelsCache] = useState<Record<string, string[]>>({});
  const [loadingModelsMap, setLoadingModelsMap] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPresets = presets[selectedMode] || [];
  const currentActiveId = activePresetId[selectedMode] || '';

  const filteredPresets = currentPresets.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const nameMatch = p.name.toLowerCase().includes(q);
    const idMatch = p.id.toLowerCase().includes(q);
    const descMatch = p.description.toLowerCase().includes(q);
    const modelsStr = JSON.stringify(p.models || {}).toLowerCase();
    return nameMatch || idMatch || descMatch || modelsStr.includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filteredPresets.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPresets = filteredPresets.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE);

  // Initialize form default provider IDs when providers load
  useEffect(() => {
    if (providers.length > 0) {
      if (!mainProviderId) setMainProviderId(providers[0].id);
      if (!subDefaultProviderId) setSubDefaultProviderId(providers[0].id);
    }
  }, [providers]);

  // Real Provider Models Fetch Status
  const [providerFetchStatus, setProviderFetchStatus] = useState<Record<string, { isRealFetched: boolean; error?: string; count?: number }>>({});

  // Fetch models for a given provider ID
  const fetchProviderModels = async (providerId: string, force = false) => {
    if (!providerId) return;
    if (!force && providerFetchStatus[providerId]?.isRealFetched && (providerModelsCache[providerId]?.length || 0) > 0) return;
    setLoadingModelsMap(prev => ({ ...prev, [providerId]: true }));
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/superagent/config/provider-models?providerId=${encodeURIComponent(providerId)}`, {
        headers
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models) && data.models.length > 0) {
          setProviderModelsCache(prev => ({ ...prev, [providerId]: data.models }));
          setProviderFetchStatus(prev => ({
            ...prev,
            [providerId]: {
              isRealFetched: !!data.isRealFetched,
              error: data.error,
              count: data.models.length
            }
          }));

          if (!isMainModelCustom && providerId === mainProviderId && (!mainModel || mainModel === 'gemini-2.5-flash')) {
            setMainModel(data.models[0]);
          }
          if (!isSubDefaultModelCustom && providerId === subDefaultProviderId && (!subDefaultModel || subDefaultModel === 'gemini-2.5-flash')) {
            setSubDefaultModel(data.models[0]);
          }
        }
      }
    } catch (e: any) {
      console.error('Failed to fetch provider models:', e);
      setProviderFetchStatus(prev => ({
        ...prev,
        [providerId]: { isRealFetched: false, error: e.message }
      }));
    } finally {
      setLoadingModelsMap(prev => ({ ...prev, [providerId]: false }));
    }
  };

  useEffect(() => {
    if (showAddModal && providers.length > 0) {
      const defaultP = providers[0]?.id || '';
      const mP = mainProviderId || defaultP;
      const sP = subDefaultProviderId || defaultP;
      if (!mainProviderId) setMainProviderId(mP);
      if (!subDefaultProviderId) setSubDefaultProviderId(sP);
      if (mP) fetchProviderModels(mP, true);
      if (sP && sP !== mP) fetchProviderModels(sP, true);
    }
  }, [showAddModal, providers]);

  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);

  const openAddPresetModal = () => {
    setEditingPresetId(null);
    setPresetName('');
    setPresetDesc('');
    const defaultP = providers[0]?.id || '';
    setMainProviderId(defaultP);
    setMainModel('gemini-2.5-flash');
    setIsMainModelCustom(false);
    setSubDefaultProviderId(defaultP);
    setSubDefaultModel('gemini-2.5-flash');
    setIsSubDefaultModelCustom(false);
    setSubagentOverrides([]);
    setShowAddModal(true);
  };

  const openEditPresetModal = (p: ModelPreset) => {
    setEditingPresetId(p.id);
    setPresetName(p.name);
    setPresetDesc(p.description || '');

    const m = p.models || {};
    const mainConfig = selectedMode === 'multi' ? (m.master || m.superagent) : m.superagent;
    const subDefaultConfig = m.subagentDefault;
    const details = m.subagentDetails || {};

    const mProvider = typeof mainConfig === 'object' ? (mainConfig?.providerProfileId || '') : '';
    const mModelStr = typeof mainConfig === 'object' ? (mainConfig?.model || '') : (typeof mainConfig === 'string' ? mainConfig : '');
    setMainProviderId(mProvider || providers[0]?.id || '');
    setMainModel(mModelStr || 'gemini-2.5-flash');
    setIsMainModelCustom(!!mModelStr && !['gemini-2.5-flash', 'gpt-4o', 'claude-3-5-sonnet-20241022'].includes(mModelStr));

    const sProvider = typeof subDefaultConfig === 'object' ? (subDefaultConfig?.providerProfileId || '') : '';
    const sModelStr = typeof subDefaultConfig === 'object' ? (subDefaultConfig?.model || '') : (typeof subDefaultConfig === 'string' ? subDefaultConfig : '');
    setSubDefaultProviderId(sProvider || providers[0]?.id || '');
    setSubDefaultModel(sModelStr || 'gemini-2.5-flash');
    setIsSubDefaultModelCustom(!!sModelStr && !['gemini-2.5-flash', 'gpt-4o-mini', 'claude-3-5-haiku-20241022'].includes(sModelStr));

    const loadedOverrides: SubagentRoleOverride[] = [];
    if (details && typeof details === 'object') {
      for (const [roleName, roleConfig] of Object.entries(details)) {
        const rc: any = roleConfig;
        const rProvider = typeof rc === 'object' ? (rc?.providerProfileId || '') : '';
        const rModelStr = typeof rc === 'object' ? (rc?.model || '') : (typeof rc === 'string' ? rc : '');
        loadedOverrides.push({
          role: roleName,
          providerProfileId: rProvider || providers[0]?.id || '',
          model: rModelStr || '',
          isCustomModel: true
        });
      }
    }
    setSubagentOverrides(loadedOverrides);
    setShowAddModal(true);
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

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;

    setIsSubmitting(true);
    try {
      const defaultP = providers[0]?.id || '';
      const mProvider = mainProviderId || defaultP;
      const sDefaultProvider = subDefaultProviderId || defaultP;

      const structuredModels: any = {
        superagent: { providerProfileId: mProvider, model: mainModel.trim() },
        subagentDefault: { providerProfileId: sDefaultProvider, model: subDefaultModel.trim() },
        subagentDetails: {}
      };

      if (selectedMode === 'multi') {
        structuredModels.master = { providerProfileId: mProvider, model: mainModel.trim() };
      }

      subagentOverrides.forEach(ov => {
        if (ov.role && ov.model.trim()) {
          structuredModels.subagentDetails[ov.role.toLowerCase()] = {
            providerProfileId: ov.providerProfileId || defaultP,
            model: ov.model.trim()
          };
        }
      });

      const targetId = editingPresetId || presetName.toLowerCase().replace(/\s+/g, '-');

      await onSaveCustomPreset(selectedMode, {
        id: targetId,
        name: presetName.trim(),
        description: presetDesc.trim() || 'Custom cross-provider model preset.',
        models: structuredModels
      });
      setShowAddModal(false);
      setPresetName('');
      setPresetDesc('');
      setSubagentOverrides([]);
      setEditingPresetId(null);
    } catch (e) {
      console.error('Failed to save preset:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getProviderName = (pId: string) => {
    const match = providers.find(p => p.id === pId);
    return match ? match.name : (pId || 'Default');
  };

  const formatModelLabel = (modelConfig: any) => {
    if (!modelConfig) return 'Default';
    if (typeof modelConfig === 'string') return modelConfig;
    const modelName = modelConfig.model || 'Default';
    const providerName = getProviderName(modelConfig.providerProfileId);
    return `${modelName} (${providerName})`;
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-card)] p-3.5 rounded-xl border border-[var(--border-color)]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/50 text-[var(--color-primary)]">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-main)] text-xs">Model Presets & Cross-Provider Config</h3>
            <p className="text-[11px] text-[var(--text-muted)]">Configure independent LLM providers and models per SuperAgent and Subagent role</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-[var(--bg-sidebar)] p-1 rounded-lg border border-[var(--border-color)] flex items-center gap-1">
            <button
              onClick={() => setSelectedMode('single')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition ${
                selectedMode === 'single' ? 'text-white shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
              style={selectedMode === 'single' ? { backgroundColor: 'var(--color-primary)' } : undefined}
            >
              Single Agent Mode
            </button>
            <button
              onClick={() => setSelectedMode('multi')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition ${
                selectedMode === 'multi' ? 'text-white shadow-xs' : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
              style={selectedMode === 'multi' ? { backgroundColor: 'var(--color-primary)' } : undefined}
            >
              Multi-Agent Mode
            </button>
          </div>

          <button
            onClick={openAddPresetModal}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-1.5 px-3 rounded-lg transition flex items-center gap-1 text-xs shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Create Preset
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-2 bg-[var(--bg-sidebar)] p-2 rounded-xl border border-[var(--border-color)]">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Search presets by name, ID, description, or model..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full bg-[var(--bg-card)] text-[var(--text-main)] placeholder-[var(--text-muted)] text-xs rounded-lg pl-8 pr-7 py-1.5 border border-[var(--border-color)] focus:outline-none focus:border-[var(--color-primary)] transition"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5 cursor-pointer"
              title="Clear search"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
        <span className="text-[11px] text-[var(--text-muted)] font-mono px-1">
          {filteredPresets.length} {filteredPresets.length === 1 ? 'preset' : 'presets'}
        </span>
      </div>

      {/* Preset List Cards */}
      {filteredPresets.length === 0 ? (
        <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-8 text-center space-y-2">
          <Cpu className="w-8 h-8 text-[var(--text-muted)] mx-auto opacity-50" />
          <p className="text-xs text-[var(--text-main)] font-medium">No matching model presets found</p>
          <p className="text-[11px] text-[var(--text-muted)]">
            Try adjusting your search query or clear the filter.
          </p>
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setCurrentPage(1);
              }}
              className="mt-2 px-3 py-1 bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] text-[var(--color-primary)] border border-[var(--border-color)] rounded-md text-xs font-medium transition cursor-pointer"
            >
              Clear Search
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {paginatedPresets.map(p => {
            const isActive = p.id.toLowerCase() === currentActiveId.toLowerCase() || p.name.toLowerCase() === currentActiveId.toLowerCase();
            const m = p.models || {};
            const mainConfig = selectedMode === 'multi' ? (m.master || m.superagent) : m.superagent;
            const subDefaultConfig = m.subagentDefault;
            const details = m.subagentDetails || {};

            return (
              <div
                key={p.id}
                className={`bg-[var(--bg-card)] border rounded-xl p-3.5 flex flex-col justify-between gap-3 transition-all ${
                  isActive ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/30 bg-[var(--color-primary-glow)]' : 'border-[var(--border-color)] hover:border-[var(--border-color)]'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu className={`w-4 h-4 ${isActive ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)]'}`} />
                      <span className="font-semibold text-[var(--text-main)] text-xs">{p.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => openEditPresetModal(p)}
                        className="px-2 py-1 rounded-md bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-main)] border border-[var(--border-color)] font-medium text-[11px] transition flex items-center gap-1 cursor-pointer"
                        title="Edit model preset configuration"
                      >
                        <Edit3 className="w-3 h-3 text-[var(--color-primary)]" />
                        <span>Edit</span>
                      </button>
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 font-medium">
                          <Check className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <button
                          onClick={() => onSelectPreset(selectedMode, p.id)}
                          className="px-2.5 py-1 rounded-md bg-[var(--bg-sidebar)] hover:bg-[var(--color-primary)] hover:text-white text-[var(--text-muted)] font-medium text-[11px] transition cursor-pointer border border-[var(--border-color)]"
                        >
                          Activate
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-[11px] text-[var(--text-muted)]">{p.description}</p>

                  {/* Structured Model Breakdown */}
                  <div className="bg-[var(--bg-sidebar)] p-2.5 rounded-lg border border-[var(--border-color)] font-mono text-[10px] space-y-1.5 text-[var(--text-main)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)] font-sans font-medium">Main Agent:</span>
                      <span className="text-[var(--color-primary)] font-semibold">{formatModelLabel(mainConfig)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[var(--text-muted)] font-sans font-medium">Subagent Default:</span>
                      <span className="text-[var(--text-main)]">{formatModelLabel(subDefaultConfig)}</span>
                    </div>

                    {Object.keys(details).length > 0 && (
                      <div className="pt-1.5 border-t border-[var(--border-color)] space-y-1">
                        <span className="text-[9px] text-[var(--text-muted)] uppercase tracking-wider font-sans font-semibold">Subagent Roles Overrides:</span>
                        {Object.entries(details).map(([roleName, roleConfig]) => (
                          <div key={roleName} className="flex items-center justify-between text-[10px] pl-1">
                            <span className="text-[var(--text-muted)] capitalize font-sans">{roleName}:</span>
                            <span className="text-emerald-400 font-semibold">{formatModelLabel(roleConfig)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)] text-[10px] text-[var(--text-muted)]">
                  <span>Preset ID: {p.id}</span>
                  {!['fast', 'standard', 'superagent-standard', 'superagent-master'].includes(p.id) && (
                    <button
                      onClick={() => onDeleteCustomPreset(selectedMode, p.id)}
                      className="text-rose-400 hover:text-rose-300 p-1 transition"
                      title="Delete preset"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {filteredPresets.length > 0 && (
        <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)] text-xs text-[var(--text-muted)]">
          <div>
            Showing <span className="font-semibold text-[var(--text-main)]">{(safePage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
            <span className="font-semibold text-[var(--text-main)]">{Math.min(safePage * ITEMS_PER_PAGE, filteredPresets.length)}</span> of{' '}
            <span className="font-semibold text-[var(--text-main)]">{filteredPresets.length}</span> presets
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                disabled={safePage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="p-1.5 rounded-md bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-main)] border border-[var(--border-color)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                title="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span className="text-[11px] font-mono font-medium px-2">
                Page {safePage} of {totalPages}
              </span>

              <button
                disabled={safePage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="p-1.5 rounded-md bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-main)] border border-[var(--border-color)] disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition"
                title="Next Page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Custom Preset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-[var(--text-main)]">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h4 className="font-semibold text-[var(--text-main)] text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[var(--color-primary)]" />
                Create Cross-Provider Model Preset ({selectedMode.toUpperCase()})
              </h4>
              <button onClick={() => setShowAddModal(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)]">
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePreset} className="space-y-4 overflow-y-auto flex-1 pr-1">
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
                      onChange={(e) => {
                        setMainProviderId(e.target.value);
                        if (e.target.value) fetchProviderModels(e.target.value, true);
                      }}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] text-xs outline-none focus:border-[var(--color-primary)]"
                    >
                      <option value="">-- Not Set (Use Global Active Profile) --</option>
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                      ))}
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
                        onClick={() => setIsMainModelCustom(!isMainModelCustom)}
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
                        onChange={(e) => setMainModel(e.target.value)}
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
                          } else {
                            setMainModel(e.target.value);
                          }
                        }}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] font-mono text-xs outline-none focus:border-[var(--color-primary)]"
                      >
                        <option value="">-- Not Set (Use Default Model) --</option>
                        {(providerModelsCache[mainProviderId] || ['gemini-2.5-flash', 'gpt-4o', 'claude-3-5-sonnet-20241022']).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                        <option value="__custom__">✏️ Custom Model (Type manual string)...</option>
                      </select>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 2: Subagent Default Config */}
              <div className="bg-[var(--bg-sidebar)] p-3.5 rounded-xl border border-[var(--border-color)] space-y-2.5">
                <div className="flex items-center gap-2 font-semibold text-[var(--text-main)] text-xs">
                  <Layers className="w-4 h-4 text-[var(--color-primary)]" />
                  <span>Subagent Default Model Config</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] text-[var(--text-muted)]">Provider Profile</label>
                      <button
                        type="button"
                        onClick={() => fetchProviderModels(subDefaultProviderId, true)}
                        className="text-[10px] text-[var(--color-primary)] hover:underline flex items-center gap-1 font-medium"
                        title="Fetch real models directly from provider API endpoint"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingModelsMap[subDefaultProviderId] ? 'animate-spin' : ''}`} />
                        <span>Fetch Live API</span>
                      </button>
                    </div>
                    <select
                      value={subDefaultProviderId}
                      onChange={(e) => {
                        setSubDefaultProviderId(e.target.value);
                        if (e.target.value) fetchProviderModels(e.target.value, true);
                      }}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] text-xs outline-none focus:border-[var(--color-primary)]"
                    >
                      <option value="">-- Not Set (Use Global Active Profile) --</option>
                      {providers.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                      ))}
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
                        onClick={() => setIsSubDefaultModelCustom(!isSubDefaultModelCustom)}
                        className="text-[10px] text-[var(--color-primary)] hover:underline flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>{isSubDefaultModelCustom ? 'Select from List' : 'Custom Input'}</span>
                      </button>
                    </div>

                    {isSubDefaultModelCustom ? (
                      <input
                        type="text"
                        value={subDefaultModel}
                        onChange={(e) => setSubDefaultModel(e.target.value)}
                        placeholder="Type custom subagent default model"
                        className="w-full bg-[var(--bg-card)] border border-[var(--color-primary)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] font-mono text-xs outline-none"
                        autoFocus
                      />
                    ) : (
                      <select
                        value={subDefaultModel}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsSubDefaultModelCustom(true);
                          } else {
                            setSubDefaultModel(e.target.value);
                          }
                        }}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] font-mono text-xs outline-none focus:border-[var(--color-primary)]"
                      >
                        <option value="">-- Not Set (Use Default Model) --</option>
                        {(providerModelsCache[subDefaultProviderId] || ['gemini-2.5-flash', 'gpt-4o-mini', 'claude-3-5-haiku-20241022']).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                        <option value="__custom__">✏️ Custom Model (Type manual string)...</option>
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
                                <option key={r.id} value={r.id}>{r.label}</option>
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
                              <option value="">-- Not Set (Inherit Default Profile) --</option>
                              {providers.map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                              ))}
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
                                  <option value="">-- Not Set (Use Default Model) --</option>
                                  {availModels.map(m => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                  <option value="__custom__">✏️ Custom Model...</option>
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
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)] font-medium text-xs cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium text-xs flex items-center gap-1.5 cursor-pointer transition shadow-xs"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save Preset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
