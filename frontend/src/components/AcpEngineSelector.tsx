import { useState, useRef, useEffect } from 'react';
import { Zap, Brain, Wrench, Check, ChevronDown, Layers } from 'lucide-react';

export interface AcpModelItem {
  id: string;
  name: string;
  contextWindow?: string;
  description?: string;
  isDefault?: boolean;
}

export interface AcpEngineInfo {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon?: string;
  status: 'ready' | 'configured' | 'available';
  capabilities?: string[];
  models?: AcpModelItem[];
  defaultModel?: string;
}

export const FALLBACK_ACP_ENGINES: AcpEngineInfo[] = [
  {
    id: 'superagent',
    name: 'Superagent Core',
    badge: 'ACP v1.0',
    description: 'Autonomous multi-agent coder with 3-tier subagents and local MCP tools',
    icon: 'Zap',
    status: 'ready',
    capabilities: ['tools', 'multi-tier', 'mcp', 'terminal-execution'],
    defaultModel: 'openrouter',
    models: [
      { id: 'openrouter', name: 'OpenRouter (Multi-Model)', description: 'Claude 3.7 Sonnet, DeepSeek R1, GPT-4o', isDefault: true },
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Hybrid)', description: 'High capability coding with hybrid thinking mode' },
      { id: 'openai-gpt4o', name: 'GPT-4o Omnimodal', description: 'OpenAI multimodal flagship coding model' },
    ],
  },
  {
    id: 'antigravity',
    name: 'Antigravity (Gemini)',
    badge: '1M Context',
    description: 'Official Google DeepMind Antigravity with Gemini 3.8 Flash High & Claude Sonnet 4.6',
    icon: 'Brain',
    status: 'ready',
    capabilities: ['massive-context', 'vision', 'literature-research', 'multimodal'],
    defaultModel: 'gemini-3.8-flash-high',
    models: [
      { id: 'gemini-3.8-flash-high', name: 'Gemini 3.8 Flash (High)', contextWindow: '1M Context', description: 'Official DeepMind Gemini with deep reasoning & 1M context', isDefault: true },
      { id: 'gemini-3.8-flash-medium', name: 'Gemini 3.8 Flash (Medium)', contextWindow: '1M Context', description: 'Balanced speed and high-precision reasoning' },
      { id: 'gemini-3.8-flash-low', name: 'Gemini 3.8 Flash (Low)', contextWindow: '1M Context', description: 'Fast responses for rapid iteration' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6 (Thinking)', contextWindow: '1M Context', description: 'Anthropic Claude reasoning integrated in Antigravity' },
      { id: 'claude-opus-4-6-thinking', name: 'Claude Opus 4.6 (Thinking)', contextWindow: '1M Context', description: 'Extended thinking and complex architectural synthesis' },
      { id: 'gpt-oss-120b-medium', name: 'GPT-OSS 120B (Medium)', contextWindow: '1M Context', description: 'Open-weights reasoning model running in Antigravity' },
    ],
  },
  {
    id: 'codex',
    name: 'Codex Bridge',
    badge: 'Fast Review',
    description: 'Fast single-pass refactoring and independent secondary code review',
    icon: 'Wrench',
    status: 'ready',
    capabilities: ['code-review', 'fast-refactoring', 'second-opinion'],
    defaultModel: 'gpt-4.1-code-review',
    models: [
      { id: 'gpt-4.1-code-review', name: 'GPT-4.1 Code Review', description: 'Specialized code review and refactoring engine', isDefault: true },
      { id: 'gpt-4.1-mini-turbo', name: 'GPT-4.1 Mini Turbo', description: 'Fast code linting and syntax fixing' },
      { id: 'o3-mini', name: 'o3-mini (High Reasoning)', description: 'Fast reasoning for tricky edge cases' },
    ],
  },
];

interface AcpEngineSelectorProps {
  currentEngineId: string;
  onEngineSelect: (engineId: string) => void;
  currentModelId?: string;
  onModelSelect?: (modelId: string) => void;
  disabled?: boolean;
}

