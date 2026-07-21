export interface SlashCommand {
  command: string;
  description: string;
  argsHelp?: string;
  action?: (args?: string) => void;
}

interface CommandContext {
  ws: WebSocket | null;
  workspace: string;
  agentMode: 'single' | 'multi';
  customArgs: string;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  setAgentMode: (mode: 'single' | 'multi') => void;
  setCustomArgs: (args: string) => void;
  setWorkspace: (path: string) => void;
  setConnectTrigger: React.Dispatch<React.SetStateAction<number>>;
  handleSend: (prompt?: string) => Promise<void> | void;
  handleAbort: () => void;
}

export const BUILTIN_COMMAND_DESCRIPTIONS: Record<string, string> = {
  "/help": "Show available commands and usage instructions",
  "/model": "Switch active LLM model or configure per-tier models",
  "/workspace": "Manage project workspaces (list, add, use)",
  "/w": "Manage project workspaces (alias: /workspace)",
  "/mode": "Switch agent execution mode (single or multi)",
  "/single": "Switch agent mode to Single Agent and restart",
  "/multi": "Switch agent mode to Multi-Agent Master (--multi) and restart",
  "/login": "Add API credentials or switch active provider",
  "/resume": "Resume a previous session from history",
  "/checkpoint": "Save or restore a session state snapshot",
  "/history": "Manage SQLite history database — export, backup, or migrate sessions",
  "/skills": "Browse all installed automation skills",
  "/skill": "Browse all installed automation skills",
  "/hallmark": "Anti-AI-slop design skill for greenfield pages, audits, redesigns & study",
  "/goal": "Activate Goal Mode for long-running overnight tasks",
  "/procs": "Display active background processes",
  "/processes": "Display active background processes",
  "/terminal": "Spawn a visible terminal window or run presets",
  "/memory": "Manage persistent agent memory and scenes",
  "/internal-hooks": "Manage custom internal hook tools — init, dev, or select active hooks",
  "/ih": "Manage custom internal hook tools (alias: /internal-hooks)",
  "/status": "Check agent connection and server status",
  "/clear": "Clear local console chat messages",
  "/abort": "Abort active agent execution immediately",
  "/reset": "Reset and restart WebSocket bridge connection",
  "/explain": "Ask SuperAgent to analyze and explain codebase structure",
  "/test": "Ask SuperAgent to check and run test suite",
  "/browser": "Launch web browsing, search, or web app interaction",
  "/grill-me": "Start interactive alignment interview to resolve design decisions",
  "/teamwork-preview": "Preview multi-agent team collaborative execution",
  "/learn": "Persist user corrections or complex setup for future tasks",
  "/focus": "Set reasoning focus depth level (off, low, medium, high, max)",
  "/setting-focus": "Set reasoning focus depth level (alias: /focus)",
  "/setting-auto-vision": "Enable or disable automatic vision token saving (on or off)",
  "/setting-vision-threshold": "Set characters threshold for auto vision token saving",
  "/setting-hide-timeline": "Hide or show the timeline lines connecting turns (on or off)",
  "/setting-advisor": "Enable or disable the Real-Time Execution Advisor (on or off)",
  "/setting-classifier": "Enable or disable multi-category request classifier (on or off)",
  "/setting-classifier-threshold": "Set classifier heuristic confidence threshold (high, medium, low)",
};

