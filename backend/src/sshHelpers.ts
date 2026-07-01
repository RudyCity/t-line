import { execFile, spawn } from 'child_process';

export interface SSHConnectionDetails {
  user: string;
  host: string;
  port: number;
  remotePath: string;
}

export function parseSSHPath(sshPath: string): SSHConnectionDetails | null {
  if (!sshPath || typeof sshPath !== 'string') return null;
  // Expected format: ssh://user@host:port/path
  const match = sshPath.match(/^ssh:\/\/([^@]+)@([^:]+):(\d+)(.*)$/);
  if (!match) {
    const matchNoPort = sshPath.match(/^ssh:\/\/([^@]+)@([^\/]+)(.*)$/);
    if (!matchNoPort) return null;
    return {
      user: matchNoPort[1],
      host: matchNoPort[2],
      port: 22,
      remotePath: matchNoPort[3] || '/'
    };
  }
  return {
    user: match[1],
    host: match[2],
    port: parseInt(match[3], 10),
    remotePath: match[4] || '/'
  };
}

export function isSSHPath(filePath: string): boolean {
  return typeof filePath === 'string' && filePath.startsWith('ssh://');
}

export function normalizeSSHPath(p: string): string {
  if (!p || !p.startsWith('ssh://')) return p;
  const parsed = parseSSHPath(p);
  if (!parsed) return p;
  
  let cleanRemote = parsed.remotePath.replace(/\/+/g, '/');
  if (cleanRemote.length > 1 && cleanRemote.endsWith('/')) {
    cleanRemote = cleanRemote.slice(0, -1);
  }
  return `ssh://${parsed.user}@${parsed.host}:${parsed.port}${cleanRemote}`;
}

export function runSSHCommand(host: string, port: number, user: string, cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      '-p', port.toString(),
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=accept-new',
      `${user}@${host}`,
      cmd
    ];
    
    execFile('ssh', args, { timeout: 20000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr.trim() || error.message));
      } else {
        resolve(stdout.trimEnd());
      }
    });
  });
}

