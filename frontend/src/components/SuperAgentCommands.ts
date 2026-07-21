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
      command: '/hallmark',
      description: 'Anti-AI-slop design skill for greenfield pages, audits, redesigns & study',
      argsHelp: '[redesign|audit|study]',
      action: (args?: string) => {
        handleSend(`/hallmark ${args || ''}`.trim());
      }
    },
    {
      command: '/goal',
      description: 'Run long-running task with extra thoroughness until goal is fully achieved',
      action: () => {
        handleSend('/goal');
      }
    },
    {
      command: '/schedule',
      description: 'Schedule a one-time timer or recurring cron job',
      action: () => {
        handleSend('/schedule');
      }
    },
    {
      command: '/browser',
      description: 'Launch web browsing, web search, or web app interaction',
      action: () => {
        handleSend('/browser');
      }
    },
    {
      command: '/grill-me',
      description: 'Start interactive alignment interview to resolve design decisions',
      action: () => {
        handleSend('/grill-me');
      }
    },
    {
      command: '/teamwork-preview',
      description: 'Preview multi-agent team collaborative execution',
      action: () => {
        handleSend('/teamwork-preview');
      }
    },
    {
      command: '/learn',
      description: 'Persist user corrections or complex setup for future tasks',
      action: () => {
        handleSend('/learn');
      }
    },
    {
      command: '/help',
      description: 'Show available commands & system instructions',
      action: () => {
        setMessages(prev => [
          ...prev,
          {
            role: 'system',
            text: 'Available commands:\n' +
              '/help - Show this help message\n' +
              '/hallmark [redesign|audit|study] - Anti-slop UI design, audit & redesign\n' +
              '/goal - Run long-running goal-oriented task\n' +
              '/schedule - Schedule timer or recurring cron job\n' +
              '/browser - Web browsing & automation\n' +
              '/grill-me - Interactive alignment interview\n' +
              '/teamwork-preview - Multi-agent team preview\n' +
              '/learn - Persist custom rule/skill\n' +
              '/status - Show agent connection & server status\n' +
              '/mode [single|multi] - Switch agent execution mode\n' +
              '/single - Switch agent mode to Single Agent\n' +
              '/multi - Switch agent mode to Multi-Agent Master (--multi)\n' +
              '/workspace [path] - Switch active workspace\n' +
              '/explain - Explain codebase structure\n' +
              '/test - Run codebase tests\n' +
              '/clear - Clear console messages\n' +
              '/abort - Abort active execution\n' +
              '/reset - Reset WebSocket bridge'
          }
        ]);
      }
    },
    {
      command: '/status',
      description: 'Check agent server and connection status',
      action: () => {
        const statusText = `WebSocket Connection: ${ws?.readyState === 1 ? 'Connected (OPEN)' : 'Disconnected'}\n` +
          `Active Workspace: ${workspace || 'None'}\n` +
          `CLI Mode: ${agentMode === 'multi' ? 'Multi-Agent Master (--multi)' : 'Single Agent Mode'}\n` +
          `Custom CLI Flags: ${customArgs || 'None'}`;
        setMessages(prev => [...prev, { role: 'system', text: statusText }]);
      }
    },
    {
      command: '/mode',
      description: 'Switch CLI execution mode',
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
      description: 'Switch agent mode to Single Agent and restart',
      action: () => {
        setAgentMode('single');
        setMessages(prev => [...prev, { role: 'system', text: 'CLI Mode switched to Single Agent. Restarting bridge...' }]);
        setConnectTrigger(prev => prev + 1);
      }
    },
    {
      command: '/multi',
      description: 'Switch agent mode to Multi-Agent Master (--multi) and restart',
      action: () => {
        setAgentMode('multi');
        setMessages(prev => [...prev, { role: 'system', text: 'CLI Mode switched to Multi-Agent. Restarting bridge...' }]);
        setConnectTrigger(prev => prev + 1);
      }
    },
    {
      command: '/workspace',
      description: 'Switch active workspace path',
      argsHelp: '[path]',
      action: (args?: string) => {
        const targetPath = args?.trim();
        if (targetPath) {
          setWorkspace(targetPath);
          localStorage.setItem('currentWorkspace', targetPath);
          setMessages(prev => [...prev, { role: 'system', text: `Workspace switched to: ${targetPath}. Restarting bridge...` }]);
          setConnectTrigger(prev => prev + 1);
        } else {
          setMessages(prev => [...prev, { role: 'system', text: 'Usage: /workspace [directory-path]' }]);
        }
      }
    },
    {
      command: '/abort',
      description: 'Abort the active running agent task',
      action: () => {
        handleAbort();
      }
    },
    {
      command: '/clear',
      description: 'Clear the local console chat messages',
      action: () => {
        setMessages([{ role: 'system', text: 'Console cleared. Connected to t-line workspace context.' }]);
      }
    },
    {
      command: '/resume',
      description: 'Restart the agent process with the --resume flag',
      action: () => {
        setCustomArgs('--resume');
        setMessages(prev => [...prev, { role: 'system', text: 'Flags set to --resume. Restarting bridge...' }]);
        setConnectTrigger(prev => prev + 1);
      }
    },
    {
      command: '/explain',
      description: 'Ask SuperAgent to analyze and explain codebase structure',
      action: () => {
        handleSend('Please analyze and explain the codebase structure of this workspace.');
      }
    },
    {
      command: '/test',
      description: 'Ask SuperAgent to check and run tests',
      action: () => {
        handleSend('Please check the test suite and run tests to verify codebase health.');
      }
    },
    {
      command: '/reset',
      description: 'Reset and restart the WebSocket bridge',
      action: () => {
        setMessages(prev => [...prev, { role: 'system', text: 'Resetting and reconnecting WebSocket bridge...' }]);
        setConnectTrigger(prev => prev + 1);
      }
    }
  ];
}

export function getSubCommands(
  parentCmd: string,
  context: { workspace: string; agentMode: 'single' | 'multi' }
): SlashCommand[] {
  const cleanCmd = parentCmd.toLowerCase().trim();

  if (cleanCmd === '/mode') {
    return [
      {
        command: '/mode single',
        description: 'Single Agent execution mode (default)',
        argsHelp: 'single'
      },
      {
        command: '/mode multi',
        description: 'Multi-Agent Master mode (--multi)',
        argsHelp: 'multi'
      }
    ];
  }

  if (cleanCmd === '/workspace') {
    return [
      {
        command: `/workspace ${context.workspace}`,
        description: 'Current active workspace path',
        argsHelp: context.workspace
      },
      {
        command: ' /workspace d:\\backup from pc asus\\Documents Development\\t-line'.trim(),
        description: 't-line project workspace',
        argsHelp: 't-line'
      },
      {
        command: ' /workspace d:\\backup from pc asus\\Documents Development\\superagent'.trim(),
        description: 'SuperAgent core engine workspace',
        argsHelp: 'superagent'
      }
    ];
  }

  if (cleanCmd === '/hallmark') {
    return [
      {
        command: '/hallmark redesign',
        description: 'Redesign visual UI structure within existing component boundaries',
        argsHelp: 'redesign'
      },
      {
        command: '/hallmark audit',
        description: 'Score UI against anti-pattern list & return ranked punch list',
        argsHelp: 'audit'
      },
      {
        command: '/hallmark study',
        description: 'Extract design DNA from screenshot or live URL',
        argsHelp: 'study'
      }
    ];
  }

  return [];
}