export function getSlashCommands({
  ws,
  workspace,
  agentMode,
  customArgs,
  setMessages,
  setAgentMode,
  setCustomArgs,
  setWorkspace,
  setConnectTrigger,
  handleSend,
  handleAbort
}: CommandContext): SlashCommand[] {
  return [
    {
      command: '/help',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/help'],
      action: () => {
        setMessages(prev => [
          ...prev,
          {
            role: 'system',
            text: 'SuperAgent Commands:\n' +
              Object.entries(BUILTIN_COMMAND_DESCRIPTIONS)
                .map(([cmd, desc]) => `${cmd} - ${desc}`)
                .join('\n')
          }
        ]);
      }
    },
    {
      command: '/model',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/model'],
      argsHelp: '[model-id|preset]',
      action: (args?: string) => {
        if (args) handleSend(`/model ${args}`);
      }
    },
    {
      command: '/workspace',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/workspace'],
      argsHelp: '[list|add|use|path]',
      action: (args?: string) => {
        const targetPath = args?.trim();
        if (targetPath) {
          setWorkspace(targetPath);
          localStorage.setItem('currentWorkspace', targetPath);
          setMessages(prev => [...prev, { role: 'system', text: `Workspace switched to: ${targetPath}. Restarting bridge...` }]);
          setConnectTrigger(prev => prev + 1);
        } else {
          setMessages(prev => [...prev, { role: 'system', text: 'Usage: /workspace [list|add|use|path]' }]);
        }
      }
    },
    {
      command: '/mode',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/mode'],
      argsHelp: '[single|multi]',
      action: (args?: string) => {
        const cleanMode = args?.trim().toLowerCase();
        if (cleanMode === 'single' || cleanMode === 'multi') {
          setAgentMode(cleanMode as 'single' | 'multi');
          setMessages(prev => [...prev, { role: 'system', text: `Mode switched to: ${cleanMode}. Restarting bridge...` }]);
          setConnectTrigger(prev => prev + 1);
        } else {
          setMessages(prev => [...prev, { role: 'system', text: 'Usage: /mode [single|multi]' }]);
        }
      }
    },
    {
      command: '/single',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/single'],
      action: () => {
        setAgentMode('single');
        setMessages(prev => [...prev, { role: 'system', text: 'CLI Mode switched to Single Agent. Restarting bridge...' }]);
        setConnectTrigger(prev => prev + 1);
      }
    },
    {
      command: '/multi',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/multi'],
      action: () => {
        setAgentMode('multi');
        setMessages(prev => [...prev, { role: 'system', text: 'CLI Mode switched to Multi-Agent. Restarting bridge...' }]);
        setConnectTrigger(prev => prev + 1);
      }
    },
    {
      command: '/login',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/login'],
      argsHelp: '[add|list|remove]',
      action: (args?: string) => {
        if (args) handleSend(`/login ${args}`);
      }
    },
    {
      command: '/checkpoint',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/checkpoint'],
      argsHelp: '[list|restore|delete]',
      action: (args?: string) => {
        if (args) handleSend(`/checkpoint ${args}`);
      }
    },
    {
      command: '/history',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/history'],
      argsHelp: '[stats|tag|export|backup|migrate|clean]',
      action: (args?: string) => {
        if (args) handleSend(`/history ${args}`);
      }
    },
    {
      command: '/hallmark',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/hallmark'],
      argsHelp: '[redesign|audit|study]',
      action: (args?: string) => {
        handleSend(`/hallmark ${args || ''}`.trim());
      }
    },
    {
      command: '/goal',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/goal'],
      action: () => {
        handleSend('/goal');
      }
    },
    {
      command: '/procs',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/procs'],
      argsHelp: '[stop|stop all]',
      action: (args?: string) => {
        if (args) handleSend(`/procs ${args}`);
      }
    },
    {
      command: '/terminal',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/terminal'],
      argsHelp: '[init|bg|stop|all|preset]',
      action: (args?: string) => {
        if (args) handleSend(`/terminal ${args}`);
      }
    },
    {
      command: '/memory',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/memory'],
      argsHelp: '[status|sync|search|add|delete]',
      action: (args?: string) => {
        if (args) handleSend(`/memory ${args}`);
      }
    },
    {
      command: '/internal-hooks',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/internal-hooks'],
      argsHelp: '[init|dev|list|active]',
      action: (args?: string) => {
        if (args) handleSend(`/internal-hooks ${args}`);
      }
    },
    {
      command: '/focus',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/focus'],
      argsHelp: '[off|low|medium|high|max]',
      action: (args?: string) => {
        if (args) handleSend(`/focus ${args}`);
      }
    },
    {
      command: '/status',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/status'],
      action: () => {
        const statusText = `WebSocket Connection: ${ws?.readyState === 1 ? 'Connected (OPEN)' : 'Disconnected'}\n` +
          `Active Workspace: ${workspace || 'None'}\n` +
          `CLI Mode: ${agentMode === 'multi' ? 'Multi-Agent Master (--multi)' : 'Single Agent Mode'}\n` +
          `Custom CLI Flags: ${customArgs || 'None'}`;
        setMessages(prev => [...prev, { role: 'system', text: statusText }]);
      }
    },
    {
      command: '/clear',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/clear'],
      action: () => {
        setMessages([{ role: 'system', text: 'Console cleared. Connected to t-line workspace context.' }]);
      }
    },
    {
      command: '/abort',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/abort'],
      action: () => {
        handleAbort();
      }
    },
    {
      command: '/reset',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/reset'],
      action: () => {
        setMessages(prev => [...prev, { role: 'system', text: 'Resetting and reconnecting WebSocket bridge...' }]);
        setConnectTrigger(prev => prev + 1);
      }
    },
    {
      command: '/resume',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/resume'],
      action: () => {
        setCustomArgs('--resume');
        setMessages(prev => [...prev, { role: 'system', text: 'Flags set to --resume. Restarting bridge...' }]);
        setConnectTrigger(prev => prev + 1);
      }
    },
    {
      command: '/explain',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/explain'],
      action: () => {
        handleSend('Please analyze and explain the codebase structure of this workspace.');
      }
    },
    {
      command: '/test',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/test'],
      action: () => {
        handleSend('Please check the test suite and run tests to verify codebase health.');
      }
    },
    {
      command: '/browser',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/browser'],
      action: () => {
        handleSend('/browser');
      }
    },
    {
      command: '/grill-me',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/grill-me'],
      action: () => {
        handleSend('/grill-me');
      }
    },
    {
      command: '/teamwork-preview',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/teamwork-preview'],
      action: () => {
        handleSend('/teamwork-preview');
      }
    },
    {
      command: '/learn',
      description: BUILTIN_COMMAND_DESCRIPTIONS['/learn'],
      action: () => {
        handleSend('/learn');
      }
    }
  ];
}

