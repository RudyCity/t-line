import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadConfig, saveConfig } from './auth';
import {
  isSSHPath,
  parseSSHPath,
  runSSHCommand,
  remoteExists,
  remoteRead,
  remoteWrite,
  normalizeSSHPath
} from './sshHelpers';

function normalizePath(p: string): string {
  if (p && p.startsWith('ssh://')) return normalizeSSHPath(p);
  return path.normalize(p);
}

interface WorktreeInfo {
  path: string;
  commit: string;
  branch?: string;
  isMain: boolean;
  isDirty: boolean;
  dirtyCount?: number;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  isGit: boolean;
  worktrees: WorktreeInfo[];
  defaultShell?: string;
}

// Promisified safe execFile helper for git commands
function runGit(args: string[], cwd: string): Promise<string> {
  if (cwd && cwd.startsWith('ssh://')) {
    const ssh = parseSSHPath(cwd);
    if (!ssh) throw new Error('Invalid SSH Path');
    const gitArgs = args.map(a => `"${a.replace(/"/g, '\\"')}"`).join(' ');
    const cmd = `cd "${ssh.remotePath.replace(/"/g, '\\"')}" && git ${gitArgs}`;
    return runSSHCommand(ssh.host, ssh.port, ssh.user, cmd);
  }
  return new Promise((resolve, reject) => {
    // 15 seconds timeout to prevent hanging processes
    execFile('git', args, { cwd, timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout.trimEnd());
      }
    });
  });
}

export interface WorkspaceConfig {
  path: string;
  defaultShell?: string;
  name?: string;
}

// Get workspaces list from config
export function getWorkspaces(): WorkspaceConfig[] {
  const config = loadConfig();
  const raw = (config as any)?.workspaces || [];
  
  // Migrate old format (string[]) to new format (WorkspaceConfig[])
  return raw.map((item: any) => {
    if (typeof item === 'string') {
      return { path: normalizePath(item), defaultShell: 'powershell' };
    }
    return {
      path: normalizePath(item.path),
      defaultShell: item.defaultShell || 'powershell',
      name: item.name
    };
  });
}

// Add workspace to config
export function addWorkspace(dirPath: string, defaultShell = 'powershell'): { success: boolean; workspaces: WorkspaceConfig[] } {
  const config = loadConfig();
  if (!config) return { success: false, workspaces: [] };

  const rawWorkspaces: any[] = (config as any).workspaces || [];
  const normalizedPath = normalizePath(dirPath);

  // Check if already exists
  const exists = rawWorkspaces.some((w: any) => {
    const p = typeof w === 'string' ? w : w.path;
    return normalizePath(p) === normalizedPath;
  });

  if (!exists) {
    rawWorkspaces.push({ path: normalizedPath, defaultShell });
    (config as any).workspaces = rawWorkspaces;
    saveConfig(config);
    clearWorkspaceCache();
  }

  return { success: true, workspaces: getWorkspaces() };
}

// Remove workspace from config
export function removeWorkspace(dirPath: string): { success: boolean; workspaces: WorkspaceConfig[] } {
  const config = loadConfig();
  if (!config) return { success: false, workspaces: [] };

  let rawWorkspaces: any[] = (config as any).workspaces || [];
  const normalizedPath = normalizePath(dirPath);

  rawWorkspaces = rawWorkspaces.filter((w: any) => {
    const p = typeof w === 'string' ? w : w.path;
    return normalizePath(p) !== normalizedPath;
  });
  
  (config as any).workspaces = rawWorkspaces;
  saveConfig(config);
  clearWorkspaceCache();

  return { success: true, workspaces: getWorkspaces() };
}

