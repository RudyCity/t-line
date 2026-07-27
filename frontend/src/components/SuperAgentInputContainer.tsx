import React, { useState, useRef, useEffect } from 'react';
import { Paperclip, Square, Send, ChevronDown, X, Cpu, Terminal, Search } from 'lucide-react';
import { SlashCommand } from './SuperAgentCommands';

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
  showSuggestions?: boolean;
  suggestions?: SlashCommand[];
  suggestionIndex?: number;
  setSuggestionIndex?: (idx: number) => void;
  handleSelectSuggestion?: (cmd: SlashCommand) => void;
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
  getMainModelLabel,
  showSuggestions,
  suggestions = [],
  suggestionIndex = 0,
  setSuggestionIndex,
  handleSelectSuggestion,
}: SuperAgentInputContainerProps) {
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [presetFilterQuery, setPresetFilterQuery] = useState('');
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

  const currentPresetId = activePresetId[agentMode] || '';
  const activePreset = (presets[agentMode] || []).find(
    p => p.id?.toLowerCase() === currentPresetId.toLowerCase() || p.name?.toLowerCase() === currentPresetId.toLowerCase()
  );
  const hasActivePreset = Boolean(activePreset);
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

      {/* Hallmark Minimalist Slash Command Autocomplete Popover (Unified with input) */}
      {showSuggestions && suggestions.length > 0 && handleSelectSuggestion && (
        <div className="absolute bottom-full left-0 right-0 mb-0 bg-[var(--bg-sidebar)] border border-b-0 border-[var(--border-color)] rounded-t-xl rounded-b-none  z-50 max-h-64 overflow-y-auto scrollbar-thin font-mono text-xs divide-y divide-[var(--border-color)]/60 select-none">
          <div className="px-3 py-1.5 bg-[var(--panel-header-bg)] text-[10px] text-[var(--color-primary)] font-bold uppercase tracking-wider flex items-center justify-between sticky top-0 backdrop-blur-md border-b border-[var(--border-color)]">
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-[var(--color-primary)]" />
              <span>COMMANDS</span>
              <span className="text-[var(--text-muted)] font-normal">({suggestions.length})</span>
            </span>
            <span className="text-[var(--text-muted)] font-normal normal-case font-sans text-[9px]">
              ↑↓ Navigate • Tab/Enter Select • Esc Close
            </span>
          </div>

          {suggestions.map((s, idx) => {
            const isSelected = idx === suggestionIndex;
            return (
              <div
                key={s.command}
                onClick={() => handleSelectSuggestion(s)}
                onMouseEnter={() => setSuggestionIndex?.(idx)}
                className={`px-3 py-2 cursor-pointer transition flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-[var(--color-primary-glow)] text-[var(--text-main)] border-l-2 border-[var(--color-primary)] pl-2.5'
                    : 'text-[var(--text-main)] hover:bg-[var(--surface-overlay-hover)]'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-bold font-mono text-xs ${isSelected ? 'text-[var(--color-primary)]' : 'text-[var(--color-primary)]'}`}>
                    {s.command}
                  </span>
                  {s.argsHelp && (
                    <span className="text-[var(--text-muted)] text-[10px] font-mono truncate">
                      {s.argsHelp}
                    </span>
                  )}
                </div>
                <span className="text-[var(--text-muted)] text-[11px] font-sans truncate max-w-xs shrink-0">
                  {s.description}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Unified High-Craft CLI Input Card */}
      <div className={`bg-[var(--bg-sidebar)] border-t border-[var(--border-color)] focus-within:border-t-[var(--color-primary)] transition-all duration-200 ${
        showSuggestions && suggestions.length > 0 ? 'rounded-t-none' : 'rounded-t-xl'
      }`}>
        {/* Attachment Previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 px-3 pt-2 max-h-32 overflow-y-auto scrollbar-thin border-b border-[var(--border-color)]/60">
            {attachments.map(att => (
              <div
                key={att.id}
                className="relative group flex items-center gap-2 p-1.5 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg  max-w-xs transition-colors hover:border-[var(--color-primary)]/50"
              >
                {att.type === 'image' && att.previewUrl ? (
                  <img
                    src={att.previewUrl}
                    alt={att.file.name}
                    className="w-8 h-8 rounded object-cover border border-[var(--border-color)]"
                  />
                ) : (
                  <div className="w-8 h-8 bg-[var(--bg-main)] border border-[var(--border-color)] rounded-md flex items-center justify-center text-[var(--text-muted)]">
                    <Paperclip className="w-4 h-4" />
                  </div>
                )}
                <div className="flex flex-col min-w-0 pr-6">
                  <span className="text-[11px] text-[var(--text-main)] font-medium truncate font-sans w-24">
                    {att.file.name}
                  </span>
                  <span className="text-[9px] text-[var(--text-muted)] font-mono">
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
          <span className="text-[var(--color-primary)] font-bold select-none pt-0.5 text-xs font-mono">
            ❯
          </span>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !hasActivePreset
                ? "No active model preset selected. Please select a preset first..."
                : ws?.readyState === WebSocket.OPEN
                  ? "Enter prompt or command (e.g. /schedule, /goal, /grill-me)..."
                  : "Connecting to SuperAgent bridge..."
            }
            className="flex-1 bg-transparent border-0 focus:outline-none focus:ring-0 text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] font-mono py-0.5 px-0 resize-none overflow-y-auto max-h-[220px] leading-relaxed"
            rows={1}
            disabled={loading || !ws || ws.readyState !== WebSocket.OPEN || !hasActivePreset}
            style={{ minHeight: '36px' }}
          />
        </div>

        {/* Control Footer Toolbar with Presets & Model */}
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-[var(--panel-header-bg)] border-t border-[var(--border-color)] overflow-visible">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || !ws || ws.readyState !== WebSocket.OPEN || !hasActivePreset}
              className="flex items-center justify-center text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-md p-1.5 transition cursor-pointer disabled:opacity-40 shrink-0"
              title="Attach Files"
            >
              <Paperclip className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>

            {/* Preset Switcher Pill */}
            {(presets[agentMode] || []).length > 0 && (
              <div className="relative inline-block" ref={presetMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowPresetMenu(!showPresetMenu)}
                  disabled={loading || !ws || ws.readyState !== WebSocket.OPEN}
                  className="flex items-center gap-1 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] text-[var(--text-main)] border border-[var(--border-color)] rounded-md px-2 py-1 text-[10px] font-mono transition cursor-pointer"
                >
                  <span className="text-[var(--text-muted)] font-normal">preset:</span>
                  <span className={`font-semibold ${hasActivePreset ? 'text-[var(--color-primary)]' : 'text-amber-400'}`}>
                    {activePreset ? activePreset.name : (currentPresetId || 'Select Preset...')}
                  </span>
                  <ChevronDown className="w-3 h-3 text-[var(--text-muted)] ml-0.5" />
                </button>

                {showPresetMenu && (
                  <div className="sa-command-popover absolute bottom-full left-0 mb-1.5 w-64 py-1 z-[100] overflow-hidden font-mono bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl  backdrop-blur-md">
                    <div className="px-2.5 py-1 text-[9px] font-bold text-[var(--color-primary)] uppercase tracking-wider border-b border-[var(--border-color)] flex items-center justify-between">
                      <span>Select Preset</span>
                      <span className="text-[var(--text-muted)] font-normal">
                        ({(presets[agentMode] || []).filter(p => {
                          if (!presetFilterQuery.trim()) return true;
                          const q = presetFilterQuery.toLowerCase().trim();
                          return p.name?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
                        }).length})
                      </span>
                    </div>

                    <div className="px-2 py-1 border-b border-[var(--border-color)]/60">
                      <div className="relative flex items-center">
                        <Search className="w-3 h-3 absolute left-2 text-[var(--text-muted)]" />
                        <input
                          type="text"
                          placeholder="Filter presets..."
                          value={presetFilterQuery}
                          onChange={(e) => setPresetFilterQuery(e.target.value)}
                          className="w-full bg-[var(--bg-card)] text-[var(--text-main)] placeholder-[var(--text-muted)] text-[10px] rounded-md pl-6 pr-5 py-1 border border-[var(--border-color)] focus:outline-none focus:border-[var(--color-primary)] transition"
                          autoFocus
                        />
                        {presetFilterQuery && (
                          <button
                            onClick={() => setPresetFilterQuery('')}
                            className="absolute right-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] p-0.5 cursor-pointer"
                          >
                            <X className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="max-h-56 overflow-y-auto scrollbar-thin divide-y divide-[var(--border-color)]/30">
                      {(presets[agentMode] || []).filter(p => {
                        if (!presetFilterQuery.trim()) return true;
                        const q = presetFilterQuery.toLowerCase().trim();
                        return p.name?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
                      }).length === 0 ? (
                        <div className="px-3 py-2 text-[10px] text-[var(--text-muted)] italic text-center">
                          No matching presets found
                        </div>
                      ) : (
                        (presets[agentMode] || []).filter(p => {
                          if (!presetFilterQuery.trim()) return true;
                          const q = presetFilterQuery.toLowerCase().trim();
                          return p.name?.toLowerCase().includes(q) || p.id?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q);
                        }).map(p => {
                          const isActive = p.id?.toLowerCase() === (activePresetId[agentMode] || '').toLowerCase() || p.name?.toLowerCase() === (activePresetId[agentMode] || '').toLowerCase();
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                handlePresetChange(p.id);
                                setShowPresetMenu(false);
                                setPresetFilterQuery('');
                              }}
                              className={`w-full text-left px-2.5 py-1.5 text-[10px] transition flex flex-col cursor-pointer ${
                                isActive
                                  ? 'bg-[var(--color-primary-glow)] text-[var(--color-primary)] font-bold border-l-2 border-[var(--color-primary)]'
                                  : 'text-[var(--text-muted)] hover:bg-[var(--surface-overlay-hover)] hover:text-[var(--text-main)]'
                              }`}
                            >
                              <span className="flex items-center justify-between">
                                <span>{p.name}</span>
                                {isActive && <span className="text-[9px] text-[var(--color-primary)] font-semibold">● Active</span>}
                              </span>
                              {p.description && p.description !== '/model' && (
                                <span className="text-[9px] text-[var(--text-muted)] font-sans truncate mt-0.5">
                                  {p.description}
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Model Badge */}
            {modelName && (
              <span className="flex items-center gap-1 text-[10px] text-[var(--text-muted)] font-mono border border-[var(--border-color)] px-2 py-1 rounded-md bg-[var(--bg-card)]">
                <Cpu className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                <span>{modelName}</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[10px] text-[var(--text-muted)] font-mono hidden lg:inline">
              ↵ • / cmds
            </span>
            <span className="text-[10px] text-[var(--text-muted)]/80 font-mono">
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
                disabled={(!input.trim() && attachments.length === 0) || !ws || ws.readyState !== WebSocket.OPEN || !hasActivePreset}
                className="flex items-center justify-center bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] active:scale-95 disabled:bg-[var(--bg-card)] disabled:text-[var(--text-muted)] disabled:border-[var(--border-color)] border border-[var(--color-primary)] text-white rounded-md p-1.5   transition-all cursor-pointer shrink-0 focus:outline-none"
                title="Send Message (↵)"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
