import express from 'express';
import { WebSocket } from 'ws';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { 
  getWorkspaces, 
  getWorkspaceInfo, 
  addWorktree, 
  removeWorktree, 
  getGitStatus, 
  getGitDiff 
} from './gitManager';
import { verifySocketToken, authMiddleware } from './auth';

// Router for Express endpoints
export const mcpRouter = express.Router();

// Types for JSON-RPC
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: any;
}

interface McpSession {
  id: string;
  res: express.Response;
  clientInfo?: { name: string; version: string };
  initialized: boolean;
}

interface McpLog {
  id: string;
  timestamp: number;
  client: string;
  method: string;
  toolName?: string;
  status: 'pending' | 'success' | 'error';
  errorDetail?: string;
  durationMs?: number;
}

// Global states
const activeSessions = new Map<string, McpSession>();
const mcpLogs: McpLog[] = [];
const MAX_LOGS = 100;

export function getMcpActiveSessionsCount(): number {
  return activeSessions.size;
}

export function getMcpLogs(): McpLog[] {
  return mcpLogs;
}

function logMcpCall(
  client: string,
  method: string,
  toolName?: string,
  status: 'pending' | 'success' | 'error' = 'pending',
  errorDetail?: string,
  durationMs?: number
): string {
  const logId = Math.random().toString(36).substring(2, 10);
  const logEntry: McpLog = {
    id: logId,
    timestamp: Date.now(),
    client,
    method,
    toolName,
    status,
    errorDetail,
    durationMs
  };
  mcpLogs.unshift(logEntry);
  if (mcpLogs.length > MAX_LOGS) {
    mcpLogs.pop();
  }
  return logId;
}

function updateMcpLogStatus(
  logId: string,
  status: 'success' | 'error',
  errorDetail?: string,
  durationMs?: number
) {
  const log = mcpLogs.find(l => l.id === logId);
  if (log) {
    log.status = status;
    if (errorDetail) log.errorDetail = errorDetail;
    if (durationMs) log.durationMs = durationMs;
  }
}

// Security: Verify if a path resides inside any of the registered workspaces
function isPathAllowed(targetPath: string): boolean {
  if (!targetPath) return false;
  try {
    const normalizedTarget = path.normalize(path.resolve(targetPath)).toLowerCase();
    const workspaces = getWorkspaces();
    return workspaces.some(w => {
      const normalizedWorkspace = path.normalize(path.resolve(w.path)).toLowerCase();
      return normalizedTarget === normalizedWorkspace || 
             normalizedTarget.startsWith(normalizedWorkspace + path.sep);
    });
  } catch (e) {
    return false;
  }
}

// Promisified safe command execution
function runCommand(command: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // 30 seconds timeout for command execution
    exec(command, { cwd, timeout: 30000 }, (error, stdout, stderr) => {
      const output = (stdout || '') + (stderr || '');
      if (error && !stdout && !stderr) {
        reject(new Error(error.message));
      } else {
        resolve(output.trim() || 'Command completed with no output.');
      }
    });
  });
}

// Defined MCP tools
const TOOLS = [
  {
    name: 'list_workspaces',
    description: 'List all workspaces registered in t-line, along with their names, paths, Git status, and workspace IDs.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'get_workspace_details',
    description: 'Retrieve detailed information for a specific workspace, including its active Git branches and configured worktrees.',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceId: {
          type: 'string',
          description: 'The Base64 workspace ID.'
        }
      },
      required: ['workspaceId']
    }
  },
  {
    name: 'run_command',
    description: 'Execute a terminal shell command inside a permitted workspace or worktree path. (Timeout: 30s)',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute directory path to execute the command in.'
        },
        command: {
          type: 'string',
          description: 'The shell command to run.'
        }
      },
      required: ['path', 'command']
    }
  },
  {
    name: 'read_file',
    description: 'Read the text content of a file located inside one of the registered workspaces.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute file path.'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write or overwrite text content to a file inside a registered workspace.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'The absolute file path.'
        },
        content: {
          type: 'string',
          description: 'The complete content to write into the file.'
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'create_worktree',
    description: 'Create a new Git worktree for a registered repository.',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: {
          type: 'string',
          description: 'The absolute path of the parent repository.'
        },
        newPath: {
          type: 'string',
          description: 'The absolute destination path for the new worktree.'
        },
        branch: {
          type: 'string',
          description: 'The branch name to check out or create (e.g., my-feature).'
        },
        newBranch: {
          type: 'boolean',
          description: 'Whether to create a new branch (defaults to false).'
        }
      },
      required: ['workspacePath', 'newPath', 'branch']
    }
  },
  {
    name: 'remove_worktree',
    description: 'Safely prune/remove an existing Git worktree.',
    inputSchema: {
      type: 'object',
      properties: {
        workspacePath: {
          type: 'string',
          description: 'The absolute path of the parent repository.'
        },
        worktreePath: {
          type: 'string',
          description: 'The absolute path of the worktree to be removed.'
        },
        force: {
          type: 'boolean',
          description: 'Whether to force the removal (defaults to false).'
        }
      },
      required: ['workspacePath', 'worktreePath']
    }
  }
];