// Update workspace config
export function updateWorkspace(dirPath: string, updates: { defaultShell?: string; name?: string }): { success: boolean; workspaces: WorkspaceConfig[] } {
  const config = loadConfig();
  if (!config) return { success: false, workspaces: [] };

  const rawWorkspaces: any[] = (config as any).workspaces || [];
  const normalizedPath = normalizePath(dirPath);

  const idx = rawWorkspaces.findIndex((w: any) => {
    const p = typeof w === 'string' ? w : w.path;
    return normalizePath(p) === normalizedPath;
  });

  if (idx !== -1) {
    const existing = typeof rawWorkspaces[idx] === 'string' ? { path: rawWorkspaces[idx] } : rawWorkspaces[idx];
    rawWorkspaces[idx] = {
      ...existing,
      ...updates
    };
    (config as any).workspaces = rawWorkspaces;
    saveConfig(config);
    clearWorkspaceCache();
    return { success: true, workspaces: getWorkspaces() };
  }

  return { success: false, workspaces: getWorkspaces() };
}

// Parse 'git worktree list --porcelain' output
export function parseWorktreePorcelain(porcelain: string): WorktreeInfo[] {
  const worktrees: WorktreeInfo[] = [];
  const lines = porcelain.split('\n');
  
  let currentWorktree: Partial<WorktreeInfo> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('worktree ')) {
      if (currentWorktree.path) {
        worktrees.push(currentWorktree as WorktreeInfo);
      }
      currentWorktree = {
        path: normalizePath(trimmed.substring(9).trim()),
        isMain: worktrees.length === 0 // The first one listed is the main/parent worktree
      };
    } else if (trimmed.startsWith('commit ')) {
      currentWorktree.commit = trimmed.substring(7).trim();
    } else if (trimmed.startsWith('branch ')) {
      const fullBranch = trimmed.substring(7).trim();
      // Convert 'refs/heads/main' to 'main'
      currentWorktree.branch = fullBranch.startsWith('refs/heads/') 
        ? fullBranch.substring(11) 
        : fullBranch;
    }
  }

  if (currentWorktree.path) {
    worktrees.push(currentWorktree as WorktreeInfo);
  }

  return worktrees;
}

// Check if a worktree has uncommitted changes
async function isWorktreeDirty(worktreePath: string): Promise<{ isDirty: boolean; dirtyCount: number }> {
  try {
    const output = await runGit(['status', '--porcelain'], worktreePath);
    const lines = output.split('\n').filter(line => line.trim().length > 0);
    return {
      isDirty: lines.length > 0,
      dirtyCount: lines.length
    };
  } catch (e) {
    return { isDirty: false, dirtyCount: 0 };
  }
}

const infoCache = new Map<string, { info: WorkspaceInfo; timestamp: number }>();
const INFO_CACHE_TTL_MS = 8000; // 8 seconds (spans the 5s polling loop to prevent multiple Git process spawns)

export function clearWorkspaceCache(): void {
  infoCache.clear();
}

