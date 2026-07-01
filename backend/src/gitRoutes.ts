import express from 'express';
import { authMiddleware } from './auth';
import {
  getWorkspaces,
  getRepoBranches,
  getGitStatus,
  getGitDiff,
  addWorktree,
  removeWorktree,
  stagePath,
  unstagePath,
  discardChanges,
  commitChanges,
  checkoutBranch,
  createBranch,
  pullBranch,
  pushBranch,
  getGitHistory,
  getCommitDetails,
  getGitCommitDiff,
  getCheckpoints,
  createCheckpoint,
  restoreCheckpoint,
  deleteCheckpoint,
  deleteBranch,
  fetchRemote
} from './gitManager';

const router = express.Router();

router.get('/workspaces/:id/branches', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const branches = await getRepoBranches(matched.path);
    res.json(branches);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/workspaces/:id/git/status', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { worktreePath } = req.query;
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const statusList = await getGitStatus(targetPath);
    res.json(statusList);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/workspaces/:id/git/diff', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { filePath, worktreePath } = req.query;
    if (!filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'filePath is required.' });
    }
    
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const diffOutput = await getGitDiff(targetPath, filePath);
    res.json({ diff: diffOutput });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workspaces/:id/git/stage', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { filePath, all, worktreePath } = req.body;
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await stagePath(targetPath, filePath, !!all);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workspaces/:id/git/unstage', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { filePath, all, worktreePath } = req.body;
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await unstagePath(targetPath, filePath, !!all);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workspaces/:id/git/discard', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { filePath, all, worktreePath } = req.body;
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await discardChanges(targetPath, filePath, !!all);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workspaces/:id/git/commit', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { message, commitAll, worktreePath } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Commit message is required.' });
    }
    
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await commitChanges(targetPath, message, !!commitAll);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

let onWorkspaceChangeCallback: (() => void) | null = null;

export function registerWorkspaceChangeCallback(cb: () => void) {
  onWorkspaceChangeCallback = cb;
}

router.post('/worktrees/add', authMiddleware, async (req, res) => {
  const { repoPath, worktreePath, branchName, newBranch, newBranchName } = req.body;
  if (!repoPath || !worktreePath || !branchName) {
    return res.status(400).json({ error: 'repoPath, worktreePath, and branchName are required.' });
  }
  
  const result = await addWorktree(repoPath, worktreePath, branchName, !!newBranch, newBranchName);
  if (result.success) {
    if (onWorkspaceChangeCallback) onWorkspaceChangeCallback();
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/worktrees/remove', authMiddleware, async (req, res) => {
  const { repoPath, worktreePath, force } = req.body;
  if (!repoPath || !worktreePath) {
    return res.status(400).json({ error: 'repoPath and worktreePath are required.' });
  }
  
  const result = await removeWorktree(repoPath, worktreePath, !!force);
  if (result.success) {
    if (onWorkspaceChangeCallback) onWorkspaceChangeCallback();
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

router.post('/workspaces/:id/git/checkout', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { branchName, worktreePath } = req.body;
    if (!branchName) {
      return res.status(400).json({ error: 'branchName is required.' });
    }
    
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await checkoutBranch(targetPath, branchName);
    if (result.success) {
      if (onWorkspaceChangeCallback) onWorkspaceChangeCallback();
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workspaces/:id/git/branch/create', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { branchName, worktreePath } = req.body;
    if (!branchName) {
      return res.status(400).json({ error: 'branchName is required.' });
    }
    
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await createBranch(targetPath, branchName, true);
    if (result.success) {
      if (onWorkspaceChangeCallback) onWorkspaceChangeCallback();
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workspaces/:id/git/pull', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { worktreePath } = req.body;
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await pullBranch(targetPath);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workspaces/:id/git/push', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { worktreePath } = req.body;
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await pushBranch(targetPath);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workspaces/:id/git/branch/delete', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { branchName, force, worktreePath } = req.body;
    if (!branchName) {
      return res.status(400).json({ error: 'branchName is required.' });
    }
    
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await deleteBranch(targetPath, branchName, !!force);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workspaces/:id/git/fetch', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { worktreePath } = req.body;
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await fetchRemote(targetPath);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/workspaces/:id/git/history', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { worktreePath, limit } = req.query;
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const historyLimit = limit ? parseInt(limit as string, 10) : 50;
    const history = await getGitHistory(targetPath, historyLimit);
    res.json(history);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/workspaces/:id/git/commit-details', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { worktreePath, commitHash } = req.query;
    if (!commitHash || typeof commitHash !== 'string') {
      return res.status(400).json({ error: 'commitHash query parameter is required.' });
    }
    
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const details = await getCommitDetails(targetPath, commitHash);
    res.json(details);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/workspaces/:id/git/commit-diff', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { worktreePath, commitHash, filePath } = req.query;
    if (!commitHash || typeof commitHash !== 'string' || !filePath || typeof filePath !== 'string') {
      return res.status(400).json({ error: 'commitHash and filePath are required.' });
    }
    
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const diff = await getGitCommitDiff(targetPath, commitHash, filePath);
    res.json({ diff });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// Checkpoints API endpoints
router.get('/workspaces/:id/checkpoints', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { worktreePath } = req.query;
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const checkpoints = await getCheckpoints(targetPath);
    res.json(checkpoints);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workspaces/:id/checkpoints', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const { worktreePath, name, description } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Checkpoint name is required.' });
    }
    
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await createCheckpoint(targetPath, name, description || '');
    if (result.success) {
      if (onWorkspaceChangeCallback) onWorkspaceChangeCallback();
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/workspaces/:id/checkpoints/:checkpointId/restore', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const checkpointId = req.params.checkpointId;
    const { worktreePath } = req.body;
    
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await restoreCheckpoint(targetPath, checkpointId);
    if (result.success) {
      if (onWorkspaceChangeCallback) onWorkspaceChangeCallback();
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/workspaces/:id/checkpoints/:checkpointId', authMiddleware, async (req, res) => {
  try {
    const workspaceId = req.params.id;
    const checkpointId = req.params.checkpointId;
    const { worktreePath } = req.body; // can be query parameter or body parameter
    
    const configs = getWorkspaces();
    const matched = configs.find(w => Buffer.from(w.path).toString('base64') === workspaceId);
    
    if (!matched) {
      return res.status(404).json({ error: 'Workspace not found.' });
    }
    
    const targetPath = (worktreePath && typeof worktreePath === 'string') ? worktreePath : matched.path;
    const result = await deleteCheckpoint(targetPath, checkpointId);
    if (result.success) {
      if (onWorkspaceChangeCallback) onWorkspaceChangeCallback();
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;

