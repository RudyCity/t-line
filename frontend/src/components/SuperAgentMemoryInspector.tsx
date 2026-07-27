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
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 rounded-lg border border-slate-800 p-4 font-sans text-sm relative">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-base">SuperAgent Memory Inspector</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenAddModal}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-md text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Memori
          </button>
          <button
            onClick={() => fetchMemories()}
            disabled={loading}
            className="p-1.5 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-slate-200"
            title="Refresh memory"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 my-3">
        <button
          onClick={() => setActiveTab('l1')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'l1' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Atomic RMemory (L1/L2) ({memories.length})
        </button>
        <button
          onClick={() => setActiveTab('shared')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'shared' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Shared Memory ({sharedMemories.length})
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari memori, preferensi, atau instruksi (auto-search)..."
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-xs">Memuat memori...</div>
        ) : error ? (
          <div className="text-center py-8 text-rose-400 text-xs">{error}</div>
        ) : currentList.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">Tidak ada memori terstruktur ditemukan</div>
        ) : (
          currentList.map((m, idx) => {
            const itemId = m.id || m.key || `mem-${idx}`;
            const displayContent = m.content || m.value || '';
            return (
              <div key={itemId} className="p-3 bg-slate-950 border border-slate-800/80 hover:border-slate-700/80 transition-colors rounded-md flex flex-col gap-1.5 group">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-purple-300">{itemId}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                      m.scope === 'global' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800/50' : 'bg-slate-800 text-slate-300'
                    }`}>
                      {m.scope || 'project'}
                    </span>
                    {m.type && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-950/80 text-purple-400 border border-purple-800/40 flex items-center gap-1 font-mono">
                        <Tag className="w-2.5 h-2.5" />
                        {m.type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleOpenEditModal(m)}
                      className="p-1 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
                      title="Edit memori"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteMemory(itemId)}
                      disabled={deletingId === itemId}
                      className="p-1 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 rounded"
                      title="Hapus memori"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="text-xs text-slate-300 whitespace-pre-wrap font-sans bg-slate-900/60 p-2 rounded border border-slate-800/40">
                  {displayContent}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Add / Edit Memory */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-lg w-full max-w-md p-4 shadow-2xl flex flex-col gap-3 font-sans">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h4 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                <Brain className="w-4 h-4 text-purple-400" />
                {editingItem ? 'Edit Memori' : 'Tambah Memori Baru'}
              </h4>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              <div>
                <label className="text-xs text-slate-400 block mb-1">ID / Key Memori</label>
                <input
                  type="text"
                  value={formId}
                  disabled={!!editingItem}
                  onChange={(e) => setFormId(e.target.value)}
                  placeholder="e.g. project-framework, user-preference-theme"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50 disabled:opacity-50 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Scope</label>
                  <select
                    value={formScope}
                    onChange={(e) => setFormScope(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="project">Project (Workspace)</option>
                    <option value="global">Global (Universal)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Kategori / Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
                  >
                    <option value="fact">Fact</option>
                    <option value="preference">Preference</option>
                    <option value="context">Context</option>
                    <option value="decision">Decision</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1">Isi / Konten Memori</label>
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  rows={4}
                  placeholder="Tulis fakta, aturan codebase, atau preferensi yang harus diingat agen..."
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSaveMemory}
                disabled={saving}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded text-xs font-medium transition-colors flex items-center gap-1"
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