// Retrieve details for a workspace
export async function getWorkspaceInfo(workspace: WorkspaceConfig): Promise<WorkspaceInfo> {
  const normalizedPath = normalizePath(workspace.path);
  const cacheKey = normalizedPath;
  const now = Date.now();
  
  const cached = infoCache.get(cacheKey);
  if (cached && (now - cached.timestamp < INFO_CACHE_TTL_MS)) {
    return cached.info;
  }

  let name = workspace.name;
  if (!name) {
    if (normalizedPath.startsWith('ssh://')) {
      const parts = normalizedPath.split('/');
      name = parts[parts.length - 1] || normalizedPath;
    } else {
      name = path.basename(normalizedPath) || normalizedPath;
    }
  }

  let isGit = false;
  if (normalizedPath.startsWith('ssh://')) {
    isGit = await remoteExists(`${normalizedPath}/.git`);
  } else {
    isGit = fs.existsSync(path.join(normalizedPath, '.git'));
  }
  
  let worktrees: WorktreeInfo[] = [];

  if (isGit) {
    try {
      const ptyOutput = await runGit(['worktree', 'list', '--porcelain'], normalizedPath);
      const parsedWorktrees = parseWorktreePorcelain(ptyOutput);
      
      if (normalizedPath.startsWith('ssh://')) {
        const ssh = parseSSHPath(normalizedPath);
        if (ssh) {
          const prefix = `ssh://${ssh.user}@${ssh.host}:${ssh.port}`;
          for (const wt of parsedWorktrees) {
            if (!wt.path.startsWith('ssh://')) {
              wt.path = `${prefix}${wt.path.replace(/\\/g, '/')}`;
            }
          }
        }
      }

      // Check dirty status for each worktree sequentially to prevent resource contention
      const resolvedWorktrees: WorktreeInfo[] = [];
      for (const wt of parsedWorktrees) {
        const { isDirty, dirtyCount } = await isWorktreeDirty(wt.path);
        resolvedWorktrees.push({
          ...wt,
          isDirty,
          dirtyCount
        });
      }
      worktrees = resolvedWorktrees;
    } catch (e) {
      console.error(`Error listing worktrees in ${normalizedPath}:`, e);
      // Fallback: create a mock worktree representing the main repo if list fails
      const { isDirty, dirtyCount } = await isWorktreeDirty(normalizedPath);
      worktrees = [{
        path: normalizedPath,
        commit: 'unknown',
        branch: 'unknown',
        isMain: true,
        isDirty,
        dirtyCount
      }];
    }
  }

  const info: WorkspaceInfo = {
    id: Buffer.from(normalizedPath).toString('base64'),
    name,
    path: normalizedPath,
    isGit,
    worktrees,
    defaultShell: workspace.defaultShell || 'powershell'
  };

  infoCache.set(cacheKey, { info, timestamp: now });
  return info;
}

// Add a new git worktree
export async function addWorktree(
  repoPath: string, 
  worktreePath: string, 
  branchName: string, 
  newBranch: boolean,
  newBranchName?: string
): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = normalizePath(repoPath);
    const normalizedWorktree = normalizePath(worktreePath);
    
    const args = ['worktree', 'add'];
    if (newBranch) {
      args.push('-b', branchName, normalizedWorktree);
    } else if (newBranchName) {
      args.push('-b', newBranchName, normalizedWorktree, branchName);
    } else {
      args.push(normalizedWorktree, branchName);
    }

    const output = await runGit(args, normalizedRepo);
    clearWorkspaceCache();
    return { success: true, output };
  } catch (error: any) {
    if (error.message && error.message.includes('is already used by worktree')) {
      try {
        const normalizedRepo = normalizePath(repoPath);
        const normalizedWorktree = normalizePath(worktreePath);
        
        // If they specify a custom local branch name but it fails (unlikely to fail on 'already used' unless the new name is in use),
        // or if checking out existing branch directly fails:
        const targetBranch = newBranchName || branchName;
        const detachArgs = ['worktree', 'add', '--detach', normalizedWorktree, targetBranch];
        const output = await runGit(detachArgs, normalizedRepo);
        clearWorkspaceCache();
        return { 
          success: true, 
          output: output + '\n(Note: Branch was already checked out elsewhere; created as a detached HEAD to avoid conflicts.)' 
        };
      } catch (detachError: any) {
        return { success: false, output: detachError.message };
      }
    }
    return { success: false, output: error.message };
  }
}

