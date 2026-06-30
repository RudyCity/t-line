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
  commitChanges
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

router.post('/worktrees/add', authMiddleware, async (req, res) => {
  const { repoPath, worktreePath, branchName, newBranch, newBranchName } = req.body;
  if (!repoPath || !worktreePath || !branchName) {
    return res.status(400).json({ error: 'repoPath, worktreePath, and branchName are required.' });
  }
  
  const result = await addWorktree(repoPath, worktreePath, branchName, !!newBranch, newBranchName);
  if (result.success) {
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
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

export default router;
