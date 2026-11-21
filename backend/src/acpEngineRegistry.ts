/**
 * Agent Client Protocol (ACP) - Universal Multi-Engine Registry for T-Line
 * Manages all available ACP execution engines (Antigravity agy.exe, Superagent Core,
 * Claude Code, Cursor, Codex, Zed, Aider, and user-configured custom ACP servers)
 * with real-time CLI installation detection while maintaining a unified single-thread chat session.
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
  status: 'ready' | 'configured' | 'available' | 'not-installed';
  isInstalled: boolean;
  installHint?: string;
  installCommand?: string;
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
 * Checks whether a given binary path or command name is executable/installed on the host.
 * Fast, synchronous, non-blocking check without shell execution.
 */
export function isBinaryInstalled(binaryPathOrCommand: string): boolean {
  if (!binaryPathOrCommand) return false;

  // 1. Direct path check (absolute or relative with separator)
  if (path.isAbsolute(binaryPathOrCommand) || binaryPathOrCommand.includes('/') || binaryPathOrCommand.includes('\\')) {
    if (fs.existsSync(binaryPathOrCommand)) return true;
    if (process.platform === 'win32') {
      const exts = ['.exe', '.cmd', '.bat', '.ps1'];
      for (const ext of exts) {
        if (fs.existsSync(binaryPathOrCommand + ext)) return true;
      }
    }
    return false;
  }

  // 2. PATH environment check
  const pathEnv = process.env.PATH || '';
  const delimiter = path.delimiter;
  const dirs = pathEnv.split(delimiter);
  const extensions = process.platform === 'win32'
    ? (process.env.PATHEXT ? process.env.PATHEXT.split(';') : ['.EXE', '.CMD', '.BAT', '.PS1'])
    : [''];

  for (const dir of dirs) {
    if (!dir) continue;
    for (const ext of extensions) {
      const fullPath = path.join(dir, binaryPathOrCommand + (binaryPathOrCommand.toUpperCase().endsWith(ext.toUpperCase()) ? '' : ext));
      try {
        if (fs.existsSync(fullPath)) return true;
      } catch {}
    }
  }

  return false;
}

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
 * Resolves the path to Anthropic Claude Code CLI.
 */
