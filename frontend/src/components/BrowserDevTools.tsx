import React from 'react';
import { 
  Bug, Code2, ChevronUp, ChevronDown, AlertCircle, ShieldAlert, 
  Layout, Check, Sparkles
} from 'lucide-react';

export interface ConsoleErrorLog {
  id: string;
  timestamp: string;
  message: string;
  filename: string;
  lineno: number;
  colno: number;
  stack: string | null;
}

export interface InspectedElement {
  tagName: string;
  id: string;
  classes: string[];
  selectorPath: string;
  outerHTML: string;
  computedStyles: Record<string, string>;
}

interface BrowserDevToolsProps {
  logs: ConsoleErrorLog[];
  inspectedElement: InspectedElement | null;
  activeSubTab: 'console' | 'inspector';
  setActiveSubTab: (tab: 'console' | 'inspector') => void;
  isDevtoolsCollapsed: boolean;
  setIsDevtoolsCollapsed: (collapsed: boolean) => void;
  devtoolsHeight: number;
  isResizing: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  getHelperStatusColorClass: () => string;
  getHelperStatusText: () => string;
  expandedLogId: string | null;
  setExpandedLogId: (id: string | null) => void;
  copiedId: string | null;
  copyToClipboard: (text: string, id: string) => void;
}

export default function BrowserDevTools({
  logs,
  inspectedElement,
  activeSubTab,
  setActiveSubTab,
  isDevtoolsCollapsed,
  setIsDevtoolsCollapsed,
  devtoolsHeight,
  isResizing,
  handleMouseDown,
  getHelperStatusColorClass,
  getHelperStatusText,
  expandedLogId,
  setExpandedLogId,
  copiedId,
  copyToClipboard
}: BrowserDevToolsProps) {

  const generateErrorPrompt = (log: ConsoleErrorLog) => {
    return `Here is a JavaScript/Console error captured from my web application:\n\n### 🔴 Error Context\n- **Message:** ${log.message}\n- **Source:** ${log.filename || 'Unknown source'} ${log.lineno ? `(line ${log.lineno}, col ${log.colno})` : ''}\n${log.stack ? `\n**Stack Trace:**\n\`\`\`\n${log.stack}\n\`\`\`\n` : ''}\nPlease analyze this error log, explain what is causing it, and provide a clear solution to fix it.`;
  };

  const generateElementPrompt = (el: InspectedElement) => {
    const styleDetails = Object.entries(el.computedStyles)
      .map(([k, v]) => `- \`${k}\`: \`${v}\``)
      .join('\n');

    return `Please analyze this UI element from my web application to troubleshoot styling or layout issues:\n\n### 🔍 Element Context\n- **Tag:** \`${el.tagName}\`\n- **ID:** ${el.id ? `\`${el.id}\`` : '*None*'}\n- **CSS Selector Path:** \`${el.selectorPath}\`\n- **Classes:** \`${el.classes.join(' ')}\`\n\n### 🛠 Computed CSS Styles\n${styleDetails || '*None*'}\n\n### 💻 HTML Outer Source Preview\n\`\`\`html\n${el.outerHTML}\n\`\`\`\n\nPlease review its styles and structure, identify potential problems, and suggest improvements.`;
  };

  return (
    <div 
      style={{ height: isDevtoolsCollapsed ? '38px' : `${devtoolsHeight}px` }}
      className={`border-t border-[var(--border-color)] bg-[var(--bg-card)] flex flex-col shrink-0 relative z-10 ${isResizing ? '' : 'transition-[height] duration-200'}`}
    >
      {/* Resize Handle */}
      {!isDevtoolsCollapsed && (
        <div 
          className="absolute top-0 left-0 right-0 h-1.5 -mt-0.5 cursor-row-resize bg-transparent hover:bg-purple-500/40 active:bg-purple-600 transition-colors z-20"
          onMouseDown={handleMouseDown}
          title="Drag to resize DevTools"
        />
      )}
      
      {/* DevTools Headers */}
      <div 
        className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-main)] px-3 py-1.5 select-none cursor-pointer"
        onDoubleClick={() => setIsDevtoolsCollapsed(!isDevtoolsCollapsed)}
        title="Double click to collapse/expand"
      >
        <div className="flex gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsDevtoolsCollapsed(false);
              setActiveSubTab('console');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all ${
              activeSubTab === 'console' && !isDevtoolsCollapsed
                ? 'text-purple-400 bg-[var(--bg-card)] border border-[var(--border-color)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Bug size={13} />
            <span>Console Errors</span>
            {logs.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-red-600/20 text-red-400 border border-red-500/30 rounded-full">
                {logs.length}
              </span>
            )}
          </button>
          
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsDevtoolsCollapsed(false);
              setActiveSubTab('inspector');
            }}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded transition-all ${
              activeSubTab === 'inspector' && !isDevtoolsCollapsed
                ? 'text-purple-400 bg-[var(--bg-card)] border border-[var(--border-color)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Code2 size={13} />
            <span>Element Inspector</span>
            {inspectedElement && (
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            )}
          </button>
        </div>
        
        {/* Helper status indicator & Collapse toggle */}
        <div className="flex items-center gap-3 text-[10px] font-medium text-[var(--text-muted)]">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${getHelperStatusColorClass()}`} />
            <span>{getHelperStatusText()}</span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsDevtoolsCollapsed(!isDevtoolsCollapsed);
            }}
            className="p-1 rounded hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            title={isDevtoolsCollapsed ? 'Expand DevTools' : 'Collapse DevTools'}
          >
            {isDevtoolsCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* DevTools Tab Content */}
      {!isDevtoolsCollapsed && (
        <div className="flex-1 overflow-y-auto p-3" style={{ scrollbarWidth: 'thin' }}>
          
          {/* CONSOLE ERRORS TAB */}
          {activeSubTab === 'console' && (
            <div className="flex flex-col gap-2 font-mono text-[11px]">
              {logs.map(log => {
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

              {logs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)] gap-2">
                  <ShieldAlert size={20} className="opacity-40" />
                  <span className="text-xs">No client-side JavaScript errors detected.</span>
                </div>
              )}
            </div>
          )}

          {/* ELEMENT INSPECTOR TAB */}
          {activeSubTab === 'inspector' && (
            <div className="h-full flex flex-col">
              {inspectedElement ? (
                <div className="flex flex-col gap-3 text-xs">
                  {/* Element metadata overview */}
                  <div className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] pb-2.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-purple-600/20 border border-purple-500/30 text-purple-400 font-mono font-bold text-[11px]">
                          &lt;{inspectedElement.tagName}&gt;
                        </span>
                        {inspectedElement.id && (
                          <span className="text-blue-400 font-mono text-[11px]" title="Element ID">
                            #{inspectedElement.id}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono break-all mt-1">
                        Selector: {inspectedElement.selectorPath}
                      </span>
                    </div>

                    <button
                      onClick={() => copyToClipboard(generateElementPrompt(inspectedElement), 'element')}
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
                        {Object.entries(inspectedElement.computedStyles).map(([key, val]) => (
                          <div key={key} className="flex justify-between border-b border-[var(--border-color)]/30 py-0.5">
                            <span className="text-[var(--text-muted)]">{key}:</span>
                            <span className="text-purple-300 font-semibold">{val}</span>
                          </div>
                        ))}
                      </div>
                      
                      {inspectedElement.classes.length > 0 && (
                        <div className="flex flex-col gap-1 mt-1">
                          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">CSS Classes</span>
                          <div className="flex flex-wrap gap-1">
                            {inspectedElement.classes.map(cls => (
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
                        {inspectedElement.outerHTML}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-[var(--text-muted)] gap-2">
                  <Layout size={20} className="opacity-40" />
                  <span className="text-xs text-center max-w-sm leading-relaxed">
                    Click the <strong className="text-purple-400">Inspect Element</strong> button in the header, then click any UI component on the page to extract its code and style properties.
                  </span>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
