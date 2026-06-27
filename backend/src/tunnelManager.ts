import { spawn, ChildProcess } from 'child_process';
import { execSync } from 'child_process';

interface TunnelStatus {
  active: boolean;
  url: string | null;
  type: 'quick' | 'token' | 'none';
  error: string | null;
}

class TunnelManager {
  private tunnelProcess: ChildProcess | null = null;
  private activeUrl: string | null = null;
  private tunnelType: 'quick' | 'token' | 'none' = 'none';
  private lastError: string | null = null;

  // Check if cloudflared binary is installed and accessible in the system PATH
  isCloudflaredInstalled(): boolean {
    try {
      execSync('cloudflared --version', { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  }

  // Start Cloudflare quick tunnel (trycloudflare.com)
  startQuickTunnel(localPort: number, onStatusChange: () => void): void {
    if (this.tunnelProcess) {
      this.stopTunnel();
    }

    this.tunnelType = 'quick';
    this.lastError = null;
    this.activeUrl = null;

    console.log(`Starting Cloudflare Quick Tunnel for port ${localPort}...`);
    
    // Quick tunnel command
    this.tunnelProcess = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${localPort}`]);

    // Cloudflared output is usually piped to stderr
    this.tunnelProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log(`[cloudflared-logs] ${output.trim()}`);

      // Look for trycloudflare.com URL
      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match) {
        this.activeUrl = match[0];
        console.log(`Cloudflare Quick Tunnel active at: ${this.activeUrl}`);
        onStatusChange();
      }
    });

    this.tunnelProcess.on('close', (code) => {
      console.log(`Cloudflare tunnel process exited with code ${code}`);
      this.resetStatus();
      onStatusChange();
    });

    this.tunnelProcess.on('error', (err) => {
      console.error('Failed to start cloudflared process:', err);
      this.lastError = err.message;
      this.resetStatus();
      onStatusChange();
    });
  }

  // Start Cloudflare tunnel using user token
  startTokenTunnel(token: string, onStatusChange: () => void): void {
    if (this.tunnelProcess) {
      this.stopTunnel();
    }

    this.tunnelType = 'token';
    this.lastError = null;
    this.activeUrl = 'Managed by Cloudflare Panel (Token Tunnel)';

    console.log(`Starting Cloudflare Named Tunnel with token...`);

    this.tunnelProcess = spawn('cloudflared', ['tunnel', 'run', '--token', token]);

    this.tunnelProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log(`[cloudflared-logs] ${output.trim()}`);
      if (output.includes('Error')) {
        this.lastError = output.trim();
        onStatusChange();
      }
    });

    this.tunnelProcess.on('close', (code) => {
      console.log(`Cloudflare tunnel process exited with code ${code}`);
      this.resetStatus();
      onStatusChange();
    });

    this.tunnelProcess.on('error', (err) => {
      console.error('Failed to start cloudflared process:', err);
      this.lastError = err.message;
      this.resetStatus();
      onStatusChange();
    });
  }

  // Stop the running tunnel
  stopTunnel(): void {
    if (this.tunnelProcess) {
      try {
        this.tunnelProcess.kill();
      } catch (e) {
        console.error('Error killing cloudflared process:', e);
      }
      this.resetStatus();
    }
  }

  private resetStatus(): void {
    this.tunnelProcess = null;
    this.activeUrl = null;
    this.tunnelType = 'none';
  }

  getStatus(): TunnelStatus {
    return {
      active: this.tunnelProcess !== null,
      url: this.activeUrl,
      type: this.tunnelType,
      error: this.lastError
    };
  }
}

export const tunnelManager = new TunnelManager();
