import React, { useState, useEffect, useRef } from 'react';
import { 
  Globe, RotateCw, Bug, MousePointer, Check, 
  AlertCircle, ShieldAlert, Code2, Sparkles, Layout, Columns
} from 'lucide-react';
import { TabData } from '../hooks/useTerminals';

interface ConsoleErrorLog {
  id: string;
  timestamp: string;
  message: string;
  filename: string;
  lineno: number;
  colno: number;
  stack: string | null;
}

interface InspectedElement {
  tagName: string;
  id: string;
  classes: string[];
  outerHTML: string;
  computedStyles: Record<string, string>;
  selectorPath: string;
}

interface BrowserTabProps {
  tab: TabData;
  onUpdateTabName?: (newName: string) => void;
}

export default function BrowserTab({ tab, onUpdateTabName }: BrowserTabProps) {
  const [isSplit, setIsSplit] = useState(false);
  const [activeFrame, setActiveFrame] = useState<'left' | 'right'>('left');
  
  // Left Frame State
  const [leftUrlInput, setLeftUrlInput] = useState(tab.url || 'https://www.google.com');
  const [leftActiveUrl, setLeftActiveUrl] = useState(tab.url || 'https://www.google.com');
  const [leftLogs, setLeftLogs] = useState<ConsoleErrorLog[]>([]);
  const [leftInspectedElement, setLeftInspectedElement] = useState<InspectedElement | null>(null);
  const [leftHelperReady, setLeftHelperReady] = useState(false);
  const [leftIframeKey, setLeftIframeKey] = useState(0);
  const [leftIsInspecting, setLeftIsInspecting] = useState(false);

  // Right Frame State
  const [rightUrlInput, setRightUrlInput] = useState(tab.url || 'https://www.google.com');
  const [rightActiveUrl, setRightActiveUrl] = useState(tab.url || 'https://www.google.com');
  const [rightLogs, setRightLogs] = useState<ConsoleErrorLog[]>([]);
  const [rightInspectedElement, setRightInspectedElement] = useState<InspectedElement | null>(null);
  const [rightHelperReady, setRightHelperReady] = useState(false);
  const [rightIframeKey, setRightIframeKey] = useState(0);
  const [rightIsInspecting, setRightIsInspecting] = useState(false);

  // Global UI State
  const [activeSubTab, setActiveSubTab] = useState<'console' | 'inspector'>('console');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const leftIframeRef = useRef<HTMLIFrameElement>(null);
  const rightIframeRef = useRef<HTMLIFrameElement>(null);

  // Sync tab URL state if changed externally
  useEffect(() => {
    if (tab.url && tab.url !== leftActiveUrl) {
      setLeftUrlInput(tab.url);
      setLeftActiveUrl(tab.url);
      setLeftHelperReady(false);
      setLeftIframeKey(prev => prev + 1);
    }
  }, [tab.url]);

  // Listen to postMessage from iframe sources
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      
      const { type, payload } = event.data;
      
      // Determine sender
      const isLeftSender = event.source === leftIframeRef.current?.contentWindow;
      const isRightSender = event.source === rightIframeRef.current?.contentWindow;
      
      if (!isLeftSender && !isRightSender) return;
      const sourceFrame = isLeftSender ? 'left' : 'right';
      
      if (type === 'tline-ready') {
        if (sourceFrame === 'left') {
          setLeftHelperReady(true);
          if (leftIsInspecting) {
            leftIframeRef.current?.contentWindow?.postMessage({ type: 'tline-start-inspect' }, '*');
          }
        } else {
          setRightHelperReady(true);
          if (rightIsInspecting) {
            rightIframeRef.current?.contentWindow?.postMessage({ type: 'tline-start-inspect' }, '*');
          }
        }
        console.log(`[BrowserTab] Connection established with ${sourceFrame} frame helper script.`);
      }
      
      if (type === 'tline-error') {
        const newLog: ConsoleErrorLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toLocaleTimeString(),
          message: payload.message,
          filename: payload.filename,
          lineno: payload.lineno,
          colno: payload.colno,
          stack: payload.stack
        };
        
        if (sourceFrame === 'left') {
          setLeftLogs(prev => [newLog, ...prev].slice(0, 100));
        } else {
          setRightLogs(prev => [newLog, ...prev].slice(0, 100));
        }
      }
      
      if (type === 'tline-element-selected') {
        if (sourceFrame === 'left') {
          setLeftInspectedElement(payload);
          setLeftIsInspecting(false);
        } else {
          setRightInspectedElement(payload);
          setRightIsInspecting(false);
        }
        setActiveFrame(sourceFrame); // focus the frame that selected the element
        setActiveSubTab('inspector');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [leftIsInspecting, rightIsInspecting]);

  // Navigate actions
  const handleLeftNavigate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let targetUrl = leftUrlInput.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'http://' + targetUrl;
    }
    setLeftUrlInput(targetUrl);
    setLeftActiveUrl(targetUrl);
    setLeftHelperReady(false);
    setLeftLogs([]);
    setLeftInspectedElement(null);
    setLeftIframeKey(prev => prev + 1);

    if (onUpdateTabName && !isSplit) {
      try {
        const hostname = new URL(targetUrl).hostname;
        onUpdateTabName(`Preview: ${hostname}`);
      } catch (err) {
        onUpdateTabName('Web Preview');
      }
    }
  };

  const handleRightNavigate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    let targetUrl = rightUrlInput.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'http://' + targetUrl;
    }
    setRightUrlInput(targetUrl);
    setRightActiveUrl(targetUrl);
    setRightHelperReady(false);
    setRightLogs([]);
    setRightInspectedElement(null);
    setRightIframeKey(prev => prev + 1);
  };

  const handleLeftReload = () => {
    setLeftHelperReady(false);
    setLeftLogs([]);
    setLeftIframeKey(prev => prev + 1);
  };

  const handleRightReload = () => {
    setRightHelperReady(false);
    setRightLogs([]);
    setRightIframeKey(prev => prev + 1);
  };

  const toggleLeftInspect = () => {
    const nextState = !leftIsInspecting;
    setLeftIsInspecting(nextState);
    if (leftIframeRef.current?.contentWindow) {
      leftIframeRef.current.contentWindow.postMessage({
        type: nextState ? 'tline-start-inspect' : 'tline-stop-inspect'
      }, '*');
    }
  };

  const toggleRightInspect = () => {
    const nextState = !rightIsInspecting;
    setRightIsInspecting(nextState);
    if (rightIframeRef.current?.contentWindow) {
      rightIframeRef.current.contentWindow.postMessage({
        type: nextState ? 'tline-start-inspect' : 'tline-stop-inspect'
      }, '*');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const generateErrorPrompt = (log: ConsoleErrorLog) => {
    return `Here is a JavaScript/Console error captured from my web application:

### 🔴 Error Context
- **Message:** ${log.message}
- **Source:** ${log.filename || 'Unknown source'} ${log.lineno ? `(line ${log.lineno}, col ${log.colno})` : ''}
${log.stack ? `
**Stack Trace:**
\`\`\`
${log.stack}
\`\`\`
` : ''}

Please analyze this error log, explain what is causing it, and provide a clear solution to fix it.`;
  };

  const generateElementPrompt = (el: InspectedElement) => {
    const styleDetails = Object.entries(el.computedStyles)
      .map(([k, v]) => `- \`${k}\`: \`${v}\``)
      .join('\n');

    return `Please analyze this UI element from my web application to troubleshoot styling or layout issues:

### 🔍 Element Context
- **Tag:** \`${el.tagName}\`
- **ID:** ${el.id ? `\`${el.id}\`` : '*None*'}
- **CSS Selector Path:** \`${el.selectorPath}\`
- **Classes:** \`${el.classes.join(' ')}\`

### 🎨 Computed Styles (Layout Details)
${styleDetails}

### 📄 HTML Source Code
\`\`\`html
${el.outerHTML}
\`\`\`

Please inspect this element and recommend layout fixes, cleaner tailwind classes, or code refactorings to improve its layout or styling.`;
  };

  // Select active values based on focused frame
  const activeLogs = activeFrame === 'left' ? leftLogs : rightLogs;
  const activeInspectedElement = activeFrame === 'left' ? leftInspectedElement : rightInspectedElement;
  const isHelperReady = activeFrame === 'left' ? leftHelperReady : rightHelperReady;

  return (
    <div className="flex flex-col h-full w-full bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden">
      
      {/* Main Preview Container (Splittable) */}
      <div className="flex-1 flex min-h-[200px] overflow-hidden">
        
        {/* LEFT BROWSER PANEL */}
        <div 
          onClick={() => setActiveFrame('left')}
          className={`flex flex-col h-full min-w-[200px] transition-all relative ${
            isSplit ? 'w-1/2 border-r border-[var(--border-color)]' : 'w-full'
          } ${
            isSplit && activeFrame === 'left' ? 'ring-2 ring-purple-600/30 z-10' : ''
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 p-2 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
            <button 
              onClick={handleLeftReload}
              className="p-1.5 rounded hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
              title="Reload Preview"
            >
              <RotateCw size={13} />
            </button>

            <form onSubmit={handleLeftNavigate} className="flex-1 flex items-center gap-1">
              <div className="flex-1 flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-md focus-within:border-[var(--color-primary)] transition-all">
                <Globe size={12} className="text-[var(--text-muted)]" />
                <input 
                  type="text" 
                  value={leftUrlInput}
                  onChange={(e) => setLeftUrlInput(e.target.value)}
                  placeholder="Enter URL"
                  className="flex-1 bg-transparent border-none outline-none text-xs text-[var(--text-main)] font-mono"
                />
              </div>
              <button 
                type="submit" 
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded transition-colors"
              >
                Go
              </button>
            </form>

            <button 
              onClick={toggleLeftInspect}
              className={`p-1.5 rounded border transition-all ${
                leftIsInspecting 
                  ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.2)]' 
                  : 'bg-transparent border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
              }`}
              title="Inspect Element"
            >
              <MousePointer size={13} className={leftIsInspecting ? 'animate-pulse' : ''} />
            </button>

            {!isSplit && (
              <button
                onClick={() => {
                  setIsSplit(true);
                  setActiveFrame('left');
                }}
                className="p-1.5 rounded border border-[var(--border-color)] text-[var(--text-muted)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-main)] transition-colors"
                title="Split screen (Dual View)"
              >
                <Columns size={13} />
              </button>
            )}
          </div>

          {/* IFrame Viewport */}
          <div className="flex-1 bg-white relative">
            <iframe 
              key={leftIframeKey}
              ref={leftIframeRef}
              src={`/api/preview-proxy?target=${encodeURIComponent(leftActiveUrl)}`} 
              className="w-full h-full border-none bg-white"
              title="Left Preview Frame"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
            {leftIsInspecting && (
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-purple-500/40 bg-purple-500/5 flex items-center justify-center">
                <span className="bg-[var(--bg-card)] border border-[var(--border-color)] text-purple-400 text-[10px] px-2 py-1 rounded-full font-semibold pointer-events-auto">
                  🔍 Select element in Left Frame
                </span>
              </div>
            )}
            {isSplit && activeFrame === 'left' && (
              <div className="absolute top-2 right-2 bg-purple-600 text-white font-bold text-[9px] px-2 py-0.5 rounded shadow pointer-events-none z-20">
                ACTIVE FOCUS
              </div>
            )}
          </div>
        </div>

        {/* RIGHT BROWSER PANEL (Dual View mode) */}
        {isSplit && (
          <div 
            onClick={() => setActiveFrame('right')}
            className={`flex flex-col h-full w-1/2 min-w-[200px] transition-all relative ${
              activeFrame === 'right' ? 'ring-2 ring-purple-600/30 z-10' : ''
            }`}
          >
            {/* Header */}
            <div className="flex items-center gap-2 p-2 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
              <button 
                onClick={handleRightReload}
                className="p-1.5 rounded hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                title="Reload Right Preview"
              >
                <RotateCw size={13} />
              </button>

              <form onSubmit={handleRightNavigate} className="flex-1 flex items-center gap-1">
                <div className="flex-1 flex items-center gap-1.5 px-3 py-1 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-md focus-within:border-[var(--color-primary)] transition-all">
                  <Globe size={12} className="text-[var(--text-muted)]" />
                  <input 
                    type="text" 
                    value={rightUrlInput}
                    onChange={(e) => setRightUrlInput(e.target.value)}
                    placeholder="Enter URL"
                    className="flex-1 bg-transparent border-none outline-none text-xs text-[var(--text-main)] font-mono"
                  />
                </div>
                <button 
                  type="submit" 
                  className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded transition-colors"
                >
                  Go
                </button>
              </form>

              <button 
                onClick={toggleRightInspect}
                className={`p-1.5 rounded border transition-all ${
                  rightIsInspecting 
                    ? 'bg-purple-600/20 border-purple-500 text-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.2)]' 
                    : 'bg-transparent border-[var(--border-color)] text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card-hover)]'
                }`}
                title="Inspect Element"
              >
                <MousePointer size={13} className={rightIsInspecting ? 'animate-pulse' : ''} />
              </button>

              <button
                onClick={() => {
                  setIsSplit(false);
                  setActiveFrame('left');
                }}
                className="p-1.5 rounded border border-purple-500/30 bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 transition-colors"
                title="Close Split View"
              >
                <Columns size={13} />
              </button>
            </div>

            {/* IFrame Viewport */}
            <div className="flex-1 bg-white relative">
              <iframe 
                key={rightIframeKey}
                ref={rightIframeRef}
                src={`/api/preview-proxy?target=${encodeURIComponent(rightActiveUrl)}`} 
                className="w-full h-full border-none bg-white"
                title="Right Preview Frame"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
              {rightIsInspecting && (
                <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-purple-500/40 bg-purple-500/5 flex items-center justify-center">
                  <span className="bg-[var(--bg-card)] border border-[var(--border-color)] text-purple-400 text-[10px] px-2 py-1 rounded-full font-semibold pointer-events-auto">
                    🔍 Select element in Right Frame
                  </span>
                </div>
              )}
              {activeFrame === 'right' && (
                <div className="absolute top-2 right-2 bg-purple-600 text-white font-bold text-[9px] px-2 py-0.5 rounded shadow pointer-events-none z-20">
                  ACTIVE FOCUS
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* DevTools Drawer (Obsidian Theme style) */}
      <div className="h-[280px] min-h-[150px] border-t border-[var(--border-color)] bg-[var(--bg-card)] flex flex-col">
        
        {/* DevTools Headers */}
        <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-1.5">
          <div className="flex gap-2">
            <button 
              onClick={() => setActiveSubTab('console')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all ${
                activeSubTab === 'console'
                  ? 'text-purple-400 bg-[var(--bg-card)] border border-[var(--border-color)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Bug size={13} />
              <span>Console Errors</span>
              {activeLogs.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-600/20 text-red-400 border border-red-500/30 rounded-full">
                  {activeLogs.length}
                </span>
              )}
            </button>
            
            <button 
              onClick={() => setActiveSubTab('inspector')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all ${
                activeSubTab === 'inspector'
                  ? 'text-purple-400 bg-[var(--bg-card)] border border-[var(--border-color)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              <Code2 size={13} />
              <span>Element Inspector</span>
              {activeInspectedElement && (
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
              )}
            </button>
          </div>
          
          {/* Helper status & frame focus indicator */}
          <div className="flex items-center gap-3 text-[10px] font-medium text-[var(--text-muted)]">
            {isSplit && (
              <span className="px-2 py-0.5 rounded bg-purple-600/10 border border-purple-500/20 text-purple-400 font-bold uppercase tracking-wider">
                Viewing: {activeFrame === 'left' ? 'Left Frame' : 'Right Frame'}
              </span>
            )}
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isHelperReady ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`} />
              <span>{isHelperReady ? 'Proxy Helper Active' : 'Connecting Helper...'}</span>
            </div>
          </div>
        </div>

        {/* DevTools Tab Content */}
        <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: 'thin' }}>
          
          {/* CONSOLE ERRORS TAB */}
          {activeSubTab === 'console' && (
            <div className="flex flex-col gap-2 font-mono text-[11px]">
              {activeLogs.map(log => {
                const isExpanded = expandedLogId === log.id;
                return (
                  <div 
                    key={log.id} 
                    className="border border-red-950/40 bg-red-950/10 rounded-lg p-2.5 flex flex-col gap-1.5 text-red-300 relative group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div 
                        className="flex items-start gap-2 cursor-pointer flex-1 select-text"
                        onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                      >
                        <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                        <div className="flex flex-col">
                          <span className="font-semibold break-all text-[12px]">{log.message}</span>
                          <span className="text-[10px] text-red-400/80 mt-0.5">
                            {log.filename || 'console'} {log.lineno ? `:${log.lineno}:${log.colno}` : ''}
                          </span>
                        </div>
                      </div>

                      {/* Prompt Copy Buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        {log.stack && (
                          <button
                            onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                            className="px-1.5 py-0.5 rounded border border-red-500/20 hover:border-red-500/40 text-[10px] text-red-400"
                          >
                            {isExpanded ? 'Hide Stack' : 'Show Stack'}
                          </button>
                        )}
                        <button
                          onClick={() => copyToClipboard(generateErrorPrompt(log), log.id)}
                          className="flex items-center gap-1 px-2 py-1 rounded bg-purple-600/80 hover:bg-purple-600 text-white text-[10px] font-bold transition-all shadow-sm cursor-pointer"
                          title="Copy prompt for AI"
                        >
                          {copiedId === log.id ? <Check size={10} /> : <Sparkles size={10} />}
                          <span>{copiedId === log.id ? 'Copied!' : 'Tag to AI'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Expandable Stack Trace */}
                    {isExpanded && log.stack && (
                      <pre className="mt-2 p-2 bg-black/40 rounded border border-red-950/80 text-[10px] text-red-400 overflow-x-auto whitespace-pre">
                        {log.stack}
                      </pre>
                    )}
                  </div>
                );
              })}

              {activeLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)] gap-2">
                  <ShieldAlert size={20} className="opacity-40" />
                  <span className="text-xs">No client-side JavaScript errors detected in this frame.</span>
                </div>
              )}
            </div>
          )}

          {/* ELEMENT INSPECTOR TAB */}
          {activeSubTab === 'inspector' && (
            <div className="h-full flex flex-col">
              {activeInspectedElement ? (
                <div className="flex flex-col gap-3 text-xs">
                  {/* Element metadata overview */}
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] pb-2.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-purple-600/20 border border-purple-500/30 text-purple-400 font-mono font-bold text-[11px]">
                          &lt;{activeInspectedElement.tagName}&gt;
                        </span>
                        {activeInspectedElement.id && (
                          <span className="text-blue-400 font-mono text-[11px]" title="Element ID">
                            #{activeInspectedElement.id}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono break-all mt-1">
                        Selector: {activeInspectedElement.selectorPath}
                      </span>
                    </div>

                    <button
                      onClick={() => copyToClipboard(generateElementPrompt(activeInspectedElement), 'element')}
                      className="flex items-center gap-1 px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-sm cursor-pointer shrink-0"
                      title="Copy prompt for AI"
                    >
                      {copiedId === 'element' ? <Check size={11} /> : <Sparkles size={11} />}
                      <span>{copiedId === 'element' ? 'Copied!' : 'Tag to AI'}</span>
                    </button>
                  </div>

                  {/* Content Details Split */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* CSS Classes & Computed Layout */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">Computed Layout Styles</span>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px] bg-black/10 p-2.5 rounded-lg border border-[var(--border-color)]">
                        {Object.entries(activeInspectedElement.computedStyles).map(([key, val]) => (
                          <div key={key} className="flex justify-between border-b border-[var(--border-color)]/30 py-0.5">
                            <span className="text-[var(--text-muted)]">{key}:</span>
                            <span className="text-purple-300 font-semibold">{val}</span>
                          </div>
                        ))}
                      </div>
                      
                      {activeInspectedElement.classes.length > 0 && (
                        <div className="flex flex-col gap-1 mt-1">
                          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">CSS Classes</span>
                          <div className="flex flex-wrap gap-1">
                            {activeInspectedElement.classes.map(cls => (
                              <span key={cls} className="px-1.5 py-0.5 rounded bg-[var(--bg-main)] border border-[var(--border-color)] font-mono text-[10px]">
                                  {cls}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* HTML Source Preview */}
                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">HTML Code Snippet</span>
                      <pre className="flex-1 p-2.5 bg-black/30 rounded-lg border border-[var(--border-color)] font-mono text-[10px] text-emerald-300 overflow-x-auto whitespace-pre-wrap break-all">
                        {activeInspectedElement.outerHTML}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)] gap-2">
                  <Layout size={20} className="opacity-40" />
                  <span className="text-xs text-center max-w-sm leading-relaxed">
                    Click the <strong className="text-purple-400">Inspect Element</strong> button in the active frame header, then click any UI component on the page to extract its code and style properties.
                  </span>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
