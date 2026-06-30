import express from 'express';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { authMiddleware } from './auth';
import { clearWorkspaceCache } from './gitManager';

const router = express.Router();

let fileChangeCallback: ((filename: string) => void) | null = null;

export function registerFileChangeCallback(cb: (filename: string) => void) {
  fileChangeCallback = cb;
}

// File System directory browser endpoint
router.get('/list', authMiddleware, (req, res) => {
  const targetPath = req.query.path as string;

  try {
    if (!targetPath) {
      // Return logical drives on Windows, or root on Unix
      if (os.platform() === 'win32') {
        const drives: string[] = [];
        for (let i = 65; i <= 90; i++) {
          const drive = String.fromCharCode(i) + ':\\';
          if (fs.existsSync(drive)) {
            drives.push(drive);
          }
        }
        return res.json({ currentPath: '', parentPath: null, directories: drives.map(d => ({ name: d, path: d })) });
      } else {
        const homePath = os.homedir();
        return res.json({ 
          currentPath: homePath, 
          parentPath: path.dirname(homePath),
          directories: [
            { name: 'Root (/)', path: '/' },
            { name: 'User Home', path: homePath }
          ] 
        });
      }
    }

    const resolvedPath = path.resolve(targetPath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Path does not exist.' });
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory.' });
    }

    const items = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const directories = items
      .filter(item => {
        try {
          return item.isDirectory() && item.name !== '.git';
        } catch (e) {
          return false;
        }
      })
      .map(item => ({
        name: item.name,
        path: path.join(resolvedPath, item.name)
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const parentPath = path.dirname(resolvedPath);
    
    res.json({
      currentPath: resolvedPath,
      parentPath: parentPath !== resolvedPath ? parentPath : null,
      directories
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/explore', authMiddleware, (req, res) => {
  const targetPath = req.query.path as string;
  if (!targetPath) {
    return res.status(400).json({ error: 'Path is required.' });
  }

  try {
    const resolvedPath = path.resolve(targetPath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Path does not exist.' });
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return res.status(400).json({ error: 'Path is not a directory.' });
    }

    const items = fs.readdirSync(resolvedPath, { withFileTypes: true });
    const contents = items
      .map(item => {
        try {
          return {
            name: item.name,
            path: path.join(resolvedPath, item.name),
            isDirectory: item.isDirectory()
          };
        } catch {
          return null;
        }
      })
      .filter((item): item is { name: string; path: string; isDirectory: boolean } => 
        item !== null && 
        item.name !== 'node_modules' && 
        item.name !== 'dist' && 
        item.name !== 'dist-exe' &&
        item.name !== '.git'
      )
      .sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name);
        }
        return a.isDirectory ? -1 : 1;
      });

    const parentPath = path.dirname(resolvedPath);

    res.json({
      currentPath: resolvedPath,
      parentPath: parentPath !== resolvedPath ? parentPath : null,
      contents
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/read', authMiddleware, (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required.' });
  }

  try {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'File does not exist.' });
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      return res.status(400).json({ error: 'Path is not a file.' });
    }

    // Limit read size to 1MB to prevent large memory overhead
    const fd = fs.openSync(resolvedPath, 'r');
    const buffer = Buffer.alloc(1024 * 1024);
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
    fs.closeSync(fd);

    let encoding: BufferEncoding = 'utf8';
    let startOffset = 0;

    if (bytesRead >= 2) {
      if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
        encoding = 'utf16le';
        startOffset = 2;
      } else if (bytesRead >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        encoding = 'utf8';
        startOffset = 3;
      } else {
        // Heuristic to detect UTF-16LE without BOM
        let nullsAtOdd = 0;
        let nullsAtEven = 0;
        const limit = Math.min(bytesRead, 100);
        for (let i = 0; i < limit; i++) {
          if (buffer[i] === 0x00) {
            if (i % 2 === 1) nullsAtOdd++;
            else nullsAtEven++;
          }
        }
        if (nullsAtOdd > 5 && nullsAtEven === 0) {
          encoding = 'utf16le';
        }
      }
    }

    const content = buffer.toString(encoding, startOffset, bytesRead);
    res.json({
      content,
      truncated: stat.size > bytesRead
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/raw', authMiddleware, (req, res) => {
  const filePath = req.query.path as string;
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required.' });
  }

  try {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'File does not exist.' });
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isFile()) {
      return res.status(400).json({ error: 'Path is not a file.' });
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.pdf') {
      contentType = 'application/pdf';
    } else if (ext === '.png') {
      contentType = 'image/png';
    } else if (ext === '.jpg' || ext === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (ext === '.gif') {
      contentType = 'image/gif';
    } else if (ext === '.webp') {
      contentType = 'image/webp';
    } else if (ext === '.svg') {
      contentType = 'image/svg+xml';
    } else if (ext === '.ico') {
      contentType = 'image/x-icon';
    }

    res.setHeader('Content-Type', contentType);
    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/write', authMiddleware, (req, res) => {
  const { path: filePath, content } = req.body;
  if (!filePath) {
    return res.status(400).json({ error: 'File path is required.' });
  }
  if (content === undefined) {
    return res.status(400).json({ error: 'Content is required.' });
  }

  try {
    const resolvedPath = path.resolve(filePath);
    fs.writeFileSync(resolvedPath, content, 'utf8');
    clearWorkspaceCache(); // Clear cache so status updates immediately
    if (fileChangeCallback) {
      fileChangeCallback(resolvedPath); // Trigger immediate update notification
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/delete', authMiddleware, (req, res) => {
  const targetPath = req.query.path as string || req.body.path as string;
  if (!targetPath) {
    return res.status(400).json({ error: 'Path is required.' });
  }

  try {
    const resolvedPath = path.resolve(targetPath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Path does not exist.' });
    }

    const stat = fs.statSync(resolvedPath);
    if (stat.isDirectory()) {
      fs.rmSync(resolvedPath, { recursive: true, force: true });
    } else {
      fs.rmSync(resolvedPath, { force: true });
    }

    clearWorkspaceCache();
    if (fileChangeCallback) {
      fileChangeCallback(resolvedPath); // Notify file explorer changes
    }
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/open-explorer', authMiddleware, (req, res) => {
  const targetPath = req.body.path as string;
  if (!targetPath) {
    return res.status(400).json({ error: 'Path is required.' });
  }

  try {
    const resolvedPath = path.resolve(targetPath);
    if (!fs.existsSync(resolvedPath)) {
      return res.status(404).json({ error: 'Path does not exist.' });
    }

    const platform = os.platform();
    let cmd = '';

    if (platform === 'win32') {
      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        cmd = `explorer.exe "${resolvedPath}"`;
      } else {
        cmd = `explorer.exe /select,"${resolvedPath}"`;
      }
    } else if (platform === 'darwin') {
      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        cmd = `open "${resolvedPath}"`;
      } else {
        cmd = `open -R "${resolvedPath}"`;
      }
    } else {
      // Linux fallback
      const stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        cmd = `xdg-open "${resolvedPath}"`;
      } else {
        cmd = `xdg-open "${path.dirname(resolvedPath)}"`;
      }
    }

    exec(cmd, (err) => {
      if (err) {
        console.error('Failed to open explorer:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true });
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