// JSON-RPC Request Processor
async function processRequest(
  request: JsonRpcRequest,
  clientName: string
): Promise<any> {
  const startTime = Date.now();
  let logId = '';

  try {
    const { method, params, id } = request;

    if (method === 'initialize') {
      logId = logMcpCall(clientName, 'initialize');
      const clientInfo = params?.clientInfo || { name: 'Unknown', version: '0.0' };
      updateMcpLogStatus(logId, 'success', undefined, Date.now() - startTime);
      
      return {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 't-line-mcp',
          version: '1.0.0'
        }
      };
    }

    if (method === 'notifications/initialized') {
      logMcpCall(clientName, 'notifications/initialized', undefined, 'success', undefined, 0);
      return null;
    }

    if (method === 'tools/list') {
      logId = logMcpCall(clientName, 'tools/list');
      updateMcpLogStatus(logId, 'success', undefined, Date.now() - startTime);
      return { tools: TOOLS };
    }

    if (method === 'tools/call') {
      const toolName = params?.name;
      const args = params?.arguments || {};
      logId = logMcpCall(clientName, 'tools/call', toolName);

      let textResult = '';

      switch (toolName) {
        case 'list_workspaces': {
          const workspaces = getWorkspaces();
          const list = await Promise.all(workspaces.map(async (w) => {
            try {
              const info = await getWorkspaceInfo(w);
              return {
                id: info.id,
                name: info.name,
                path: info.path,
                isGit: info.isGit,
                worktreesCount: info.worktrees.length
              };
            } catch (e) {
              return {
                id: Buffer.from(w.path).toString('base64'),
                name: w.name || path.basename(w.path),
                path: w.path,
                isGit: false,
                worktreesCount: 0
              };
            }
          }));
          textResult = JSON.stringify({ workspaces: list }, null, 2);
          break;
        }

        case 'get_workspace_details': {
          const workspaces = getWorkspaces();
          const found = workspaces.find(w => {
            const id = Buffer.from(path.normalize(w.path)).toString('base64');
            return id === args.workspaceId;
          });
          if (!found) {
            throw new Error(`Workspace with ID ${args.workspaceId} was not found.`);
          }
          const info = await getWorkspaceInfo(found);
          textResult = JSON.stringify({ workspace: info }, null, 2);
          break;
        }

        case 'run_command': {
          if (!isPathAllowed(args.path)) {
            throw new Error(`Access Denied: Path "${args.path}" is outside registered workspaces.`);
          }
          textResult = await runCommand(args.command, args.path);
          break;
        }

        case 'read_file': {
          if (!isPathAllowed(args.path)) {
            throw new Error(`Access Denied: Path "${args.path}" is outside registered workspaces.`);
          }
          if (!fs.existsSync(args.path) || fs.statSync(args.path).isDirectory()) {
            throw new Error(`File not found or is a directory at "${args.path}".`);
          }
          textResult = await fs.promises.readFile(args.path, 'utf8');
          break;
        }

        case 'write_file': {
          if (!isPathAllowed(args.path)) {
            throw new Error(`Access Denied: Path "${args.path}" is outside registered workspaces.`);
          }
          await fs.promises.mkdir(path.dirname(args.path), { recursive: true });
          await fs.promises.writeFile(args.path, args.content, 'utf8');
          textResult = `Successfully wrote ${args.content.length} characters to "${args.path}".`;
          break;
        }

        case 'create_worktree': {
          if (!isPathAllowed(args.workspacePath)) {
            throw new Error(`Access Denied: Workspace path "${args.workspacePath}" is outside registered workspaces.`);
          }
          // Validate target path is also inside registered workspaces
          if (!isPathAllowed(args.newPath)) {
            throw new Error(`Access Denied: Target path "${args.newPath}" is outside registered workspaces.`);
          }
          const result = await addWorktree(args.workspacePath, args.newPath, args.branch, args.newBranch || false);
          textResult = JSON.stringify(result, null, 2);
          break;
        }

        case 'remove_worktree': {
          if (!isPathAllowed(args.workspacePath)) {
            throw new Error(`Access Denied: Workspace path "${args.workspacePath}" is outside registered workspaces.`);
          }
          if (!isPathAllowed(args.worktreePath)) {
            throw new Error(`Access Denied: Worktree path "${args.worktreePath}" is outside registered workspaces.`);
          }
          const result = await removeWorktree(args.workspacePath, args.worktreePath, args.force || false);
          textResult = JSON.stringify(result, null, 2);
          break;
        }

        default:
          throw new Error(`Tool "${toolName}" is not supported.`);
      }

      updateMcpLogStatus(logId, 'success', undefined, Date.now() - startTime);

      return {
        content: [
          {
            type: 'text',
            text: textResult
          }
        ],
        isError: false
      };
    }

    // Method not found fallback
    return {
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    };

  } catch (error: any) {
    if (logId) {
      updateMcpLogStatus(logId, 'error', error.message, Date.now() - startTime);
    }
    return {
      error: {
        code: -32603,
        message: error.message || 'Internal MCP processing error.'
      }
    };
  }
}

