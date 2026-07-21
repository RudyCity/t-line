import React, { useState } from 'react';
import { Key, Server, Plus, Trash2, Check, Eye, EyeOff, ShieldCheck, Cpu, ExternalLink, RefreshCw, Edit3 } from 'lucide-react';

export interface ProviderProfile {
  id: string;
  name: string;
  type: string;
  apiKey: string;
  baseUrl?: string;
  models?: any;
}

interface SuperAgentLoginManagerProps {
  providers: ProviderProfile[];
  activeProviderId: string;
  onSaveProvider: (provider: ProviderProfile) => Promise<void>;
  onDeleteProvider: (id: string) => Promise<void>;
  onSetActiveProvider: (id: string) => Promise<void>;
  getAuthHeader: () => Record<string, string>;
}

const PROVIDER_TYPES = [
  { id: 'openai', name: 'OpenAI', defaultBaseUrl: 'https://api.openai.com/v1', docs: 'https://platform.openai.com/api-keys' },
  { id: 'anthropic', name: 'Anthropic (Claude)', defaultBaseUrl: 'https://api.anthropic.com/v1', docs: 'https://console.anthropic.com/' },
  { id: 'gemini', name: 'Google Gemini', defaultBaseUrl: 'https://generativelanguage.googleapis.com', docs: 'https://aistudio.google.com/app/apikey' },
  { id: 'deepseek', name: 'DeepSeek AI', defaultBaseUrl: 'https://api.deepseek.com/v1', docs: 'https://platform.deepseek.com/' },
  { id: 'openrouter', name: 'OpenRouter', defaultBaseUrl: 'https://openrouter.ai/api/v1', docs: 'https://openrouter.ai/keys' },
  { id: 'groq', name: 'Groq', defaultBaseUrl: 'https://api.groq.com/openai/v1', docs: 'https://console.groq.com/keys' },
  { id: 'mistral', name: 'Mistral AI', defaultBaseUrl: 'https://api.mistral.ai/v1', docs: 'https://console.mistral.ai/' },
  { id: 'ollama', name: 'Ollama (Local LLM)', defaultBaseUrl: 'http://localhost:11434', docs: 'https://ollama.com/' },
  { id: 'azure', name: 'Azure OpenAI', defaultBaseUrl: 'https://<your-resource>.openai.azure.com', docs: 'https://portal.azure.com/' },
  { id: 'custom', name: 'Custom HTTP / Compatible REST API', defaultBaseUrl: '', docs: '' }
];

