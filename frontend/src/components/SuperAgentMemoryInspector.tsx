import React, { useState, useEffect } from 'react';
import { Database, Search, Brain, Globe, RefreshCw } from 'lucide-react';

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
}

export const SuperAgentMemoryInspector: React.FC<SuperAgentMemoryInspectorProps> = ({ workspacePath, token }) => {
  const [activeTab, setActiveTab] = useState<'l1' | 'shared'>('l1');
  const [searchQuery, setSearchQuery] = useState('');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [sharedMemories, setSharedMemories] = useState<MemoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(
        `/api/superagent/memory?workspace=${encodeURIComponent(workspacePath)}&query=${encodeURIComponent(searchQuery)}&scope=all`,
        { headers }
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

  useEffect(() => {
    fetchMemories();
  }, [workspacePath, activeTab]);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 rounded-lg border border-slate-800 p-4 font-sans text-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          <h3 className="font-semibold text-base">SuperAgent Memory Inspector</h3>
        </div>
        <button
          onClick={fetchMemories}
          disabled={loading}
          className="p-1.5 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-slate-200"
          title="Refresh memory"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex gap-2 my-3">
        <button
          onClick={() => setActiveTab('l1')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'l1' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          Atomic RMemory (L1/L2)
        </button>
        <button
          onClick={() => setActiveTab('shared')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            activeTab === 'shared' ? 'bg-purple-600/30 text-purple-300 border border-purple-500/40' : 'bg-slate-800/60 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          Shared Memory
        </button>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchMemories()}
            placeholder="Cari memori atau preferensi..."
            className="w-full bg-slate-950 border border-slate-800 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-xs">Memuat memori...</div>
        ) : error ? (
          <div className="text-center py-8 text-rose-400 text-xs">{error}</div>
        ) : activeTab === 'l1' ? (
          memories.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">Tidak ada memori terstruktur ditemukan</div>
          ) : (
            memories.map((m) => (
              <div key={m.id} className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-md flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-purple-300">{m.id}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">{m.scope || 'project'}</span>
                </div>
                <p className="text-xs text-slate-300">{m.content}</p>
              </div>
            ))
          )
        ) : (
          sharedMemories.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs">Tidak ada shared memory ditemukan</div>
          ) : (
            sharedMemories.map((sm, idx) => (
              <div key={sm.key || idx} className="p-2.5 bg-slate-950 border border-slate-800/80 rounded-md flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-semibold text-amber-300">{sm.key}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 border border-amber-800/50 font-mono">shared</span>
                </div>
                <p className="text-xs text-slate-300">{sm.value || sm.content}</p>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};