// Remove a git worktree — with Windows Permission Denied fallback
export async function removeWorktree(repoPath: string, worktreePath: string, force: boolean): Promise<{ success: boolean; output: string }> {
  const normalizedRepo = normalizePath(repoPath);
  const normalizedWorktree = normalizePath(worktreePath);

  // Step 1: Try git worktree remove (--force)
  try {
    const args = ['worktree', 'remove'];
    if (force) args.push('--force');
    args.push(normalizedWorktree);
    const output = await runGit(args, normalizedRepo);
    clearWorkspaceCache();
    return { success: true, output };
  } catch (gitError: any) {
    const msg: string = gitError.message || '';

    // Step 2: If git failed with a permission/lock error, manually delete the folder
    // then prune the worktree metadata so Git stays consistent
    const isPermissionError = msg.toLowerCase().includes('permission') ||
      msg.toLowerCase().includes('failed to delete') ||
      msg.toLowerCase().includes('unable to');

    if (!isPermissionError) {
      return { success: false, output: msg };
    }

    try {
      // Force-remove directory tree via Node.js (bypasses the git shell limitation)
      if (normalizedWorktree.startsWith('ssh://')) {
        const ssh = parseSSHPath(normalizedWorktree);
        if (ssh) {
          await runSSHCommand(ssh.host, ssh.port, ssh.user, `rm -rf "${ssh.remotePath}"`);
        }
      } else if (fs.existsSync(normalizedWorktree)) {
        // On Windows, read-only .git files can block deletion — clear read-only flags first
        const clearReadOnly = (dirPath: string) => {
          try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
              const full = path.join(dirPath, entry.name);
              try { fs.chmodSync(full, 0o666); } catch {}
              if (entry.isDirectory()) clearReadOnly(full);
            }
          } catch {}
        };
        clearReadOnly(normalizedWorktree);
        fs.rmSync(normalizedWorktree, { recursive: true, force: true });
      }

      // Prune the now-missing worktree from git's internal registry
      await runGit(['worktree', 'prune'], normalizedRepo);
      clearWorkspaceCache();

      return { success: true, output: 'Worktree forcefully removed via filesystem fallback and git metadata pruned.' };
    } catch (fsError: any) {
      return { success: false, output: `Git error: ${msg} | Filesystem fallback error: ${fsError.message}` };
    }
  }
}

// List local git branches in repository
export async function getRepoBranches(repoPath: string): Promise<string[]> {
  try {
    const normalizedRepo = normalizePath(repoPath);
    const output = await runGit(['branch', '--format=%(refname:short)'], normalizedRepo);
    return output.split('\n').map(b => b.trim()).filter(Boolean);
  } catch (e) {
    return [];
  }
}

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed';
  staged: boolean;
  unstaged: boolean;
}

// Get git changes (modified, untracked, added, deleted, renamed)
export async function getGitStatus(repoPath: string): Promise<GitFileStatus[]> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    const output = await runGit(['status', '--porcelain'], normalizedRepo);
    if (!output.trim()) return [];
    
    return output.split('\n').map(line => {
      if (line.length < 4) return null;
      const X = line[0];
      const Y = line[1];
      let filePath = line.substring(3).trim();
      
      if (X === 'R' || Y === 'R') {
        const parts = filePath.split(' -> ');
        if (parts.length > 1) {
          filePath = parts[1].trim();
        }
      }
      
      const stagedList = ['M', 'A', 'D', 'R', 'C'];
      const unstagedList = ['M', 'D', 'T'];
      
      const staged = stagedList.includes(X);
      const unstaged = unstagedList.includes(Y) || (X === '?' && Y === '?');
      
      let status: GitFileStatus['status'] = 'modified';
      if (X === '?' && Y === '?') {
        status = 'untracked';
      } else if (X === 'A' || Y === 'A') {
        status = 'added';
      } else if (X === 'D' || Y === 'D') {
        status = 'deleted';
      } else if (X === 'R' || Y === 'R') {
        status = 'renamed';
      }
      
      return { path: filePath, status, staged, unstaged };
    }).filter((item): item is GitFileStatus =>
      item !== null &&
      !!item.path &&
      !item.path.endsWith('/')   // exclude bare directory entries (e.g. untracked folders)
    );
  } catch (e) {
    return [];
  }
}

// Get diff for a modified file
export async function getGitDiff(repoPath: string, filePath: string): Promise<string> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    const normalizedFile = path.normalize(filePath);
    const output = await runGit(['diff', normalizedFile], normalizedRepo);
    return output;
  } catch (error: any) {
    return `Error generating diff: ${error.message}`;
  }
}

