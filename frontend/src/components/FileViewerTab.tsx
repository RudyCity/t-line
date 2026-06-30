import { useState, useEffect, useRef } from 'react';
import { FileCode, RotateCcw, Check, ZoomIn, ZoomOut, Maximize, Image as ImageIcon, FileText, File } from 'lucide-react';
import Editor, { loader } from '@monaco-editor/react';

interface FileViewerTabProps {
  filePath: string;
  token: string;
  onSave?: () => void;
  theme?: string;
  themeBackground?: string;
}

function getFileType(filePath: string): 'image' | 'pdf' | 'text' | 'binary' {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'].includes(ext || '')) {
    return 'image';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  const binaryExtensions = [
    'exe', 'dll', 'so', 'dylib', 'bin', 'zip', 'tar', 'gz', 'rar', '7z',
    'mp3', 'mp4', 'wav', 'ogg', 'webm', 'woff', 'woff2', 'ttf', 'eot', 'dmg',
    'pkg', 'iso', 'class', 'jar', 'db', 'sqlite'
  ];
  if (binaryExtensions.includes(ext || '')) {
    return 'binary';
  }
  return 'text';
}

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'ts':
      return 'typescript';
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
    case 'svg':
    case 'xml':
      return 'xml';
    default:
      return 'plaintext';
  }
}

