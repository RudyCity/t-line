import React, { useState, useEffect, useCallback } from 'react';
import {
  Link as LinkIcon, Plus, Trash2, CheckCircle, Play, StopCircle,
  Activity, RefreshCw, Folder, Server, Globe, ShieldAlert,
  ChevronDown, ChevronRight
} from 'lucide-react';

interface WorkspaceNodeSshConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKeyPath?: string;
  remoteCwd: string;
}

interface WorkspaceNode {
  id: string;
  label: string;
  type: 'local' | 'ssh';
  role: 'main' | 'module' | 'deploy' | 'dependency' | 'test' | 'staging' | 'custom';
  path?: string;
  sshConfig?: WorkspaceNodeSshConfig;
  dependsOn?: string[];
  description?: string;
}

interface WorkspaceChain {
  id: string;
  name: string;
  description?: string;
  nodes: WorkspaceNode[];
  primaryNodeId: string;
}

interface NodeStatus {
  nodeId: string;
  connected: boolean;
  type: string;
}

interface NodeHealth {
  nodeId: string;
  label: string;
  type: string;
  role: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'LOCAL' | 'ERROR';
  pingMs: number;
  osInfo: string;
  uptime: string;
  ramUsage: string;
  diskUsage: string;
  error?: string;
}

interface Props {
  workspace: string;
  setWorkspace: (w: string) => void;
  getAuthHeader: () => Record<string, string>;
}

const DEFAULT_NODE = { id: '', label: '', type: 'local' as const, role: 'module' as const, path: '', description: '' };
const DEFAULT_SSH = { host: '', port: 22, username: 'root', password: '', privateKeyPath: '', remoteCwd: '/' };