// Stage path (file or all)
export async function stagePath(repoPath: string, filePath?: string, all = false): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    let output = '';
    if (all) {
      output = await runGit(['add', '-A'], normalizedRepo);
    } else if (filePath) {
      const normalizedFile = path.normalize(filePath);
      output = await runGit(['add', normalizedFile], normalizedRepo);
    } else {
      return { success: false, output: 'No file path provided.' };
    }
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// Unstage path (file or all)
export async function unstagePath(repoPath: string, filePath?: string, all = false): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    let output = '';
    if (all) {
      output = await runGit(['reset', 'HEAD'], normalizedRepo);
    } else if (filePath) {
      const normalizedFile = path.normalize(filePath);
      output = await runGit(['reset', 'HEAD', '--', normalizedFile], normalizedRepo);
    } else {
      return { success: false, output: 'No file path provided.' };
    }
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// Discard changes (file or all)
export async function discardChanges(repoPath: string, filePath?: string, all = false): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    if (all) {
      // Unstage everything
      await runGit(['reset', 'HEAD'], normalizedRepo);
      // Checkout all tracked files
      await runGit(['checkout', '--', '.'], normalizedRepo);
      // Clean all untracked files
      await runGit(['clean', '-fd'], normalizedRepo);
      return { success: true, output: 'Discarded all changes.' };
    } else if (filePath) {
      const normalizedFile = path.normalize(filePath);
      const fullPath = path.resolve(normalizedRepo, normalizedFile);

      // Unstage the file first (in case it is staged)
      try {
        await runGit(['reset', 'HEAD', '--', normalizedFile], normalizedRepo);
      } catch (e) {
        // Ignore reset errors
      }

      // Try to checkout/restore the file
      try {
        await runGit(['checkout', '--', normalizedFile], normalizedRepo);
      } catch (error) {
        // If checkout fails, delete the untracked file
        if (fullPath.startsWith('ssh://')) {
          const ssh = parseSSHPath(fullPath);
          if (ssh) {
            await runSSHCommand(ssh.host, ssh.port, ssh.user, `rm -rf "${ssh.remotePath}"`);
          }
        } else if (fs.existsSync(fullPath)) {
          const stats = fs.statSync(fullPath);
          if (stats.isDirectory()) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.unlinkSync(fullPath);
          }
        }
      }
      return { success: true, output: `Discarded changes for ${filePath}` };
    } else {
      return { success: false, output: 'No file path provided.' };
    }
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// Commit changes
export async function commitChanges(repoPath: string, message: string, commitAll = false): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    if (commitAll) {
      // Stage all changes (both tracked modifications and untracked files)
      await runGit(['add', '-A'], normalizedRepo);
    }
    const output = await runGit(['commit', '-m', message], normalizedRepo);
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// Checkout an existing branch
export async function checkoutBranch(repoPath: string, branchName: string): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    const output = await runGit(['checkout', branchName], normalizedRepo);
    clearWorkspaceCache();
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// Create a new local branch and checkout
export async function createBranch(repoPath: string, branchName: string, checkout = true): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    const args = checkout ? ['checkout', '-b', branchName] : ['branch', branchName];
    const output = await runGit(args, normalizedRepo);
    clearWorkspaceCache();
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// Pull changes
export async function pullBranch(repoPath: string): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    const output = await runGit(['pull'], normalizedRepo);
    clearWorkspaceCache();
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// Push changes
export async function pushBranch(repoPath: string): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    const output = await runGit(['push'], normalizedRepo);
    clearWorkspaceCache();
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  subject: string;
  graphPrefix: string;
  refNames?: string;
}

// Get recent git commits with log graph
export async function getGitHistory(repoPath: string, limit = 50): Promise<CommitInfo[]> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    // Format: __COMMIT__|%H|%h|%an|%ae|%ar|%s|%d
    // Use --graph for visual representation
    const format = '__COMMIT__|%H|%h|%an|%ae|%ar|%s|%d';
    const output = await runGit(['log', '--graph', '--date-order', `--format=${format}`, `-n`, limit.toString()], normalizedRepo);
    if (!output.trim()) return [];
    
    return output.split('\n').map(line => {
      const parts = line.split('__COMMIT__|');
      if (parts.length > 1) {
        const graphPrefix = parts[0];
        const [hash, shortHash, authorName, authorEmail, date, subject, refNamesRaw] = parts[1].split('|');
        const refNames = refNamesRaw ? refNamesRaw.trim().replace(/^\((.*)\)$/, '$1') : '';
        return { hash, shortHash, authorName, authorEmail, date, subject, graphPrefix, refNames };
      } else {
        // Line with graph representation only (connectors)
        return {
          hash: '',
          shortHash: '',
          authorName: '',
          authorEmail: '',
          date: '',
          subject: '',
          graphPrefix: line,
          refNames: ''
        };
      }
    });
  } catch (e) {
    console.error('Error fetching git history:', e);
    return [];
  }
}

