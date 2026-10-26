import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const MAX_CRASH_LOG_BYTES = 2 * 1024 * 1024;
const MAX_CONTEXT_BYTES = 12 * 1024;
const MAX_TEXT_CHARS = 8_000;

export type CrashEventKind = 'startup' | 'uncaught_exception' | 'unhandled_rejection' | 'exit';
export interface CrashEvent {
  event: CrashEventKind;
  at: string;
  pid: number;
  uptimeMs: number;
  runtime: string;
  nodeVersion: string;
  exitCode?: number;
  origin?: string;
  error?: string;
  recentLog?: string[];
  memory?: { rss: number; heapUsed: number };
}

/** Logs may contain credentials in errors and URLs. Redact before persisting. */
export function sanitizeCrashText(value: string): string {
  return value
    .replace(/\bBearer\s+[^\s,'\"}]+/gi, 'Bearer [REDACTED]')
    .replace(/\b(?:eyJ[A-Za-z0-9_-]{6,}\.){2}[A-Za-z0-9_-]+\b/g, '[REDACTED_JWT]')
    .replace(/((?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|secret|token|authorization)\s*[:=]\s*[\"']?)([^\s\"',;&}\]]+)/gi, '$1[REDACTED]')
    .slice(0, MAX_TEXT_CHARS);
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return sanitizeCrashText(error.stack || `${error.name}: ${error.message}`);
  }
  return sanitizeCrashText(typeof error === 'string' ? error : Object.prototype.toString.call(error));
}

export function crashLogPath(home = os.homedir()): string {
  return path.join(home, '.tline-logs', 'backend-crashes.jsonl');
}

function recentBackendLines(home: string): string[] {
  try {
    const contents = fs.readFileSync(path.join(home, '.tline-backend.log'), 'utf8');
    // Limit recent console context: avoid storing complete request bodies/history.
    return contents.slice(-MAX_CONTEXT_BYTES).split(/\r?\n/).filter(Boolean)
      .slice(-25).map(line => sanitizeCrashText(line).slice(0, 360));
  } catch {
    return [];
  }
}

/** Synchronous writes survive a fatal exception better than async console logging. */
export function writeCrashEvent(event: CrashEvent, home = os.homedir()): boolean {
  try {
    const target = crashLogPath(home);
    fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 });
    if (fs.existsSync(target) && fs.statSync(target).size > MAX_CRASH_LOG_BYTES) {
      const backup = target + '.1';
      try { fs.unlinkSync(backup); } catch (error: any) {
        if (error?.code !== 'ENOENT') throw error;
      }
      fs.renameSync(target, backup);
    }
    const sanitized = {
      ...event,
      error: event.error ? sanitizeCrashText(event.error) : undefined,
      origin: event.origin ? sanitizeCrashText(event.origin) : undefined,
      recentLog: event.recentLog?.map(sanitizeCrashText),
    };
    const fd = fs.openSync(target, 'a', 0o600);
    try {
      fs.writeSync(fd, JSON.stringify(sanitized) + '\n');
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    return true;
  } catch {
    // Never recursively crash the error reporter.
    return false;
  }
}

export function installBackendCrashDiagnostics(home = os.homedir()): void {
  const started = Date.now();
  let lastFatal = '';
  const emit = (event: CrashEventKind, extra: Partial<CrashEvent> = {}, withContext = false) => {
    const memory = process.memoryUsage();
    writeCrashEvent({
      event, at: new Date().toISOString(), pid: process.pid,
      uptimeMs: Date.now() - started,
      runtime: process.versions.bun ? 'bun' : 'node',
      nodeVersion: process.version,
      memory: { rss: memory.rss, heapUsed: memory.heapUsed },
      ...(withContext ? { recentLog: recentBackendLines(home) } : {}),
      ...extra,
    }, home);
  };
  emit('startup');
  // Monitor does not override the runtime's existing uncaught-exception policy.
  process.on('uncaughtExceptionMonitor', (error, origin) => {
    lastFatal = 'uncaught_exception';
    emit('uncaught_exception', { origin, error: formatError(error) }, true);
  });
  process.on('unhandledRejection', reason => {
    // Record the rejected operation, but do not claim it caused a later exit.
    emit('unhandled_rejection', { error: formatError(reason) }, true);
  });
  process.on('exit', code => {
    emit('exit', { exitCode: code, origin: lastFatal || (code === 0 ? 'normal_exit' : 'unexpected_exit') }, code !== 0);
  });
}
