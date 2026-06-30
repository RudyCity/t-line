import { useState, useEffect, useCallback } from 'react';
import { GitCommit, User, Calendar, FileCode, FilePlus, FileMinus, X, Loader2, RefreshCw } from 'lucide-react';

export interface CommitInfo {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  subject: string;
  graphPrefix: string;
}

export interface CommitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
}

export interface CommitDetails {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
  files: CommitFile[];
}

interface GitHistoryProps {
  workspaceId: string;
  token: string;
  worktreePath?: string | null;
}

function StatusIcon({ status }: { status: CommitFile['status'] }) {
  switch (status) {
    case 'added':
      return <FilePlus size={13} style={{ color: '#4ade80', flexShrink: 0 }} />;
    case 'deleted':
      return <FileMinus size={13} style={{ color: '#f87171', flexShrink: 0 }} />;
    case 'renamed':
      return <FileCode size={13} style={{ color: '#a78bfa', flexShrink: 0 }} />;
    default:
      return <FileCode size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />;
  }
}

const STATUS_LABEL: Record<CommitFile['status'], { label: string; color: string }> = {
  modified: { label: 'M', color: '#fbbf24' },
  added:    { label: 'A', color: '#4ade80' },
  deleted:  { label: 'D', color: '#f87171' },
  renamed:  { label: 'R', color: '#a78bfa' }
};

const LANE_COLORS = [
  '#f43f5e', // rose-500
  '#3b82f6', // blue-500
  '#10b981', // emerald-500
  '#a855f7', // purple-500
  '#f59e0b', // amber-500
  '#06b6d4', // cyan-500
  '#ec4899', // pink-500
];

function ColorizedGraphPrefix({ prefix }: { prefix: string }) {
  // Render character by character, colorizing based on position / index to represent lanes
  return (
    <span className="font-mono text-xs whitespace-pre select-none tracking-normal" style={{ letterSpacing: '0.05em' }}>
      {prefix.split('').map((char, index) => {
        if (char === ' ') return <span key={index}> </span>;
        
        let color = '#94a3b8'; // default text-muted
        if (char === '*') {
          color = 'var(--color-primary, #a855f7)'; // main node is bright purple/primary
        } else {
          // connection lines colored by column index
          color = LANE_COLORS[index % LANE_COLORS.length];
        }

        return (
          <span 
            key={index} 
            style={{ 
              color, 
              fontWeight: char === '*' ? 'bold' : 'normal',
              textShadow: char === '*' ? '0 0 4px var(--color-primary)' : 'none'
            }}
          >
            {char}
          </span>
        );
      })}
    </span>
  );
}

function parseDiff(diff: string): { header: string; hunks: { header: string; lines: { type: '+' | '-' | ' '; text: string }[] }[] } {
  const lines = diff.split('\n');
  let header = '';
  const hunks: { header: string; lines: { type: '+' | '-' | ' '; text: string }[] }[] = [];
  let currentHunk: typeof hunks[0] | null = null;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (currentHunk) hunks.push(currentHunk);
      currentHunk = { header: line, lines: [] };
    } else if (currentHunk) {
      if (line.startsWith('+')) currentHunk.lines.push({ type: '+', text: line.slice(1) });
      else if (line.startsWith('-')) currentHunk.lines.push({ type: '-', text: line.slice(1) });
      else currentHunk.lines.push({ type: ' ', text: line.slice(1) });
    } else {
      header += line + '\n';
    }
  }
  if (currentHunk) hunks.push(currentHunk);
  return { header, hunks };
}

