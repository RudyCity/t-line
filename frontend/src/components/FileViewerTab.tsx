import { useState, useEffect } from 'react';
import { FileCode, Copy, Check, Edit3, Save, X } from 'lucide-react';

interface FileViewerTabProps {
  filePath: string;
  token: string;
}

export function FileViewerTab({ filePath, token }: FileViewerTabProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  
  // Editor States
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadFile() {
      setLoading(true);
      setContent(null);
      setIsEditing(false);
      setSaveError(null);
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

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
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
      setIsEditing(false);
    } catch (e: any) {
      setSaveError(e.message || 'Error saving file');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedContent(content || '');
    setIsEditing(false);
    setSaveError(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-2 p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent" />
        <span className="text-sm font-medium">Reading file...</span>
      </div>
    );
  }

  const lines = (content || '').split('\n');

  return (
    <div className="flex flex-col h-full bg-[#030408] overflow-hidden">
      {/* File Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <FileCode size={14} className="text-purple-400 shrink-0" />
          <span className="text-xs font-mono text-slate-300 truncate" title={filePath}>
            {filePath}
          </span>
          {saveError && (
            <span className="text-[10px] text-red-400 font-semibold truncate ml-2">({saveError})</span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-purple-400 hover:bg-purple-500/10 rounded transition-all duration-150 cursor-pointer"
                title="Edit file"
              >
                <Edit3 size={12} />
                <span>Edit</span>
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded transition-all duration-150 cursor-pointer"
                title="Copy file content"
              >
                {copied ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold text-white bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded transition-all duration-150 cursor-pointer"
                title="Save changes"
              >
                <Save size={12} />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-white/5 disabled:opacity-50 rounded transition-all duration-150 cursor-pointer"
                title="Cancel editing"
              >
                <X size={12} />
                <span>Cancel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {!isEditing ? (
          /* Read-Only View with Line Numbers */
          <div className="w-full h-full overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-300 select-text">
            <div className="min-w-full inline-block">
              {lines.map((line, idx) => (
                <div key={idx} className="flex hover:bg-white/[0.02] py-[1.5px] px-1 rounded">
                  <span className="w-12 text-slate-600 text-right select-none pr-4 shrink-0 font-medium border-r border-white/5 mr-4">
                    {idx + 1}
                  </span>
                  <span className="whitespace-pre text-slate-200">{line || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Editor View */
          <textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            disabled={saving}
            className="w-full h-full p-4 font-mono text-xs bg-[#030408] text-slate-200 resize-none outline-none border-none focus:ring-0 focus:outline-none"
            placeholder="Type content here..."
            style={{
              lineHeight: '1.6',
              tabSize: 2
            }}
          />
        )}
      </div>
    </div>
  );
}
