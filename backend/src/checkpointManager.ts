import fs from 'fs';
import path from 'path';
import {
  parseSSHPath,
  remoteExists,
  remoteRead,
  remoteWrite
} from './sshHelpers';
import {
  runGit,
  normalizePath,
  clearWorkspaceCache,
  getGitStatus
} from './gitManager';

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
