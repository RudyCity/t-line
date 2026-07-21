import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Square, Send, ChevronUp, X, Sparkles, Cpu, Command, CornerDownLeft } from 'lucide-react';

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
  const [isFocused, setIsFocused] = useState(false);
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
  const isReady = ws && ws.readyState === WebSocket.OPEN;

  return (
    <div
      ref={consoleContainerRef}
      className="p-3 bg-[#0a0d16]/95 border-t border-[#1e2335] flex flex-col gap-2 relative w-full shadow-2xl backdrop-blur-lg select-none font-sans"
    >
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
              className="relative group flex items-center gap-2 p-1.5 bg-[#121624] border border-indigo-900/40 rounded-lg shadow-sm max-w-xs transition-colors hover:border-indigo-600/60"
            >
              {att.type === 'image' && att.previewUrl ? (
                <img
                  src={att.previewUrl}
                  alt={att.file.name}
                  className="w-8 h-8 rounded object-cover border border-zinc-800"
                />
              ) : (
                <div className="w-8 h-8 bg-zinc-900/80 border border-zinc-800 rounded flex items-center justify-center text-zinc-400">
                  <Paperclip className="w-4 h-4 text-indigo-400" />
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
                className="absolute top-1.5 right-1.5 bg-red-950/90 border border-red-800 hover:bg-red-900 text-red-200 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer flex items-center justify-center focus:outline-none"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Unified Input Card */}
      <div
        className={`relative flex items-end gap-2.5 p-2.5 bg-[#111522]/90 border rounded-xl transition-all duration-200 ${
          isFocused
            ? 'border-indigo-500/70 shadow-[0_0_20px_rgba(99,102,241,0.15)] bg-[#131828]'
            : 'border-[#22283a] hover:border-[#2e3752]'
        }`}
      >
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading || !isReady}
          className="p-2 text-zinc-400 hover:text-indigo-300 active:scale-95 transition-all rounded-lg hover:bg-indigo-950/50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100 shrink-0 focus:outline-none"
          title="Attach Files"
        >
          <Paperclip className="w-4 h-4" />
        </button>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={isReady ? "Ask SuperAgent to perform tasks or type / for commands..." : "Connecting to SuperAgent server..."}
          className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-xs text-zinc-100 placeholder-zinc-500 font-sans py-1 px-1 resize-none overflow-y-auto max-h-[240px] leading-relaxed"
          rows={1}
          disabled={loading || !isReady}
          style={{ height: 'auto', minHeight: '32px' }}
        />

        {loading ? (
          <button
            onClick={handleAbort}
            disabled={!isReady}
            className="bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-95 disabled:opacity-50 transition-all rounded-lg text-white flex items-center justify-center h-8 w-8 cursor-pointer shrink-0 shadow-lg shadow-rose-900/30 focus:outline-none"
            title="Stop Execution"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        ) : (
          <button
            onClick={() => handleSend()}
            disabled={(!input.trim() && attachments.length === 0) || !isReady}
            className="bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 active:scale-95 disabled:bg-none disabled:bg-zinc-800/60 disabled:text-zinc-600 disabled:scale-100 transition-all rounded-lg text-white flex items-center justify-center h-8 w-8 cursor-pointer shrink-0 shadow-lg shadow-indigo-600/30 focus:outline-none"
            title="Send Message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Footer Helper Row & Preset Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-[10px] text-zinc-400 font-sans">
        {/* Preset & Model Selector */}
        <div className="flex items-center gap-2">
          <span className="text-zinc-500 font-medium text-[10px]">Preset:</span>
          {(presets[agentMode] || []).length > 0 ? (
            <div className="relative inline-block" ref={presetMenuRef}>
              <button
                type="button"
                onClick={() => setShowPresetMenu(!showPresetMenu)}
                disabled={loading || !isReady}
                className="flex items-center gap-1.5 bg-[#121624] text-indigo-300 hover:text-white border border-indigo-900/50 hover:border-indigo-600/70 rounded-full px-2.5 py-0.5 outline-none text-[10px] font-mono font-medium transition cursor-pointer select-none shadow-sm"
              >
                <Sparkles className="w-3 h-3 text-indigo-400" />
                <span>
                  {(presets[agentMode] || []).find(p => p.id === activePresetId[agentMode])?.name || activePresetId[agentMode] || 'Select Preset'}
                </span>
                <ChevronUp className={`w-3 h-3 text-zinc-400 transition-transform ${showPresetMenu ? 'rotate-180' : ''}`} />
              </button>

              {showPresetMenu && (
                <div className="sa-command-popover absolute bottom-full left-0 mb-1.5 w-52 py-1 z-50 rounded-xl bg-[#121624] border border-indigo-900/60 shadow-2xl overflow-hidden backdrop-blur-xl">
                  <div className="px-3 py-1.5 text-[9px] font-bold text-indigo-400 uppercase tracking-wider border-b border-zinc-800/80 mb-1 flex items-center justify-between">
                    <span>Select Preset</span>
                    <span className="text-[9px] text-zinc-500 font-normal">{agentMode.toUpperCase()}</span>
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
                        className={`w-full text-left px-3 py-1.5 text-[11px] transition flex flex-col cursor-pointer ${
                          isActive
                            ? 'bg-indigo-600/20 text-indigo-300 font-semibold border-l-2 border-indigo-500'
                            : 'text-zinc-300 hover:bg-zinc-800/50 hover:text-white'
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
            <span className="flex items-center gap-1 text-[10px] text-zinc-300 font-mono border border-zinc-800 px-2 py-0.5 rounded-full bg-[#121624]">
              <Cpu className="w-2.5 h-2.5 text-zinc-400" />
              {modelName}
            </span>
          )}
        </div>

        {/* Keyboard Hints & Character Counter */}
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          <div className="flex items-center gap-1.5">
            <span className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 px-1 rounded text-zinc-400 font-mono text-[9px]">
              <CornerDownLeft className="w-2.5 h-2.5" /> send
            </span>
            <span className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 px-1 rounded text-zinc-400 font-mono text-[9px]">
              Shift+⏎ newline
            </span>
            <span className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 px-1 rounded text-zinc-400 font-mono text-[9px]">
              <Command className="w-2.5 h-2.5" />/ commands
            </span>
          </div>

          <span className="text-zinc-500 font-mono text-[10px]">{input.length} chars</span>
        </div>
      </div>
    </div>
  );
}
