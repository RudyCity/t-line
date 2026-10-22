/**
 * T-Line's authenticated, read-only view of LOCAL CLI Brain sessions.
 * Never exposes the entire ~/.superagent-r tree or other MCP identities.
 * Unlike the CLI, the desktop UI must not execute arbitrary paths or commands.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router, raw } from 'express';
import { isRegisteredMotionWorkspace } from './motionWorkspaceAccess';
import {
  brainStorageUsage, prepareBrainCleanup, confirmBrainCleanup, scanBrainArea,
  prepareBrainPublish, confirmBrainPublish, validateDestination, assertNoSymlink, importBrainBinaryArtifact,
} from './brainStorageManager';
import { beginBrainTransfer, inspectBrainTransfer, appendBrainTransfer, finishBrainTransfer, abortBrainTransfer } from './brainTransfers';
import { annotateBrainArtifact, searchBrainArtifacts, brainResumeContext, brainRMemoryCandidate } from './brainIndex';

const SESSION_ID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,95}$/;
const MAX_LIST = 100;
const MAX_FILES = 250;
const MAX_PREVIEW = 128 * 1024;
const LOCAL_OWNER_HASH = crypto.createHash('sha256').update('local-cli').digest('hex').slice(0, 24);
const TEXT_EXT = new Set(['.txt', '.md', '.json', '.jsonl', '.csv', '.log', '.ts', '.tsx', '.js', '.jsx', '.py', '.css', '.html', '.yaml', '.yml', '.xml', '.sh']);

type ReadOptions = {
  configRoot?: () => string;
  authorizeProject?: (projectId: string, root: string) => boolean;
};
export function createBrainExplorerRouter(options: ReadOptions = {}): Router {
  const router = Router();
  const root = () => path.resolve(options.configRoot?.() ?? process.env.SUPERAGENT_CONFIG_DIR?.trim() ?? path.join(os.homedir(), '.superagent-r'));
  const owned = () => path.join(root(), 'brain', LOCAL_OWNER_HASH);
  const scanRetentionArea = (dir: string) => scanBrainArea(dir, 'scratch');

  // Publishing requires *both* an enabled SuperAgent local project registration
  // and a separately registered T-Line local workspace. The desktop operator
  // must complete the one-time prepare/confirm challenge. It does not reuse
  // or claim the OAuth MCP project's write capability.
  function publishingProject(projectId: unknown): string {
    if (typeof projectId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(projectId)) throw new Error('Invalid project ID.');
    const registry = path.join(root(), 'projects.json');
    assertSafe(root(), registry);
    const stat = fs.lstatSync(registry);
    if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('Project registry unavailable.');
    const parsed = JSON.parse(fs.readFileSync(registry, 'utf8'));
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.projects)) throw new Error('Invalid project registry.');
    const project = parsed.projects.find((p: any) =>
      p?.id === projectId && p.enabled === true && p.type === 'local' && typeof p.root === 'string');
    if (!project) throw new Error('Enabled local project registration required.');
    const resolved = fs.realpathSync.native(project.root);
    if (!(options.authorizeProject ?? isRegisteredMotionWorkspace)(projectId, resolved)) throw new Error('Project not registered and authorized in T-Line.');
    return resolved;
  }

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

  // Informational retention preview. There is no background deletion and no
  // batch-delete endpoint; each cleanup requires its own explicit confirmation.
  router.get('/retention/preview', (req, res) => {
    try {
      const days = Number(req.query.days ?? 30);
      if (![7, 30, 90].includes(days)) { res.status(400).json({ error: 'Retention preview supports 7, 30 or 90 days.' }); return; }
      const directory = owned();
      assertSafe(path.join(root(), 'brain'), directory);
      const cutoff = Date.now() - days * 86400_000;
      const candidates: Array<{ sessionId: string; scratchFiles: number; scratchBytes: number; lastModifiedAt: string | null }> = [];
      let scanned = 0;
      if (fs.existsSync(directory)) for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory() || !SESSION_ID.test(entry.name)) continue;
        if (++scanned > 200) break;
        try {
          const { dir } = session(entry.name);
          const area = scanRetentionArea(dir);
          if (area.files > 0 && area.lastModifiedAt && Date.parse(area.lastModifiedAt) < cutoff) {
            candidates.push({ sessionId: entry.name, scratchFiles: area.files, scratchBytes: area.bytes, lastModifiedAt: area.lastModifiedAt });
          }
        } catch { /* Ignore uninspectable sessions, never delete implicitly. */ }
        if (candidates.length >= MAX_LIST) break;
      }
      res.json({ days, dryRun: true, autoDelete: false, candidates, scanned,
        partial: scanned > 200 || candidates.length >= MAX_LIST,
        totalCandidateBytes: candidates.reduce((sum, entry) => sum + entry.scratchBytes, 0) });
    } catch { res.status(503).json({ error: 'Retention preview unavailable.' }); }
  });

  router.get('/search', (req, res) => {
    try {
      if (typeof req.query.q !== 'string' || !req.query.q.trim()) throw new Error('Search query required.');
      res.json({ records: searchBrainArtifacts('local-cli', req.query.q, root()), owner: 'local-cli' });
    } catch { res.status(400).json({ error: 'Invalid Brain search.' }); }
  });
  router.get('/sessions/:sessionId/resume', (req, res) => {
    try {
      session(req.params.sessionId);
      res.json(brainResumeContext('local-cli', req.params.sessionId, root()));
    } catch { res.status(404).json({ error: 'Brain session resume unavailable.' }); }
  });
  router.post('/sessions/:sessionId/annotate', (req, res) => {
    try {
      session(req.params.sessionId);
      res.json(annotateBrainArtifact('local-cli', req.params.sessionId,
        req.body?.filePath, req.body?.summary, req.body?.tags || [], root()));
    } catch { res.status(409).json({ error: 'Brain annotation rejected.' }); }
  });
  router.get('/sessions/:sessionId/memory-candidate', (req, res) => {
    try {
      session(req.params.sessionId);
      res.json(brainRMemoryCandidate('local-cli', req.params.sessionId, String(req.query.path || ''), root()));
    } catch { res.status(404).json({ error: 'No verified Brain memory candidate available.' }); }
  });

  router.post('/sessions/:sessionId/transfers', (req, res) => {
    try {
      session(req.params.sessionId);
      res.status(201).json(beginBrainTransfer('local-cli', req.params.sessionId,
        req.body?.filename, req.body?.totalBytes, req.body?.sha256, root()));
    } catch { res.status(409).json({ error: 'Brain transfer initialization rejected.' }); }
  });
  router.get('/sessions/:sessionId/transfers/:transferId', (req, res) => {
    try {
      session(req.params.sessionId);
      res.json(inspectBrainTransfer('local-cli', req.params.sessionId, req.params.transferId, root()));
    } catch { res.status(404).json({ error: 'Brain transfer not available.' }); }
  });
  router.post('/sessions/:sessionId/transfers/:transferId/chunk',
    raw({ type: 'application/octet-stream', limit: '256kb' }), (req, res) => {
    try {
      session(req.params.sessionId);
      if (!Buffer.isBuffer(req.body) || !req.body.length) throw new Error('Expected a nonempty binary chunk.');
      const offset = Number(req.query.offset);
      res.json(appendBrainTransfer('local-cli', req.params.sessionId, req.params.transferId,
        offset, req.body.toString('base64'), root()));
    } catch { res.status(409).json({ error: 'Brain transfer chunk rejected; check current offset.' }); }
  });
  router.post('/sessions/:sessionId/transfers/:transferId/finish', (req, res) => {
    try {
      session(req.params.sessionId);
      res.json(finishBrainTransfer('local-cli', req.params.sessionId, req.params.transferId, root()));
    } catch { res.status(409).json({ error: 'Brain transfer is incomplete or checksum mismatch.' }); }
  });
  router.delete('/sessions/:sessionId/transfers/:transferId', (req, res) => {
    try {
      session(req.params.sessionId);
      res.json(abortBrainTransfer('local-cli', req.params.sessionId, req.params.transferId, root()));
    } catch { res.status(404).json({ error: 'Brain transfer not available.' }); }
  });

  router.get('/sessions/:sessionId/storage', (req, res) => {
    try {
      const { dir } = session(req.params.sessionId);
      res.json({ sessionId: req.params.sessionId, ...brainStorageUsage(dir), readOnly: true });
    } catch { res.status(404).json({ error: 'Brain storage unavailable.' }); }
  });

  router.post('/sessions/:sessionId/cleanup/prepare', (req, res) => {
    try {
      const { dir } = session(req.params.sessionId);
      res.json(prepareBrainCleanup(req.headers.authorization, req.params.sessionId, dir));
    } catch { res.status(409).json({ error: 'Unable to prepare Brain cleanup.' }); }
  });

  router.post('/sessions/:sessionId/cleanup/confirm', (req, res) => {
    try {
      const { dir } = session(req.params.sessionId);
      if (typeof req.body?.challenge !== 'string' || !/^[0-9a-f]{48}$/.test(req.body.challenge))
        throw new Error('Invalid challenge.');
      res.json(confirmBrainCleanup(req.headers.authorization, req.params.sessionId, req.body.challenge, dir));
    } catch { res.status(409).json({ error: 'Cleanup rejected; request a new preview.' }); }
  });

  router.get('/projects', (_req, res) => {
    try {
      const registry = path.join(root(), 'projects.json');
      assertSafe(root(), registry);
      if (!fs.existsSync(registry)) { res.json({ projects: [] }); return; }
      const stat = fs.lstatSync(registry);
      if (!stat.isFile() || stat.size > 1024 * 1024) throw new Error('Invalid project registry.');
      const doc = JSON.parse(fs.readFileSync(registry, 'utf8'));
      if (doc.schemaVersion !== 1 || !Array.isArray(doc.projects)) throw new Error('Invalid registry schema.');
      const projects = doc.projects.filter((p: any) => p?.enabled && p.type === 'local' &&
        typeof p.id === 'string' && typeof p.root === 'string')
        .filter((p: any) => {
          try { return (options.authorizeProject ?? isRegisteredMotionWorkspace)(p.id, fs.realpathSync.native(p.root)); }
          catch { return false; }
        }).slice(0, 100).map((p: any) => ({ id: p.id, name: typeof p.name === 'string' ? p.name : p.id }));
      res.json({ projects });
    } catch { res.status(503).json({ error: 'Could not list permitted local projects.' }); }
  });

  router.post('/sessions/:sessionId/publish/prepare', (req, res) => {
    try {
      const { dir } = session(req.params.sessionId);
      const root = publishingProject(req.body?.projectId);
      if (typeof req.body?.filePath !== 'string' || typeof req.body?.destinationPath !== 'string') throw new Error('Missing publish paths.');
      const result = prepareBrainPublish(req.headers.authorization, req.params.sessionId,
        dir, req.body.filePath, root, req.body.destinationPath);
      res.json(result);
    } catch { res.status(409).json({ error: 'Publish preview rejected. Check registrations, file path and destination.' }); }
  });

  router.post('/sessions/:sessionId/publish/confirm', (req, res) => {
    try {
      const { dir } = session(req.params.sessionId);
      if (typeof req.body?.challenge !== 'string' || !/^[0-9a-f]{48}$/.test(req.body.challenge))
        throw new Error('Invalid challenge.');
      const projectRoot = publishingProject(req.body?.projectId);
      const result = confirmBrainPublish(req.headers.authorization, req.params.sessionId,
        req.body.challenge, dir, projectRoot, true);
      res.json(result);
    } catch { res.status(409).json({ error: 'Publish rejected; request a new preview.' }); }
  });

  router.post('/sessions/:sessionId/artifacts/import', raw({ type: 'application/octet-stream', limit: '5mb' }), (req, res) => {
    try {
      const { dir } = session(req.params.sessionId);
      if (typeof req.query.name !== 'string' || !Buffer.isBuffer(req.body)) throw new Error('Expected a binary payload.');
      res.status(201).json(importBrainBinaryArtifact(dir, req.query.name, req.body));
    } catch { res.status(409).json({ error: 'Artifact upload rejected (type, size, path, quota or collision).' }); }
  });

  router.get('/sessions/:sessionId/download', (req, res) => {
    try {
      const { dir } = session(req.params.sessionId);
      const relative = String(req.query.path ?? '');
      if (!relative.startsWith('artifacts/') && !relative.startsWith('evidence/')) throw new Error('Only artifacts and evidence may be downloaded.');
      const target = path.join(dir, validateDestination(relative));
      assertNoSymlink(dir, target);
      const stat = fs.lstatSync(target);
      if (!stat.isFile() || stat.nlink > 1 || stat.size > 20 * 1024 * 1024) {
        res.status(415).json({ error: 'Unsupported artifact download (20 MiB maximum).' }); return;
      }
      res.setHeader('Content-Type', 'application/octet-stream');
      const filename = path.basename(target).replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 120) || 'brain-artifact';
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.sendFile(target);
    } catch { res.status(404).json({ error: 'Artifact unavailable.' }); }
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
