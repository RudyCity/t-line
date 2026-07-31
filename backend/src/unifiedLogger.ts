import fs from 'fs';
import path from 'path';
import os from 'os';

export type LogCategory = 'SQL' | 'SUPERAGENT-SERVER' | 'TLINE-BACKEND' | 'TLINE-UI';

export function logE2E(category: LogCategory, message: string, meta?: any): void {
  try {
    const dir = path.join(os.homedir(), '.superagent-r');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const logPath = path.join(dir, 'e2e-unified.log');
    const superagentLogPath = path.join(dir, 'superagent.log');

    const timestamp = new Date().toISOString();
    const metaStr = meta !== undefined ? ` | ${typeof meta === 'string' ? meta : JSON.stringify(meta)}` : '';
    const line = `[${timestamp}] [${category}] ${message}${metaStr}\n`;

    fs.appendFileSync(logPath, line, 'utf-8');
    fs.appendFileSync(superagentLogPath, line, 'utf-8');
  } catch {}
}
