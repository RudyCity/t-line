import { useState, useRef, useEffect } from 'react';
import { Zap, Brain, Wrench, Check, ChevronDown, Layers } from 'lucide-react';

export interface AcpEngineInfo {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon?: string;
  status: 'ready' | 'configured' | 'available';
  capabilities?: string[];
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
  },
  {
    id: 'antigravity',
    name: 'Antigravity (Gemini)',
    badge: '1M Context',
    description: 'Deep codebase researcher, multimodal perception & architecture planner',
    icon: 'Brain',
    status: 'ready',
    capabilities: ['massive-context', 'vision', 'literature-research', 'multimodal'],
  },
  {
    id: 'codex',
    name: 'Codex Bridge',
    badge: 'Fast Review',
    description: 'Fast single-pass refactoring and independent secondary code review',
    icon: 'Wrench',
    status: 'ready',
    capabilities: ['code-review', 'fast-refactoring', 'second-opinion'],
  },
];

interface AcpEngineSelectorProps {
  currentEngineId: string;
  onEngineSelect: (engineId: string) => void;
  disabled?: boolean;
}

export function AcpEngineSelector({
  currentEngineId,
  onEngineSelect,
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
        title={`Execution Core: ${activeEngine.name} (${activeEngine.badge}) - Click to switch`}
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
        <span className="hidden sm:inline-block text-[9px] px-1 py-0.2 rounded font-mono uppercase tracking-wider bg-[var(--color-primary)]/10 text-[var(--color-primary)] border border-[var(--color-primary)]/20">
          {activeEngine.badge}
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
          className="absolute left-0 mt-1.5 w-76 sm:w-84 rounded-xl bg-[var(--bg-card)] border border-[var(--border-color)] shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
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
          <div className="flex flex-col gap-1">
            {engines.map((engine) => {
              const isSelected = engine.id === currentEngineId;
              return (
                <button
                  key={engine.id}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    onEngineSelect(engine.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left p-2 rounded-lg transition-all duration-150 flex items-start gap-2.5 cursor-pointer group ${
                    isSelected
                      ? 'bg-[var(--color-primary-glow)] border border-[var(--color-primary)]/40 text-[var(--text-main)] shadow-xs'
                      : 'border border-transparent hover:bg-[var(--bg-sidebar)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  <div
                    className={`mt-0.5 p-1.5 rounded-md flex-shrink-0 transition-colors ${
                      isSelected
                        ? 'bg-[var(--color-primary)] text-black font-bold'
                        : 'bg-[var(--bg-main)] text-[var(--text-muted)] group-hover:text-[var(--color-primary)] group-hover:bg-[var(--color-primary)]/10'
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
