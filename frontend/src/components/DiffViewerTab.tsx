import { useState, useEffect } from 'react';
import { GitCommit, Loader2, AlertCircle, ChevronDown, ChevronRight } from 'lucide-react';

interface DiffViewerTabProps {
  commitHash: string;
  filePath: string;
  token: string;
  workspaceId: string;
}

interface ParsedHunk {
  header: string;
  oldStart: number;
  newStart: number;
  lines: { type: '+' | '-' | ' '; text: string; oldLine?: number; newLine?: number }[];
}

interface ParsedDiff {
  header: string;
  hunks: ParsedHunk[];
}

function parseDiffWithLineNumbers(diff: string): ParsedDiff {
  const rawLines = diff.split('\n');
  let header = '';
  const hunks: ParsedHunk[] = [];
  let currentHunk: ParsedHunk | null = null;
  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of rawLines) {
    if (line.startsWith('@@')) {
      if (currentHunk) hunks.push(currentHunk);
      // Parse @@ -oldStart,oldCount +newStart,newCount @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      oldLineNum = match ? parseInt(match[1], 10) : 1;
      newLineNum = match ? parseInt(match[2], 10) : 1;
      currentHunk = { header: line, oldStart: oldLineNum, newStart: newLineNum, lines: [] };
    } else if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({ type: '+', text: line.slice(1), newLine: newLineNum++ });
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({ type: '-', text: line.slice(1), oldLine: oldLineNum++ });
      } else {
        currentHunk.lines.push({ type: ' ', text: line.slice(1), oldLine: oldLineNum++, newLine: newLineNum++ });
      }
    } else {
      header += line + '\n';
    }
  }
  if (currentHunk) hunks.push(currentHunk);
  return { header, hunks };
}

