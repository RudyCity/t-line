import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { loadConfig, saveConfig } from './auth';

interface WorktreeInfo {
  path: string;
  commit: string;
  branch?: string;
  isMain: boolean;
  isDirty: boolean;
}

interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  isGit: boolean;
  worktrees: WorktreeInfo[];
  defaultShell?: string;
}

// Promisified exec helper
function runCmd(cmd: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
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
      defaultShell: item.defaultShell || 'powershell'
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
async function isWorktreeDirty(worktreePath: string): Promise<boolean> {
  try {
    const output = await runCmd('git status --porcelain', worktreePath);
    return output.trim().length > 0;
  } catch (e) {
    return false;
  }
}

// Retrieve details for a workspace
export async function getWorkspaceInfo(workspace: WorkspaceConfig): Promise<WorkspaceInfo> {
  const normalizedPath = path.normalize(workspace.path);
  const name = path.basename(normalizedPath) || normalizedPath;
  const isGit = fs.existsSync(path.join(normalizedPath, '.git'));
  
  let worktrees: WorktreeInfo[] = [];

  if (isGit) {
    try {
      const ptyOutput = await runCmd('git worktree list --porcelain', normalizedPath);
      const parsedWorktrees = parseWorktreePorcelain(ptyOutput);
      
      // Check dirty status for each worktree
      worktrees = await Promise.all(parsedWorktrees.map(async wt => {
        const isDirty = await isWorktreeDirty(wt.path);
        return {
          ...wt,
          isDirty
        };
      }));
    } catch (e) {
      console.error(`Error listing worktrees in ${normalizedPath}:`, e);
      // Fallback: create a mock worktree representing the main repo if list fails
      const isDirty = await isWorktreeDirty(normalizedPath);
      worktrees = [{
        path: normalizedPath,
        commit: 'unknown',
        branch: 'unknown',
        isMain: true,
        isDirty
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
    
    // Command compilation
    let cmd = 'git worktree add';
    if (newBranch) {
      cmd += ` -b "${branchName}" "${normalizedWorktree}"`;
    } else {
      cmd += ` "${normalizedWorktree}" "${branchName}"`;
    }

    const output = await runCmd(cmd, normalizedRepo);
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
    
    const cmd = `git worktree remove ${force ? '--force' : ''} "${normalizedWorktree}"`;
    const output = await runCmd(cmd, normalizedRepo);
    
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.message };
  }
}

// List local git branches in repository
export async function getRepoBranches(repoPath: string): Promise<string[]> {
  try {
    const output = await runCmd('git branch --format="%(refname:short)"', repoPath);
    return output.split('\n').map(b => b.trim()).filter(Boolean);
  } catch (e) {
    return [];
  }
}