export interface CommitFile {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed';
}

export interface CommitDetails {
  hash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  message: string;
  files: CommitFile[];
}

// Get detailed info of a commit
export async function getCommitDetails(repoPath: string, commitHash: string): Promise<CommitDetails> {
  const normalizedRepo = path.normalize(repoPath);
  
  // Format: name|email|date|full message
  const infoOutput = await runGit(['show', '-s', '--format=%an|%ae|%ad|%B', commitHash], normalizedRepo);
  const parts = infoOutput.split('|');
  const authorName = parts[0] || '';
  const authorEmail = parts[1] || '';
  const date = parts[2] || '';
  const message = parts.slice(3).join('|').trim();

  const filesOutput = await runGit(['diff-tree', '--no-commit-id', '--name-status', '-r', commitHash], normalizedRepo);
  const files: CommitFile[] = filesOutput.split('\n').filter(Boolean).map(line => {
    const parts = line.split(/\s+/);
    const statusCode = parts[0];
    const filePath = parts[1];
    
    let status: CommitFile['status'] = 'modified';
    if (statusCode.startsWith('A')) status = 'added';
    else if (statusCode.startsWith('D')) status = 'deleted';
    else if (statusCode.startsWith('R')) status = 'renamed';
    
    return { path: filePath, status };
  });

  return {
    hash: commitHash,
    authorName,
    authorEmail,
    date,
    message,
    files
  };
}

// Get diff of a file in a commit
export async function getGitCommitDiff(repoPath: string, commitHash: string, filePath: string): Promise<string> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    const normalizedFile = path.normalize(filePath);
    // git show to get the diff format, with format= to remove headers
    const output = await runGit(['show', '--format=', commitHash, '--', normalizedFile], normalizedRepo);
    return output;
  } catch (error: any) {
    return `Error generating commit diff: ${error.message}`;
  }
}

export interface Checkpoint {
  id: string;
  name: string;
  description: string;
  timestamp: number;
  commitHash: string; // The stash commit hash if dirty, or HEAD commit hash if clean
  parentCommit: string; // HEAD commit at creation time
  branch: string; // branch name at creation time
  isDirty: boolean; // whether it had uncommitted changes
  worktreePath: string; // worktree path where it was created
}

async function getMetaPath(normalizedRepo: string): Promise<string> {
  const commonGitDir = await runGit(['rev-parse', '--git-common-dir'], normalizedRepo);
  const commonGitDirClean = commonGitDir.trim().replace(/\\/g, '/');
  
  if (normalizedRepo.startsWith('ssh://')) {
    const ssh = parseSSHPath(normalizedRepo);
    if (!ssh) throw new Error('Invalid SSH Path');
    const resolvedRemoteDir = commonGitDirClean.startsWith('/') 
      ? commonGitDirClean 
      : `${ssh.remotePath}/${commonGitDirClean}`;
    return `ssh://${ssh.user}@${ssh.host}:${ssh.port}${resolvedRemoteDir}/tline-checkpoints.json`;
  } else {
    const absCommonGitDir = path.resolve(normalizedRepo, commonGitDir);
    return path.join(absCommonGitDir, 'tline-checkpoints.json');
  }
}

