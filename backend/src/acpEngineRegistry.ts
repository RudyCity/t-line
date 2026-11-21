/**
 * Agent Client Protocol (ACP) - Universal Multi-Engine Registry for T-Line
 * Manages all available ACP execution engines (Antigravity agy.exe, Superagent Core,
 * Codex, Claude Code, and user-configured custom ACP servers) that plug into T-Line
 * while maintaining a unified single-thread chat session.
 */

import fs from 'fs';
import path from 'path';

export interface AcpModelInfo {
  id: string;
  name: string;
  contextWindow?: string;
  description?: string;
  isDefault?: boolean;
}

export interface AcpEngineProfile {
  id: string;
  name: string;
  badge: string;
  description: string;
  icon: string;
  status: 'ready' | 'configured' | 'available';
  capabilities: string[];
  command: string;
  args: string[];
  env?: Record<string, string>;
  models?: AcpModelInfo[];
  defaultModel?: string;
  systemPromptAppend?: string;
}

export const SUPERAGENT_DYNAMIC_TOOLS_ACP_PROMPT = `
# SUPERAGENT DYNAMIC TOOLS PROTOCOL
You are operating within T-Line with direct access to the Superagent Dynamic Tool Gateway via MCP (server: 'superagent').
- DYNAMIC DISCOVERY & EXECUTION:
  1. SEARCH: When the user asks for browser/web automation, UI inspection, terminal commands, or multi-agent tasks, discover tools using 'superagent_tool_search' (with keyword or task intent).
  2. DESCRIBE: Inspect tool requirements using 'superagent_tool_describe' with the tool name.
  3. EXECUTE: Execute the tool using 'superagent_tool_execute' with 'name' and 'arguments'.
- AVAILABLE CAPABILITIES ON DEMAND:
  • Chrome Browser & Web Automation: 'superagent_chrome_cdp' (commands: 'navigate', 'click', 'type', 'screenshot', 'scroll', 'eval'), 'superagent_chrome_cdp_web'
  • Visual Perception & Layout Auditing: 'superagent_chrome_vision' (UI-DETR-1 layout defect detection & Set-of-Mark numeric coordinates)
  • Workspace & Project Operations: 'superagent_get_workspace', 'superagent_list_projects', 'superagent_check_project_health'
  • History & Chat Inspection: 'superagent_delegate_search_history', 'superagent_delegate_sync_history'
- ACTION FIRST: For executable requests, use these authorized tools directly instead of merely describing manual steps.
`.trim();

/**
 * Resolves the absolute path to the official Google DeepMind Antigravity CLI (agy.exe).
 */
export function resolveAgyPath(): string {
  const localAppData = process.env.LOCALAPPDATA || 'C:\\Users\\USER\\AppData\\Local';
  const directPath = path.join(localAppData, 'agy', 'bin', 'agy.exe');
  if (fs.existsSync(directPath)) return directPath;

  const userProfile = process.env.USERPROFILE || 'C:\\Users\\USER';
  const altPath = path.join(userProfile, '.gemini', 'antigravity-cli', 'bin', 'agentapi.bat');
  if (fs.existsSync(altPath)) return altPath;

  return 'agy';
}

/**
 * Resolves the path to the Superagent Core CLI.
 */
export function resolveSuperagentPath(): { command: string; args: string[] } {
  // Check sibling workspace checkout first
  const siblingCli = path.resolve(__dirname, '../../../superagent/dist/cli.js');
  if (fs.existsSync(siblingCli)) {
    return { command: 'bun', args: [siblingCli, '--acp'] };
  }

  return { command: 'superagent', args: ['--acp'] };
}

/**
 * Resolves the path to Codex CLI.
 */
export function resolveCodexPath(): string {
  const appData = process.env.LOCALAPPDATA || '';
  const codexPath = path.join(appData, 'Programs', 'codex', 'codex.exe');
  if (fs.existsSync(codexPath)) return codexPath;
  return 'codex';
}

/**
 * Returns the built-in ACP server profiles.
 */
