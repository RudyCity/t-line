import React, { useState, useEffect, useRef } from 'react';
import { Database, Search, Brain, Globe, RefreshCw, Plus, Trash2, Edit3, X, Check, Tag } from 'lucide-react';

interface MemoryItem {
  id: string;
  content: string;
  scope?: 'project' | 'global';
  type?: string;
  key?: string;
  value?: string;
}

interface SuperAgentMemoryInspectorProps {
  workspacePath: string;
  token?: string;
  getAuthHeader?: () => Record<string, string>;
}

export const SuperAgentMemoryInspector: React.FC<SuperAgentMemoryInspectorProps> = ({ workspacePath, token, getAuthHeader }) => {
  const [activeTab, setActiveTab] = useState<'l1' | 'shared'>('l1');
  const [searchQuery, setSearchQuery] = useState('');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [sharedMemories, setSharedMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MemoryItem | null>(null);
  const [formId, setFormId] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formScope, setFormScope] = useState<'project' | 'global'>('project');
  const [formType, setFormType] = useState('fact');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const searchTimeoutRef = useRef<any>(null);

  const getHeaders = () => {
    const headers: Record<string, string> = {
      ...(getAuthHeader ? getAuthHeader() : {}),
      'Content-Type': 'application/json'
    };
    if (token && !headers['Authorization']) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  const fetchMemories = async (query = searchQuery) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/superagent/memory/search?workspace=${encodeURIComponent(workspacePath)}&query=${encodeURIComponent(query)}&scope=all`,
        { headers: getHeaders() }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMemories(data.memory || []);
      setSharedMemories(data.sharedMemory || []);
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data memori');
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      fetchMemories(searchQuery);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery, workspacePath, activeTab]);

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormId('');
    setFormContent('');
    setFormScope('project');
    setFormType('fact');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: MemoryItem) => {
    setEditingItem(item);
    setFormId(item.id || item.key || '');
    setFormContent(item.content || item.value || '');
    setFormScope(item.scope || 'project');
    setFormType(item.type || 'fact');
    setIsModalOpen(true);
  };

  const handleSaveMemory = async () => {
    if (!formId.trim() || !formContent.trim()) {
      alert('ID/Key dan Konten memori wajib diisi.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/superagent/memory/save?workspace=${encodeURIComponent(workspacePath)}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          id: formId.trim(),
          key: formId.trim(),
          content: formContent.trim(),
          value: formContent.trim(),
          scope: formScope,
          type: formType
        })
      });
      if (!res.ok) throw new Error(`Gagal menyimpan memori (${res.status})`);
      setIsModalOpen(false);
      fetchMemories();
    } catch (err: any) {
      alert(err.message || 'Gagal menyimpan memori');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    if (!confirm(`Hapus memori "${id}"?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/superagent/memory/delete?workspace=${encodeURIComponent(workspacePath)}`, {
        method: 'DELETE',
        headers: getHeaders(),
        body: JSON.stringify({ id, key: id })
      });
      if (!res.ok) throw new Error(`Gagal menghapus memori (${res.status})`);
      fetchMemories();
    } catch (err: any) {
      alert(err.message || 'Gagal menghapus memori');
    } finally {
      setDeletingId(null);
    }
  };

  const currentList = activeTab === 'l1' ? memories : sharedMemories;

  return (
    <div className="flex flex-col h-full font-sans text-sm relative">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[var(--color-primary)]" />
          <h3 className="font-semibold text-[var(--text-main)] text-xs">SuperAgent Memory Inspector</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg text-xs font-medium transition-colors shadow-sm shadow-[var(--color-primary-glow)]/10"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Memori
          </button>
          <button
            onClick={() => fetchMemories()}
            disabled={loading}
            className="p-1.5 hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-main)]"
            title="Refresh memory"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 my-3">
        <button
          onClick={() => setActiveTab('l1')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            activeTab === 'l1' 
              ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary-hover)] border-[var(--color-primary)]/30' 
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:bg-[var(--bg-card-hover)]'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Atomic RMemory (L1/L2) ({memories.length})
        </button>
        <button
          onClick={() => setActiveTab('shared')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            activeTab === 'shared' 
              ? 'bg-[var(--color-primary)]/10 text-[var(--color-primary-hover)] border-[var(--color-primary)]/30' 
              : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:bg-[var(--bg-card-hover)]'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Shared Memory ({sharedMemories.length})
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-[var(--text-muted)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari memori, preferensi, atau instruksi (auto-search)..."
            className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/30 transition"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <div className="text-center py-8 text-[var(--text-muted)] text-xs">Memuat memori...</div>
        ) : error ? (
          <div className="text-center py-8 text-[var(--color-danger)] text-xs">{error}</div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)] text-xs">Tidak ada memori terstruktur ditemukan</div>
        ) : (
          currentList.map((m, idx) => {
            const itemId = m.id || m.key || `mem-${idx}`;
            const displayContent = m.content || m.value || '';
            return (
              <div key={itemId} className="p-3 bg-[var(--bg-sidebar)] border border-[var(--border-color)] hover:border-[var(--color-primary)]/20 transition-colors rounded-xl flex flex-col gap-1.5 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-[var(--color-primary-hover)]">{itemId}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium border ${
                      m.scope === 'global' ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30' : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)]'
                    }`}>
                      {m.scope || 'project'}
                    </span>
                    {m.type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-primary)]/10 text-[var(--color-primary-hover)] border border-[var(--color-primary)]/20 flex items-center gap-1 font-mono">
                        <Tag className="w-2.5 h-2.5" />
                        {m.type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEditModal(m)}
                      className="p-1 hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded transition-colors"
                      title="Edit memori"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMemory(itemId)}
                      disabled={deletingId === itemId}
                      className="p-1 hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-400 rounded transition-colors"
                      title="Hapus memori"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-[var(--text-main)] whitespace-pre-wrap font-sans bg-[var(--bg-card)] p-2.5 rounded-lg border border-[var(--border-color)]">
                  {displayContent}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add / Edit Memory */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[var(--bg-main)] border border-[var(--border-color)] rounded-xl w-full max-w-md p-5 shadow-2xl flex flex-col gap-4 font-sans">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <h4 className="font-semibold text-sm text-[var(--text-main)] flex items-center gap-2">
                <Brain className="w-4 h-4 text-[var(--color-primary)]" />
                {editingItem ? 'Edit Memori' : 'Tambah Memori Baru'}
              </h4>
              <button onClick={() => setIsModalOpen(false)} className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="text-[11px] text-[var(--text-muted)] block mb-1">ID / Key Memori</label>
                <input
                  type="text"
                  value={formId}
                  disabled={!!editingItem}
                  onChange={(e) => setFormId(e.target.value)}
                  placeholder="e.g. project-framework, user-preference-theme"
                  className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/30 disabled:opacity-50 font-mono transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-[var(--text-muted)] block mb-1">Scope</label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as any)}
                    className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]/50 transition"
                  >
                    <option value="project">Project (Workspace)</option>
                    <option value="global">Global (Universal)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-[var(--text-muted)] block mb-1">Kategori / Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]/50 transition"
                  >
                    <option value="fact">Fact</option>
                    <option value="preference">Preference</option>
                    <option value="context">Context</option>
                    <option value="decision">Decision</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[11px] text-[var(--text-muted)] block mb-1">Isi / Konten Memori</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={4}
                  placeholder="Tulis fakta, aturan codebase, atau preferensi yang harus diingat agen..."
                  className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)]/50 focus:ring-1 focus:ring-[var(--color-primary)]/30 resize-none transition"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg text-xs transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveMemory}
                disabled={saving}
                className="px-3 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 shadow-sm shadow-[var(--color-primary-glow)]/10"
              >
                <Check className="w-3.5 h-3.5" />
                {saving ? 'Menyimpan...' : 'Simpan Memori'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
