import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  FileCode,
  Loader2,
  X,
  Trash2
} from 'lucide-react';
import { GitFileStatus } from './GitChanges';

interface FsItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface TreeNode extends FsItem {
  children?: TreeNode[];
  expanded?: boolean;
  loaded?: boolean;
}

interface ExplorerProps {
  rootPath: string;
  token: string;
  onFileClick?: (path: string, name: string) => void;
  changedFiles?: GitFileStatus[];
  onRefresh?: () => void;
  refreshTrigger?: number;
}

async function fetchExplore(dirPath: string, token: string): Promise<FsItem[]> {
  const res = await fetch(`/api/fs/explore?path=${encodeURIComponent(dirPath)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch directory');
  const data = await res.json();
  return data.contents as FsItem[];
}

async function fetchFileContent(filePath: string, token: string): Promise<string> {
  const res = await fetch(`/api/fs/read?path=${encodeURIComponent(filePath)}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to read file');
  const data = await res.json();
  return data.content as string;
}

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const iconMap: Record<string, { color: string }> = {
    ts: { color: '#3b82f6' },
    tsx: { color: '#06b6d4' },
    js: { color: '#eab308' },
    jsx: { color: '#f97316' },
    json: { color: '#a3e635' },
    md: { color: '#a78bfa' },
    css: { color: '#ec4899' },
    html: { color: '#f87171' },
    yml: { color: '#fb923c' },
    yaml: { color: '#fb923c' },
    sh: { color: '#34d399' },
    py: { color: '#60a5fa' },
    env: { color: '#facc15' },
    gitignore: { color: '#f97316' }
  };
  return iconMap[ext] ?? { color: 'var(--text-muted)' };
}