export const SuperAgentLoginManager: React.FC<SuperAgentLoginManagerProps> = ({
  providers,
  activeProviderId,
  onSaveProvider,
  onDeleteProvider,
  onSetActiveProvider
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showApiKeyMap, setShowApiKeyMap] = useState<Record<string, boolean>>({});

  // Form State
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState('openai');
  const [formApiKey, setFormApiKey] = useState('');
  const [formBaseUrl, setFormBaseUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const openAddForm = () => {
    setEditingId(null);
    setFormName('OpenAI Account');
    setFormType('openai');
    setFormApiKey('');
    setFormBaseUrl('https://api.openai.com/v1');
    setErrorMessage('');
    setShowAddModal(true);
  };

  const openEditForm = (p: ProviderProfile) => {
    setEditingId(p.id);
    setFormName(p.name);
    setFormType(p.type);
    setFormApiKey(p.apiKey || '');
    setFormBaseUrl(p.baseUrl || '');
    setErrorMessage('');
    setShowAddModal(true);
  };

  const handleTypeChange = (type: string) => {
    setFormType(type);
    const meta = PROVIDER_TYPES.find(t => t.id === type);
    if (meta && meta.defaultBaseUrl && !formBaseUrl) {
      setFormBaseUrl(meta.defaultBaseUrl);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setErrorMessage('Provider Profile Name is required.');
      return;
    }

    const profileId = editingId || `${formType}-${Date.now().toString(36)}`;
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await onSaveProvider({
        id: profileId,
        name: formName.trim(),
        type: formType,
        apiKey: formApiKey.trim(),
        baseUrl: formBaseUrl.trim()
      });
      setShowAddModal(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save provider credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleShowApiKey = (id: string) => {
    setShowApiKeyMap(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskApiKey = (key: string) => {
    if (!key) return 'No API Key configured';
    if (key.length <= 8) return '••••••••';
    return `${key.slice(0, 4)}••••••••${key.slice(-4)}`;
  };

  return (
    <div className="space-y-4 text-xs font-sans">
      {/* Top Banner */}
      <div className="flex items-center justify-between bg-[var(--bg-card)] p-3.5 rounded-xl border border-[var(--border-color)] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/50 text-[var(--color-primary)]">
            <Key className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-main)] text-xs">LLM Provider Credentials & Management Login</h3>
            <p className="text-[11px] text-[var(--text-muted)]">Manage API Keys and authentication profiles for SuperAgent models</p>
          </div>
        </div>
        <button
          onClick={openAddForm}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium py-1.5 px-3 rounded-lg transition flex items-center gap-1.5 text-xs shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Provider Profile
        </button>
      </div>

      {/* Provider Profiles List */}
      <div className="space-y-2.5">
        {providers.length === 0 ? (
          <div className="bg-[var(--bg-sidebar)] border border-dashed border-[var(--border-color)] rounded-xl p-6 text-center space-y-2">
            <Server className="w-8 h-8 text-[var(--text-muted)] mx-auto" />
            <p className="text-[var(--text-main)] font-medium text-xs">No Provider Profiles Configured</p>
            <p className="text-[11px] text-[var(--text-muted)] max-w-md mx-auto">
              Add your API credentials (OpenAI, Anthropic, Gemini, DeepSeek, Ollama, etc.) to enable SuperAgent to communicate with your AI models.
            </p>
            <button
              onClick={openAddForm}
              className="mt-2 inline-flex items-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white px-3 py-1.5 rounded-md text-xs font-medium transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Configure First Provider
            </button>
          </div>
        ) : (
          providers.map(p => {
            const isActive = p.id === activeProviderId;
            const meta = PROVIDER_TYPES.find(t => t.id === p.type);
            const isVisible = !!showApiKeyMap[p.id];

            return (
              <div
                key={p.id}
                className={`bg-[var(--bg-card)] border rounded-xl p-3.5 transition-all flex flex-col gap-2.5 ${
                  isActive ? 'border-[var(--color-primary)] ring-1 ring-[var(--color-primary)]/30 bg-[var(--color-primary-glow)]' : 'border-[var(--border-color)] hover:border-[var(--border-color)]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-md ${isActive ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/40' : 'bg-[var(--bg-sidebar)] text-[var(--text-muted)]'}`}>
                      <Cpu className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[var(--text-main)] text-xs">{p.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--bg-sidebar)] text-[var(--text-muted)] border border-[var(--border-color)] uppercase font-mono tracking-wider">
                          {meta?.name || p.type}
                        </span>
                        {isActive && (
                          <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-700/50 font-medium">
                            <Check className="w-3 h-3" /> Active Profile
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-[var(--text-muted)] font-mono truncate max-w-md mt-0.5">
                        Base URL: {p.baseUrl || meta?.defaultBaseUrl || 'Default'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isActive && (
                      <button
                        onClick={() => onSetActiveProvider(p.id)}
                        className="px-2.5 py-1 rounded-md bg-[var(--bg-sidebar)] hover:bg-[var(--color-primary)] hover:text-white text-[var(--text-muted)] font-medium text-[11px] transition flex items-center gap-1 border border-[var(--border-color)]"
                        title="Set as Active Provider Profile"
                      >
                        <ShieldCheck className="w-3.5 h-3.5 text-[var(--color-primary)] group-hover:text-white" />
                        Set Active
                      </button>
                    )}
                    <button
                      onClick={() => openEditForm(p)}
                      className="px-2.5 py-1 rounded-md bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-main)] font-medium text-[11px] transition flex items-center gap-1 cursor-pointer border border-[var(--border-color)]"
                      title="Edit provider profile & credentials"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[var(--color-primary)]" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => onDeleteProvider(p.id)}
                      className="p-1.5 rounded-md text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition"
                      title="Delete profile"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* API Key Details bar */}
                <div className="flex items-center justify-between bg-[var(--bg-sidebar)] px-3 py-1.5 rounded-lg border border-[var(--border-color)] font-mono text-[11px]">
                  <div className="flex items-center gap-2 text-[var(--text-muted)] truncate">
                    <Key className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                    <span>API Key:</span>
                    <span className="text-[var(--text-main)] select-all">
                      {isVisible ? (p.apiKey || 'None configured') : maskApiKey(p.apiKey)}
                    </span>
                  </div>
                  {p.apiKey && (
                    <button
                      onClick={() => toggleShowApiKey(p.id)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-main)] text-[10px] flex items-center gap-1 font-sans shrink-0 ml-2"
                    >
                      {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {isVisible ? 'Hide' : 'Show'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Provider Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-2xl w-full max-w-md p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 text-[var(--text-main)]">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h4 className="font-semibold text-[var(--text-main)] text-sm flex items-center gap-2">
                <Key className="w-4 h-4 text-[var(--color-primary)]" />
                {editingId ? 'Edit Provider Profile' : 'Add New Provider Profile'}
              </h4>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-500 text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--text-muted)]">Provider Type</label>
                <select
                  value={formType}
                  onChange={(e) => handleTypeChange(e.target.value)}
                  className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-main)] text-xs outline-none focus:border-[var(--color-primary)]"
                >
                  {PROVIDER_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--text-muted)]">Profile Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Work OpenAI Account"
                  className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-main)] text-xs outline-none focus:border-[var(--color-primary)]"
                  required
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-medium text-[var(--text-muted)]">API Key / Secret Token</label>
                  {PROVIDER_TYPES.find(t => t.id === formType)?.docs && (
                    <a
                      href={PROVIDER_TYPES.find(t => t.id === formType)?.docs}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-[var(--color-primary)] hover:underline flex items-center gap-0.5"
                    >
                      Get API Key <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
                <input
                  type="password"
                  value={formApiKey}
                  onChange={(e) => setFormApiKey(e.target.value)}
                  placeholder={formType === 'ollama' ? 'Optional for local Ollama' : 'sk-...'}
                  className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-main)] font-mono text-xs outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-[var(--text-muted)]">Base API URL (Optional)</label>
                <input
                  type="text"
                  value={formBaseUrl}
                  onChange={(e) => setFormBaseUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-main)] font-mono text-xs outline-none focus:border-[var(--color-primary)]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-[var(--bg-sidebar)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-medium text-xs transition border border-[var(--border-color)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-lg bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium text-xs transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {editingId ? 'Update Credentials' : 'Save Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