export function AcpEngineSelector({
  currentEngineId,
  onEngineSelect,
  currentModelId,
  onModelSelect,
  disabled = false,
}: AcpEngineSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [engines, setEngines] = useState<AcpEngineInfo[]>(FALLBACK_ACP_ENGINES);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch registered engines from T-Line backend if available
  useEffect(() => {
    let cancelled = false;
    fetch('/api/superagent/acp/engines')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!cancelled && Array.isArray(data?.engines) && data.engines.length > 0) {
          setEngines(data.engines);
        }
      })
      .catch(() => {
        // Fallback engines already set
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const activeEngine = engines.find((e) => e.id === currentEngineId) || engines[0] || FALLBACK_ACP_ENGINES[0];
  const activeModel = activeEngine.models?.find(m => m.id === currentModelId) || activeEngine.models?.find(m => m.isDefault) || activeEngine.models?.[0];

  const renderIcon = (iconName?: string, className: string = 'w-3.5 h-3.5') => {
    switch (iconName) {
      case 'Brain':
        return <Brain className={className} />;
      case 'Wrench':
        return <Wrench className={className} />;
      case 'Zap':
      default:
        return <Zap className={className} />;
    }
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Pill */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-label={`Select ACP Engine. Currently ${activeEngine.name}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        title={`Execution Core: ${activeEngine.name} (${activeModel ? activeModel.name : activeEngine.badge}) - Click to switch`}
        className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-all duration-150 cursor-pointer select-none ${
          isOpen
            ? 'bg-[var(--color-primary-glow)] border-[var(--color-primary)] text-[var(--color-primary)] shadow-xs'
            : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-main)] hover:border-[var(--color-primary)]/50 hover:bg-[var(--bg-sidebar)]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className="flex items-center text-[var(--color-primary)]">
          {renderIcon(activeEngine.icon)}
        </span>
        <span className="font-medium tracking-tight text-[11px] max-w-[110px] sm:max-w-[140px] truncate">
          {activeEngine.name}
        </span>
        {activeModel && (
          <span className="hidden sm:inline-block text-[10px] text-[var(--color-primary)] font-mono border-l border-[var(--border-color)] pl-1.5 ml-0.5 truncate max-w-[130px]">
            {activeModel.name.split(' (')[0]}
          </span>
        )}
        <span className="hidden sm:inline-block text-[9px] px-1 py-0.2 rounded font-mono uppercase tracking-wider bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
          {activeModel?.contextWindow || activeEngine.badge}
        </span>
        <ChevronDown
          className={`w-3 h-3 text-[var(--text-muted)] transition-transform duration-150 group-hover:text-[var(--text-main)] ${
            isOpen ? 'rotate-180 text-[var(--color-primary)]' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          role="menu"
          className="absolute left-0 mt-1.5 w-76 sm:w-88 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
        >
          {/* Header */}
          <div className="px-2.5 py-1.5 border-b border-[var(--border-color)]/60 mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)]">
              <Layers className="w-3 h-3 text-[var(--color-primary)]" />
              <span>ACP Pluggable Core</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/30 font-semibold">
              ACP v1.0
            </span>
          </div>

          {/* Engine Items */}
          <div className="flex flex-col gap-1.5">
            {engines.map((engine) => {
              const isSelected = engine.id === currentEngineId;
              return (
                <div
                  key={engine.id}
                  className={`w-full rounded-lg transition-all duration-150 flex flex-col ${
                    isSelected
                      ? 'bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/40 text-[var(--text-main)] shadow-xs p-1.5'
                      : 'border border-transparent hover:bg-[var(--bg-sidebar)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      onEngineSelect(engine.id);
                      setIsOpen(false);
                    }}
                    className="w-full text-left p-1 rounded-md flex items-start gap-2.5 cursor-pointer bg-transparent border-0"
                  >
                    <div
                      className={`mt-0.5 p-1.5 rounded-md flex-shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-[var(--color-primary)] text-black font-bold'
                          : 'bg-[var(--bg-main)] text-[var(--text-muted)] group-hover:text-[var(--color-primary)]'
                      }`}
                    >
                      {renderIcon(engine.icon, 'w-4 h-4')}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="text-xs font-semibold text-[var(--text-main)] font-mono flex items-center gap-1.5">
                          {engine.name}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded font-mono font-medium ${
                            isSelected
                              ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30'
                              : 'bg-[var(--bg-main)] text-[var(--text-muted)] border border-[var(--border-color)]'
                          }`}
                        >
                          {engine.badge}
                        </span>
                      </div>
                      <p className="text-[11px] leading-tight text-[var(--text-muted)] line-clamp-2">
                        {engine.description}
                      </p>
                    </div>

                    {isSelected && (
                      <div className="mt-1 flex-shrink-0 text-[var(--color-primary)]">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>

                  {/* Available Models for selected Engine */}
                  {isSelected && engine.models && engine.models.length > 0 && (
                    <div className="mt-1 pt-1.5 border-t border-[var(--border-color)]/60 flex flex-col gap-1 px-1">
                      <div className="text-[9px] font-mono uppercase tracking-wider text-[var(--color-primary)] font-bold flex items-center justify-between px-0.5">
                        <span>Select Model</span>
                        <span className="text-[8px] text-[var(--text-muted)] font-normal">
                          {activeModel?.name}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-1">
                        {engine.models.map((m) => {
                          const isModelActive = m.id === currentModelId || (!currentModelId && m.isDefault);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onModelSelect?.(m.id);
                                setIsOpen(false);
                              }}
                              className={`text-left px-2 py-1.5 rounded-md text-[10px] font-mono flex items-center justify-between gap-1.5 transition cursor-pointer ${
                                isModelActive
                                  ? 'bg-[var(--color-primary)] text-black font-bold shadow-xs'
                                  : 'bg-[var(--bg-main)] hover:bg-[var(--surface-overlay-hover)] text-[var(--text-main)] border border-[var(--border-color)]/60'
                              }`}
                              title={m.description}
                            >
                              <span className="truncate">{m.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                {m.contextWindow && (
                                  <span className={`text-[8px] px-1 py-0.2 rounded font-sans ${isModelActive ? 'bg-black/20 text-black' : 'text-[var(--text-muted)] border border-[var(--border-color)]'}`}>
                                    {m.contextWindow}
                                  </span>
                                )}
                                {isModelActive && <Check className="w-3 h-3 text-black shrink-0" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer note explaining single-thread preservation */}
          <div className="mt-1.5 pt-1.5 px-2.5 border-t border-[var(--border-color)]/50 text-[10px] text-[var(--text-muted)] flex items-center justify-between">
            <span className="italic">Single session · Context preserved</span>
            <span className="font-mono text-[9px] text-[var(--color-primary)] opacity-80">
              Protocol: ACP
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