export function FileViewerTab({ filePath, token, onSave, theme, themeBackground }: FileViewerTabProps) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Editor States
  const [editedContent, setEditedContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Image zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const imageContainerRef = useRef<HTMLDivElement>(null);


  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 4));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25));
  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const fileType = getFileType(filePath);
  const isSvg = filePath.split('.').pop()?.toLowerCase() === 'svg';
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  useEffect(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    if (isSvg) {
      setViewMode('preview');
    }
  }, [filePath, isSvg]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragStart.current.x,
        y: e.clientY - dragStart.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (fileType !== 'image') return;
    const container = imageContainerRef.current;
    if (!container) return;

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        setZoom(z => Math.min(z + 0.1, 4));
      } else {
        setZoom(z => Math.max(z - 0.1, 0.25));
      }
    };

    container.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheelEvent);
    };
  }, [fileType]);

  // SVG always loads as text — content is needed for inline DOM rendering in Preview mode
  // and for Monaco editor in Code mode. Avoids re-fetch when switching between modes.
  const shouldLoadAsText = fileType === 'text' || isSvg;
  // renderType controls which UI to show — SVG code mode shows Monaco, otherwise image/pdf/binary
  const renderType = (isSvg && viewMode === 'code') ? 'text' : fileType;

  useEffect(() => {
    if (!shouldLoadAsText) {
      setLoading(false);
      return;
    }

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
      // Dispose of the Monaco model for this file when switching/unmounting to prevent memory leaks
      loader.init().then((monaco) => {
        const models = monaco.editor.getModels();
        const targetModel = models.find((m: any) => m.uri.path.endsWith(filePath.replace(/\\/g, '/')));
        if (targetModel) {
          targetModel.dispose();
        }
      }).catch(() => {});
    };
  }, [filePath, token, shouldLoadAsText]);

  // Monaco Editor theme effect
  useEffect(() => {
    const monacoObj = (window as any).monaco;
    if (monacoObj) {
      monacoObj.editor.defineTheme('t-line-theme', {
        base: theme === 'light' ? 'vs' : 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': themeBackground || '#030408',
        }
      });
      monacoObj.editor.setTheme('t-line-theme');
    }
  }, [theme, themeBackground]);

  // Debounced Auto-Save Effect
  useEffect(() => {
    if (content === null || editedContent === content) return;

    const timer = setTimeout(() => {
      async function autoSave() {
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
          onSave?.();
          setTimeout(() => setSaveSuccess(false), 1500);
        } catch (e: any) {
          setSaveError(e.message || 'Error saving file');
        } finally {
          setSaving(false);
        }
      }
      autoSave();
    }, 1000);

    return () => clearTimeout(timer);
  }, [editedContent, content, filePath, token]);

  const handleRevert = () => {
    setEditedContent(content || '');
    setSaveError(null);
  };

  const handleEditorDidMount = (_editor: any, monaco: any) => {
    monaco.editor.defineTheme('t-line-theme', {
      base: theme === 'light' ? 'vs' : 'vs-dark',
      inherit: true,
      rules: [],
      colors: {
        'editor.background': themeBackground || '#030408',
      }
    });
    monaco.editor.setTheme('t-line-theme');
  };

  const isDirty = content !== null && content !== editedContent;

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-[var(--bg-main)] overflow-hidden animate-pulse">
        {/* Skeleton Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-sidebar)]/80 border-b border-[var(--border-color)] shrink-0">
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

  if (renderType === 'image') {
    return (
      <div className="flex flex-col flex-1 w-full h-full bg-[var(--bg-main)] overflow-hidden">
        {/* File Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-sidebar)]/80 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-2 truncate">
            <ImageIcon size={14} className="text-purple-400 shrink-0" />
            <span className="text-xs font-mono text-slate-300 truncate" title={filePath}>
              {filePath}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isSvg && (
              <div className="flex items-center bg-slate-900 rounded-md p-0.5 border border-slate-800 mr-2">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition duration-150 cursor-pointer ${
                    viewMode === 'preview'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Preview
                </button>
                <button
                  onClick={() => setViewMode('code')}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition duration-150 cursor-pointer ${
                    viewMode === 'code'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Code
                </button>
              </div>
            )}
            <div className="text-[11px] text-slate-500 font-medium">Image Preview</div>
          </div>
        </div>

        {/* Image Viewer Area */}
        <div 
          ref={imageContainerRef}
          className="flex-1 flex flex-col items-center justify-center p-4 bg-[#0a0a0c] overflow-auto select-none relative"
        >
          {/* Zoom Controls Overlay */}
          <div className="absolute top-4 right-4 flex items-center gap-1 bg-[#16161a]/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10 z-10">
            <button 
              className="flex items-center justify-center p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded transition duration-150 cursor-pointer" 
              onClick={handleZoomOut} 
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <span className="text-xs font-medium text-slate-300 font-mono w-12 text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button 
              className="flex items-center justify-center p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded transition duration-150 cursor-pointer" 
              onClick={handleZoomIn} 
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <button 
              className="flex items-center justify-center p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded transition duration-150 cursor-pointer" 
              onClick={handleResetZoom} 
              title="Reset Zoom"
            >
              <Maximize size={14} />
            </button>
          </div>

          {/* Checkerboard background wrapper */}
          <div 
            className="rounded-lg border border-white/5 overflow-hidden"
            style={{
              backgroundImage: 'radial-gradient(#ffffff0a 1px, transparent 0), radial-gradient(#ffffff0a 1px, #0a0a0c 0)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 10px 10px',
              position: 'absolute',
              top: '16px',
              bottom: '16px',
              left: '16px',
              right: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isSvg ? (
              // Render SVG inline — most reliable in Electron (no URL scheme / CSP issues).
              // Also live-synced: re-renders immediately after every auto-save.
              <div
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                  width: '90%',
                  height: '90%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isDragging ? 'grabbing' : 'grab',
                  overflow: 'hidden',
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                  dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
                }}
                // Inject SVG XML directly into DOM — avoids blob:/data: URL handling by browser
                dangerouslySetInnerHTML={{ __html: editedContent || '' }}
              />
            ) : (
              <img
                src={`/api/fs/raw?path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`}
                alt={filePath.split(/[/\\]/).pop()}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                  maxWidth: '90%',
                  maxHeight: '90%',
                  objectFit: 'contain',
                  cursor: isDragging ? 'grabbing' : 'grab'
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                  dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
                }}
                draggable={false}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  if (renderType === 'pdf') {
    return (
      <div className="flex flex-col flex-1 w-full h-full bg-[var(--bg-main)] overflow-hidden">
        {/* File Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-sidebar)]/80 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-2 truncate">
            <FileText size={14} className="text-purple-400 shrink-0" />
            <span className="text-xs font-mono text-slate-300 truncate" title={filePath}>
              {filePath}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">PDF Document</div>
        </div>

        {/* PDF Frame */}
        <div className="flex-1 w-full h-full bg-[#0a0a0c] overflow-hidden">
          <iframe
            src={`/api/fs/raw?path=${encodeURIComponent(filePath)}&token=${encodeURIComponent(token)}`}
            className="w-full h-full border-none"
            title="PDF Viewer"
          />
        </div>
      </div>
    );
  }

  if (renderType === 'binary') {
    const handleRevealInExplorer = async () => {
      try {
        const res = await fetch('/api/fs/open-explorer', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ path: filePath })
        });
        if (!res.ok) {
          const err = await res.json();
          alert(`Failed to reveal file: ${err.error}`);
        }
      } catch (e: any) {
        alert(`Error revealing file: ${e.message}`);
      }
    };

    return (
      <div className="flex flex-col flex-1 w-full h-full bg-[var(--bg-main)] overflow-hidden">
        {/* File Header */}
        <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-sidebar)]/80 border-b border-[var(--border-color)] shrink-0">
          <div className="flex items-center gap-2 truncate">
            <File size={14} className="text-slate-400 shrink-0" />
            <span className="text-xs font-mono text-slate-300 truncate" title={filePath}>
              {filePath}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">Binary File</div>
        </div>

        {/* Binary Warning Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0a0a0c] select-none text-center">
          <div className="p-4 rounded-full bg-slate-900 border border-slate-800 text-slate-400 mb-4 animate-pulse">
            <File size={32} />
          </div>
          <h3 className="text-sm font-semibold text-slate-200 mb-1">
            Binary File Not Supported
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mb-6 leading-relaxed">
            This file cannot be displayed in the editor because it is a binary file or has an unsupported format.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRevealInExplorer}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-md transition-colors duration-150 cursor-pointer"
            >
              Reveal in Explorer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 w-full h-full bg-[var(--bg-main)] overflow-hidden">
      {/* File Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--bg-sidebar)]/80 border-b border-[var(--border-color)] shrink-0">
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
          {isSvg && (
            <div className="flex items-center bg-slate-900 rounded-md p-0.5 border border-slate-800 mr-2">
              <button
                onClick={() => setViewMode('preview')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition duration-150 cursor-pointer ${
                  viewMode === 'preview'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Preview
              </button>
              <button
                onClick={() => setViewMode('code')}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition duration-150 cursor-pointer ${
                  viewMode === 'code'
                    ? 'bg-purple-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Code
              </button>
            </div>
          )}
          {saving ? (
            <div className="flex items-center gap-1.5 text-[11px] text-purple-400 font-medium animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-ping" />
              <span>Saving...</span>
            </div>
          ) : saveSuccess ? (
            <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <Check size={12} />
              <span>Saved</span>
            </div>
          ) : isDirty ? (
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-purple-400 font-semibold px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                Modified
              </span>
              <button
                onClick={handleRevert}
                className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-white hover:bg-white/5 rounded transition-all duration-150 cursor-pointer"
                title="Revert changes"
              >
                <RotateCcw size={12} />
                <span>Revert</span>
              </button>
            </div>
          ) : (
            <span className="text-[11px] text-slate-500 font-medium">Auto-save active</span>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 w-full h-full overflow-hidden relative">
        <Editor
          height="100%"
          width="100%"
          language={getLanguageFromPath(filePath)}
          theme="t-line-theme"
          value={editedContent}
          onChange={(value) => setEditedContent(value || '')}
          onMount={handleEditorDidMount}
          loading={
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--bg-main)]">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--color-primary)] border-t-transparent" />
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