// ----------------------------------------------------
// Express Routing Hooks
// ----------------------------------------------------

mcpRouter.get('/logs', authMiddleware, (req, res) => {
  const absoluteStdioPath = path.resolve(path.join(__dirname, 'mcp-stdio.js')).replace(/\\/g, '/');
  res.json({
    sessionsCount: activeSessions.size,
    logs: mcpLogs,
    sseUrl: `http://localhost:3999/api/mcp/sse`,
    stdioPath: absoluteStdioPath
  });
});

mcpRouter.get('/sse', (req, res) => {
  const token = req.query.token as string || req.headers.authorization?.split(' ')[1];
  if (!token || !verifySocketToken(token)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing token.' });
  }
  
  // Set up EventSource SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sessionId = Math.random().toString(36).substring(2, 15);
  const clientUA = req.headers['user-agent'] || 'SSE Client';

  const session: McpSession = {
    id: sessionId,
    res,
    clientInfo: { name: clientUA, version: '1.0' },
    initialized: false
  };

  activeSessions.set(sessionId, session);

  // Send the endpoint event back to the client
  // It specifies where to POST incoming JSON-RPC messages
  const messageUrl = `/api/mcp/message?sessionId=${sessionId}&token=${encodeURIComponent(token || '')}`;
  res.write(`event: endpoint\ndata: ${messageUrl}\n\n`);

  req.on('close', () => {
    activeSessions.delete(sessionId);
    console.log(`[MCP] SSE Connection closed for session ${sessionId}`);
  });
});

mcpRouter.post('/message', async (req, res) => {
  const token = req.query.token as string || req.headers.authorization?.split(' ')[1];
  if (!token || !verifySocketToken(token)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing token.' });
  }

  const sessionId = req.query.sessionId as string;
  const payload = req.body as JsonRpcRequest;

  if (!sessionId || !payload) {
    return res.status(400).json({ error: 'Missing sessionId or request body' });
  }

  const session = activeSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Active session not found' });
  }

  // Process the JSON-RPC call
  const clientName = session.clientInfo?.name || 'SSE Client';
  const result = await processRequest(payload, clientName);

  // Send output back to client via SSE message event
  const responsePayload = {
    jsonrpc: '2.0',
    id: payload.id,
    ...result
  };

  session.res.write(`event: message\ndata: ${JSON.stringify(responsePayload)}\n\n`);
  res.status(202).send('Accepted');
});

// ----------------------------------------------------
// WebSocket Handler (for the stdio local proxy)
// ----------------------------------------------------
export function handleMcpWebSocket(ws: WebSocket, req: any) {
  const clientUA = req.headers['user-agent'] || 'Stdio Proxy';
  const sessionId = Math.random().toString(36).substring(2, 15);

  console.log(`[MCP] WebSocket connection established for proxy session: ${sessionId}`);

  ws.on('message', async (data: string) => {
    try {
      const payload = JSON.parse(data) as JsonRpcRequest;
      const result = await processRequest(payload, clientUA);

      const responsePayload = {
        jsonrpc: '2.0',
        id: payload.id,
        ...result
      };

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(responsePayload));
      }
    } catch (e: any) {
      console.error('[MCP] WS Message error:', e);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32700, message: 'Parse error' }
        }));
      }
    }
  });

  ws.on('close', () => {
    console.log(`[MCP] WebSocket connection closed for proxy session: ${sessionId}`);
  });
}
