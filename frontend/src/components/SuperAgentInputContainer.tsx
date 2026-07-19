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
    <div ref={consoleContainerRef} className="p-3.5 bg-[#090c14] border-t border-zinc-800/80 flex flex-col gap-2 relative w-full shadow-md">
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
        <div className="flex flex-wrap gap-2 px-1 py-1 max-h-32 overflow-y-auto mb-0.5 scrollbar-thin">
          {attachments.map(att => (
            <div
              key={att.id}
              className="relative group flex items-center gap-2 p-1.5 bg-[#121622] border border-zinc-700/60 rounded-md shadow-sm max-w-xs transition-colors hover:border-zinc-500"
            >
              {att.type === 'image' && att.previewUrl ? (
                <img
                  src={att.previewUrl}
                  alt={att.file.name}
                  className="w-8 h-8 rounded object-cover border border-zinc-800"
                />
              ) : (
                <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center text-zinc-400">
                  <Paperclip className="w-4 h-4" />
                </div>
              )}
              <div className="flex flex-col min-w-0 pr-6">
                <span className="text-[11px] text-zinc-200 font-medium truncate font-sans w-24">
                  {att.file.name}
                </span>
                <span className="text-[9px] text-zinc-500 font-mono">
                  {(att.file.size / 1024).toFixed(1)} KB
                </span>
              </div>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="absolute top-1 right-1 bg-red-950/90 border border-red-800 hover:bg-red-900 text-red-200 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center focus:outline-none"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Unified Input Card */}
      <div className="sa-input-area flex p-2 items-end gap-2 shadow-inner">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
          className="p-2 text-zinc-400 hover:text-zinc-200 active:translate-y-0.5 transition rounded-lg hover:bg-zinc-800/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0 shrink-0 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
          className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-xs text-zinc-100 placeholder-zinc-500 font-sans py-1.5 px-1 resize-none overflow-y-auto max-h-[240px] leading-relaxed"
          rows={1}
          disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
          style={{ height: 'auto', minHeight: '32px' }}
        />

        {loading ? (
          <button
            onClick={handleAbort}
            disabled={!ws || ws.readyState !== WebSocket.OPEN}
            className="bg-rose-600 hover:bg-rose-500 active:translate-y-0.5 disabled:bg-zinc-800 disabled:text-zinc-600 transition rounded-md text-white flex items-center justify-center h-8 w-8 cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-rose-400"
            title="Stop Execution"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={() => handleSend()}
            disabled={(!input.trim() && attachments.length === 0) || !ws || ws.readyState !== WebSocket.OPEN}
            className="bg-indigo-600 hover:bg-indigo-500 active:translate-y-0.5 disabled:bg-zinc-800/60 disabled:text-zinc-600 disabled:translate-y-0 transition rounded-md text-white flex items-center justify-center h-8 w-8 cursor-pointer shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            title="Send Message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Input Helpers Row & Preset Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-zinc-400 select-none font-sans pt-1">
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 font-medium">Preset:</span>
          {(presets[agentMode] || []).length > 0 ? (
            <div className="relative inline-block" ref={presetMenuRef}>
              <button
                type="button"
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
                className="flex items-center gap-1.5 bg-[#121622] text-zinc-300 hover:text-white border border-zinc-700/60 hover:border-zinc-600 rounded px-2 py-0.5 outline-none text-[10px] font-medium transition cursor-pointer select-none focus:ring-1 focus:ring-indigo-500"
              >
                <span>
                  {(presets[agentMode] || []).find(p => p.id === activePresetId[agentMode])?.name || activePresetId[agentMode] || 'Select Preset'}
                </span>
                <ChevronUp className="w-3 h-3 text-zinc-400" />
              </button>

              {showPresetMenu && (
                <div className="sa-command-popover absolute bottom-full left-0 mb-1 w-48 py-1 z-50 overflow-hidden">
                  <div className="px-2.5 py-1 text-[9px] font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-800/60 mb-1">
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
                            ? 'bg-indigo-600/20 text-indigo-300 font-semibold'
                            : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                        }`}
                      >
                        <span>{p.name}</span>
                        {p.description && p.description !== '/model' && (
                          <span className="text-[9px] text-zinc-500 font-normal truncate mt-0.5">
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
            <span className="text-[10px] text-zinc-400 font-mono border border-zinc-800 px-1.5 py-0.5 rounded bg-[#121622]">
              {modelName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-zinc-500">⏎ send • Shift+⏎ newline • / commands</span>
          <span className="text-zinc-600 font-mono">{input.length} chars</span>
        </div>
      </div>
    </div>
  );
}
