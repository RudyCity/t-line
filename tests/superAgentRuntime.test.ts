import { describe, expect, it } from 'vitest';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { selectSuperAgentLaunch } from '../backend/src/superAgentRuntime';

describe('T-Line SuperAgent runtime selection', () => {
  it('defaults to the existing published bunx package mode', () => {
    expect(selectSuperAgentLaunch(undefined, 'single')).toMatchObject({
      args: ['x', 'superagent', '--server', '--client-mode', 'tline'],
      runtime: 'bunx-package',
      version: null,
    });
  });
  it('runs the specifically selected local built SuperAgent without bunx', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tline-sa-runtime-'));
    try {
      fs.mkdirSync(path.join(dir, 'dist'));
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'superagent', version: '1.14.8' }));
      fs.writeFileSync(path.join(dir, 'dist', 'cli.js'), '#!/usr/bin/env node');
      const chosen = selectSuperAgentLaunch(dir, 'multi', ['--resume']);
      expect(chosen.runtime).toBe('local-source');
      expect(chosen.version).toBe('1.14.8');
      expect(chosen.args[0]).toBe(path.join(dir, 'dist', 'cli.js'));
      expect(chosen.args.slice(1)).toEqual(['--server', '--client-mode', 'tline', '--multi', '--resume']);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
  it('fails closed if the configured local package is missing or not SuperAgent', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tline-sa-bad-'));
    try {
      expect(() => selectSuperAgentLaunch(dir, 'single')).toThrow(/built dist\/cli.js/);
      fs.mkdirSync(path.join(dir, 'dist'));
      fs.writeFileSync(path.join(dir, 'dist', 'cli.js'), 'ok');
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'other', version: '1.0.0' }));
      expect(() => selectSuperAgentLaunch(dir, 'single')).toThrow(/not a valid SuperAgent/);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