export function GitHistory({ workspaceId, token, worktreePath }: GitHistoryProps) {
  const [history, setHistory] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [commitDetails, setCommitDetails] = useState<CommitDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  
  const [selectedFile, setSelectedFile] = useState<CommitFile | null>(null);
  const [diff, setDiff] = useState<string>('');
  const [diffLoading, setDiffLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const queryParam = worktreePath ? `&worktreePath=${encodeURIComponent(worktreePath)}` : '';
      const res = await fetch(`/api/workspaces/${workspaceId}/git/history?limit=70${queryParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.error('Error fetching git history:', e);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, token, worktreePath]);

  useEffect(() => {
    fetchHistory();
    setSelectedCommitHash(null);
    setCommitDetails(null);
    setSelectedFile(null);
    setDiff('');
  }, [workspaceId, token, worktreePath, fetchHistory]);

  const handleCommitSelect = async (commit: CommitInfo) => {
    if (!commit.hash) return; // ignore connector-only lines
    setSelectedCommitHash(commit.hash);
    setCommitDetails(null);
    setSelectedFile(null);
    setDiff('');
    
    setDetailsLoading(true);
    try {
      const queryParam = worktreePath ? `&worktreePath=${encodeURIComponent(worktreePath)}` : '';
      const res = await fetch(`/api/workspaces/${workspaceId}/git/commit-details?commitHash=${commit.hash}${queryParam}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCommitDetails(data);
      }
    } catch (e) {
      console.error('Error fetching commit details:', e);
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleFileSelect = async (file: CommitFile) => {
    if (!selectedCommitHash) return;
    setSelectedFile(file);
    setDiff('');
    
    if (file.status === 'added') {
      setDiff('(New file added in this commit – no diff relative to parent)');
      return;
    }
    
    setDiffLoading(true);
    try {
      const queryParam = worktreePath ? `&worktreePath=${encodeURIComponent(worktreePath)}` : '';
      const res = await fetch(
        `/api/workspaces/${workspaceId}/git/commit-diff?commitHash=${selectedCommitHash}&filePath=${encodeURIComponent(file.path)}${queryParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setDiff(data.diff || '(Empty diff)');
      }
    } catch {
      setDiff('(Error loading commit diff)');
    } finally {
      setDiffLoading(false);
    }
  };

  const parsedDiff = diff ? parseDiff(diff) : null;

  return (
    <div className="panel-split" style={{ height: '100%' }}>
      <style>{`
        .git-history-item {
          display: flex;
          align-items: stretch;
          border-bottom: 1px solid rgba(255,255,255,0.02);
          cursor: pointer;
          min-height: 42px;
          transition: background-color 0.15s;
        }
        .git-history-item:hover {
          background: rgba(255,255,255,0.02);
        }
        .git-history-item-active {
          background: rgba(168, 85, 247, 0.08) !important;
          border-left: 2px solid var(--color-primary, #a855f7);
        }
        .git-graph-col {
          display: flex;
          align-items: center;
          padding: 0 10px;
          border-right: 1px solid rgba(255,255,255,0.04);
          background: rgba(0,0,0,0.08);
          min-width: 60px;
        }
        .git-commit-info-col {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 6px 12px;
          flex: 1;
          min-w-0;
        }
        .git-history-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.68rem;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .git-commit-details-panel {
          flex: 1.2;
          display: flex;
          flex-direction: column;
          border-left: 1px solid var(--border-color);
          background: var(--bg-sidebar);
          overflow: hidden;
        }
        .git-details-body {
          flex: 1;
          overflow-y: auto;
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .git-details-header-card {
          padding: 10px 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .git-details-msg {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-main);
          white-space: pre-wrap;
          line-height: 1.35;
        }
        .git-details-author {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          color: var(--text-muted);
        }
        .git-details-hash {
          font-family: monospace;
          font-size: 0.7rem;
          color: var(--color-primary, #a855f7);
          word-break: break-all;
        }
      `}</style>
      
      {/* ── Commits Log and Graph Column ── */}
      <div className="explorer-tree" style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: 'none' }}>
        <div className="panel-section-header">
          <span className="panel-section-title">Git Commit History</span>
          <button className="action-btn" onClick={fetchHistory} title="Refresh History" disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div className="explorer-scroll" style={{ flex: 1 }}>
          {loading ? (
            <div className="panel-loading">
              <Loader2 size={16} className="animate-spin" />
              <span>Loading commit graph...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="panel-empty">
              <GitCommit size={24} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
              <span>No commit history found</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              {history.map((commit, index) => {
                const isCommitNode = !!commit.hash;
                const isActive = selectedCommitHash === commit.hash;
                
                return (
                  <div
                    key={commit.hash || `connector-${index}`}
                    className={`git-history-item ${isActive ? 'git-history-item-active' : ''}`}
                    onClick={() => isCommitNode && handleCommitSelect(commit)}
                    style={{ cursor: isCommitNode ? 'pointer' : 'default' }}
                  >
                    {/* Visual tree graph column */}
                    <div className="git-graph-col">
                      <ColorizedGraphPrefix prefix={commit.graphPrefix} />
                    </div>
                    
                    {/* Commit info column */}
                    {isCommitNode ? (
                      <div className="git-commit-info-col">
                        <span className="explorer-item-name truncate font-semibold" style={{ fontSize: '0.8rem' }}>
                          {commit.subject}
                        </span>
                        <div className="git-history-meta">
                          <span className="font-mono text-purple-400 font-semibold">{commit.shortHash}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5"><User size={10} /> {commit.authorName}</span>
                          <span>•</span>
                          <span>{commit.date}</span>
                        </div>
                      </div>
                    ) : (
                      // empty details for graph connector lines
                      <div className="git-commit-info-col" style={{ opacity: 0.3 }}>
                        <span className="font-mono text-[10px] text-slate-500">connector</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Commit Details and Historical File Diff Panel ── */}
      {selectedCommitHash && (
        <div className="git-commit-details-panel">
          <div className="panel-section-header">
            <span className="panel-section-title">Commit Details</span>
            <button className="action-btn" onClick={() => setSelectedCommitHash(null)} title="Close Panel">
              <X size={13} />
            </button>
          </div>
          
          <div className="git-details-body">
            {detailsLoading ? (
              <div className="panel-loading" style={{ height: '100px' }}>
                <Loader2 size={16} className="animate-spin" />
                <span>Loading commit data...</span>
              </div>
            ) : commitDetails ? (
              <>
                {/* Header card with commit info */}
                <div className="git-details-header-card">
                  <div className="git-details-msg">{commitDetails.message}</div>
                  <div className="git-details-author" style={{ marginTop: '4px' }}>
                    <User size={12} className="text-slate-400" />
                    <span>
                      <strong className="text-slate-200">{commitDetails.authorName}</strong> &lt;{commitDetails.authorEmail}&gt;
                    </span>
                  </div>
                  <div className="git-details-author">
                    <Calendar size={12} className="text-slate-400" />
                    <span>{commitDetails.date}</span>
                  </div>
                  <div className="git-details-hash mt-1">
                    commit: {commitDetails.hash}
                  </div>
                </div>

                {/* Modified Files Section */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Changed Files ({commitDetails.files.length})
                  </span>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(0,0,0,0.1)', borderRadius: '6px', padding: '4px' }}>
                    {commitDetails.files.map(file => {
                      const { label, color } = STATUS_LABEL[file.status];
                      const isFileActive = selectedFile?.path === file.path;
                      const fileName = file.path.split(/[/\\]/).pop() ?? file.path;
                      const dirName = file.path.split(/[/\\]/).slice(0, -1).join('/');
                      
                      return (
                        <div
                          key={file.path}
                          className={`explorer-item ${isFileActive ? 'explorer-item-active' : ''}`}
                          style={{ paddingLeft: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                          onClick={() => handleFileSelect(file)}
                          title={file.path}
                        >
                          <StatusIcon status={file.status} />
                          <span className="flex-1 min-w-0 text-left" style={{ display: 'flex', flexDirection: 'column' }}>
                            <span className="explorer-item-name">{fileName}</span>
                            {dirName && (
                              <span className="explorer-item-dir">{dirName}</span>
                            )}
                          </span>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color, width: '12px', textAlign: 'center', marginRight: '4px' }}>
                            {label}
                          </span>
                        </div>
                      );
                    })}
                    {commitDetails.files.length === 0 && (
                      <span className="text-xs text-slate-500 p-2 italic text-center">No files modified</span>
                    )}
                  </div>
                </div>

                {/* Diff Preview Subpanel */}
                {selectedFile && (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '14px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate" style={{ maxWidth: '80%' }}>
                        Diff: {selectedFile.path.split('/').pop()}
                      </span>
                      <button className="action-btn" onClick={() => setSelectedFile(null)} title="Close Diff">
                        <X size={11} />
                      </button>
                    </div>
                    
                    <div className="file-preview-content" style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'auto', flex: 1 }}>
                      {diffLoading ? (
                        <div className="panel-loading" style={{ height: '80px' }}>
                          <Loader2 size={14} className="animate-spin" />
                          <span>Loading commit diff...</span>
                        </div>
                      ) : parsedDiff && parsedDiff.hunks.length > 0 ? (
                        <div className="diff-viewer">
                          {parsedDiff.hunks.map((hunk, hi) => (
                            <div key={hi} className="diff-hunk">
                              <div className="diff-hunk-header">{hunk.header}</div>
                              {hunk.lines.map((line, li) => (
                                <div
                                  key={li}
                                  className={`diff-line ${
                                    line.type === '+' ? 'diff-line-add' :
                                    line.type === '-' ? 'diff-line-del' : 'diff-line-ctx'
                                  }`}
                                >
                                  <span className="diff-line-sign">
                                    {line.type === ' ' ? ' ' : line.type}
                                  </span>
                                  <span className="diff-line-text">{line.text}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <pre className="file-preview-code" style={{ padding: '8px' }}>{diff}</pre>
                      )}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="panel-empty">
                <span>Failed to load details</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
