import { useState, useEffect } from 'react';
import { FileCode, Copy, Check } from 'lucide-react';

interface FileViewerTabProps {
  filePath: string;
  token: string;
}

export function FileViewerTab({ filePath, token }: FileViewerTabProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadFile() {
      setLoading(true);
      setContent(null);
      try {
        const res = await fetch(`/api/fs/read?path=${encodeURIComponent(filePath)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to read file');
        const data = await res.json();
        if (active) {
          setContent(data.content);
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
    <div className="flex flex-col h-full bg-[#030408] border border-white/5 rounded-lg overflow-hidden">
      {/* File Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/80 border-b border-white/5 shrink-0">
        <div className="flex items-center gap-2 truncate">
          <FileCode size={14} className="text-purple-400 shrink-0" />
          <span className="text-xs font-mono text-slate-300 truncate" title={filePath}>
            {filePath}
          </span>
        </div>
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
      </div>

      {/* Code Area */}
      <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-300 select-text">
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
    </div>
  );
}
