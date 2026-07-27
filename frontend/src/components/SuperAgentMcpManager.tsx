import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Trash2, RefreshCw, Server, CheckCircle,
  XCircle, Loader, ChevronDown, ChevronUp
} from 'lucide-react';

interface McpServer {
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  status?: string;
  tools?: string[];
  error?: string;
}

interface Props {
  getAuthHeader: () => Record<string, string>;
}

const EMPTY_FORM = { name: '', command: '', args: '', env: '' };

function StatusBadge({ status }: { status?: string }) {
  if (status === 'connected')  return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
  if (status === 'error')      return <XCircle className="w-3.5 h-3.5 text-rose-400" />;
  if (status === 'connecting') return <Loader className="w-3.5 h-3.5 text-amber-400 animate-spin" />;
  return <Server className="w-3.5 h-3.5 text-zinc-500" />;
}

function statusCls(status?: string) {
  if (status === 'connected')  return 'text-emerald-400 bg-emerald-400/10 border-emerald-500/30';
  if (status === 'error')      return 'text-rose-400 bg-rose-400/10 border-rose-500/30';
  if (status === 'connecting') return 'text-amber-400 bg-amber-400/10 border-amber-500/30';
  return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/30';
}

export const SuperAgentMcpManager: React.FC<Props> = ({ getAuthHeader }) => {
  const [servers,      setServers]      = useState<McpServer[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [reloading,    setReloading]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [showForm,     setShowForm]     = useState(false);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [adding,       setAdding]       = useState(false);
  const [deletingName, setDeletingName] = useState<string | null>(null);
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());

  const authH = useCallback(() => ({ ...getAuthHeader(), 'Content-Type': 'application/json' }), [getAuthHeader]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/superagent/config/mcp', { headers: getAuthHeader() });
      setServers((await r.json()).servers ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [getAuthHeader]);

  useEffect(() => { load(); }, [load]);

  const handleReload = async () => {
    setReloading(true); setError(null);
    try {
      const r = await fetch('/api/superagent/config/mcp/reload', { method: 'POST', headers: authH() });
      setServers((await r.json()).servers ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setReloading(false); }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.command.trim()) return;
    setAdding(true); setError(null);
    try {
      const args = form.args.trim() ? form.args.trim().split(/\s+/) : [];
      const env: Record<string, string> = {};
      for (const line of form.env.split('\n')) {
        const i = line.indexOf('=');
        if (i > 0) env[line.slice(0, i).trim()] = line.slice(i + 1).trim();
      }
      const payload: any = { name: form.name.trim(), command: form.command.trim(), args };
      if (Object.keys(env).length) payload.env = env;
      const r = await fetch('/api/superagent/config/mcp', { method: 'POST', headers: authH(), body: JSON.stringify(payload) });
      if (!r.ok) throw new Error((await r.json()).error || 'Failed');
      setForm(EMPTY_FORM); setShowForm(false); await load();
    } catch (e: any) { setError(e.message); }
    finally { setAdding(false); }
  };

  const handleDelete = async (name: string) => {
    setError(null);
    try {
      await fetch(`/api/superagent/config/mcp/${encodeURIComponent(name)}`, { method: 'DELETE', headers: getAuthHeader() });
      setDeletingName(null); await load();
    } catch (e: any) { setError(e.message); }
  };

  const toggleExpand = (name: string) =>
    setExpanded(p => { const n = new Set(p); n.has(name) ? n.delete(name) : n.add(name); return n; });

  const isSensitiveKey = (k: string) =>
    ['key', 'token', 'secret', 'password', 'pass', 'auth'].some(w => k.toLowerCase().includes(w));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[var(--text-main)] text-xs flex items-center gap-2">
            <Server className="w-4 h-4 text-[var(--color-primary)]" />
            MCP Servers
            <span className="text-[10px] text-[var(--color-primary)] bg-[var(--color-primary-glow)] px-1.5 py-0.5 rounded-full border border-[var(--color-primary)]/40 font-mono">
              {servers.length}
            </span>
          </h3>
          <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
            Model Context Protocol � extend SuperAgent with external tool servers
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={handleReload} disabled={reloading || loading}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:border-[var(--color-primary)]/50 transition disabled:opacity-40">
            <RefreshCw className={`w-3 h-3 ${reloading ? 'animate-spin' : ''}`} />
            Reload All
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg transition ">
            <Plus className="w-3 h-3" />
            Add Server
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-rose-400 bg-rose-400/10 border border-rose-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
          <XCircle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd}
          className="bg-[var(--bg-sidebar)] border border-[var(--color-primary)]/30 rounded-xl p-4 space-y-3">
          <p className="font-semibold text-[var(--text-main)] text-xs flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-[var(--color-primary)]" />New MCP Server
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] text-[var(--text-muted)]">Name <span className="text-rose-400">*</span></label>
              <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. git-tools"
                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)] transition" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] text-[var(--text-muted)]">Command <span className="text-rose-400">*</span></label>
              <input type="text" required value={form.command} onChange={e => setForm(f => ({ ...f, command: e.target.value }))}
                placeholder="e.g. uvx or npx"
                className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--color-primary)] transition" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-[var(--text-muted)]">Arguments <span className="text-zinc-600">(space-separated)</span></label>
            <input type="text" value={form.args} onChange={e => setForm(f => ({ ...f, args: e.target.value }))}
              placeholder="e.g. mcp-server-git --repository /path"
              className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-main)] font-mono focus:outline-none focus:border-[var(--color-primary)] transition" />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] text-[var(--text-muted)]">Env Variables <span className="text-zinc-600">(KEY=VALUE per line)</span></label>
            <textarea value={form.env} onChange={e => setForm(f => ({ ...f, env: e.target.value }))}
              placeholder={"GITHUB_TOKEN=ghp_xxx\nREPO_PATH=/path"} rows={3}
              className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-xs text-[var(--text-main)] font-mono focus:outline-none focus:border-[var(--color-primary)] transition resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              className="px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)] rounded-lg bg-[var(--bg-card)] transition">
              Cancel
            </button>
            <button type="submit" disabled={adding}
              className="px-3 py-1.5 text-xs font-medium bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg transition disabled:opacity-50 flex items-center gap-1.5">
              {adding ? <Loader className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              {adding ? 'Adding...' : 'Add Server'}
            </button>
          </div>
        </form>
      )}

      {/* Server list */}
      {loading ? (
        <div className="flex items-center justify-center py-10 text-[var(--text-muted)] text-xs gap-2">
          <Loader className="w-4 h-4 animate-spin" />Loading MCP servers...
        </div>
      ) : servers.length === 0 ? (
        <div className="text-center py-10 text-[var(--text-muted)] text-xs">
          <Server className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-medium">No MCP servers configured</p>
          <p className="text-[10px] mt-1 opacity-60">Add a server to extend SuperAgent with external tools</p>
        </div>
      ) : (
        <div className="space-y-2">
          {servers.map(srv => {
            const isExp = expanded.has(srv.name);
            const isDel = deletingName === srv.name;
            const hasDetails = !!(srv.tools?.length || srv.error || (srv.env && Object.keys(srv.env).length));
            return (
              <div key={srv.name}
                className={`bg-[var(--bg-sidebar)] border rounded-xl overflow-hidden transition-all ${srv.status === 'error' ? 'border-rose-500/30' : 'border-[var(--border-color)]'}`}>
                <div className="p-3 flex items-center gap-2.5">
                  <div className="shrink-0"><StatusBadge status={srv.status} /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-xs text-[var(--text-main)]">{srv.name}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${statusCls(srv.status)}`}>
                        {srv.status || 'not-connected'}
                      </span>
                      {(srv.tools?.length ?? 0) > 0 && (
                        <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-color)]">
                          {srv.tools!.length} tool{srv.tools!.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5 truncate">
                      {srv.command}{srv.args.length ? ' ' + srv.args.join(' ') : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {hasDetails && (
                      <button onClick={() => toggleExpand(srv.name)}
                        className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-lg hover:bg-[var(--surface-overlay-hover)] transition">
                        {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    )}
                    {isDel ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => handleDelete(srv.name)}
                          className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-semibold transition">Delete</button>
                        <button onClick={() => setDeletingName(null)}
                          className="px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded text-[10px] transition">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeletingName(srv.name)} title="Remove"
                        className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg hover:bg-[var(--surface-overlay-hover)] transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                {isExp && (
                  <div className="border-t border-[var(--border-color)] px-3 py-3 space-y-2.5">
                    {srv.error && <div className="text-[11px] text-rose-400 bg-rose-400/10 rounded-lg p-2 font-mono">? {srv.error}</div>}
                    {(srv.tools?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] mb-1.5 font-semibold uppercase tracking-wide">Available Tools</p>
                        <div className="flex flex-wrap gap-1">
                          {srv.tools!.map(t => (
                            <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[var(--text-muted)]">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {srv.env && Object.keys(srv.env).length > 0 && (
                      <div>
                        <p className="text-[10px] text-[var(--text-muted)] mb-1 font-semibold uppercase tracking-wide">Environment</p>
                        <div className="space-y-0.5 font-mono text-[10px] text-[var(--text-muted)]">
                          {Object.entries(srv.env).map(([k, v]) => (
                            <div key={k}>
                              <span className="text-[var(--color-primary)]">{k}</span>=
                              <span className="text-[var(--text-main)]">
                                {isSensitiveKey(k) ? '������' : v.length > 40 ? v.slice(0, 40) + '�' : v}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