function getRelativePath(rootPath: string, itemPath: string): string {
  const normRoot = rootPath.replace(/\\/g, '/').replace(/\/$/, '');
  const normItem = itemPath.replace(/\\/g, '/');
  
  if (normItem.startsWith(normRoot)) {
    return normItem.slice(normRoot.length).replace(/^\//, '');
  }
  return normItem;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  modified: {
    label: 'M',
    color: '#fbbf24',
    bg: 'rgba(251, 191, 36, 0.1)',
    border: '1px solid rgba(251, 191, 36, 0.2)'
  },
  added: {
    label: 'A',
    color: '#4ade80',
    bg: 'rgba(74, 222, 128, 0.1)',
    border: '1px solid rgba(74, 222, 128, 0.2)'
  },
  untracked: {
    label: 'U',
    color: '#4ade80',
    bg: 'rgba(74, 222, 128, 0.1)',
    border: '1px solid rgba(74, 222, 128, 0.2)'
  },
  deleted: {
    label: 'D',
    color: '#f87171',
    bg: 'rgba(248, 113, 113, 0.1)',
    border: '1px solid rgba(248, 113, 113, 0.2)'
  },
  renamed: {
    label: 'R',
    color: '#a78bfa',
    bg: 'rgba(167, 139, 250, 0.1)',
    border: '1px solid rgba(167, 139, 250, 0.2)'
  }
};

function TreeNodeItem({
  node,
  depth,
  token,
  onFileClick,
  rootPath,
  changedFiles = [],
  refreshTrigger = 0,
  onContextMenu
}: {
  node: TreeNode;
  depth: number;
  token: string;
  onFileClick: (path: string, name: string) => void;
  rootPath: string;
  changedFiles?: GitFileStatus[];
  refreshTrigger?: number;
  onContextMenu: (e: React.MouseEvent, node: TreeNode) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  const lastTriggerRef = useRef(refreshTrigger);

  useEffect(() => {
    if (expanded && refreshTrigger !== lastTriggerRef.current) {
      lastTriggerRef.current = refreshTrigger;
      const reloadChildren = async () => {
        try {
          const items = await fetchExplore(node.path, token);
          setChildren(items.map(i => ({ ...i })));
        } catch {
          // ignore
        }
      };
      reloadChildren();
    }
  }, [refreshTrigger, expanded, node.path, token]);

  const toggle = useCallback(async () => {
    if (!node.isDirectory) {
      onFileClick(node.path, node.name);
      return;
    }
    if (!expanded && children.length === 0) {
      setLoading(true);
      try {
        const items = await fetchExplore(node.path, token);
        setChildren(items.map(i => ({ ...i })));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    setExpanded(prev => !prev);
  }, [expanded, children.length, node, token, onFileClick]);

  const iconColor = !node.isDirectory ? getFileIcon(node.name).color : undefined;
  const indent = depth * 14;

  const relPath = getRelativePath(rootPath, node.path).toLowerCase();
  
  const fileGitStatus = !node.isDirectory 
    ? changedFiles.find(f => f.path.replace(/\\/g, '/').toLowerCase() === relPath)
    : null;

  const dirChangesCount = node.isDirectory
    ? changedFiles.filter(f => {
        const fPath = f.path.replace(/\\/g, '/').toLowerCase();
        return fPath.startsWith(relPath + '/');
      }).length
    : 0;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onContextMenu(e, node);
  };

  return (
    <div>
      <button
        className="explorer-item"
        style={{ paddingLeft: `${8 + indent}px` }}
        onClick={toggle}
        onContextMenu={handleContextMenu}
        title={node.path}
      >
        <span className="explorer-item-arrow">
          {node.isDirectory
            ? loading
              ? <Loader2 size={12} className="animate-spin" />
              : expanded
              ? <ChevronDown size={12} />
              : <ChevronRight size={12} />
            : null}
        </span>
        {node.isDirectory ? (
          expanded
            ? <FolderOpen size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
            : <Folder size={14} style={{ color: '#60a5fa', flexShrink: 0 }} />
        ) : (
          <File size={14} style={{ color: iconColor, flexShrink: 0 }} />
        )}
        <span className="explorer-item-name">{node.name}</span>

        {!node.isDirectory && fileGitStatus && statusConfig[fileGitStatus.status] && (
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '1px 5px',
              borderRadius: '4px',
              display: 'inline-flex',
              alignItems: 'center',
              lineHeight: 1,
              color: statusConfig[fileGitStatus.status].color,
              background: statusConfig[fileGitStatus.status].bg,
              border: statusConfig[fileGitStatus.status].border,
              flexShrink: 0
            }}
          >
            {statusConfig[fileGitStatus.status].label}
          </span>
        )}

        {node.isDirectory && dirChangesCount > 0 && (
          <span
            style={{
              fontSize: '0.62rem',
              fontWeight: 700,
              padding: '1px 4px',
              borderRadius: '999px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '14px',
              height: '14px',
              lineHeight: 1,
              color: '#fbbf24',
              background: 'rgba(251, 191, 36, 0.15)',
              border: '1px solid rgba(251, 191, 36, 0.2)',
              flexShrink: 0
            }}
            title={`${dirChangesCount} changed file(s) inside`}
          >
            {dirChangesCount}
          </span>
        )}
      </button>
      {expanded && children.length > 0 && (
        <div>
          {children.map(child => (
            <TreeNodeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              token={token}
              onFileClick={onFileClick}
              rootPath={rootPath}
              changedFiles={changedFiles}
              refreshTrigger={refreshTrigger}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Explorer Context Menu Sub-Component ────────────────────────
interface ExplorerContextMenuProps {
  x: number;
  y: number;
  node: TreeNode;
  onClose: () => void;
  onDelete: (node: TreeNode) => void;
  onOpenExplorer: (node: TreeNode) => void;
}

function ExplorerContextMenu({ x, y, node, onClose, onDelete, onOpenExplorer }: ExplorerContextMenuProps) {
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('.terminal-ctx-menu') === null) {
        onClose();
      }
    };
    window.addEventListener('mousedown', close, true);
    return () => window.removeEventListener('mousedown', close, true);
  }, [onClose]);

  return (
    <div
      className="terminal-ctx-menu"
      style={{ position: 'fixed', top: y, left: x, zIndex: 1000 }}
    >
      <button
        onClick={() => {
          onOpenExplorer(node);
          onClose();
        }}
        className="terminal-ctx-item"
      >
        <span className="terminal-ctx-icon">
          <FolderOpen size={13} />
        </span>
        <span className="terminal-ctx-label">
          {node.isDirectory ? 'Open in Explorer' : 'Reveal in Explorer'}
        </span>
      </button>
      <div className="terminal-ctx-separator" />
      <button
        onClick={() => {
          onDelete(node);
          onClose();
        }}
        className="terminal-ctx-item danger"
      >
        <span className="terminal-ctx-icon">
          <Trash2 size={13} />
        </span>
        <span className="terminal-ctx-label">Delete</span>
      </button>
    </div>
  );
}

export function FileExplorer({
  rootPath,
  token,
  onFileClick,
  changedFiles = [],
  onRefresh,
  refreshTrigger = 0
}: ExplorerProps) {
  const [roots, setRoots] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ path: string; name: string; content: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [localTrigger, setLocalTrigger] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; node: TreeNode } | null>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  }, []);

  // Keep onRefresh in a ref so it never causes load() to be recreated.
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const items = await fetchExplore(rootPath, token);
      setRoots(items.map(i => ({ ...i })));
      setLocalTrigger(prev => prev + 1);
      if (onRefreshRef.current) onRefreshRef.current();
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [rootPath, token]);

  const handleDeleteNode = useCallback(async (node: TreeNode) => {
    const confirmMsg = `Are you sure you want to delete ${node.name}? This action cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/fs/delete?path=${encodeURIComponent(node.path)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        window.dispatchEvent(new CustomEvent('tline-toast', {
          detail: { message: `Deleted ${node.name}` }
        }));
        load();
      } else {
        const err = await res.json();
        alert(`Failed to delete: ${err.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Error deleting: ${e.message}`);
    }
  }, [token, load]);

  const handleOpenExplorer = useCallback(async (node: TreeNode) => {
    try {
      const res = await fetch('/api/fs/open-explorer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path: node.path })
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Failed to open in explorer: ${err.error || 'Unknown error'}`);
      }
    } catch (e: any) {
      alert(`Error opening in explorer: ${e.message}`);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const prevRefreshTrigger = useRef(refreshTrigger);
  useEffect(() => {
    if (refreshTrigger > 0 && refreshTrigger !== prevRefreshTrigger.current) {
      prevRefreshTrigger.current = refreshTrigger;
      load();
    }
  }, [refreshTrigger, load]);

  const combinedTrigger = refreshTrigger + localTrigger;

  const handleFileClick = useCallback(async (path: string, name: string) => {
    if (onFileClick) {
      onFileClick(path, name);
      return;
    }
    setPreviewLoading(true);
    setPreview(null);
    try {
      const content = await fetchFileContent(path, token);
      setPreview({ path, name, content });
    } catch {
      setPreview({ path, name, content: '(Unable to read file)' });
    } finally {
      setPreviewLoading(false);
    }
  }, [token, onFileClick]);

  return (
    <div className="panel-container">
      <div className="panel-split">
        {/* Tree panel */}
        <div className="explorer-tree">
          <div className="panel-section-header">
            <span className="panel-section-title">EXPLORER</span>
            <button
              className="action-btn"
              onClick={load}
              title="Refresh"
              disabled={loading}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          <div className="explorer-scroll">
            {loading && roots.length === 0 ? (
              <div className="panel-loading">
                <Loader2 size={16} className="animate-spin" />
                <span>Loading...</span>
              </div>
            ) : (
              roots.map(node => (
                <TreeNodeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  token={token}
                  onFileClick={handleFileClick}
                  rootPath={rootPath}
                  changedFiles={changedFiles}
                  refreshTrigger={combinedTrigger}
                  onContextMenu={handleContextMenu}
                />
              ))
            )}
          </div>
        </div>

        {/* Preview panel */}
        {(preview || previewLoading) && (
          <div className="file-preview">
            <div className="panel-section-header">
              <div className="flex items-center gap-2 truncate">
                <FileCode size={13} style={{ color: preview ? getFileIcon(preview.name).color : 'var(--text-muted)', flexShrink: 0 }} />
                <span className="panel-section-title truncate">{preview?.name ?? '...'}</span>
              </div>
              <button className="action-btn" onClick={() => setPreview(null)} title="Close preview">
                <X size={13} />
              </button>
            </div>
            <div className="file-preview-content">
              {previewLoading ? (
                <div className="panel-loading">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Reading file...</span>
                </div>
              ) : (
                <pre className="file-preview-code">{preview?.content}</pre>
              )}
            </div>
          </div>
        )}
      </div>

      {contextMenu && (
        <ExplorerContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          node={contextMenu.node}
          onClose={() => setContextMenu(null)}
          onDelete={handleDeleteNode}
          onOpenExplorer={handleOpenExplorer}
        />
      )}
    </div>
  );
}