export function getSubCommands(
  parentCmd: string,
  context: { workspace: string; agentMode: 'single' | 'multi' }
): SlashCommand[] {
  const cleanCmd = parentCmd.toLowerCase().trim();

  if (cleanCmd === '/model') {
    return [
      { command: '/model preset', description: 'Configure or switch model presets' },
      { command: '/model master', description: 'Configure primary master agent model' },
      { command: '/model superagent', description: 'Configure superagent model' },
      { command: '/model subagent', description: 'Configure subagent worker model' },
      { command: '/model google/gemini-2.5-flash', description: 'Fast Flash model' },
      { command: '/model google/gemini-2.5-pro', description: 'High reasoning Pro model' },
      { command: '/model anthropic/claude-3-5-sonnet', description: 'Claude 3.5 Sonnet' },
      { command: '/model openai/gpt-4o', description: 'OpenAI GPT-4o' }
    ];
  }

  if (cleanCmd === '/workspace' || cleanCmd === '/w') {
    return [
      { command: `${cleanCmd} list`, description: 'List all trusted project workspaces' },
      { command: `${cleanCmd} add`, description: 'Add a new directory to trusted workspaces' },
      { command: `${cleanCmd} use`, description: 'Switch to a specific workspace by index' },
      { command: `${cleanCmd} ${context.workspace}`, description: 'Current active workspace' }
    ];
  }

  if (cleanCmd === '/mode') {
    return [
      { command: '/mode single', description: 'Single Agent execution mode' },
      { command: '/mode multi', description: 'Multi-Agent Master mode (--multi)' }
    ];
  }

  if (cleanCmd === '/login') {
    return [
      { command: '/login add', description: 'Add provider API credentials (openrouter, openai, gemini, anthropic)' },
      { command: '/login list', description: 'List configured API key providers' },
      { command: '/login remove', description: 'Remove configured API key provider' }
    ];
  }

  if (cleanCmd === '/checkpoint') {
    return [
      { command: '/checkpoint list', description: 'List session state snapshots' },
      { command: '/checkpoint restore', description: 'Restore session state snapshot' },
      { command: '/checkpoint delete', description: 'Delete session state snapshot' }
    ];
  }

  if (cleanCmd === '/history') {
    return [
      { command: '/history stats', description: 'Show history statistics' },
      { command: '/history tag', description: 'Add tag to current session' },
      { command: '/history export', description: 'Export session history to JSON/Markdown' },
      { command: '/history backup', description: 'Backup SQLite history database' },
      { command: '/history migrate', description: 'Migrate legacy history database' },
      { command: '/history clean', description: 'Clean up old history logs' }
    ];
  }

  if (cleanCmd === '/terminal') {
    return [
      { command: '/terminal init', description: 'Initialize terminal session' },
      { command: '/terminal bg', description: 'Run command in background terminal' },
      { command: '/terminal stop', description: 'Stop active background terminal' },
      { command: '/terminal stop all', description: 'Stop all background terminals' },
      { command: '/terminal preset', description: 'Run terminal preset script' }
    ];
  }

  if (cleanCmd === '/procs' || cleanCmd === '/processes') {
    return [
      { command: `${cleanCmd} stop`, description: 'Stop background process' },
      { command: `${cleanCmd} stop all`, description: 'Stop all background processes' }
    ];
  }

  if (cleanCmd === '/focus' || cleanCmd === '/setting-focus') {
    return [
      { command: `${cleanCmd} off`, description: 'Turn off reasoning focus' },
      { command: `${cleanCmd} low`, description: 'Low depth reasoning focus' },
      { command: `${cleanCmd} medium`, description: 'Medium depth reasoning focus' },
      { command: `${cleanCmd} high`, description: 'High depth reasoning focus' },
      { command: `${cleanCmd} max`, description: 'Maximum depth reasoning focus' }
    ];
  }

  if (cleanCmd === '/memory') {
    return [
      { command: '/memory status', description: 'Show persistent memory status' },
      { command: '/memory sync', description: 'Sync memory database' },
      { command: '/memory search', description: 'Search through persistent memories' },
      { command: '/memory add', description: 'Add item to persistent memory' },
      { command: '/memory delete', description: 'Delete item from persistent memory' }
    ];
  }

  if (cleanCmd === '/internal-hooks' || cleanCmd === '/ih') {
    return [
      { command: `${cleanCmd} init`, description: 'Initialize custom internal hook tool' },
      { command: `${cleanCmd} dev`, description: 'Develop internal hook tool' },
      { command: `${cleanCmd} list`, description: 'List available internal hook tools' },
      { command: `${cleanCmd} active`, description: 'Show active internal hook tools' }
    ];
  }

  if (cleanCmd === '/hallmark') {
    return [
      { command: '/hallmark redesign', description: 'Redesign visual UI structure within existing boundaries' },
      { command: '/hallmark audit', description: 'Score UI against anti-pattern list & return ranked punch list' },
      { command: '/hallmark study', description: 'Extract design DNA from screenshot or live URL' }
    ];
  }

  return [];
}
