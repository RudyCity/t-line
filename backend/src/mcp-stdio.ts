import WebSocket from 'ws';
import path from 'path';
import fs from 'fs';
import os from 'os';
import readline from 'readline';

const BYPASS_TOKEN_FILE = path.join(os.homedir(), '.tline-bypass-token');

async function main() {
  // 1. Read the bypass token
  if (!fs.existsSync(BYPASS_TOKEN_FILE)) {
    console.error('Error: t-line application is not running.');
    console.error('Please launch the t-line workspace manager before starting this MCP client.');
    process.exit(1);
  }

  let token = '';
  try {
    token = fs.readFileSync(BYPASS_TOKEN_FILE, 'utf8').trim();
  } catch (e: any) {
    console.error('Error reading t-line authentication bypass token:', e.message);
    process.exit(1);
  }

  if (!token) {
    console.error('Error: t-line authentication bypass token is empty.');
    process.exit(1);
  }

  // 2. Connect to the local running t-line backend WebSocket
  const backendUrl = `ws://localhost:3999/api/mcp/ws?token=${encodeURIComponent(token)}`;
  const ws = new WebSocket(backendUrl, {
    headers: {
      'User-Agent': 't-line-mcp-stdio-bridge'
    }
  });

  // Keep track of WS connection status
  let connected = false;

  ws.on('open', () => {
    connected = true;
    // Set up standard input reading once connected
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    rl.on('line', (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(trimmed);
      } else {
        console.error('Error: WebSocket is not open. Received stdin chunk:', trimmed);
      }
    });

    rl.on('close', () => {
      ws.close();
    });
  });

  ws.on('message', (data) => {
    // Write the raw JSON message back to stdout with a single trailing newline
    process.stdout.write(data.toString() + '\n');
  });

  ws.on('error', (err) => {
    console.error('MCP Stdio Bridge WebSocket error:', err.message);
  });

  ws.on('close', (code, reason) => {
    if (!connected) {
      console.error('Error: Could not connect to t-line backend server (is it running on port 3999?).');
      process.exit(1);
    }
    process.exit(0);
  });
}

main().catch(err => {
  console.error('Fatal MCP Stdio Bridge error:', err);
  process.exit(1);
});