export function resolveClaudePath(): string {
  if (process.platform === 'win32') {
    const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
    const pfClaude = path.join(pf, 'nodejs', 'claude.cmd');
    if (fs.existsSync(pfClaude)) return pfClaude;

    const appData = process.env.APPDATA || '';
    const npmClaude = path.join(appData, 'npm', 'claude.cmd');
    if (fs.existsSync(npmClaude)) return npmClaude;
  }
  return 'claude';
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
 * Resolves the path to Cursor Agent / CLI.
 */
export function resolveCursorPath(): string {
  const appData = process.env.LOCALAPPDATA || '';
  const cursorPath = path.join(appData, 'Programs', 'cursor', 'Cursor.exe');
  if (fs.existsSync(cursorPath)) return cursorPath;
  return 'cursor';
}

/**
 * Resolves the path to Zed Editor ACP binary.
 */
export function resolveZedPath(): string {
  const appData = process.env.LOCALAPPDATA || '';
  const zedPath = path.join(appData, 'Programs', 'Zed', 'zed.exe');
  if (fs.existsSync(zedPath)) return zedPath;
  return 'zed';
}

/**
 * Resolves the path to Aider Pair Programmer.
 */
export function resolveAiderPath(): string {
  const userProfile = process.env.USERPROFILE || '';
  const aiderScripts = path.join(userProfile, 'AppData', 'Roaming', 'Python', 'Scripts', 'aider.exe');
  if (fs.existsSync(aiderScripts)) return aiderScripts;
  return 'aider';
}

/**
 * Returns the built-in ACP / ADE server profiles with real-time installation detection.
 */
export function getBuiltinAcpEngines(): Record<string, AcpEngineProfile> {
  const agyBinary = resolveAgyPath();
  const isAgyInstalled = isBinaryInstalled(agyBinary);

  const superagentSpec = resolveSuperagentPath();
  const isSuperagentInstalled = isBinaryInstalled(superagentSpec.command) || fs.existsSync(path.resolve(__dirname, '../../../superagent/dist/cli.js'));

  const claudeBinary = resolveClaudePath();
  const isClaudeInstalled = isBinaryInstalled(claudeBinary);

  const codexBinary = resolveCodexPath();
  const isCodexInstalled = isBinaryInstalled(codexBinary);

  const cursorBinary = resolveCursorPath();
  const isCursorInstalled = isBinaryInstalled(cursorBinary);

  const zedBinary = resolveZedPath();
  const isZedInstalled = isBinaryInstalled(zedBinary);

  const aiderBinary = resolveAiderPath();
  const isAiderInstalled = isBinaryInstalled(aiderBinary);

  return {
    antigravity: {
      id: 'antigravity',
      name: 'Antigravity (Gemini)',
      badge: '1M Context',
      description: 'Official Google DeepMind Antigravity ADE with Gemini 3.8 Flash High & Claude Sonnet 4.6',
      icon: 'Brain',
      status: isAgyInstalled ? 'ready' : 'not-installed',
      isInstalled: isAgyInstalled,
      installHint: 'Download Antigravity from Google DeepMind',
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
      status: isSuperagentInstalled ? 'ready' : 'not-installed',
      isInstalled: isSuperagentInstalled,
      capabilities: ['tools', 'multi-tier', 'mcp', 'terminal-execution', 'chrome-cdp'],
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
    'claude-code': {
      id: 'claude-code',
      name: 'Claude Code',
      badge: 'Agentic CLI',
      description: 'Official Anthropic Claude Code agentic coding assistant with hybrid thinking',
      icon: 'Cpu',
      status: isClaudeInstalled ? 'ready' : 'not-installed',
      isInstalled: isClaudeInstalled,
      installHint: 'npm install -g @anthropic-ai/claude-code',
      installCommand: 'npm install -g @anthropic-ai/claude-code',
      capabilities: ['agentic-coding', 'bash', 'file-editing', 'hybrid-thinking', 'subagents'],
      command: claudeBinary,
      args: ['--output-format=stream-json', '--input-format=stream-json', '--verbose'],
      defaultModel: 'claude-3-7-sonnet',
      models: [
        {
          id: 'claude-3-7-sonnet',
          name: 'Claude 3.7 Sonnet (Hybrid Thinking)',
          description: 'Latest flagship with dynamic reasoning effort and coding excellence',
          isDefault: true,
        },
        {
          id: 'claude-3-5-sonnet',
          name: 'Claude 3.5 Sonnet v2',
          description: 'Fast and accurate coding model for rapid changes',
        },
        {
          id: 'claude-3-opus',
          name: 'Claude 3 Opus',
          description: 'Deep architectural reasoning model for complex systems',
        },
      ],
    },
    cursor: {
      id: 'cursor',
      name: 'Cursor Agent',
      badge: 'Fast Index',
      description: 'Cursor codebase indexing & agentic terminal refactoring engine',
      icon: 'MousePointer',
      status: isCursorInstalled ? 'ready' : 'not-installed',
      isInstalled: isCursorInstalled,
      installHint: 'Install Cursor IDE from https://cursor.com',
      capabilities: ['codebase-index', 'fast-apply', 'diff-editing'],
      command: cursorBinary,
      args: ['agent'],
      defaultModel: 'cursor-fast',
      models: [
        {
          id: 'cursor-fast',
          name: 'Cursor Fast Model',
          description: 'Optimized low-latency codebase editor',
          isDefault: true,
        },
        {
          id: 'claude-3.7-sonnet',
          name: 'Claude 3.7 Sonnet in Cursor',
          description: 'Anthropic coding agent running within Cursor',
        },
        {
          id: 'gpt-4o',
          name: 'GPT-4o in Cursor',
          description: 'OpenAI multi-modal coding model',
        },
      ],
    },
    codex: {
      id: 'codex',
      name: 'Codex Bridge',
      badge: 'Fast Review',
      description: 'OpenAI Codex single-pass refactoring and secondary code review',
      icon: 'Wrench',
      status: isCodexInstalled ? 'ready' : 'not-installed',
      isInstalled: isCodexInstalled,
      installHint: 'Install OpenAI Codex CLI via https://openai.com/codex',
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
    zed: {
      id: 'zed',
      name: 'Zed AI Agent',
      badge: 'Rust ACP',
      description: 'High-performance Zed editor agent protocol powered by Anthropic & OpenAI',
      icon: 'Terminal',
      status: isZedInstalled ? 'ready' : 'not-installed',
      isInstalled: isZedInstalled,
      installHint: 'Install Zed editor from https://zed.dev',
      capabilities: ['rust-speed', 'fast-buffering', 'acp-v1'],
      command: zedBinary,
      args: ['acp'],
      defaultModel: 'claude-3-7-sonnet',
      models: [
        {
          id: 'claude-3-7-sonnet',
          name: 'Claude 3.7 Sonnet (Zed)',
          description: 'Default Zed AI reasoning agent',
          isDefault: true,
        },
        {
          id: 'gpt-4o',
          name: 'GPT-4o (Zed)',
          description: 'OpenAI integration in Zed',
        },
      ],
    },
    aider: {
      id: 'aider',
      name: 'Aider Pair Programmer',
      badge: 'Git Pair',
      description: 'Git-integrated terminal pair programming assistant',
      icon: 'Code2',
      status: isAiderInstalled ? 'ready' : 'not-installed',
      isInstalled: isAiderInstalled,
      installHint: 'pip install aider-chat',
      installCommand: 'pip install aider-chat',
      capabilities: ['git-commit-history', 'repo-map', 'pair-programming'],
      command: aiderBinary,
      args: ['--no-git', '--stream'],
      defaultModel: 'claude-3-7-sonnet',
      models: [
        {
          id: 'claude-3-7-sonnet',
          name: 'Claude 3.7 Sonnet (Aider Architect)',
          description: 'High-score pair programming architect',
          isDefault: true,
        },
        {
          id: 'deepseek-r1',
          name: 'DeepSeek R1 (Aider)',
          description: 'Reasoning model for tough algorithmic tasks',
        },
        {
          id: 'o3-mini',
          name: 'OpenAI o3-mini (Aider)',
          description: 'High-speed reasoning model',
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
        const enriched: Record<string, AcpEngineProfile> = {};
        for (const [key, val] of Object.entries(data)) {
          const profile = val as AcpEngineProfile;
          const installed = isBinaryInstalled(profile.command);
          enriched[key] = {
            ...profile,
            isInstalled: installed,
            status: installed ? 'ready' : 'not-installed',
          };
        }
        return enriched;
      }
    } catch {}
  }
  return {};
}

/**
 * Lists all registered ACP / ADE engines (both built-in and user-customized),
 * sorted so that installed and ready engines appear first.
 */
export function listAcpEngines(): AcpEngineProfile[] {
  const builtin = getBuiltinAcpEngines();
  const custom = loadCustomAcpServers();
  const all = [...Object.values(builtin), ...Object.values(custom)];

  return all.sort((a, b) => {
    // Installed engines come first
    if (a.isInstalled && !b.isInstalled) return -1;
    if (!a.isInstalled && b.isInstalled) return 1;
    return 0;
  });
}

/**
 * Gets an ACP engine profile by ID, defaulting to 'antigravity' (if installed) or 'superagent'.
 */
export function getAcpEngine(engineId?: string): AcpEngineProfile {
  const allEngines: Record<string, AcpEngineProfile> = {
    ...getBuiltinAcpEngines(),
    ...loadCustomAcpServers(),
  };

  if (engineId && allEngines[engineId]) {
    return allEngines[engineId];
  }

  // Smart fallback
  if (allEngines.antigravity?.isInstalled) {
    return allEngines.antigravity;
  }
  return allEngines.superagent || getBuiltinAcpEngines().superagent;
}
