import fs from 'fs';
import path from 'path';

export interface SuperAgentLaunchChoice {
  args: string[];
  runtime: 'local-source' | 'bunx-package';
  version: string | null;
  sourceDirectory?: string;
}

/**
 * T-Line never infers a sibling checkout as an executable. A local SuperAgent
 * build is used ONLY when explicitly configured. This prevents accidentally
 * running a stale bunx package while believing the latest checkout is active.
 */
export function selectSuperAgentLaunch(
  sourceDirectory: string | undefined,
  mode: string,
  extraArgs: string[] = []
): SuperAgentLaunchChoice {
  const flags = ['--server', '--client-mode', 'tline'];
  if (mode === 'multi') flags.push('--multi');
  flags.push(...extraArgs);
  if (!sourceDirectory?.trim()) {
    return { args: ['x', 'superagent', ...flags], runtime: 'bunx-package', version: null };
  }
  const root = path.resolve(sourceDirectory.trim());
  const manifestPath = path.join(root, 'package.json');
  const builtCli = path.join(root, 'dist', 'cli.js');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(builtCli) || !fs.statSync(builtCli).isFile()) {
    throw new Error('Configured TLINE_SUPERAGENT_SOURCE_DIR must contain package.json and built dist/cli.js. Build the SuperAgent checkout first.');
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.name !== 'superagent' || typeof manifest.version !== 'string') {
    throw new Error('Configured TLINE_SUPERAGENT_SOURCE_DIR is not a valid SuperAgent package.');
  }
  return {
    args: [builtCli, ...flags], runtime: 'local-source',
    version: manifest.version, sourceDirectory: root,
  };
}
