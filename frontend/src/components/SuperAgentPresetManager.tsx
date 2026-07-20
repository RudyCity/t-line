import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, Check, Cpu, RefreshCw } from 'lucide-react';
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
  onSelectPreset: (presetId: string) => Promise<void>;
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

  // Custom Preset Form State
  const [presetName, setPresetName] = useState('');
  const [presetDesc, setPresetDesc] = useState('');
  const [superagentModel, setSuperagentModel] = useState('gemini-2.5-flash');
  const [subagentDefaultModel, setSubagentDefaultModel] = useState('gemini-2.5-flash');
  const [providerProfileId, setProviderProfileId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentPresets = presets[selectedMode] || [];
  const currentActiveId = activePresetId[selectedMode] || '';

  const handleSavePreset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;

    setIsSubmitting(true);
    try {
      const pProfile = providerProfileId || providers[0]?.id || '';
      const modelsObj: any = {
        superagent: { providerProfileId: pProfile, model: superagentModel.trim() },
        subagentDefault: { providerProfileId: pProfile, model: subagentDefaultModel.trim() }
      };

      if (selectedMode === 'multi') {
        modelsObj.master = { providerProfileId: pProfile, model: superagentModel.trim() };
      }

      await onSaveCustomPreset(selectedMode, {
        id: presetName.toLowerCase().replace(/\s+/g, '-'),
        name: presetName.trim(),
        description: presetDesc.trim() || 'Custom model preset.',
        models: modelsObj
      });
      setShowAddModal(false);
      setPresetName('');
      setPresetDesc('');
    } catch (e) {
      console.error('Failed to save preset:', e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getModelSummary = (p: ModelPreset) => {
    const m = p.models;
    if (!m) return 'Default Models';
    const main = m.master?.model || m.superagent?.model || m.MODEL || m.MODEL_SINGLE || 'Default';
    const sub = m.subagentDefault?.model || m.MODEL_SINGLE_SUBAGENT || 'Default';
    return `Main: ${typeof main === 'object' ? main.model : main} | Subagent: ${typeof sub === 'object' ? sub.model : sub}`;
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* Top Controls & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#121622] p-3.5 rounded-xl border border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-700/50 text-indigo-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-zinc-100 text-xs">Model Presets Manager</h3>
            <p className="text-[11px] text-zinc-400">Select or create model configurations for Single & Multi-Agent modes</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mode Switch Tabs */}
          <div className="bg-[#090c14] p-1 rounded-lg border border-zinc-800 flex items-center gap-1">
            <button
              onClick={() => setSelectedMode('single')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition ${
                selectedMode === 'single' ? 'bg-indigo-600 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Single Agent Mode
            </button>
            <button
              onClick={() => setSelectedMode('multi')}
              className={`px-3 py-1 rounded-md text-[11px] font-medium transition ${
                selectedMode === 'multi' ? 'bg-indigo-600 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Multi-Agent Mode
            </button>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-1.5 px-3 rounded-lg transition flex items-center gap-1 text-xs shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Create Preset
          </button>
        </div>
      </div>

      {/* Preset List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {currentPresets.map(p => {
          const isActive = p.id.toLowerCase() === currentActiveId.toLowerCase() || p.name.toLowerCase() === currentActiveId.toLowerCase();

          return (
            <div
              key={p.id}
              className={`bg-[#090c14] border rounded-xl p-3.5 flex flex-col justify-between gap-3 transition-all ${
                isActive ? 'border-indigo-500/80 ring-1 ring-indigo-500/30 bg-[#0c101d]' : 'border-zinc-800/80 hover:border-zinc-700/80'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                    <span className="font-semibold text-zinc-100 text-xs">{p.name}</span>
                  </div>
                  {isActive ? (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 font-medium">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  ) : (
                    <button
                      onClick={() => onSelectPreset(p.id)}
                      className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-indigo-600 hover:text-white text-zinc-300 font-medium text-[11px] transition"
                    >
                      Activate
                    </button>
                  )}
                </div>

                <p className="text-[11px] text-zinc-400">{p.description}</p>
                <div className="bg-[#121622] p-2 rounded-lg border border-zinc-800/60 font-mono text-[10px] text-zinc-300">
                  {getModelSummary(p)}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500">
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

      {/* Add Custom Preset Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[#0d111c] border border-zinc-800 rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-3">
              <h4 className="font-semibold text-zinc-100 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                Create Custom Model Preset ({selectedMode.toUpperCase()})
              </h4>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePreset} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-300">Preset Name</label>
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="e.g. Claude 3.5 Sonnet Heavy"
                  className="w-full bg-[#121622] border border-zinc-700/60 rounded-lg px-3 py-2 text-zinc-200 text-xs outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-300">Description</label>
                <input
                  type="text"
                  value={presetDesc}
                  onChange={(e) => setPresetDesc(e.target.value)}
                  placeholder="High accuracy preset with subagent vision support"
                  className="w-full bg-[#121622] border border-zinc-700/60 rounded-lg px-3 py-2 text-zinc-200 text-xs outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-300">Provider Profile</label>
                <select
                  value={providerProfileId}
                  onChange={(e) => setProviderProfileId(e.target.value)}
                  className="w-full bg-[#121622] border border-zinc-700/60 rounded-lg px-3 py-2 text-zinc-200 text-xs outline-none focus:border-indigo-500"
                >
                  <option value="">Default Active Profile</option>
                  {providers.map(pr => (
                    <option key={pr.id} value={pr.id}>{pr.name} ({pr.type})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-300">Main SuperAgent Model</label>
                <input
                  type="text"
                  value={superagentModel}
                  onChange={(e) => setSuperagentModel(e.target.value)}
                  placeholder="gemini-2.5-flash or gpt-4o"
                  className="w-full bg-[#121622] border border-zinc-700/60 rounded-lg px-3 py-2 text-zinc-200 font-mono text-xs outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-zinc-300">Subagent Default Model</label>
                <input
                  type="text"
                  value={subagentDefaultModel}
                  onChange={(e) => setSubagentDefaultModel(e.target.value)}
                  placeholder="gemini-2.5-flash or claude-3-5-haiku"
                  className="w-full bg-[#121622] border border-zinc-700/60 rounded-lg px-3 py-2 text-zinc-200 font-mono text-xs outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5"
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
