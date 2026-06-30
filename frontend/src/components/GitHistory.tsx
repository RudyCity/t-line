import { useState, useEffect, useCallback } from 'react';
import { GitCommit, User, Calendar, FileCode, FilePlus, FileMinus, X, Loader2, RefreshCw } from 'lucide-react';
import { LinkVertical } from '@visx/shape';

export interface CommitInfo {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  subject: string;
  graphPrefix: string;
  refNames?: string;
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
  '#38bdf8', // sky-400
  '#4ade80', // green-400
  '#f43f5e', // rose-400
  '#fbbf24', // amber-400
  '#c084fc', // purple-400
  '#22d3ee', // cyan-400
  '#f472b6', // pink-400
];

function GitGraphLine({ prefix }: { prefix: string }) {
  const chars = prefix.split('');
  const laneWidth = 12;
  const rowHeight = 50;
  const svgWidth = chars.length * laneWidth;

  return (
    <svg 
      width={svgWidth} 
      height="100%" 
      viewBox={`0 0 ${svgWidth} ${rowHeight}`} 
      preserveAspectRatio="none"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {chars.map((char, index) => {
        const laneColor = LANE_COLORS[index % LANE_COLORS.length];
        const xc = index * laneWidth + laneWidth / 2;
        const xl = index * laneWidth;
        const xr = (index + 1) * laneWidth;
        const yc = rowHeight / 2;

        if (char === ' ') {
          return null;
        }

        if (char === '*') {
          return (
            <g key={index}>
              <line 
                x1={xc} 
                y1={0} 
                x2={xc} 
                y2={rowHeight} 
                stroke="var(--tree-connector-color, rgba(255, 255, 255, 0.08))" 
                strokeWidth={2} 
              />
              <circle 
                cx={xc} 
                cy={yc} 
                r={4} 
                fill="var(--color-primary, #a855f7)" 
                stroke="var(--bg-sidebar, #1e1e2e)" 
                strokeWidth={1.5}
                style={{
                  filter: 'drop-shadow(0px 0px 3px var(--color-primary, #a855f7))'
                }}
              />
            </g>
          );
        }

        if (char === '|') {
          return (
            <line 
              key={index}
              x1={xc} 
              y1={0} 
              x2={xc} 
              y2={rowHeight} 
              stroke={laneColor} 
              strokeWidth={2} 
            />
          );
        }

        if (char === '/') {
          // Slope up-right (branches/merges leftward going down)
          // Top: index, Bottom: index - 1
          const xcBottom = (index - 1) * laneWidth + laneWidth / 2;
          return (
            <LinkVertical
              key={index}
              data={{
                source: { x: xcBottom, y: rowHeight },
                target: { x: xc, y: 0 }
              }}
              stroke={laneColor}
              strokeWidth={2}
              fill="none"
            />
          );
        }

        if (char === '\\') {
          // Slope down-right (branches/merges rightward going down)
          // Top: index, Bottom: index + 1
          const xcBottom = (index + 1) * laneWidth + laneWidth / 2;
          return (
            <LinkVertical
              key={index}
              data={{
                source: { x: xc, y: 0 },
                target: { x: xcBottom, y: rowHeight }
              }}
              stroke={laneColor}
              strokeWidth={2}
              fill="none"
            />
          );
        }

        if (char === '_') {
          return (
            <line 
              key={index}
              x1={xl} 
              y1={rowHeight - 1} 
              x2={xr} 
              y2={rowHeight - 1} 
              stroke={laneColor} 
              strokeWidth={2} 
            />
          );
        }

        return (
          <text 
            key={index} 
            x={xc} 
            y={yc + 3} 
            textAnchor="middle" 
            fill={laneColor} 
            fontSize="9px" 
            fontFamily="monospace"
            fontWeight="bold"
          >
            {char}
          </text>
        );
      })}
    </svg>
  );
}

function getAvatarColor(name: string) {
  if (!name) return 'var(--color-primary, #a855f7)';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    '#ec4899', // pink-500
    '#f43f5e', // rose-500
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#a855f7', // purple-500
    '#f59e0b', // amber-500
    '#06b6d4', // cyan-500
    '#84cc16', // lime-500
  ];
  return colors[Math.abs(hash) % colors.length];
}

