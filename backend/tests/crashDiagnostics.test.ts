import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { crashLogPath, sanitizeCrashText, writeCrashEvent, type CrashEvent } from '../src/crashDiagnostics';

describe('backend crash diagnostics', () => {
  it('removes bearer, token, password, API key and JWT secrets', () => {
    const text = 'Authorization: Bearer abc123 api_key=verysecret token=hello password: xyz ' +
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.signature123';
    const result = sanitizeCrashText(text);
    expect(result).not.toContain('abc123');
    expect(result).not.toContain('verysecret');
    expect(result).not.toContain('hello');
    expect(result).not.toContain('xyz');
    expect(result).not.toContain('signature123');
    expect(result).toContain('[REDACTED]');
  });

  it('writes durable structured diagnostics separate from ordinary backend logs', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tline-crash-'));
    const event: CrashEvent = {
      event: 'uncaught_exception', at: '2026-10-26T00:00:00.000Z', pid: 42,
      uptimeMs: 123, runtime: 'bun', nodeVersion: 'v20.19.4',
      error: 'Error: broken token=my-secret', recentLog: ['failed Authorization: Bearer secretbearer'],
    };
    try {
      expect(writeCrashEvent(event, home)).toBe(true);
      const payload = JSON.parse(fs.readFileSync(crashLogPath(home), 'utf8').trim());
      expect(payload.pid).toBe(42);
      expect(payload.event).toBe('uncaught_exception');
      expect(payload.error).not.toContain('my-secret');
      expect(payload.recentLog[0]).not.toContain('secretbearer');
      expect(fs.statSync(crashLogPath(home)).size).toBeGreaterThan(0);
    } finally {
      fs.rmSync(home, { recursive: true, force: true });
    }
  });
});
