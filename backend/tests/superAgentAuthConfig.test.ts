import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readSuperAgentServiceToken } from '../src/superAgentAuth';

describe('SuperAgent auth token discovery', () => {
  const original = process.env.SUPERAGENT_CONFIG_DIR;
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'tline-superagent-auth-'));
  afterEach(() => {
    if (original === undefined) delete process.env.SUPERAGENT_CONFIG_DIR;
    else process.env.SUPERAGENT_CONFIG_DIR = original;
  });
  it('reads the approved, explicit SuperAgent config root without modifying services', () => {
    process.env.SUPERAGENT_CONFIG_DIR = temp;
    const file = path.join(temp, 'server-info-7888.json');
    const token = 'a'.repeat(48);
    try {
      fs.writeFileSync(file, JSON.stringify({ port: 7888, authToken: token }));
      expect(readSuperAgentServiceToken()).toBe(token);
      fs.writeFileSync(file, JSON.stringify({ port: 7889, authToken: token }));
      expect(readSuperAgentServiceToken()).toBeNull();
    } finally { fs.rmSync(temp, { recursive: true, force: true }); }
  });
});
