import React, { useState, useEffect } from 'react';
import { Sparkles, BookOpen, RefreshCw } from 'lucide-react';

interface SkillItem {
  name: string;
  description: string;
  author?: string;
  path?: string;
}

interface SkillMarketplaceInspectorProps {
  workspacePath: string;
  token?: string;
  getAuthHeader?: () => Record<string, string>;
}

export const SkillMarketplaceInspector: React.FC<SkillMarketplaceInspectorProps> = ({ workspacePath, token, getAuthHeader }) => {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = {
        ...(getAuthHeader ? getAuthHeader() : {})
      };
      if (token && !headers['Authorization']) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/superagent/skills/detail?workspace=${encodeURIComponent(workspacePath)}`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error && (!data.skills || data.skills.length === 0)) {
        setError(data.error);
        setSkills([]);
      } else {
        setSkills(Array.isArray(data.skills) ? data.skills : (Array.isArray(data) ? data : []));
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat daftar skill SuperAgent');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
  }, [workspacePath]);

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100 rounded-lg border border-slate-800 p-4 font-sans text-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-base">SuperAgent Skill Inspector</h3>
        </div>
        <button
          onClick={fetchSkills}
          disabled={loading}
          className="p-1.5 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-slate-200"
          title="Reload skills"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 my-3 pr-1">
        {loading ? (
          <div className="text-center py-8 text-slate-500 text-xs">Memuat daftar skill...</div>
        ) : error ? (
          <div className="text-center py-8 text-rose-400 text-xs">{error}</div>
        ) : skills.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">Tidak ada skill custom terinstal</div>
        ) : (
          skills.map((skill) => (
            <div key={skill.name} className="p-3 bg-slate-950 border border-slate-800/90 rounded-lg flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-slate-200 text-xs font-mono">{skill.name}</span>
                </div>
                {skill.author && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    by {skill.author}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{skill.description}</p>
              {skill.path && (
                <div className="text-[10px] text-slate-500 font-mono truncate border-t border-slate-900 pt-1 mt-1">
                  Path: {skill.path}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