export const SuperAgentChainManager: React.FC<Props> = ({ workspace, setWorkspace, getAuthHeader }) => {
  const [chains, setChains] = useState<WorkspaceChain[]>([]);
  const [activeChainId, setActiveChainId] = useState<string | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [nodeStatuses, setNodeStatuses] = useState<NodeStatus[]>([]);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  
  // Health Dashboard
  const [healthData, setHealthData] = useState<NodeHealth[]>([]);
  const [healthLoading, setHealthLoading] = useState(false);
  const [showHealth, setShowHealth] = useState(false);

  // States
  const [_loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CRUD Forms
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [chainName, setChainName] = useState('');
  const [chainDesc, setChainDesc] = useState('');
  const [chainNodes, setChainNodes] = useState<WorkspaceNode[]>([]);
  
  // Single node adding state
  const [showAddNodeForm, setShowAddNodeForm] = useState(false);
  const [nodeForm, setNodeForm] = useState<Omit<WorkspaceNode, 'sshConfig'>>(DEFAULT_NODE);
  const [sshForm, setSshForm] = useState<WorkspaceNodeSshConfig>(DEFAULT_SSH);

  const authH = useCallback(() => ({ ...getAuthHeader(), 'Content-Type': 'application/json' }), [getAuthHeader]);

  // Load All Chains & Status
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch chains (do not filter by workspace so we can see all)
      const chainsRes = await fetch(`/api/superagent/workspace/chains?workspace=${encodeURIComponent(workspace)}&filter=false`, { headers: getAuthHeader() });
      const chainsData = await chainsRes.json();
      setChains(chainsData.chains || []);

      // 2. Fetch active chain ID
      const activeRes = await fetch(`/api/superagent/workspace/chains/active?workspace=${encodeURIComponent(workspace)}`, { headers: getAuthHeader() });
      const activeData = await activeRes.json();
      const currentActiveId = activeData.activeChainId;
      setActiveChainId(currentActiveId);
      if (currentActiveId && !selectedChainId) {
        setSelectedChainId(currentActiveId);
      }

      // 3. Fetch node connection status
      const statusRes = await fetch(`/api/superagent/workspace/chains/status?workspace=${encodeURIComponent(workspace)}`, { headers: getAuthHeader() });
      const statusData = await statusRes.json();
      setNodeStatuses(statusData.status || []);
      setActiveNodeId(statusData.activeNodeId);
    } catch (e: any) {
      setError(e.message || 'Failed to load chains');
    } finally {
      setLoading(false);
    }
  }, [workspace, getAuthHeader, selectedChainId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load Active Chain Health
  const loadHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch(`/api/superagent/workspace/chains/health?workspace=${encodeURIComponent(workspace)}`, { headers: getAuthHeader() });
      const data = await res.json();
      setHealthData(data.healthData || []);
    } catch (e) {}
    finally { setHealthLoading(false); }
  };

  useEffect(() => {
    if (showHealth && activeChainId) {
      loadHealth();
    }
  }, [showHealth, activeChainId]);

  // Activate / Deactivate Chain
  const handleToggleActive = async (chainId: string) => {
    setError(null);
    const activate = activeChainId !== chainId;
    try {
      const res = await fetch(`/api/superagent/workspace/chains/active?workspace=${encodeURIComponent(workspace)}`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify({ chainId: activate ? chainId : null })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to set active chain');
      await loadData();
      if (activate) {
        // Automatically switch workspace to the primary node of the activated chain
        const activeChain = chains.find(c => c.id === chainId);
        if (activeChain) {
          const primaryNode = activeChain.nodes.find(n => n.id === activeChain.primaryNodeId);
          if (primaryNode) {
            handleSwitchActiveNode(primaryNode);
          }
        }
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Switch Active Node (routes in SuperAgent + updates parent workspace state)
  const handleSwitchActiveNode = async (node: WorkspaceNode) => {
    setError(null);
    try {
      const res = await fetch(`/api/superagent/workspace/chains/switch-node?workspace=${encodeURIComponent(workspace)}`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify({ nodeId: node.id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to switch active node');
      
      // Update t-line active workspace
      if (node.type === 'local' && node.path) {
        setWorkspace(node.path);
        localStorage.setItem('currentWorkspace', node.path);
      } else if (node.type === 'ssh' && node.sshConfig) {
        const sshTarget = `ssh://${node.sshConfig.username}@${node.sshConfig.host}:${node.sshConfig.port}${node.sshConfig.remoteCwd}`;
        setWorkspace(sshTarget);
        localStorage.setItem('currentWorkspace', sshTarget);
      }
      await loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Delete Chain
  const handleDeleteChain = async (chainId: string) => {
    if (!confirm('Are you sure you want to delete this workspace chain?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/superagent/workspace/chains?workspace=${encodeURIComponent(workspace)}`, {
        method: 'DELETE',
        headers: authH(),
        body: JSON.stringify({ chainId })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to delete chain');
      if (selectedChainId === chainId) setSelectedChainId(null);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Create Chain Form Helper
  const handleCreateChainSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chainName.trim()) return;
    if (chainNodes.length === 0) {
      setError('Chain must contain at least one node');
      return;
    }
    setError(null);
    try {
      const payload = {
        name: chainName.trim(),
        description: chainDesc.trim(),
        nodes: chainNodes,
        primaryNodeId: chainNodes[0].id
      };
      const res = await fetch(`/api/superagent/workspace/chains?workspace=${encodeURIComponent(workspace)}`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to create chain');
      
      // Reset form
      setChainName('');
      setChainDesc('');
      setChainNodes([]);
      setShowCreateForm(false);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Add Node to Existing Chain
  const handleAddNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChainId) return;
    if (!nodeForm.id.trim() || !nodeForm.label.trim()) return;
    if (nodeForm.type === 'local' && !nodeForm.path?.trim()) {
      setError('Path is required for local node');
      return;
    }
    if (nodeForm.type === 'ssh' && (!sshForm.host.trim() || !sshForm.username.trim() || !sshForm.remoteCwd.trim())) {
      setError('SSH host, username, and remote path are required');
      return;
    }
    setError(null);
    try {
      const node: WorkspaceNode = {
        id: nodeForm.id.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        label: nodeForm.label.trim(),
        type: nodeForm.type,
        role: nodeForm.role,
        description: nodeForm.description?.trim(),
        path: nodeForm.type === 'local' ? nodeForm.path?.trim() : undefined,
        sshConfig: nodeForm.type === 'ssh' ? sshForm : undefined
      };
      
      const res = await fetch(`/api/superagent/workspace/chains/nodes?workspace=${encodeURIComponent(workspace)}`, {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify({ chainId: selectedChainId, node })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to add node');
      
      // Reset Form
      setNodeForm(DEFAULT_NODE);
      setSshForm(DEFAULT_SSH);
      setShowAddNodeForm(false);
      await loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Remove Node from Chain
  const handleRemoveNode = async (chainId: string, nodeId: string) => {
    const chain = chains.find(c => c.id === chainId);
    if (chain && chain.primaryNodeId === nodeId) {
      alert('Cannot remove the primary node of the chain');
      return;
    }
    if (!confirm(`Are you sure you want to remove node "${nodeId}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/superagent/workspace/chains/nodes?workspace=${encodeURIComponent(workspace)}`, {
        method: 'DELETE',
        headers: authH(),
        body: JSON.stringify({ chainId, nodeId })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to remove node');
      await loadData();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const selectedChain = chains.find(c => c.id === selectedChainId);

  return (
    <div className="space-y-4 text-xs font-sans text-[var(--text-muted)] select-none">
      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Grid Layout: Chains list on left, details on right */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Left Column: Chain List */}
        <div className="bg-[var(--bg-sidebar)] p-4 rounded-xl border border-[var(--border-color)] space-y-3 md:col-span-1">
          <div className="flex items-center justify-between font-semibold text-[var(--text-main)]">
            <div className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4 text-[var(--color-primary)]" />
              <span>Workspace Chains</span>
            </div>
            <button
              onClick={() => {
                setShowCreateForm(!showCreateForm);
                setChainNodes([]);
              }}
              className="p-1 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)] rounded border border-[var(--border-color)] cursor-pointer"
              title="Create new chain"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
            {chains.length === 0 ? (
              <div className="text-center py-6 text-zinc-500 italic">No workspace chains defined.</div>
            ) : (
              chains.map(c => {
                const isActive = activeChainId === c.id;
                const isSelected = selectedChainId === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedChainId(c.id)}
                    className={`p-2.5 rounded-lg border transition cursor-pointer flex flex-col gap-1 ${
                      isSelected
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--text-main)]'
                        : 'border-[var(--border-color)] bg-[var(--bg-card)] hover:border-zinc-500 text-[var(--text-muted)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate">{c.name}</span>
                      {isActive && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1 py-0.2 rounded font-mono uppercase">
                          Active
                        </span>
                      )}
                    </div>
                    {c.description && <span className="text-[10px] text-zinc-500 truncate">{c.description}</span>}
                    <span className="text-[9px] font-mono text-zinc-600">{c.nodes.length} nodes</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Chain Details & Node Management */}
        <div className="bg-[var(--bg-sidebar)] p-4 rounded-xl border border-[var(--border-color)] space-y-4 md:col-span-2">
          {showCreateForm ? (
            /* CREATE CHAIN FORM */
            <form onSubmit={handleCreateChainSubmit} className="space-y-4">
              <h3 className="font-semibold text-[var(--text-main)] text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[var(--color-primary)]" />
                Create Workspace Chain
              </h3>
              
              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-[var(--text-main)]">Chain Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Multi-Service Project"
                  value={chainName}
                  onChange={e => setChainName(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--color-primary)] text-xs"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-medium text-[var(--text-main)]">Description (optional)</label>
                <textarea
                  placeholder="Link local backend to staging SSH environment"
                  value={chainDesc}
                  onChange={e => setChainDesc(e.target.value)}
                  className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-main)] outline-none focus:border-[var(--color-primary)] text-xs h-16 resize-none"
                />
              </div>

              {/* Add nodes list during creation */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-[var(--text-main)]">Nodes in Chain</span>
                  <button
                    type="button"
                    onClick={() => setShowAddNodeForm(true)}
                    className="flex items-center gap-1 text-[10px] text-[var(--color-primary)] hover:underline bg-transparent border-0 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Node
                  </button>
                </div>

                <div className="space-y-1.5 max-h-[160px] overflow-y-auto bg-[var(--bg-card)] p-2 rounded-lg border border-[var(--border-color)]">
                  {chainNodes.length === 0 ? (
                    <div className="text-center py-4 text-zinc-500 italic text-[10px]">Add at least one node to start. The first node will be primary.</div>
                  ) : (
                    chainNodes.map((n, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 bg-[var(--bg-sidebar)] rounded border border-[var(--border-color)] font-mono text-[10px]">
                        <div className="flex items-center gap-2">
                          {n.type === 'ssh' ? <Globe className="w-3 h-3 text-sky-400" /> : <Folder className="w-3 h-3 text-amber-400" />}
                          <span className="font-semibold">{n.label} ({n.id})</span>
                          <span className="text-zinc-500">[{n.role}]</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setChainNodes(prev => prev.filter((_, i) => i !== idx))}
                          className="text-rose-400 hover:text-rose-500 p-1 rounded hover:bg-rose-500/10 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-3.5 py-1.5 bg-transparent border border-[var(--border-color)] hover:border-zinc-500 rounded-lg text-[var(--text-main)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white rounded-lg cursor-pointer font-semibold"
                >
                  Create Chain
                </button>
              </div>
            </form>
          ) : selectedChain ? (
            /* DETAILED VIEW FOR SELECTED CHAIN */
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-[var(--text-main)] text-sm">{selectedChain.name}</h3>
                  {selectedChain.description && <p className="text-[10px] text-zinc-500 mt-0.5">{selectedChain.description}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleToggleActive(selectedChain.id)}
                    className={`px-3 py-1.5 rounded-lg border font-medium cursor-pointer flex items-center gap-1.5 ${
                      activeChainId === selectedChain.id
                        ? 'border-rose-500/40 text-rose-400 bg-rose-500/10 hover:bg-rose-500/15'
                        : 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15'
                    }`}
                  >
                    {activeChainId === selectedChain.id ? (
                      <>
                        <StopCircle className="w-3.5 h-3.5" />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Activate Chain
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteChain(selectedChain.id)}
                    className="p-1.5 text-rose-400 hover:text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg cursor-pointer"
                    title="Delete Chain"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Node Management List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-1.5">
                  <span className="font-semibold text-[var(--text-main)]">Workspace Nodes ({selectedChain.nodes.length})</span>
                  <button
                    onClick={() => setShowAddNodeForm(true)}
                    className="flex items-center gap-1 text-[10px] text-[var(--color-primary)] hover:underline cursor-pointer bg-transparent border-0"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Workspace Node
                  </button>
                </div>

                <div className="space-y-2">
                  {selectedChain.nodes.map(node => {
                    const isNodeActive = activeNodeId === node.id && activeChainId === selectedChain.id;
                    const connection = nodeStatuses.find(s => s.nodeId === node.id);
                    const isConnected = connection ? connection.connected : false;
                    
                    return (
                      <div
                        key={node.id}
                        className={`p-3 bg-[var(--bg-card)] rounded-xl border flex items-center justify-between gap-4 transition ${
                          isNodeActive
                            ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/5'
                            : 'border-[var(--border-color)]'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-[var(--text-main)] font-mono text-xs">{node.label} ({node.id})</span>
                            <span className="text-[9px] uppercase px-1 rounded bg-zinc-700/50 font-mono text-zinc-400">
                              {node.role}
                            </span>
                            {node.id === selectedChain.primaryNodeId && (
                              <span className="text-[9px] uppercase px-1 rounded bg-[var(--color-primary)]/20 font-mono text-[var(--color-primary)] font-semibold">
                                Primary
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
                            {node.type === 'ssh' ? (
                              <>
                                <Globe className="w-3 h-3 text-sky-400 shrink-0" />
                                <span className="truncate">{node.sshConfig?.username}@{node.sshConfig?.host}:{node.sshConfig?.port}{node.sshConfig?.remoteCwd}</span>
                              </>
                            ) : (
                              <>
                                <Folder className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="truncate">{node.path}</span>
                              </>
                            )}
                          </div>
                          {node.description && <p className="text-[10px] text-zinc-500 italic mt-0.5">{node.description}</p>}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* Connection indicator for SSH nodes */}
                          {node.type === 'ssh' && (
                            <span
                              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                                isConnected
                                  ? 'text-emerald-400 bg-emerald-400/10 border-emerald-500/20'
                                  : 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20'
                              }`}
                              title={isConnected ? 'SSH Connected' : 'SSH Disconnected'}
                            >
                              <Server className="w-2.5 h-2.5" />
                              {isConnected ? 'LIVE' : 'DISC'}
                            </span>
                          )}

                          {isNodeActive ? (
                            <span className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30">
                              <CheckCircle className="w-3.5 h-3.5" />
                              Active
                            </span>
                          ) : (
                            activeChainId === selectedChain.id && (
                              <button
                                onClick={() => handleSwitchActiveNode(node)}
                                className="px-2.5 py-1 rounded hover:bg-zinc-700 border border-[var(--border-color)] hover:border-zinc-500 text-[var(--text-main)] cursor-pointer"
                              >
                                Focus Node
                              </button>
                            )
                          )}
                          <button
                            onClick={() => handleRemoveNode(selectedChain.id, node.id)}
                            disabled={node.id === selectedChain.primaryNodeId}
                            className="p-1 text-rose-400 hover:text-rose-500 rounded hover:bg-rose-500/10 border border-transparent disabled:opacity-30 cursor-pointer"
                            title="Remove Node"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Chain Health Collapsible */}
              {activeChainId === selectedChain.id && (
                <div className="border border-[var(--border-color)] rounded-xl bg-[var(--bg-card)] overflow-hidden">
                  <button
                    onClick={() => setShowHealth(!showHealth)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-[var(--panel-header-bg)] hover:bg-[var(--surface-overlay-hover)] transition cursor-pointer text-xs font-semibold text-[var(--text-main)] border-0 outline-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-[var(--color-primary)]" />
                      <span>Node Health & Performance Monitor</span>
                    </div>
                    {showHealth ? <ChevronDown className="w-4 h-4 text-zinc-500" /> : <ChevronRight className="w-4 h-4 text-zinc-500" />}
                  </button>

                  {showHealth && (
                    <div className="p-3 space-y-3 font-sans">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-zinc-500">Live latency and resource metrics dashboard</span>
                        <button
                          onClick={loadHealth}
                          disabled={healthLoading}
                          className="flex items-center gap-1 text-[10px] text-[var(--color-primary)] hover:underline cursor-pointer bg-transparent border-0 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${healthLoading ? 'animate-spin' : ''}`} /> Refresh
                        </button>
                      </div>

                      {healthLoading && healthData.length === 0 ? (
                        <div className="text-center py-6 text-zinc-500 italic">Pinging nodes...</div>
                      ) : (
                        <div className="overflow-x-auto border border-[var(--border-color)] rounded-lg">
                          <table className="w-full text-[10px] font-mono text-left border-collapse">
                            <thead>
                              <tr className="bg-[var(--panel-header-bg)] border-b border-[var(--border-color)] text-[var(--text-main)]">
                                <th className="p-2 border-r border-[var(--border-color)]">Node ID</th>
                                <th className="p-2 border-r border-[var(--border-color)]">Status</th>
                                <th className="p-2 border-r border-[var(--border-color)]">Latency</th>
                                <th className="p-2 border-r border-[var(--border-color)]">RAM Usage</th>
                                <th className="p-2 border-r border-[var(--border-color)]">Disk Usage</th>
                                <th className="p-2">Uptime</th>
                              </tr>
                            </thead>
                            <tbody>
                              {healthData.map(h => (
                                <tr key={h.nodeId} className="border-b border-[var(--border-color)] hover:bg-[var(--bg-sidebar)]">
                                  <td className="p-2 border-r border-[var(--border-color)] font-semibold text-[var(--text-main)]">{h.nodeId}</td>
                                  <td className="p-2 border-r border-[var(--border-color)]">
                                    <span className={`px-1.5 py-0.2 rounded text-[9px] uppercase ${
                                      h.status === 'ERROR' ? 'text-rose-400 bg-rose-400/10' : 'text-emerald-400 bg-emerald-400/10'
                                    }`}>
                                      {h.status === 'ERROR' ? 'ERROR' : h.status}
                                    </span>
                                  </td>
                                  <td className="p-2 border-r border-[var(--border-color)]">{h.pingMs}ms</td>
                                  <td className="p-2 border-r border-[var(--border-color)]">{h.ramUsage}</td>
                                  <td className="p-2 border-r border-[var(--border-color)]">{h.diskUsage}</td>
                                  <td className="p-2">{h.uptime}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-16 text-zinc-500 italic">Select or create a workspace chain from the left sidebar.</div>
          )}
        </div>
      </div>

      {/* NODE CREATING DIALOG / MODAL (FOR CREATION AND LATE ADDING) */}
      {showAddNodeForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--bg-card)] border border-[var(--border-color)] w-full max-w-md rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <h4 className="font-semibold text-[var(--text-main)] text-sm flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[var(--color-primary)]" />
                Add Workspace Node
              </h4>
            </div>

            <form onSubmit={selectedChainId ? handleAddNodeSubmit : (e) => {
              e.preventDefault();
              const node: WorkspaceNode = {
                id: nodeForm.id.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                label: nodeForm.label.trim(),
                type: nodeForm.type,
                role: nodeForm.role,
                description: nodeForm.description?.trim(),
                path: nodeForm.type === 'local' ? nodeForm.path?.trim() : undefined,
                sshConfig: nodeForm.type === 'ssh' ? sshForm : undefined
              };
              setChainNodes(prev => [...prev, node]);
              setNodeForm(DEFAULT_NODE);
              setSshForm(DEFAULT_SSH);
              setShowAddNodeForm(false);
            }} className="space-y-3.5 max-h-[450px] overflow-y-auto pr-1">
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-medium text-[var(--text-main)]">Node ID (short, unique)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. auth-backend"
                    value={nodeForm.id}
                    onChange={e => setNodeForm(prev => ({ ...prev, id: e.target.value }))}
                    className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] outline-none text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-medium text-[var(--text-main)]">Label (human-readable)</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Auth Service"
                    value={nodeForm.label}
                    onChange={e => setNodeForm(prev => ({ ...prev, label: e.target.value }))}
                    className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-medium text-[var(--text-main)]">Type</label>
                  <select
                    value={nodeForm.type}
                    onChange={e => setNodeForm(prev => ({ ...prev, type: e.target.value as any }))}
                    className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] outline-none text-xs"
                  >
                    <option value="local">Local Directory</option>
                    <option value="ssh">Remote SSH Server</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-medium text-[var(--text-main)]">Role</label>
                  <select
                    value={nodeForm.role}
                    onChange={e => setNodeForm(prev => ({ ...prev, role: e.target.value as any }))}
                    className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] outline-none text-xs"
                  >
                    <option value="main">Main project</option>
                    <option value="module">Submodule</option>
                    <option value="dependency">Dependency</option>
                    <option value="deploy">Deployment target</option>
                    <option value="test">Testing environment</option>
                    <option value="staging">Staging</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-medium text-[var(--text-main)]">Description (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. User authorization microservice backend"
                  value={nodeForm.description}
                  onChange={e => setNodeForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] outline-none text-xs"
                />
              </div>

              {nodeForm.type === 'local' ? (
                /* LOCAL DIRECTORY CONFIG */
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-medium text-[var(--text-main)]">Local Directory Path</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. D:\projects\auth-service"
                    value={nodeForm.path || ''}
                    onChange={e => setNodeForm(prev => ({ ...prev, path: e.target.value }))}
                    className="w-full bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-lg px-2.5 py-1.5 text-[var(--text-main)] outline-none font-mono text-xs"
                  />
                </div>
              ) : (
                /* SSH CONNECTION CONFIG */
                <div className="space-y-3.5 bg-[var(--bg-sidebar)] p-3 rounded-lg border border-[var(--border-color)]">
                  <div className="flex items-center gap-1.5 font-semibold text-[var(--text-main)] text-[11px] pb-1 border-b border-[var(--border-color)]/50">
                    <Globe className="w-3.5 h-3.5 text-sky-400" />
                    <span>SSH Remote Settings</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1 col-span-2">
                      <label className="block text-[9px] font-medium text-[var(--text-main)]">Host IP / Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 192.168.1.50"
                        value={sshForm.host}
                        onChange={e => setSshForm(prev => ({ ...prev, host: e.target.value }))}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 text-[var(--text-main)] outline-none text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-medium text-[var(--text-main)]">Port</label>
                      <input
                        type="number"
                        required
                        value={sshForm.port}
                        onChange={e => setSshForm(prev => ({ ...prev, port: parseInt(e.target.value, 10) || 22 }))}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 text-[var(--text-main)] outline-none text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="block text-[9px] font-medium text-[var(--text-main)]">SSH User</label>
                      <input
                        type="text"
                        required
                        placeholder="ubuntu"
                        value={sshForm.username}
                        onChange={e => setSshForm(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 text-[var(--text-main)] outline-none text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-[9px] font-medium text-[var(--text-main)]">SSH Password (optional)</label>
                      <input
                        type="password"
                        placeholder="Password (if no SSH Key)"
                        value={sshForm.password || ''}
                        onChange={e => setSshForm(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 text-[var(--text-main)] outline-none text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-medium text-[var(--text-main)]">Private Key File Path (optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. C:\Users\USER\.ssh\id_ed25519"
                      value={sshForm.privateKeyPath || ''}
                      onChange={e => setSshForm(prev => ({ ...prev, privateKeyPath: e.target.value }))}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 text-[var(--text-main)] outline-none text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[9px] font-medium text-[var(--text-main)]">Remote Path (CWD)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. /home/ubuntu/app"
                      value={sshForm.remoteCwd}
                      onChange={e => setSshForm(prev => ({ ...prev, remoteCwd: e.target.value }))}
                      className="w-full bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 text-[var(--text-main)] outline-none text-xs font-mono"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 justify-end pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => {
                    setNodeForm(DEFAULT_NODE);
                    setSshForm(DEFAULT_SSH);
                    setShowAddNodeForm(false);
                  }}
                  className="px-3.5 py-1.5 bg-transparent border border-[var(--border-color)] hover:border-zinc-500 rounded-lg text-[var(--text-main)] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary)]/80 text-white rounded-lg cursor-pointer font-semibold"
                >
                  Add Node
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
