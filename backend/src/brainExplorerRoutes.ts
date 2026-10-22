/**
 * T-Line's authenticated, read-only view of LOCAL CLI Brain sessions.
 * Never exposes the entire ~/.superagent-r tree or other MCP identities.
 * Unlike the CLI, the desktop UI must not execute arbitrary paths or commands.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';

const SESSION_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/;
const MAX_LIST = 100;
const MAX_FILES = 250;
const MAX_PREVIEW = 128 * 1024;
const LOCAL_OWNER_HASH = crypto.createHash('sha256').update('local-cli').digest('hex').slice(0, 24);
const TEXT_EXT = new Set(['.txt', '.md', '.json', '.jsonl', '.csv', '.log', '.ts', '.tsx', '.js', '.jsx', '.py', '.css', '.html', '.yaml', '.yml', '.xml', '.sh']);

type ReadOptions = { configRoot?: () => string };
export function createBrainExplorerRouter(options: ReadOptions = {}): Router {
  const router = Router();
  const root = () => path.resolve(options.configRoot?.() ?? process.env.SUPERAGENT_CONFIG_DIR?.trim() ?? path.join(os.homedir(), '.superagent-r'));
  const owned = () => path.join(root(), 'brain', LOCAL_OWNER_HASH);

  function assertSafe(start: string, target: string): void {
    const rel = path.relative(start, target);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('Brain path outside owner scope.');
    let current = start;
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error('Brain symlink not allowed.');
    for (const segment of rel.split(path.sep).filter(Boolean)) {
      current = path.join(current, segment);
      try {
        if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Brain symlink not allowed.');
      } catch (error: any) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
  }

  function validSession(sessionId: unknown): string {
    if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) throw new Error('Invalid Brain session ID.');
    return sessionId;
  }

  function session(sessionId: unknown) {
    const id = validSession(sessionId);
    const dir = path.join(owned(), id);
    assertSafe(path.join(root(), 'brain'), dir);
    const manifestPath = path.join(dir, 'manifest.json');
    assertSafe(dir, manifestPath);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    if (manifest.schemaVersion !== 1 || manifest.sessionId !== id || manifest.ownerHash !== LOCAL_OWNER_HASH ||
      typeof manifest.createdAt !== 'string' || typeof manifest.updatedAt !== 'string') throw new Error('Invalid Brain manifest.');
    return { dir, manifest: {
      sessionId: id, createdAt: manifest.createdAt, updatedAt: manifest.updatedAt,
    } };
  }

  function relativeFile(value: unknown): string {
    if (typeof value !== 'string' || value.length > 240 || !value.length ||
      value.includes('\\') || value.includes('\0') || path.isAbsolute(value) || /^[A-Za-z]:/.test(value)) {
      throw new Error('Invalid Brain file path.');
    }
    const segments = value.split('/');
    if (segments.length < 2 || segments.length > 8 || !['scratch', 'artifacts', 'evidence'].includes(segments[0]) ||
      segments.some(item => !item || item === '..' || item === '.' || item.startsWith('.') || item.endsWith('.') ||
      /[:<>|?*"\\]/.test(item))) throw new Error('Unsafe Brain file path.');
    return segments.join(path.sep);
  }

  router.get('/sessions', (_req, res) => {
    try {
      const directory = owned();
      assertSafe(path.join(root(), 'brain'), directory);
      if (!fs.existsSync(directory)) { res.json({ sessions: [], mode: 'local-cli', readOnly: true }); return; }
      const names = fs.readdirSync(directory, { withFileTypes: true })
        .filter(item => item.isDirectory() && SESSION_ID.test(item.name)).slice(0, 200);
      const sessions: Array<{sessionId: string; createdAt: string; updatedAt: string}> = [];
      for (const entry of names) {
        try { sessions.push(session(entry.name).manifest); } catch { /* Ignore corrupt or foreign sessions. */ }
      }
      sessions.sort((a,b) => b.updatedAt.localeCompare(a.updatedAt));
      res.json({ sessions: sessions.slice(0, MAX_LIST), mode: 'local-cli', readOnly: true });
    } catch {
      res.status(503).json({ error: 'Brain sessions unavailable.' });
    }
  });

  router.get('/sessions/:sessionId/files', (req, res) => {
    try {
      const { dir } = session(req.params.sessionId);
      const files: Array<{path: string; bytes: number}> = [];
      function walk(folder: string, depth: number): void {
        if (depth > 8 || files.length >= MAX_FILES) return;
        assertSafe(dir, folder);
        if (!fs.existsSync(folder)) return;
        for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
          if (files.length >= MAX_FILES) return;
          if (entry.isSymbolicLink()) continue;
          const full = path.join(folder, entry.name);
          if (entry.isDirectory()) walk(full, depth + 1);
          else if (entry.isFile() && !entry.name.startsWith('.')) {
            files.push({ path: path.relative(dir, full).replace(/\\/g, '/'), bytes: fs.statSync(full).size });
          }
        }
      }
      for (const area of ['scratch', 'artifacts', 'evidence']) walk(path.join(dir, area), 0);
      res.json({ sessionId: req.params.sessionId, files, readOnly: true, truncated: files.length >= MAX_FILES });
    } catch { res.status(404).json({ error: 'Brain session is unavailable.' }); }
  });

  // Only show committed CLI Bridge snapshots whose cwd is EXACTLY this Brain scratch.
  // Never return prompts, logs, executable paths, tokens, or jobs from other sessions.
  router.get('/sessions/:sessionId/jobs', (req, res) => {
    try {
      const { dir } = session(req.params.sessionId);
      const scratch = path.join(dir, 'scratch');
      assertSafe(dir, scratch);
      const expected = fs.realpathSync(scratch);
      const shardRoot = path.join(root(), 'cli-bridge', 'delegations', 'jobs.d');
      assertSafe(root(), shardRoot);
      const jobs: Array<{ jobId: string; cli: string; status: string; completionState: string; startedAt: number; updatedAt: number }> = [];
      if (fs.existsSync(shardRoot)) {
        const ids = fs.readdirSync(shardRoot, { withFileTypes: true })
          .filter(entry => entry.isDirectory() && /^clj_\d+_[a-f0-9]{8,32}$/.test(entry.name))
          .slice(0, 200);
        for (const entry of ids) {
          const folder = path.join(shardRoot, entry.name);
          assertSafe(shardRoot, folder);
          const files = fs.readdirSync(folder)
            .filter(name => /^\d{13}-\d{10}-[a-f0-9]{16}\.json$/.test(name)).sort().reverse().slice(0, 8);
          for (const name of files) {
            const file = path.join(folder, name);
            assertSafe(shardRoot, file);
            try {
              if (fs.statSync(file).size > 64 * 1024) continue;
              const job = JSON.parse(fs.readFileSync(file, 'utf8'));
              if (job.jobId !== entry.name || typeof job.cwd !== 'string' ||
                fs.realpathSync(job.cwd) !== expected || typeof job.status !== 'string') continue;
              jobs.push({
                jobId: entry.name, cli: typeof job.cliAlias === 'string' ? job.cliAlias.slice(0, 30) : 'unknown',
                status: job.status.slice(0, 40),
                completionState: typeof job.completionState === 'string' ? job.completionState.slice(0, 50) : 'unverified',
                startedAt: Number(job.startedAt) || 0, updatedAt: Number(job.updatedAt) || 0,
              });
              break;
            } catch { /* In-progress or malformed snapshot; use an older one. */ }
          }
        }
      }
      jobs.sort((a, b) => b.updatedAt - a.updatedAt);
      res.json({ sessionId: req.params.sessionId, jobs: jobs.slice(0, 50), source: 'persisted-bridge-snapshots', readOnly: true });
    } catch { res.status(404).json({ error: 'Brain delegation metadata unavailable.' }); }
  });

  router.get('/sessions/:sessionId/file', (req, res) => {
    try {
      const { dir } = session(req.params.sessionId);
      const relative = relativeFile(req.query.path);
      const target = path.join(dir, relative);
      assertSafe(dir, target);
      const stat = fs.statSync(target);
      if (!stat.isFile()) { res.status(404).json({ error: 'Brain file not found.' }); return; }
      if (stat.size > MAX_PREVIEW || !TEXT_EXT.has(path.extname(target).toLowerCase())) {
        res.status(415).json({ error: 'Preview supports text files up to 128 KiB.' }); return;
      }
      const content = fs.readFileSync(target, 'utf8');
      if (content.includes('\0')) { res.status(415).json({ error: 'Binary preview not supported.' }); return; }
      res.setHeader('Cache-Control', 'no-store');
      res.json({ sessionId: req.params.sessionId, path: String(req.query.path), bytes: stat.size, content, readOnly: true });
    } catch { res.status(404).json({ error: 'Brain file is unavailable.' }); }
  });

  return router;
}
export default createBrainExplorerRouter();
