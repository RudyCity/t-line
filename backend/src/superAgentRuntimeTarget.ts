/**
 * One T-Line backend, one selected SuperAgent Core target per backend process.
 * The test target is temporary and must be an already running, authenticated
 * supervisor under the existing private SuperAgent staging directory.
 * Never install, spawn or stop a second T-Line backend for a stage.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {resolveSuperAgentCorePort} from './superAgentCorePort';

export type RuntimeTarget = {
  selected: 'primary' | 'testing';
  corePort: number;
  ownerMode: 'legacy' | 'supervised-external';
  startupOnly: true;
  backendCount: 1;
  autoStartCoreAllowed: boolean;
  temporary: boolean;
};

const PROTECTED_PORTS = new Set([6759, 6789, 7888, 9877]);

export function resolveRuntimeTarget(
  env: NodeJS.ProcessEnv = process.env,
  stageRoot = path.join(os.homedir(), '.superagent-local-staging'),
): RuntimeTarget {
  const raw = env.TLINE_SUPERAGENT_RUNTIME?.trim();
  if (raw && raw !== 'primary' && raw !== 'testing') {
    throw new Error('Unsupported SuperAgent runtime target');
  }
  const ownerMode = env.TLINE_SUPERAGENT_OWNER_MODE?.trim() || 'legacy';
  const port = resolveSuperAgentCorePort(env.TLINE_SUPERAGENT_CORE_PORT ?? '');
  // Older supervised-external deployments without the new label remain
  // interpreted as testing, but must still prove stage isolation.
  const testing = raw === 'testing' || (!raw && ownerMode === 'supervised-external');
  if (!testing) {
    // A profile under the temporary staging namespace cannot masquerade
    // as the primary user's state even when the requested port is legacy.
    const primaryProfile = env.SUPERAGENT_CONFIG_DIR;
    if (primaryProfile && path.isAbsolute(primaryProfile)) {
      const rel = path.relative(path.resolve(stageRoot),path.resolve(primaryProfile));
      if (rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) &&
          !path.isAbsolute(rel))) {
        throw new Error('Primary runtime cannot use a staging data profile');
      }
    }
    if (ownerMode !== 'legacy') {
      throw new Error('Primary runtime must not be reclassified as an external test owner');
    }
    return {
      selected: 'primary', corePort: port, ownerMode: 'legacy',
      startupOnly: true, backendCount: 1, autoStartCoreAllowed: port === 7888,
      temporary: false,
    };
  }
  if (ownerMode !== 'supervised-external' || PROTECTED_PORTS.has(port)) {
    throw new Error('Test runtime requires an independent nonlegacy Core owner');
  }
  const root = env.SUPERAGENT_CONFIG_DIR;
  if (!root || !path.isAbsolute(root)) {
    throw new Error('Test runtime requires a private absolute staging profile');
  }
  // Check both original path entries and canonical paths to prevent symlinks,
  // junctions, parent traversal and other aliases into a primary profile.
  const rootPath = path.resolve(root);
  const stagePath = path.resolve(stageRoot);
  const relative = path.relative(stagePath, rootPath);
  if (!relative || relative === '..' || relative.startsWith('..' + path.sep) ||
      path.isAbsolute(relative)) {
    throw new Error('Test runtime profile must be under SuperAgent staging root');
  }
  const segments = relative.split(path.sep).filter(Boolean);
  try {
    let current = stagePath;
    for (const part of segments) {
      const stat = fs.lstatSync(path.join(current, part));
      if (!stat.isDirectory() || stat.isSymbolicLink()) {
        throw new Error('Untrusted staging profile component');
      }
      current = path.join(current, part);
    }
    if (fs.realpathSync(rootPath) !== rootPath ||
        fs.realpathSync(stagePath) !== stagePath) {
      throw new Error('Staging profile alias not allowed');
    }
  } catch {
    throw new Error('Test runtime profile must be an existing nonlinked staging directory');
  }
  return {
    selected: 'testing', corePort: port, ownerMode: 'supervised-external',
    startupOnly: true, backendCount: 1, autoStartCoreAllowed: false,
    temporary: true,
  };
}
