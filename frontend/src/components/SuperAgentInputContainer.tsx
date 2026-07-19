import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Square, Send, ChevronUp, X } from 'lucide-react';

interface SuperAgentInputContainerProps {
  input: string;
  setInput: (val: string) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handleSend: (customPrompt?: string) => Promise<void> | void;
  handleAbort: () => void;
  loading: boolean;
  ws: WebSocket | null;
  attachments: Array<{
    id: string;
    file: File;
    type: 'image' | 'document';
    previewUrl?: string;
  }>;
  removeAttachment: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  consoleContainerRef: React.RefObject<HTMLDivElement>;
  presets: Record<string, any[]>;
  activePresetId: Record<string, string>;
  agentMode: 'single' | 'multi';
  handlePresetChange: (presetId: string) => void;
  getMainModelLabel: (preset: any) => string;
}

export function SuperAgentInputContainer({
  input,
  setInput,
  handleKeyDown,
  handleSend,
  handleAbort,
  loading,
  ws,
  attachments,
  removeAttachment,
  fileInputRef,
  handleFileChange,
  textareaRef,
  consoleContainerRef,
  presets,
  activePresetId,
  agentMode,
  handlePresetChange,
  getMainModelLabel
}: SuperAgentInputContainerProps) {
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const presetMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (presetMenuRef.current && !presetMenuRef.current.contains(e.target as Node)) {
        setShowPresetMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const activePreset = (presets[agentMode] || []).find(p => p.id === activePresetId[agentMode]);
  const mainModel = activePreset ? getMainModelLabel(activePreset) : '';
  const modelName = mainModel.includes('/') ? mainModel.substring(mainModel.lastIndexOf('/') + 1) : mainModel;

  return (
    <div ref={consoleContainerRef} className="p-4 bg-[#121214] border-t border-[#2d2d34] flex flex-col gap-1.5 relative">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        multiple
      />

      {/* Attachment Previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1 py-1 max-h-32 overflow-y-auto mb-1 scrollbar-thin">
          {attachments.map(att => (
            <div
              key={att.id}
              className="relative group flex items-center gap-2 p-1.5 bg-[#16161a] border border-[#2d2d34] rounded-lg shadow-sm max-w-xs transition hover:border-zinc-700"
            >
              {att.type === 'image' && att.previewUrl ? (
                <img
                  src={att.previewUrl}
                  alt={att.file.name}
                  className="w-8 h-8 rounded object-cover border border-zinc-800"
                />
              ) : (
                <div className="w-8 h-8 bg-zinc-800 border border-zinc-700 rounded flex items-center justify-center text-zinc-400">
                  <Paperclip className="w-4 h-4" />
                </div>
              )}
              <div className="flex flex-col min-w-0 pr-6">
                <span className="text-[11px] text-zinc-300 font-medium truncate font-sans w-24">
                  {att.file.name}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono">
                  {(att.file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="absolute top-0.5 right-0.5 bg-red-950/80 border border-red-900/50 hover:bg-red-900 text-red-200 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Unified Input Card */}
      <div className="flex bg-[#161619] border border-[#2b2b33] focus-within:border-[#4f46e5]/50 rounded-xl p-1.5 items-end gap-1.5 transition-all shadow-inner">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
          className="p-2 text-zinc-400 hover:text-zinc-200 transition rounded-lg hover:bg-zinc-800/40 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
          title="Attach Files"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={ws?.readyState === WebSocket.OPEN ? "Ask SuperAgent to perform tasks or type / to execute commands..." : "Connecting to SuperAgent bridge..."}
          className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-sm placeholder-zinc-500 font-sans py-1.5 px-1 resize-none overflow-y-auto max-h-[240px] leading-relaxed outline-none"
          rows={1}
          disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
          style={{ height: 'auto', minHeight: '32px' }}
        />

        {loading ? (
          <button
            onClick={handleAbort}
            disabled={!ws || ws.readyState !== WebSocket.OPEN}
            className="bg-red-600 hover:bg-red-500 disabled:bg-zinc-850 disabled:text-zinc-600 transition rounded-lg text-white flex items-center justify-center h-8 w-8 cursor-pointer shrink-0"
            title="Stop Execution"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={() => handleSend()}
            disabled={(!input.trim() && attachments.length === 0) || !ws || ws.readyState !== WebSocket.OPEN}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800/60 disabled:text-zinc-600 transition rounded-lg text-white flex items-center justify-center h-8 w-8 cursor-pointer shrink-0"
            title="Send Message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Input Helpers Row & Preset Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-zinc-500 select-none font-sans border-t border-[#1a1a22] pt-1.5 mt-0.5">
        <div className="flex items-center gap-1.5">
          <span className="text-zinc-600">Preset:</span>
          {(presets[agentMode] || []).length > 0 ? (
            <div className="relative inline-block" ref={presetMenuRef}>
              <button
                type="button"
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
                className="flex items-center gap-1 bg-[#18181f] text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:border-zinc-700 rounded px-1.5 py-0.5 outline-none text-[10px] font-medium transition cursor-pointer select-none"
              >
                <span>
                  {(presets[agentMode] || []).find(p => p.id === activePresetId[agentMode])?.name || activePresetId[agentMode] || 'Select Preset'}
                </span>
                <ChevronUp className="w-3 h-3 text-zinc-500" />
              </button>

              {showPresetMenu && (
                <div className="absolute bottom-full left-0 mb-1 w-44 bg-[#141417] border border-[#2d2d34] rounded-lg shadow-xl py-1 z-50 overflow-hidden">
                  <div className="px-2.5 py-1 text-[9px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800/40 mb-1">
                    Select Preset
                  </div>
                  {(presets[agentMode] || []).map(p => {
                    const isActive = p.id === activePresetId[agentMode];
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          handlePresetChange(p.id);
                          setShowPresetMenu(false);
                        }}
                        className={`w-full text-left px-2.5 py-1 text-[11px] transition flex flex-col ${
                          isActive
                            ? 'bg-indigo-600/15 text-indigo-400 font-semibold'
                            : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                        }`}
                      >
                        <span>{p.name}</span>
                        {p.description && p.description !== '/model' && (
                          <span className="text-[9px] text-zinc-600 font-normal truncate mt-0.5">
                            {p.description}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <span className="text-zinc-600 font-mono text-[10px]">None</span>
          )}

          {modelName && (
            <span className="text-[10px] text-zinc-600 font-mono border border-zinc-850 px-1 py-0.5 rounded bg-zinc-900/40">
              {modelName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span>⏎ send • Shift+⏎ newline • / commands</span>
          <span className="text-zinc-600">{input.length} chars</span>
        </div>
      </div>
    </div>
  );
}