export async function remoteList(sshPath: string) {
  const ssh = parseSSHPath(sshPath);
  if (!ssh) throw new Error('Invalid SSH Path');
  
  const escapedPath = ssh.remotePath.replace(/"/g, '\\"');
  const output = await runSSHCommand(ssh.host, ssh.port, ssh.user, `cd "${escapedPath}" && ls -F -A`);
  const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  const directories = lines
    .filter(line => line.endsWith('/'))
    .map(line => {
      const name = line.slice(0, -1);
      const separator = ssh.remotePath.endsWith('/') ? '' : '/';
      const itemPath = `ssh://${ssh.user}@${ssh.host}:${ssh.port}${ssh.remotePath}${separator}${name}`;
      return { name, path: itemPath };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
    
  const parentRemotePath = ssh.remotePath === '/' || ssh.remotePath === ''
    ? null
    : ssh.remotePath.substring(0, ssh.remotePath.lastIndexOf('/')) || '/';
    
  const parentPath = parentRemotePath 
    ? `ssh://${ssh.user}@${ssh.host}:${ssh.port}${parentRemotePath}`
    : null;

  return {
    currentPath: sshPath,
    parentPath,
    directories
  };
}

export async function remoteExplore(sshPath: string) {
  const ssh = parseSSHPath(sshPath);
  if (!ssh) throw new Error('Invalid SSH Path');
  
  const escapedPath = ssh.remotePath.replace(/"/g, '\\"');
  const output = await runSSHCommand(ssh.host, ssh.port, ssh.user, `cd "${escapedPath}" && ls -F -A`);
  const lines = output.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  const contents = lines
    .map(line => {
      let name = line;
      let isDirectory = false;
      if (name.endsWith('/')) {
        isDirectory = true;
        name = name.slice(0, -1);
      } else if (name.endsWith('*') || name.endsWith('@') || name.endsWith('=')) {
        name = name.slice(0, -1);
      }
      
      const separator = ssh.remotePath.endsWith('/') ? '' : '/';
      const itemPath = `ssh://${ssh.user}@${ssh.host}:${ssh.port}${ssh.remotePath}${separator}${name}`;
      return { name, path: itemPath, isDirectory };
    })
    .sort((a, b) => {
      if (a.isDirectory === b.isDirectory) {
        return a.name.localeCompare(b.name);
      }
      return a.isDirectory ? -1 : 1;
    });

  const parentRemotePath = ssh.remotePath === '/' || ssh.remotePath === ''
    ? null
    : ssh.remotePath.substring(0, ssh.remotePath.lastIndexOf('/')) || '/';
    
  const parentPath = parentRemotePath 
    ? `ssh://${ssh.user}@${ssh.host}:${ssh.port}${parentRemotePath}`
    : null;

  return {
    currentPath: sshPath,
    parentPath,
    contents
  };
}

export async function remoteRead(sshPath: string): Promise<{ content: string; truncated: boolean }> {
  const ssh = parseSSHPath(sshPath);
  if (!ssh) throw new Error('Invalid SSH Path');
  
  const escapedPath = ssh.remotePath.replace(/"/g, '\\"');
  const content = await runSSHCommand(ssh.host, ssh.port, ssh.user, `head -c 1048576 "${escapedPath}"`);
  
  let size = 0;
  try {
    const sizeStr = await runSSHCommand(ssh.host, ssh.port, ssh.user, `wc -c < "${escapedPath}"`);
    size = parseInt(sizeStr.trim(), 10) || 0;
  } catch (e) {
    size = content.length;
  }
  
  return {
    content,
    truncated: size > 1024 * 1024
  };
}

export function remoteWrite(sshPath: string, content: string): Promise<void> {
  const ssh = parseSSHPath(sshPath);
  if (!ssh) throw new Error('Invalid SSH Path');
  
  return new Promise<void>((resolve, reject) => {
    const child = spawn('ssh', [
      '-p', ssh.port.toString(),
      '-o', 'BatchMode=yes',
      '-o', 'StrictHostKeyChecking=accept-new',
      `${ssh.user}@${ssh.host}`,
      `cat > "${ssh.remotePath.replace(/"/g, '\\"')}"`
    ]);
    
    let errOutput = '';
    child.stderr?.on('data', (d) => {
      errOutput += d.toString();
    });
    
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(errOutput.trim() || `ssh exit code ${code}`));
    });
    
    child.stdin.write(content, 'utf8');
    child.stdin.end();
  });
}

export async function remoteCreate(sshPath: string, isDirectory: boolean): Promise<void> {
  const ssh = parseSSHPath(sshPath);
  if (!ssh) throw new Error('Invalid SSH Path');
  
  const escapedPath = ssh.remotePath.replace(/"/g, '\\"');
  const cmd = isDirectory 
    ? `mkdir -p "${escapedPath}"` 
    : `mkdir -p "$(dirname "${escapedPath}")" && touch "${escapedPath}"`;
  await runSSHCommand(ssh.host, ssh.port, ssh.user, cmd);
}

export async function remoteDelete(sshPath: string): Promise<void> {
  const ssh = parseSSHPath(sshPath);
  if (!ssh) throw new Error('Invalid SSH Path');
  
  const escapedPath = ssh.remotePath.replace(/"/g, '\\"');
  await runSSHCommand(ssh.host, ssh.port, ssh.user, `rm -rf "${escapedPath}"`);
}

export async function remoteRename(oldSSHPath: string, newSSHPath: string): Promise<void> {
  const oldSsh = parseSSHPath(oldSSHPath);
  const newSsh = parseSSHPath(newSSHPath);
  if (!oldSsh || !newSsh) throw new Error('Invalid SSH Path');
  
  const oldEscaped = oldSsh.remotePath.replace(/"/g, '\\"');
  const newEscaped = newSsh.remotePath.replace(/"/g, '\\"');
  await runSSHCommand(oldSsh.host, oldSsh.port, oldSsh.user, `mv "${oldEscaped}" "${newEscaped}"`);
}

export async function remoteExists(sshPath: string): Promise<boolean> {
  const ssh = parseSSHPath(sshPath);
  if (!ssh) return false;
  
  try {
    const escapedPath = ssh.remotePath.replace(/"/g, '\\"');
    const out = await runSSHCommand(ssh.host, ssh.port, ssh.user, `[ -e "${escapedPath}" ] && echo "true" || echo "false"`);
    return out.trim() === 'true';
  } catch {
    return false;
  }
}
