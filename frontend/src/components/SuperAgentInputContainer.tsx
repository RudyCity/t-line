import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Square, Send, ChevronDown, X, Cpu } from 'lucide-react';

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
    <div
      ref={consoleContainerRef}
      className="sa-input-container relative w-full font-mono text-xs select-none"
    >
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
        multiple
      />

      {/* Unified High-Craft CLI Input Card (Frameless sides & bottom) */}
      <div className="bg-[#0b0c10] border-t border-zinc-800/80 focus-within:border-t-indigo-500/70 rounded-t-xl transition-all duration-200">
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-2 max-h-32 overflow-y-auto scrollbar-thin border-b border-zinc-800/60">
            {attachments.map(att => (
              <div
                key={att.id}
                className="relative group flex items-center gap-2 p-1.5 bg-[#14151e] border border-zinc-800 rounded-lg shadow-sm max-w-xs transition-colors hover:border-zinc-700"
              >
                {att.type === 'image' && att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.file.name}
                    className="w-8 h-8 rounded object-cover border border-zinc-800"
                  />
                ) : (
                  <div className="w-8 h-8 bg-zinc-900 border border-zinc-800 rounded-md flex items-center justify-center text-zinc-400">
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

        {/* Textarea Area */}
        <div className="px-3 pt-2.5 pb-1 flex items-start gap-2 select-text">
          <span className="text-indigo-400 font-bold select-none pt-0.5 text-xs font-mono">
            ❯
          </span>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              ws?.readyState === WebSocket.OPEN
                ? "Enter prompt or command (e.g. /schedule, /goal, /grill-me)..."
                : "Connecting to SuperAgent bridge..."
            }
            className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-xs text-zinc-100 placeholder-zinc-600 font-mono py-0.5 px-0 resize-none overflow-y-auto max-h-[220px] leading-relaxed"
            rows={1}
            disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
            style={{ minHeight: '36px' }}
          />
        </div>

        {/* Control Footer Toolbar with Presets & Model */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#090a0e]/60 border-t border-zinc-800/50">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
              className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 rounded-md px-2.5 py-1 transition cursor-pointer disabled:opacity-40"
              title="Attach Files"
            >
              <Paperclip className="w-3 h-3 text-zinc-400" />
              <span>[+] Attach</span>
            </button>

            {/* Preset Switcher Pill */}
            {(presets[agentMode] || []).length > 0 && (
              <div className="relative inline-block" ref={presetMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowPresetMenu(!showPresetMenu)}
                  disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
                  className="flex items-center gap-1 bg-[#13141d] hover:bg-[#181a26] text-zinc-300 hover:text-white border border-zinc-800/90 hover:border-zinc-700 rounded-md px-2 py-1 text-[10px] font-mono transition cursor-pointer"
                >
                  <span className="text-zinc-500 font-normal">preset:</span>
                  <span className="font-semibold text-indigo-300">
                    {(presets[agentMode] || []).find(p => p.id === activePresetId[agentMode])?.name || activePresetId[agentMode] || 'default'}
                  </span>
                  <ChevronDown className="w-3 h-3 text-zinc-500 ml-0.5" />
                </button>

                {showPresetMenu && (
                  <div className="sa-command-popover absolute bottom-full left-0 mb-1 w-52 py-1 z-50 overflow-hidden font-mono bg-[#12131b] border border-zinc-800 rounded-lg shadow-2xl">
                    <div className="px-2.5 py-1 text-[9px] font-bold text-indigo-400 uppercase tracking-wider border-b border-zinc-800/80 mb-1">
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
                          className={`w-full text-left px-2.5 py-1 text-[10px] transition flex flex-col ${
                            isActive
                              ? 'bg-indigo-950/60 text-indigo-300 font-bold border-l-2 border-indigo-500'
                              : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200'
                          }`}
                        >
                          <span>{p.name}</span>
                          {p.description && p.description !== '/model' && (
                            <span className="text-[9px] text-zinc-500 font-sans truncate mt-0.5">
                              {p.description}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Model Badge */}
            {modelName && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-400 font-mono border border-zinc-800/80 px-2 py-1 rounded-md bg-[#12131b]">
                <Cpu className="w-2.5 h-2.5 text-zinc-500" />
                <span>{modelName}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-zinc-500 font-mono hidden md:inline">
              Shift+↵ send • ↵ newline • / commands
            </span>
            <span className="text-[10px] text-zinc-600 font-mono">
              {input.length} chars
            </span>

            {loading ? (
              <button
                onClick={handleAbort}
                disabled={!ws || ws.readyState !== WebSocket.OPEN}
                className="flex items-center gap-1.5 bg-rose-950/90 hover:bg-rose-900 border border-rose-800 text-rose-200 text-[10px] font-mono font-bold px-3 py-1 rounded-md transition cursor-pointer active:scale-95 focus:outline-none"
                title="Stop Execution"
              >
                <Square className="w-3 h-3 fill-current text-rose-400" />
                <span>ABORT</span>
              </button>
            ) : (
              <button
                onClick={() => handleSend()}
                disabled={(!input.trim() && attachments.length === 0) || !ws || ws.readyState !== WebSocket.OPEN}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 disabled:bg-zinc-900 disabled:text-zinc-600 disabled:border-zinc-800 border border-indigo-500 text-white text-[10px] font-mono font-bold px-3.5 py-1 rounded-md shadow-md shadow-indigo-600/20 transition-all cursor-pointer shrink-0 focus:outline-none"
                title="Send Message"
              >
                <Send className="w-3 h-3" />
                <span>RUN [Shift+↵]</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
