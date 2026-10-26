import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, Check, Cpu, RefreshCw, Edit3, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ProviderProfile } from './SuperAgentLoginManager';
import { SuperAgentPresetModal } from './SuperAgentPresetModal';

export interface ModelPreset {
  id: string;
  name: string;
  description: string;
  models: Record<string, { providerProfileId: string; model: string } | string | any>;
}

export interface SubagentRoleOverride {
  role: string;
  providerProfileId: string;
  model: string;
  isCustomModel?: boolean;
}

export const COMMON_SUBAGENT_ROLES = [
  { id: 'coder', label: 'Coder (Coding & Refactoring)' },
  { id: 'researcher', label: 'Researcher (Search & Docs)' },
  { id: 'vision', label: 'Vision (Image Analysis & UI)' },
  { id: 'planner', label: 'Planner (Architecture & Tasks)' },
  { id: 'auditor', label: 'Auditor (Code Audit & Security)' },
  { id: 'writer', label: 'Writer (Documentation & Copy)' },
  { id: 'browser', label: 'Browser (Web Automation)' },
  { id: 'tester', label: 'Tester (QA & Unit Testing)' }
];

interface SuperAgentPresetManagerProps {
  presets: { single: ModelPreset[]; multi: ModelPreset[] };
  activePresetId: { single: string; multi: string };
  agentMode: 'single' | 'multi';
  providers: ProviderProfile[];
  onSelectPreset: (mode: 'single' | 'multi', presetId: string) => Promise<void>;
  onSaveCustomPreset: (mode: 'single' | 'multi', preset: { id: string; name: string; description?: string; models: any }) => Promise<void>;
  onDeleteCustomPreset: (mode: 'single' | 'multi', presetId: string) => Promise<void>;
}

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
  const [editingPreset, setEditingPreset] = useState<ModelPreset | null>(null);

  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 6;

  // Provider Models Cache & Status
  const [providerModelsCache, setProviderModelsCache] = useState<Record<string, string[]>>({});
  const [loadingModelsMap, setLoadingModelsMap] = useState<Record<string, boolean>>({});
  const [providerFetchStatus, setProviderFetchStatus] = useState<Record<string, { isRealFetched: boolean; error?: string; count?: number }>>({});

  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [toastNotification, setToastNotification] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

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

  const openAddPresetModal = () => {
    setEditingPreset(null);
    setShowAddModal(true);
  };

  const openEditPresetModal = (p: ModelPreset) => {
    setEditingPreset(p);
    setShowAddModal(true);
  };

  const handleDeletePreset = async (preset: ModelPreset) => {
    if (deletingPresetId) return;
    setDeletingPresetId(preset.id);
    try {
      await onDeleteCustomPreset(selectedMode, preset.id);

      const msg = `Model preset "${preset.name}" (${preset.id}) deleted successfully`;
      window.dispatchEvent(new CustomEvent('tline-toast', { detail: { message: msg } }));
      setToastNotification({ text: msg, type: 'success' });
      setTimeout(() => setToastNotification(null), 4000);
    } catch (e: any) {
      console.error('Failed to delete preset:', e);
      const errMsg = e.message || `Failed to delete preset "${preset.name}"`;
      window.dispatchEvent(new CustomEvent('tline-toast', { detail: { message: errMsg } }));
      setToastNotification({ text: errMsg, type: 'error' });
      setTimeout(() => setToastNotification(null), 4000);
    } finally {
      setDeletingPresetId(null);
    }
  };

  const getProviderName = (pId: string) => {
    if (!pId) return 'Global Active Profile';
    const match = providers.find(p => p.id === pId);
    return match ? match.name : pId;
  };

  const formatModelLabel = (modelConfig: any) => {
    if (!modelConfig) return 'Not Set';
    if (typeof modelConfig === 'string') return modelConfig || 'Not Set';
    const modelName = modelConfig.model || 'Not Set';
    const providerName = getProviderName(modelConfig.providerProfileId);
    return `${providerName} → ${modelName}`;
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
                selectedMode === 'single'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Single Agent Mode
            </button>
            <button
              onClick={() => setSelectedMode('multi')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition ${
                selectedMode === 'multi'
                  ? 'bg-[var(--color-primary)] text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Multi Agent Mode
            </button>
          </div>

          <button
            onClick={openAddPresetModal}
            className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-1.5 px-3 rounded-lg transition flex items-center gap-1 text-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Create Preset
          </button>
        </div>
      </div>

      {/* Toast Notification Banner */}
      {toastNotification && (
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium transition-all animate-in fade-in zoom-in-95 duration-150 ${
          toastNotification.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
        }`}>
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{toastNotification.text}</span>
          </div>
          <button onClick={() => setToastNotification(null)} className="text-[11px] opacity-70 hover:opacity-100 cursor-pointer">✕</button>
        </div>
      )}

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {paginatedPresets.map(p => {
            const isActive = p.id === currentActiveId;
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
                      disabled={deletingPresetId === p.id}
                      onClick={() => handleDeletePreset(p)}
                      className="text-rose-400 hover:text-rose-300 px-2 py-1 rounded-md hover:bg-rose-500/10 transition disabled:opacity-50 cursor-pointer flex items-center gap-1 font-medium"
                      title={`Delete preset "${p.name}"`}
                    >
                      {deletingPresetId === p.id ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin text-rose-400" />
                          <span className="text-[10px] text-rose-400">Deleting...</span>
                        </>
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
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

      {/* Add / Edit Custom Preset Modal */}
      <SuperAgentPresetModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        editingPreset={editingPreset}
        selectedMode={selectedMode}
        providers={providers}
        onSavePreset={async (mode, preset) => {
          await onSaveCustomPreset(mode, preset);
          const savedMsg = `Model preset "${preset.name}" saved successfully`;
          window.dispatchEvent(new CustomEvent('tline-toast', { detail: { message: savedMsg } }));
          setToastNotification({ text: savedMsg, type: 'success' });
          setTimeout(() => setToastNotification(null), 4000);
        }}
        providerModelsCache={providerModelsCache}
        providerFetchStatus={providerFetchStatus}
        loadingModelsMap={loadingModelsMap}
        fetchProviderModels={fetchProviderModels}
      />
    </div>
  );
};