export function getBuiltinAcpEngines(): Record<string, AcpEngineProfile> {
  const agyBinary = resolveAgyPath();
  const superagentSpec = resolveSuperagentPath();
  const codexBinary = resolveCodexPath();

  return {
    antigravity: {
      id: 'antigravity',
      name: 'Antigravity (Gemini)',
      badge: '1M Context',
      description: 'Official Google DeepMind Antigravity with Gemini 3.8 Flash High & Claude Sonnet 4.6',
      icon: 'Brain',
      status: 'ready',
      capabilities: ['massive-context', 'vision', 'literature-research', 'multimodal', 'deep-reasoning', 'superagent-dynamic-tools'],
      command: agyBinary,
      args: ['acp'],
      defaultModel: 'gemini-3.8-flash-high',
      systemPromptAppend: SUPERAGENT_DYNAMIC_TOOLS_ACP_PROMPT,
      models: [
        {
          id: 'gemini-3.8-flash-high',
          name: 'Gemini 3.8 Flash (High)',
          contextWindow: '1,048,576 tokens',
          description: 'Official Google DeepMind Gemini with deep reasoning & 1M context',
          isDefault: true,
        },
        {
          id: 'gemini-3.8-flash-medium',
          name: 'Gemini 3.8 Flash (Medium)',
          contextWindow: '1,048,576 tokens',
          description: 'Balanced speed and high-precision reasoning',
        },
        {
          id: 'gemini-3.8-flash-low',
          name: 'Gemini 3.8 Flash (Low)',
          contextWindow: '1,048,576 tokens',
          description: 'Fast responses for rapid iteration',
        },
        {
          id: 'claude-sonnet-4-6',
          name: 'Claude Sonnet 4.6 (Thinking)',
          contextWindow: '1,048,576 tokens',
          description: 'Anthropic Claude reasoning integrated in Antigravity',
        },
        {
          id: 'claude-opus-4-6-thinking',
          name: 'Claude Opus 4.6 (Thinking)',
          contextWindow: '1,048,576 tokens',
          description: 'Extended thinking and complex architectural synthesis',
        },
        {
          id: 'gpt-oss-120b-medium',
          name: 'GPT-OSS 120B (Medium)',
          contextWindow: '1,048,576 tokens',
          description: 'Open-weights reasoning model running in Antigravity',
        },
      ],
    },
    superagent: {
      id: 'superagent',
      name: 'Superagent Core',
      badge: 'ACP v1.0',
      description: 'Autonomous multi-agent coder with 3-tier subagents and local MCP tools',
      icon: 'Zap',
      status: 'ready',
      capabilities: ['tools', 'multi-tier', 'mcp', 'terminal-execution'],
      command: superagentSpec.command,
      args: superagentSpec.args,
      defaultModel: 'openrouter',
      models: [
        {
          id: 'openrouter',
          name: 'OpenRouter (Multi-Model)',
          description: 'Claude 3.7 Sonnet, DeepSeek R1, GPT-4o via OpenRouter',
          isDefault: true,
        },
        {
          id: 'claude-3-7-sonnet',
          name: 'Claude 3.7 Sonnet (Hybrid)',
          description: 'High capability coding with hybrid thinking mode',
        },
        {
          id: 'openai-gpt4o',
          name: 'GPT-4o Omnimodal',
          description: 'OpenAI multimodal flagship coding model',
        },
      ],
    },
    codex: {
      id: 'codex',
      name: 'Codex Bridge',
      badge: 'Fast Review',
      description: 'Fast single-pass refactoring and independent secondary code review',
      icon: 'Wrench',
      status: 'ready',
      capabilities: ['code-review', 'fast-refactoring', 'second-opinion'],
      command: codexBinary,
      args: ['acp'],
      defaultModel: 'gpt-4.1-code-review',
      models: [
        {
          id: 'gpt-4.1-code-review',
          name: 'GPT-4.1 Code Review',
          description: 'Specialized code review and refactoring engine',
          isDefault: true,
        },
        {
          id: 'gpt-4.1-mini-turbo',
          name: 'GPT-4.1 Mini Turbo',
          description: 'Fast code linting and syntax fixing',
        },
        {
          id: 'o3-mini',
          name: 'o3-mini (High Reasoning)',
          description: 'Fast reasoning for tricky edge cases',
        },
      ],
    },
  };
}

/**
 * Loads custom ACP servers defined in ~/.superagent-r/acp-servers.json if present.
 */
export function loadCustomAcpServers(): Record<string, AcpEngineProfile> {
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const customConfigPath = path.join(home, '.superagent-r', 'acp-servers.json');
  if (fs.existsSync(customConfigPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(customConfigPath, 'utf8'));
      if (typeof data === 'object' && data !== null) {
        return data;
      }
    } catch {}
  }
  return {};
}

/**
 * Lists all registered ACP engines (both built-in and user-customized).
 */
export function listAcpEngines(): AcpEngineProfile[] {
  const builtin = getBuiltinAcpEngines();
  const custom = loadCustomAcpServers();
  return [...Object.values(builtin), ...Object.values(custom)];
}

/**
 * Gets an ACP engine profile by ID, defaulting to 'superagent'.
 */
export function getAcpEngine(engineId?: string): AcpEngineProfile {
  const allEngines: Record<string, AcpEngineProfile> = {
    ...getBuiltinAcpEngines(),
    ...loadCustomAcpServers(),
  };

  if (engineId && allEngines[engineId]) {
    return allEngines[engineId];
  }
  return allEngines.superagent || getBuiltinAcpEngines().superagent;
}
