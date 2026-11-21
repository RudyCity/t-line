import { useState, useRef, useEffect } from 'react';
import {
  Zap,
  Brain,
  Wrench,
  Check,
  ChevronDown,
  Layers,
  Cpu,
  MousePointer,
  Terminal,
  Code2,
  Download,
} from 'lucide-react';

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
  status: 'ready' | 'configured' | 'available' | 'not-installed';
  isInstalled?: boolean;
  installHint?: string;
  installCommand?: string;
  capabilities?: string[];
  models?: AcpModelItem[];
  defaultModel?: string;
}

export const FALLBACK_ACP_ENGINES: AcpEngineInfo[] = [
  {
    id: 'antigravity',
    name: 'Antigravity (Gemini)',
    badge: '1M Context',
    description: 'Official Google DeepMind Antigravity ADE with Gemini 3.8 Flash & Claude Sonnet 4.6',
    icon: 'Brain',
    status: 'ready',
    isInstalled: true,
    capabilities: ['massive-context', 'vision', 'literature-research', 'multimodal', 'deep-reasoning'],
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
    id: 'superagent',
    name: 'Superagent Core',
    badge: 'ACP v1.0',
    description: 'Autonomous multi-agent coder with 3-tier subagents and local MCP tools',
    icon: 'Zap',
    status: 'ready',
    isInstalled: true,
    capabilities: ['tools', 'multi-tier', 'mcp', 'terminal-execution', 'chrome-cdp'],
    defaultModel: 'openrouter',
    models: [
      { id: 'openrouter', name: 'OpenRouter (Multi-Model)', description: 'Claude 3.7 Sonnet, DeepSeek R1, GPT-4o', isDefault: true },
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Hybrid)', description: 'High capability coding with hybrid thinking mode' },
      { id: 'openai-gpt4o', name: 'GPT-4o Omnimodal', description: 'OpenAI multimodal flagship coding model' },
    ],
  },
  {
    id: 'opencode',
    name: 'OpenCode ADE',
    badge: 'ACP Native',
    description: 'Open-source autonomous AI software engineering agent with native ACP protocol',
    icon: 'Code',
    status: 'ready',
    isInstalled: true,
    installHint: 'npm install -g opencode-ai',
    capabilities: ['agentic-coding', 'bash', 'file-editing', 'mcp', 'acp-native', 'superagent-dynamic-tools'],
    defaultModel: 'claude-3-7-sonnet',
    models: [
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (OpenCode)', description: 'Anthropic Claude 3.7 Sonnet flagship in OpenCode', isDefault: true },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet v2', description: 'Fast and reliable coding assistant in OpenCode' },
      { id: 'gpt-4o', name: 'GPT-4o (OpenCode)', description: 'OpenAI flagship multimodal coding model in OpenCode' },
      { id: 'deepseek-r1', name: 'DeepSeek R1 (OpenCode)', description: 'Open-source reasoning model in OpenCode' },
    ],
  },
  {
    id: 'cline',
    name: 'Cline Agent',
    badge: 'ACP Native',
    description: 'Autonomous AI coding assistant in terminal with plan/act modes and ACP protocol',
    icon: 'Bot',
    status: 'ready',
    isInstalled: true,
    installHint: 'npm install -g cline',
    capabilities: ['agentic-coding', 'bash', 'file-editing', 'plan-mode', 'act-mode', 'acp-native', 'superagent-dynamic-tools'],
    defaultModel: 'claude-3-7-sonnet',
    models: [
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Cline)', description: 'Anthropic Claude 3.7 Sonnet in Cline agent', isDefault: true },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Fast and reliable coding assistant in Cline' },
      { id: 'gpt-4o', name: 'GPT-4o (Cline)', description: 'OpenAI GPT-4o multimodal model in Cline' },
    ],
  },
  {
    id: 'kilo',
    name: 'Kilo Code CLI',
    badge: 'ACP Native',
    description: 'Autonomous coding agent CLI with plan/act workflows and ACP protocol',
    icon: 'Terminal',
    status: 'ready',
    isInstalled: true,
    installHint: 'npm install -g @kilocode/cli',
    capabilities: ['agentic-coding', 'bash', 'file-editing', 'acp-native'],
    defaultModel: 'claude-3-7-sonnet',
    models: [
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Kilo)', description: 'Anthropic Claude 3.7 Sonnet in Kilo Code', isDefault: true },
    ],
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    badge: 'Agentic CLI',
    description: 'Official Anthropic Claude Code agentic coding assistant with hybrid thinking',
    icon: 'Cpu',
    status: 'ready',
    isInstalled: true,
    installHint: 'npm install -g @anthropic-ai/claude-code',
    capabilities: ['agentic-coding', 'bash', 'file-editing', 'hybrid-thinking', 'subagents'],
    defaultModel: 'claude-3-7-sonnet',
    models: [
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Hybrid Thinking)', description: 'Flagship dynamic reasoning effort & coding', isDefault: true },
      { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet v2', description: 'Fast and accurate coding model' },
      { id: 'claude-3-opus', name: 'Claude 3 Opus', description: 'Deep architectural reasoning model' },
    ],
  },
  {
    id: 'cursor',
    name: 'Cursor Agent',
    badge: 'Fast Index',
    description: 'Cursor codebase indexing & agentic terminal refactoring engine',
    icon: 'MousePointer',
    status: 'not-installed',
    isInstalled: false,
    installHint: 'https://cursor.com',
    capabilities: ['codebase-index', 'fast-apply', 'diff-editing'],
    defaultModel: 'cursor-fast',
    models: [
      { id: 'cursor-fast', name: 'Cursor Fast Model', description: 'Optimized low-latency codebase editor', isDefault: true },
      { id: 'claude-3.7-sonnet', name: 'Claude 3.7 Sonnet in Cursor', description: 'Anthropic coding agent running within Cursor' },
      { id: 'gpt-4o', name: 'GPT-4o in Cursor', description: 'OpenAI multi-modal coding model' },
    ],
  },
  {
    id: 'windsurf',
    name: 'Windsurf Cascade',
    badge: 'Flow Agent',
    description: 'Codeium Windsurf Cascade next-generation agentic IDE engine',
    icon: 'Layers',
    status: 'not-installed',
    isInstalled: false,
    installHint: 'https://codeium.com/windsurf',
    capabilities: ['cascade-agent', 'deep-context', 'flow-paradigm'],
    defaultModel: 'cascade-base',
    models: [
      { id: 'cascade-base', name: 'Cascade Engine', description: 'Codeium native agentic reasoning engine', isDefault: true },
    ],
  },
  {
    id: 'codex',
    name: 'Codex Bridge',
    badge: 'Fast Review',
    description: 'OpenAI Codex single-pass refactoring and secondary code review',
    icon: 'Wrench',
    status: 'not-installed',
    isInstalled: false,
    installHint: 'https://openai.com/codex',
    capabilities: ['code-review', 'fast-refactoring', 'second-opinion'],
    defaultModel: 'gpt-4.1-code-review',
    models: [
      { id: 'gpt-4.1-code-review', name: 'GPT-4.1 Code Review', description: 'Specialized code review and refactoring engine', isDefault: true },
      { id: 'gpt-4.1-mini-turbo', name: 'GPT-4.1 Mini Turbo', description: 'Fast code linting and syntax fixing' },
      { id: 'o3-mini', name: 'o3-mini (High Reasoning)', description: 'Fast reasoning for tricky edge cases' },
    ],
  },
  {
    id: 'zed',
    name: 'Zed AI Agent',
    badge: 'Rust ACP',
    description: 'High-performance Zed editor agent protocol powered by Anthropic & OpenAI',
    icon: 'Terminal',
    status: 'not-installed',
    isInstalled: false,
    installHint: 'https://zed.dev',
    capabilities: ['rust-speed', 'fast-buffering', 'acp-v1'],
    defaultModel: 'claude-3-7-sonnet',
    models: [
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Zed)', description: 'Default Zed AI reasoning agent', isDefault: true },
      { id: 'gpt-4o', name: 'GPT-4o (Zed)', description: 'OpenAI integration in Zed' },
    ],
  },
  {
    id: 'continue',
    name: 'Continue ADE',
    badge: 'Open Source',
    description: 'Open-source AI code assistant for terminal and IDEs with custom LLM backends',
    icon: 'Cpu',
    status: 'not-installed',
    isInstalled: false,
    installHint: 'npm install -g @continuedev/continue',
    capabilities: ['tab-autocomplete', 'chat', 'custom-llm'],
    defaultModel: 'claude-3-7-sonnet',
    models: [
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Continue)', description: 'Anthropic Claude 3.7 Sonnet in Continue', isDefault: true },
    ],
  },
  {
    id: 'goose',
    name: 'Goose Agent',
    badge: 'Extensible',
    description: 'Block Goose open-source autonomous engineering agent with extensible toolkits',
    icon: 'Bot',
    status: 'not-installed',
    isInstalled: false,
    installHint: 'https://github.com/block/goose',
    capabilities: ['autonomous-agent', 'mcp-extensions', 'toolkit-developer'],
    defaultModel: 'claude-3-7-sonnet',
    models: [
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Goose)', description: 'Anthropic Claude 3.7 Sonnet in Goose', isDefault: true },
    ],
  },
  {
    id: 'aider',
    name: 'Aider Pair Programmer',
    badge: 'Git Pair',
    description: 'Git-integrated terminal pair programming assistant',
    icon: 'Code2',
    status: 'not-installed',
    isInstalled: false,
    installHint: 'pip install aider-chat',
    capabilities: ['git-commit-history', 'repo-map', 'pair-programming'],
    defaultModel: 'claude-3-7-sonnet',
    models: [
      { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet (Aider Architect)', description: 'High-score pair programming architect', isDefault: true },
      { id: 'deepseek-r1', name: 'DeepSeek R1 (Aider)', description: 'Reasoning model for tough algorithmic tasks' },
      { id: 'o3-mini', name: 'OpenAI o3-mini (Aider)', description: 'High-speed reasoning model' },
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
      case 'Zap':
        return <Zap className={className} />;
      case 'Cpu':
        return <Cpu className={className} />;
      case 'MousePointer':
        return <MousePointer className={className} />;
      case 'Wrench':
        return <Wrench className={className} />;
      case 'Terminal':
        return <Terminal className={className} />;
      case 'Code':
      case 'Code2':
        return <Code2 className={className} />;
      case 'Bot':
        return <Cpu className={className} />;
      default:
        return <Layers className={className} />;
    }
  };

  const installedEngines = engines.filter((e) => e.isInstalled !== false);
  const uninstalledEngines = engines.filter((e) => e.isInstalled === false);

  const renderEngineItem = (engine: AcpEngineInfo) => {
    const isSelected = engine.id === currentEngineId;
    const isReady = engine.isInstalled !== false;

    return (
      <div
        key={engine.id}
        className={`w-full rounded-lg transition-all duration-150 flex flex-col ${
          isSelected
            ? 'bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/40 text-[var(--text-main)] shadow-xs p-1.5'
            : isReady
            ? 'border border-transparent hover:bg-[var(--bg-sidebar)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
            : 'border border-transparent hover:bg-[var(--bg-sidebar)]/60 text-[var(--text-muted)] opacity-75 hover:opacity-100'
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
                : isReady
                ? 'bg-[var(--bg-main)] text-[var(--text-muted)] group-hover:text-[var(--color-primary)]'
                : 'bg-[var(--bg-main)]/60 text-[var(--text-muted)]/60'
            }`}
          >
            {renderIcon(engine.icon, 'w-4 h-4')}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-0.5">
              <span className="text-xs font-semibold text-[var(--text-main)] font-mono flex items-center gap-1.5">
                {engine.name}
                {isReady ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Terinstall & Siap Pakai" />
                ) : (
                  <span className="text-[8px] font-sans px-1 py-0.2 rounded bg-neutral-800 text-neutral-400 shrink-0 border border-neutral-700">
                    Not Installed
                  </span>
                )}
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
            {!isReady && engine.installHint && (
              <p className="text-[9px] font-mono text-[var(--color-primary)]/80 mt-1 flex items-center gap-1 truncate">
                <Download className="w-2.5 h-2.5 shrink-0" />
                <span>{engine.installHint}</span>
              </p>
            )}
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
                    role="menuitem"
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
          className="absolute left-0 mt-1.5 w-80 sm:w-92 max-h-[85vh] overflow-y-auto rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
        >
          {/* Header */}
          <div className="px-2.5 py-1.5 border-b border-[var(--border-color)]/60 mb-1 flex items-center justify-between sticky top-0 bg-[var(--bg-card)] z-10">
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono tracking-wider text-[var(--text-muted)]">
              <Layers className="w-3 h-3 text-[var(--color-primary)]" />
              <span>ACP Pluggable Core</span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-primary-glow)] text-[var(--color-primary)] border border-[var(--color-primary)]/30 font-semibold">
              ACP v1.0
            </span>
          </div>

          {/* Section 1: Installed & Ready */}
          {installedEngines.length > 0 && (
            <div className="flex flex-col gap-1 mb-2">
              <div className="px-2 pt-1 pb-0.5 text-[9px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>Terinstall & Siap Pakai</span>
              </div>
              {installedEngines.map(renderEngineItem)}
            </div>
          )}

          {/* Section 2: Other Available ADE/IDE Providers */}
          {uninstalledEngines.length > 0 && (
            <div className="flex flex-col gap-1 pt-1.5 border-t border-[var(--border-color)]/60">
              <div className="px-2 pt-1 pb-0.5 text-[9px] font-mono uppercase tracking-wider text-[var(--text-muted)] font-semibold flex items-center justify-between">
                <span>Provider Lainnya</span>
                <span className="text-[8px] opacity-70">Belum Terinstall</span>
              </div>
              {uninstalledEngines.map(renderEngineItem)}
            </div>
          )}

          {/* Footer note explaining single-thread preservation */}
          <div className="mt-2 pt-1.5 px-2.5 border-t border-[var(--border-color)]/50 text-[10px] text-[var(--text-muted)] flex items-center justify-between sticky bottom-0 bg-[var(--bg-card)]">
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