function RefBadges({ refNames }: { refNames?: string }) {
  if (!refNames) return null;
  const refs = refNames.split(',').map(r => r.trim()).filter(Boolean);
  return (
    <>
      {refs.map((ref, idx) => {
        let type: 'head' | 'branch' | 'remote' | 'tag' = 'branch';
        let label = ref;
        if (ref.startsWith('HEAD -> ')) {
          type = 'head';
          label = ref.replace('HEAD -> ', '');
        } else if (ref.startsWith('tag: ')) {
          type = 'tag';
          label = ref.replace('tag: ', '');
        } else if (ref.includes('/')) {
          type = 'remote';
        }
        return (
          <span key={idx} className={`git-ref-badge git-ref-${type}`} title={ref}>
            {label}
          </span>
        );
      })}
    </>
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
        .git-history-container {
          position: relative;
          display: flex;
          flex-direction: column;
          width: 100%;
        }
        .git-history-item {
          display: flex;
          align-items: stretch;
          border-bottom: 1px solid var(--border-color);
          cursor: pointer;
          min-height: 50px;
          transition: background-color 0.15s;
        }
        .git-history-item:hover {
          background: var(--surface-overlay);
        }
        .git-history-item-active {
          background: rgba(168, 85, 247, 0.08) !important;
          border-left: 3px solid var(--color-primary, #a855f7);
        }
        .git-graph-col {
          display: flex;
          align-items: stretch;
          padding: 0 10px;
          border-right: 1px solid var(--border-color);
          background: transparent;
          min-width: 66px;
          max-width: 150px;
          flex-shrink: 0;
          overflow-x: auto;
          overflow-y: hidden;
        }
        .git-graph-col::-webkit-scrollbar {
          height: 2px;
        }
        .git-graph-col::-webkit-scrollbar-thumb {
          background: var(--scrollbar-thumb, rgba(255,255,255,0.1));
        }
        .git-commit-info-col {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          flex: 1;
          min-width: 0;
          gap: 12px;
        }
        .git-author-avatar-tiny {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: bold;
          color: white;
          flex-shrink: 0;
          text-shadow: 0 1px 1px rgba(0,0,0,0.2);
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }
        .git-commit-text-block {
          display: flex;
          flex-direction: column;
          justify-content: center;
          flex: 1;
          min-width: 0;
        }
        .git-history-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.68rem;
          color: var(--text-muted);
          margin-top: 3px;
        }
        .git-ref-badge {
          display: inline-flex;
          align-items: center;
          padding: 1px 6px;
          border-radius: 4px;
          font-size: 0.65rem;
          font-weight: 600;
          margin-left: 6px;
          border: 1px solid transparent;
          vertical-align: middle;
          white-space: nowrap;
        }
        .git-ref-head {
          background: rgba(168, 85, 247, 0.12);
          color: #c084fc;
          border-color: rgba(168, 85, 247, 0.3);
        }
        .git-ref-branch {
          background: rgba(74, 222, 128, 0.12);
          color: #4ade80;
          border-color: rgba(74, 222, 128, 0.3);
        }
        .git-ref-remote {
          background: rgba(239, 68, 68, 0.12);
          color: #f87171;
          border-color: rgba(239, 68, 68, 0.3);
        }
        .git-ref-tag {
          background: rgba(245, 158, 11, 0.12);
          color: #fbbf24;
          border-color: rgba(245, 158, 11, 0.3);
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
          background: var(--surface-overlay);
          border: 1px solid var(--border-color);
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

        /* Light Theme Overrides for high contrast and clean lines */
        .theme-light .git-ref-head {
          background: rgba(124, 58, 237, 0.08);
          color: #7c3aed;
          border-color: rgba(124, 58, 237, 0.22);
        }
        .theme-light .git-ref-branch {
          background: rgba(22, 163, 74, 0.08);
          color: #16a34a;
          border-color: rgba(22, 163, 74, 0.22);
        }
        .theme-light .git-ref-remote {
          background: rgba(220, 38, 38, 0.08);
          color: #dc2626;
          border-color: rgba(220, 38, 38, 0.22);
        }
        .theme-light .git-ref-tag {
          background: rgba(217, 119, 6, 0.08);
          color: #d97706;
          border-color: rgba(217, 119, 6, 0.22);
        }
        .theme-light .git-author-avatar-tiny {
          box-shadow: none;
          text-shadow: none;
        }
        .theme-light .git-history-item-active {
          background: var(--tab-active-bg) !important;
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
        
        <div className="explorer-scroll" style={{ flex: 1, position: 'relative' }}>
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
            <div className="git-history-container">
              {history.map((commit, index) => {
                const isCommitNode = !!commit.hash;
                const isActive = selectedCommitHash === commit.hash;
                const initials = commit.authorName ? commit.authorName.slice(0, 2).toUpperCase() : '?';
                
                return (
                  <div
                    key={commit.hash || `connector-${index}`}
                    className={`git-history-item ${isActive ? 'git-history-item-active' : ''}`}
                    onClick={() => isCommitNode && handleCommitSelect(commit)}
                    style={{ cursor: isCommitNode ? 'pointer' : 'default' }}
                  >
                    {/* Visual tree graph column */}
                    <div className="git-graph-col">
                      <GitGraphLine prefix={commit.graphPrefix} />
                    </div>
                    
                    {/* Commit info column */}
                    {isCommitNode ? (
                      <div className="git-commit-info-col">
                        {/* Author Avatar circle */}
                        <div 
                          className="git-author-avatar-tiny"
                          style={{ backgroundColor: getAvatarColor(commit.authorName) }}
                        >
                          {initials}
                        </div>
                        
                        {/* Text Details */}
                        <div className="git-commit-text-block">
                          <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                            <span className="explorer-item-name truncate font-semibold flex-1" style={{ fontSize: '0.8rem' }}>
                              {commit.subject}
                            </span>
                            <RefBadges refNames={commit.refNames} />
                          </div>
                          <div className="git-history-meta">
                            <span className="font-mono text-purple-400 font-semibold">{commit.shortHash}</span>
                            <span>•</span>
                            <span>{commit.authorName}</span>
                            <span>•</span>
                            <span>{commit.date}</span>
                          </div>
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