// Get checkpoints list for a repository/worktree path
export async function getCheckpoints(repoPath: string): Promise<Checkpoint[]> {
  try {
    const normalizedRepo = normalizePath(repoPath);
    const metaPath = await getMetaPath(normalizedRepo);

    const exists = metaPath.startsWith('ssh://') ? await remoteExists(metaPath) : fs.existsSync(metaPath);
    if (!exists) {
      return [];
    }

    const content = metaPath.startsWith('ssh://') ? (await remoteRead(metaPath)).content : fs.readFileSync(metaPath, 'utf8');
    const checkpoints: Checkpoint[] = JSON.parse(content);

    // Validate each checkpoint's commit exists in Git.
    // If a checkpoint's commit is missing (e.g., cloned elsewhere or manually pruned),
    // we clean it up from metadata to stay consistent.
    const validCheckpoints: Checkpoint[] = [];
    for (const cp of checkpoints) {
      try {
        await runGit(['cat-file', '-t', cp.commitHash], normalizedRepo);
        validCheckpoints.push(cp);
      } catch (e) {
        // Commit is missing; ignore/auto-prune
      }
    }

    // If some invalid checkpoints were removed, update the metadata file
    if (validCheckpoints.length !== checkpoints.length) {
      if (metaPath.startsWith('ssh://')) {
        await remoteWrite(metaPath, JSON.stringify(validCheckpoints, null, 2));
      } else {
        fs.writeFileSync(metaPath, JSON.stringify(validCheckpoints, null, 2), 'utf8');
      }
    }

    return validCheckpoints;
  } catch (e) {
    return [];
  }
}

// Create a new checkpoint (snapshot) of the current workspace/worktree state
export async function createCheckpoint(
  repoPath: string,
  name: string,
  description: string
): Promise<{ success: boolean; checkpoint?: Checkpoint; output: string }> {
  try {
    const normalizedRepo = normalizePath(repoPath);

    // Get HEAD commit hash
    const headCommit = await runGit(['rev-parse', 'HEAD'], normalizedRepo);

    // Get active branch name
    let branch = 'detached';
    try {
      branch = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], normalizedRepo);
    } catch (e) {}

    // Check dirty status
    const status = await getGitStatus(normalizedRepo);
    const isDirty = status.length > 0;

    let commitHash = headCommit;
    const checkpointId = `cp_${Date.now()}`;

    if (isDirty) {
      // 1. Create a stash containing all changes (including untracked files)
      const stashMsg = `tline-checkpoint:${checkpointId}`;
      await runGit(['stash', 'push', '--include-untracked', '-m', stashMsg], normalizedRepo);

      // 2. Get the stash commit hash (the newly pushed stash is at stash@{0})
      const stashCommit = await runGit(['rev-parse', 'stash@{0}'], normalizedRepo);
      commitHash = stashCommit;

      // 3. Create a custom ref to keep the commit alive and prevent Git GC
      await runGit(['update-ref', `refs/tline/checkpoints/${checkpointId}`, stashCommit], normalizedRepo);

      // 4. Drop from regular stash list to keep user stash clean
      await runGit(['stash', 'drop', 'stash@{0}'], normalizedRepo);

      // 5. Immediately restore the changes back to the working directory
      try {
        await runGit(['stash', 'apply', '--index', stashCommit], normalizedRepo);
      } catch (applyError) {
        // Fallback if --index fails (due to minor index conflicts or lock issues)
        await runGit(['stash', 'apply', stashCommit], normalizedRepo);
      }
    }

    const checkpoint: Checkpoint = {
      id: checkpointId,
      name,
      description,
      timestamp: Date.now(),
      commitHash,
      parentCommit: headCommit,
      branch,
      isDirty,
      worktreePath: normalizedRepo
    };

    // Save to metadata JSON in common git dir
    const metaPath = await getMetaPath(normalizedRepo);

    let checkpoints: Checkpoint[] = [];
    const exists = metaPath.startsWith('ssh://') ? await remoteExists(metaPath) : fs.existsSync(metaPath);
    if (exists) {
      try {
        const content = metaPath.startsWith('ssh://') ? (await remoteRead(metaPath)).content : fs.readFileSync(metaPath, 'utf8');
        checkpoints = JSON.parse(content);
      } catch (e) {}
    }

    checkpoints.push(checkpoint);
    if (metaPath.startsWith('ssh://')) {
      await remoteWrite(metaPath, JSON.stringify(checkpoints, null, 2));
    } else {
      fs.writeFileSync(metaPath, JSON.stringify(checkpoints, null, 2), 'utf8');
    }

    return { success: true, checkpoint, output: 'Checkpoint created successfully.' };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// Restore a checkpoint (snapshot) into the current workspace/worktree
