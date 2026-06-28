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

// Retrieve details for a workspace
export async function getWorkspaceInfo(workspace: WorkspaceConfig): Promise<WorkspaceInfo> {
  const normalizedPath = path.normalize(workspace.path);
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

  return {
    id: Buffer.from(normalizedPath).toString('base64'),
    name,
    path: normalizedPath,
    isGit,
    worktrees,
    defaultShell: workspace.defaultShell || 'powershell'
  };
}

// Add a new git worktree
export async function addWorktree(
  repoPath: string, 
  worktreePath: string, 
  branchName: string, 
  newBranch: boolean
): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    const normalizedWorktree = path.normalize(worktreePath);
    
    const args = ['worktree', 'add'];
    if (newBranch) {
      args.push('-b', branchName, normalizedWorktree);
    } else {
      args.push(normalizedWorktree, branchName);
    }

    const output = await runGit(args, normalizedRepo);
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// Remove a git worktree
export async function removeWorktree(repoPath: string, worktreePath: string, force: boolean): Promise<{ success: boolean; output: string }> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    const normalizedWorktree = path.normalize(worktreePath);
    
    const args = ['worktree', 'remove'];
    if (force) {
      args.push('--force');
    }
    args.push(normalizedWorktree);

    const output = await runGit(args, normalizedRepo);
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
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
}

// Get git changes (modified, untracked, added, deleted, renamed)
export async function getGitStatus(repoPath: string): Promise<GitFileStatus[]> {
  try {
    const normalizedRepo = path.normalize(repoPath);
    const output = await runGit(['status', '--porcelain'], normalizedRepo);
    if (!output.trim()) return [];
    
    return output.split('\n').map(line => {
      if (line.length < 3) return null;
      const statusChar = line.substring(0, 2);
      const filePath = line.substring(3).trim();
      
      let status: GitFileStatus['status'] = 'modified';
      if (statusChar.includes('??')) {
        status = 'untracked';
      } else if (statusChar.includes('A')) {
        status = 'added';
      } else if (statusChar.includes('D')) {
        status = 'deleted';
      } else if (statusChar.includes('R')) {
        status = 'renamed';
      }
      
      return { path: filePath, status };
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
