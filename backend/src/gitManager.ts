import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadConfig, saveConfig } from './auth';

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
  return new Promise((resolve, reject) => {
    // 15 seconds timeout to prevent hanging processes
    execFile('git', args, { cwd, timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout.trim());
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
      return { path: path.normalize(item), defaultShell: 'powershell' };
    }
    return {
      path: path.normalize(item.path),
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
  const normalizedPath = path.normalize(dirPath);

  // Check if already exists
  const exists = rawWorkspaces.some((w: any) => {
    const p = typeof w === 'string' ? w : w.path;
    return path.normalize(p) === normalizedPath;
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
  const normalizedPath = path.normalize(dirPath);

  rawWorkspaces = rawWorkspaces.filter((w: any) => {
    const p = typeof w === 'string' ? w : w.path;
    return path.normalize(p) !== normalizedPath;
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
  const normalizedPath = path.normalize(dirPath);

  const idx = rawWorkspaces.findIndex((w: any) => {
    const p = typeof w === 'string' ? w : w.path;
    return path.normalize(p) === normalizedPath;
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
        path: path.normalize(trimmed.substring(9).trim()),
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
  const normalizedPath = path.normalize(workspace.path);
  const cacheKey = normalizedPath;
  const now = Date.now();
  
  const cached = infoCache.get(cacheKey);
  if (cached && (now - cached.timestamp < INFO_CACHE_TTL_MS)) {
    return cached.info;
  }

  const name = workspace.name || path.basename(normalizedPath) || normalizedPath;
  const isGit = fs.existsSync(path.join(normalizedPath, '.git'));
  
  let worktrees: WorktreeInfo[] = [];

  if (isGit) {
    try {
      const ptyOutput = await runGit(['worktree', 'list', '--porcelain'], normalizedPath);
      const parsedWorktrees = parseWorktreePorcelain(ptyOutput);
      
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
    const normalizedRepo = path.normalize(repoPath);
    const normalizedWorktree = path.normalize(worktreePath);
    
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
        const normalizedRepo = path.normalize(repoPath);
        const normalizedWorktree = path.normalize(worktreePath);
        
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
  const normalizedRepo = path.normalize(repoPath);
  const normalizedWorktree = path.normalize(worktreePath);

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
      if (fs.existsSync(normalizedWorktree)) {
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
    const output = await runGit(['branch', '--format=%(refname:short)'], repoPath);
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
    }).filter((item): item is GitFileStatus => item !== null && !!item.path);
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
        if (fs.existsSync(fullPath)) {
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