export async function restoreCheckpoint(
  repoPath: string,
  checkpointId: string
): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = normalizePath(repoPath);

    // Verify workspace is clean
    const status = await getGitStatus(normalizedRepo);
    if (status.length > 0) {
      return {
        success: false,
        output: 'Working directory is dirty. Please commit, stash, or discard changes first.'
      };
    }

    // Load checkpoints
    const metaPath = await getMetaPath(normalizedRepo);

    const exists = metaPath.startsWith('ssh://') ? await remoteExists(metaPath) : fs.existsSync(metaPath);
    if (!exists) {
      return { success: false, output: 'No checkpoints found.' };
    }

    const content = metaPath.startsWith('ssh://') ? (await remoteRead(metaPath)).content : fs.readFileSync(metaPath, 'utf8');
    const checkpoints: Checkpoint[] = JSON.parse(content);
    const checkpoint = checkpoints.find(c => c.id === checkpointId);

    if (!checkpoint) {
      return { success: false, output: 'Checkpoint not found.' };
    }

    // 1. Checkout the original branch/commit
    try {
      await runGit(['checkout', checkpoint.branch], normalizedRepo);
    } catch (checkoutError) {
      // If checking out branch fails (e.g. checked out in another worktree), checkout parent commit detached
      await runGit(['checkout', '--detach', checkpoint.parentCommit], normalizedRepo);
    }

    // 2. Apply the checkpoint's changes
    if (checkpoint.isDirty) {
      try {
        await runGit(['stash', 'apply', '--index', checkpoint.commitHash], normalizedRepo);
      } catch (applyError) {
        // Fallback without index
        await runGit(['stash', 'apply', checkpoint.commitHash], normalizedRepo);
      }
    }

    clearWorkspaceCache();
    return { success: true, output: `Checkpoint '${checkpoint.name}' restored successfully.` };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// Delete a checkpoint
export async function deleteCheckpoint(
  repoPath: string,
  checkpointId: string
): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = normalizePath(repoPath);

    // Load checkpoints
    const metaPath = await getMetaPath(normalizedRepo);

    const exists = metaPath.startsWith('ssh://') ? await remoteExists(metaPath) : fs.existsSync(metaPath);
    if (!exists) {
      return { success: false, output: 'No checkpoints found.' };
    }

    const content = metaPath.startsWith('ssh://') ? (await remoteRead(metaPath)).content : fs.readFileSync(metaPath, 'utf8');
    let checkpoints: Checkpoint[] = JSON.parse(content);
    const checkpoint = checkpoints.find(c => c.id === checkpointId);

    if (checkpoint) {
      // Delete custom ref
      try {
        await runGit(['update-ref', '-d', `refs/tline/checkpoints/${checkpointId}`], normalizedRepo);
      } catch (e) {}

      // Filter and save
      checkpoints = checkpoints.filter(c => c.id !== checkpointId);
      if (metaPath.startsWith('ssh://')) {
        await remoteWrite(metaPath, JSON.stringify(checkpoints, null, 2));
      } else {
        fs.writeFileSync(metaPath, JSON.stringify(checkpoints, null, 2), 'utf8');
      }
    }

    return { success: true, output: 'Checkpoint deleted.' };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// Delete a local branch
export async function deleteBranch(repoPath: string, branchName: string, force = false): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    const flag = force ? '-D' : '-d';
    const output = await runGit(['branch', flag, branchName], normalizedRepo);
    clearWorkspaceCache();
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// Fetch from remote
export async function fetchRemote(repoPath: string): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    const output = await runGit(['fetch', '--all', '--prune'], normalizedRepo);
    clearWorkspaceCache();
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}




