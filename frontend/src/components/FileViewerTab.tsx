import { useState, useEffect } from 'react';
import { FileCode, Save, RotateCcw, Check } from 'lucide-react';
import Editor from '@monaco-editor/react';

interface FileViewerTabProps {
  filePath: string;
  token: string;
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'go':
      return 'go';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'rs':
      return 'rust';
    case 'java':
      return 'java';
    case 'cpp':
    case 'c':
    case 'h':
      return 'cpp';
    default:
      return 'plaintext';
  }
}

export function FileViewerTab({ filePath, token }: FileViewerTabProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Editor States
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadFile() {
      setLoading(true);
      setContent(null);
      setSaveError(null);
      setSaveSuccess(false);
      try {
        const res = await fetch(`/api/fs/read?path=${encodeURIComponent(filePath)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to read file');
        const data = await res.json();
        if (active) {
          setContent(data.content);
          setEditedContent(data.content);
        }
      } catch (e) {
        if (active) {
          setContent('(Unable to read file content)');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }
    loadFile();
    return () => {
      active = false;
    };
  }, [filePath, token]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch('/api/fs/write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ path: filePath, content: editedContent })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save file');
      }
      setContent(editedContent);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e: any) {
      setSaveError(e.message || 'Error saving file');
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = () => {
    setEditedContent(content || '');
    setSaveError(null);
  };

  const handleEditorDidMount = (_editor: any, monaco: any) => {
    monaco.editor.defineTheme('t-line-theme', {
      base: 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': '#030408',
      }
    });
    monaco.editor.setTheme('t-line-theme');
  };

  const isDirty = content !== null && content !== editedContent;

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[#030408] overflow-hidden animate-pulse">
        {/* Skeleton Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80 border-b border-white/5 shrink-0">
          <div className="h-4 w-48 bg-slate-900 rounded" />
          <div className="h-6 w-16 bg-slate-900 rounded" />
        </div>
        
        {/* Skeleton Code Lines */}
        <div className="flex-1 p-4 font-mono text-xs space-y-3">
          {[70, 85, 40, 60, 90, 30, 75, 50, 80, 45, 65, 35].map((width, idx) => (
            <div key={idx} className="flex gap-4 items-center">
              <div className="w-12 h-3 bg-slate-900/60 rounded shrink-0" />
              <div className="h-3 bg-slate-900/40 rounded" style={{ width: `${width}%` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#030408] overflow-hidden">
      {/* File Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <FileCode size={14} className="text-purple-400 shrink-0" />
          <span className="text-xs font-mono text-slate-300 truncate" title={filePath}>
            {filePath}
          </span>
          {isDirty && (
            <span className="text-[10px] text-purple-400 font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
              Modified
            </span>
          )}
          {saveError && (
            <span className="text-[10px] text-red-400 font-semibold truncate ml-2">({saveError})</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {saveSuccess && (
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <Check size={12} />
              <span>Saved!</span>
            </div>
          )}
          
          <button
            onClick={handleSave}
            disabled={saving || !isDirty}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-bold transition-all duration-200 cursor-pointer ${
              isDirty
                ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/25'
                : 'bg-white/5 text-slate-500 cursor-not-allowed'
            }`}
            title="Save changes"
          >
            <Save size={12} />
            <span>{saving ? 'Saving...' : 'Save'}</span>
          </button>
          
          {isDirty && (
            <button
              onClick={handleRevert}
              disabled={saving}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded transition-all duration-150 cursor-pointer"
              title="Revert unsaved changes"
            >
              <RotateCcw size={12} />
              <span>Revert</span>
            </button>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden relative">
        <Editor
          height="100%"
          language={getLanguageFromPath(filePath)}
          theme="vs-dark"
          value={editedContent}
          onChange={(value) => setEditedContent(value || '')}
          onMount={handleEditorDidMount}
          loading={
            <div className="absolute inset-0 flex items-center justify-center bg-[#030408]">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent" />
            </div>
          }
          options={{
            minimap: { enabled: false },
            fontSize: window.innerWidth <= 768 ? 11 : 13,
            lineHeight: 20,
            automaticLayout: true,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              useShadows: false,
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10
            },
            padding: { top: 8, bottom: 8 },
            lineNumbersMinChars: 3,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            renderLineHighlight: 'all',
            tabSize: 2,
            fontFamily: "var(--font-mono), Consolas, 'Courier New', monospace"
          }}
        />
      </div>
    </div>
  );
}