function DiffHunk({ hunk, index }: { hunk: ParsedHunk; index: number }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="dvt-hunk">
      <div
        className="dvt-hunk-header"
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand hunk' : 'Collapse hunk'}
      >
        {collapsed
          ? <ChevronRight size={12} style={{ flexShrink: 0 }} />
          : <ChevronDown size={12} style={{ flexShrink: 0 }} />
        }
        <span className="dvt-hunk-label">{hunk.header}</span>
      </div>
      {!collapsed && (
        <div className="dvt-lines">
          {hunk.lines.map((line, li) => {
            const cls =
              line.type === '+' ? 'dvt-line dvt-line-add' :
              line.type === '-' ? 'dvt-line dvt-line-del' :
              'dvt-line dvt-line-ctx';
            return (
              <div key={`${index}-${li}`} className={cls}>
                <span className="dvt-gutter dvt-gutter-old">
                  {line.oldLine ?? ''}
                </span>
                <span className="dvt-gutter dvt-gutter-new">
                  {line.newLine ?? ''}
                </span>
                <span className="dvt-sign">
                  {line.type === ' ' ? ' ' : line.type}
                </span>
                <span className="dvt-text">{line.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DiffViewerTab({
  commitHash,
  filePath,
  token,
  workspaceId,
}: DiffViewerTabProps) {
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
  const shortHash = commitHash.slice(0, 7);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setDiff(null);
    setError(null);

    async function loadDiff() {
      try {
        const res = await fetch(
          `/api/workspaces/${workspaceId}/git/commit-diff?commitHash=${encodeURIComponent(commitHash)}&filePath=${encodeURIComponent(filePath)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (active) setDiff(data.diff ?? '(Empty diff)');
      } catch (e: any) {
        if (active) setError(e.message || 'Failed to load diff');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadDiff();
    return () => { active = false; };
  }, [commitHash, filePath, workspaceId, token]);

  const parsed = diff ? parseDiffWithLineNumbers(diff) : null;
  const addCount = parsed?.hunks.reduce((acc, h) => acc + h.lines.filter(l => l.type === '+').length, 0) ?? 0;
  const delCount = parsed?.hunks.reduce((acc, h) => acc + h.lines.filter(l => l.type === '-').length, 0) ?? 0;

  return (
    <div className="dvt-root">
      <style>{`
        .dvt-root {
          display: flex;
          flex-direction: column;
          height: 100%;
          width: 100%;
          background: var(--bg-main);
          overflow: hidden;
          font-family: var(--font-mono, monospace);
        }
        .dvt-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 7px 14px;
          background: var(--bg-sidebar);
          border-bottom: 1px solid var(--border-color);
          flex-shrink: 0;
        }
        .dvt-header-icon {
          color: var(--color-primary, #a855f7);
          flex-shrink: 0;
        }
        .dvt-header-file {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-main);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          flex: 1;
        }
        .dvt-header-hash {
          font-family: monospace;
          font-size: 0.7rem;
          color: var(--color-primary, #a855f7);
          flex-shrink: 0;
        }
        .dvt-header-stats {
          display: flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }
        .dvt-stat-add {
          font-size: 0.72rem;
          font-weight: 700;
          color: #4ade80;
        }
        .dvt-stat-del {
          font-size: 0.72rem;
          font-weight: 700;
          color: #f87171;
        }
        .dvt-body {
          flex: 1;
          overflow: auto;
          position: relative;
        }
        .dvt-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          height: 100%;
          color: var(--text-muted);
          font-size: 0.8rem;
          font-family: var(--font-sans, sans-serif);
        }
        .dvt-error {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          height: 100%;
          color: #f87171;
          font-size: 0.82rem;
          font-family: var(--font-sans, sans-serif);
        }
        .dvt-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          font-size: 0.8rem;
          font-family: var(--font-sans, sans-serif);
        }
        .dvt-diff-wrap {
          min-width: max-content;
        }
        .dvt-file-header {
          padding: 4px 14px;
          font-size: 0.7rem;
          font-family: monospace;
          color: var(--text-muted);
          background: var(--surface-overlay);
          border-bottom: 1px solid var(--border-color);
          white-space: pre;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .dvt-hunk {
          border-bottom: 1px solid var(--border-color);
        }
        .dvt-hunk-header {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 3px 10px;
          background: rgba(99, 102, 241, 0.08);
          color: #818cf8;
          font-size: 0.7rem;
          cursor: pointer;
          user-select: none;
          border-top: 1px solid rgba(99, 102, 241, 0.15);
        }
        .dvt-hunk-header:hover {
          background: rgba(99, 102, 241, 0.14);
        }
        .dvt-hunk-label {
          font-family: monospace;
          font-size: 0.68rem;
          color: #6366f1;
          white-space: pre;
        }
        .dvt-lines {}
        .dvt-line {
          display: flex;
          align-items: stretch;
          font-size: 0.76rem;
          line-height: 1.6;
          min-height: 20px;
        }
        .dvt-line:hover {
          filter: brightness(1.06);
        }
        .dvt-line-add {
          background: rgba(74, 222, 128, 0.07);
        }
        .dvt-line-del {
          background: rgba(248, 113, 113, 0.07);
        }
        .dvt-line-ctx {
          background: transparent;
        }
        .dvt-gutter {
          display: inline-block;
          width: 44px;
          min-width: 44px;
          text-align: right;
          padding: 0 8px 0 4px;
          font-size: 0.66rem;
          color: var(--text-muted);
          opacity: 0.5;
          user-select: none;
          border-right: 1px solid var(--border-color);
          flex-shrink: 0;
          font-family: monospace;
        }
        .dvt-line-add .dvt-gutter {
          background: rgba(74, 222, 128, 0.05);
        }
        .dvt-line-del .dvt-gutter {
          background: rgba(248, 113, 113, 0.05);
        }
        .dvt-sign {
          display: inline-block;
          width: 18px;
          min-width: 18px;
          text-align: center;
          font-weight: 700;
          font-size: 0.78rem;
          flex-shrink: 0;
          user-select: none;
        }
        .dvt-line-add .dvt-sign { color: #4ade80; }
        .dvt-line-del .dvt-sign { color: #f87171; }
        .dvt-line-ctx .dvt-sign { color: transparent; }
        .dvt-text {
          flex: 1;
          padding: 0 12px;
          white-space: pre;
          overflow: hidden;
          color: var(--text-main);
          font-size: 0.76rem;
        }
        .dvt-line-add .dvt-text { color: #bbf7d0; }
        .dvt-line-del .dvt-text { color: #fecaca; }

        /* Light theme overrides */
        .theme-light .dvt-line-add { background: rgba(22, 163, 74, 0.07); }
        .theme-light .dvt-line-del { background: rgba(220, 38, 38, 0.07); }
        .theme-light .dvt-line-add .dvt-text { color: #15803d; }
        .theme-light .dvt-line-del .dvt-text { color: #b91c1c; }
        .theme-light .dvt-line-add .dvt-sign { color: #16a34a; }
        .theme-light .dvt-line-del .dvt-sign { color: #dc2626; }
        .theme-light .dvt-hunk-header { background: rgba(99, 102, 241, 0.05); }
      `}</style>

      {/* Header */}
      <div className="dvt-header">
        <GitCommit size={14} className="dvt-header-icon" />
        <span className="dvt-header-file" title={filePath}>{fileName}</span>
        <div className="dvt-header-stats">
          {!loading && !error && parsed && (
            <>
              <span className="dvt-stat-add">+{addCount}</span>
              <span className="dvt-stat-del">-{delCount}</span>
            </>
          )}
        </div>
        <span className="dvt-header-hash">{shortHash}</span>
      </div>

      {/* Body */}
      <div className="dvt-body">
        {loading ? (
          <div className="dvt-loading">
            <Loader2 size={16} className="animate-spin" />
            <span>Loading diff...</span>
          </div>
        ) : error ? (
          <div className="dvt-error">
            <AlertCircle size={22} />
            <span>{error}</span>
          </div>
        ) : !parsed || parsed.hunks.length === 0 ? (
          <div className="dvt-empty">
            <span>{diff || '(No diff available)'}</span>
          </div>
        ) : (
          <div className="dvt-diff-wrap">
            {parsed.header && (
              <div className="dvt-file-header">{parsed.header.trim()}</div>
            )}
            {parsed.hunks.map((hunk, i) => (
              <DiffHunk key={i} hunk={hunk} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
