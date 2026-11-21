/**
 * Agent Client Protocol (ACP) - Multi-Engine Registry for T-Line
 * Manages available ACP execution engines (Superagent Core, Antigravity, Codex)
 * that plug into T-Line while maintaining a unified single-thread chat session.
 */

export interface AcpEngineProfile {
  id: 'superagent' | 'antigravity' | 'codex';
  name: string;
  badge: string;
  description: string;
  icon: string;
  status: 'ready' | 'configured' | 'available';
  capabilities: string[];
  command: string;
  args: string[];
}

export const ACP_ENGINES: Record<string, AcpEngineProfile> = {
  superagent: {
    id: 'superagent',
    name: 'Superagent Core',
    badge: 'ACP v1.0',
    description: 'Autonomous multi-agent coder with 3-tier subagents and local MCP tools',
    icon: 'Zap',
    status: 'ready',
    capabilities: ['tools', 'multi-tier', 'mcp', 'terminal-execution'],
    command: 'bun',
    args: ['dist/cli.js', '--acp'],
  },
  antigravity: {
    id: 'antigravity',
    name: 'Antigravity (Gemini)',
    badge: '1M Context',
    description: 'Massive context window deep codebase researcher & system architect',
    icon: 'Brain',
    status: 'ready',
    capabilities: ['massive-context', 'vision', 'literature-research', 'multimodal'],
    command: 'bun',
    args: ['src/core/channels/acp/acpRuntime.js'],
  },
  codex: {
    id: 'codex',
    name: 'Codex Bridge',
    badge: 'Fast Review',
    description: 'Fast single-pass refactoring and independent secondary code review',
    icon: 'Wrench',
    status: 'ready',
    capabilities: ['code-review', 'fast-refactoring', 'second-opinion'],
    command: 'codex',
    args: ['--acp-server'],
  },
};

/**
 * Lists all registered ACP engines.
 */
export function listAcpEngines(): AcpEngineProfile[] {
  return Object.values(ACP_ENGINES);
}

/**
 * Gets an ACP engine profile by ID, defaulting to 'superagent'.
 */
export function getAcpEngine(engineId?: string): AcpEngineProfile {
  if (engineId && ACP_ENGINES[engineId]) {
    return ACP_ENGINES[engineId];
  }
  return ACP_ENGINES.superagent;
}
