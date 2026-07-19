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
      command: '/help',
      description: 'Show available commands & system instructions',
      action: () => {
        setMessages(prev => [
          ...prev,
          { role: 'system', text: 'Available commands:\n' +
            '/help - Show this help message\n' +
            '/status - Show agent connection & server status\n' +
            '/abort - Abort active agent execution immediately\n' +
            '/clear - Clear all console messages\n' +
            '/mode [single|multi] - Switch agent execution mode\n' +
            '/single - Switch agent mode to Single Agent and restart\n' +
            '/multi - Switch agent mode to Multi-Agent Master (--multi) and restart\n' +
            '/resume - Restart the agent process with the --resume flag\n' +
            '/workspace [path] - Switch active workspace\n' +
            '/explain - Ask SuperAgent to explain the codebase structure\n' +
            '/test - Ask SuperAgent to check and run tests\n' +
            '/reset - Reset and restart WebSocket connection'
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
      command: '/mode',
      description: 'Switch CLI mode',
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
      command: '/resume',
      description: 'Restart the agent process with the --resume flag',
      action: () => {
        setCustomArgs('--resume');
        setMessages(prev => [...prev, { role: 'system', text: 'Flags set to --resume. Restarting bridge...' }]);
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
      command: '/explain',
      description: 'Ask SuperAgent to analyze and explain the codebase structure',
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
