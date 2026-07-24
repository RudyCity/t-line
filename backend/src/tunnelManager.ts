import { spawn, ChildProcess } from 'child_process';
import { execSync } from 'child_process';

export interface TunnelItemStatus {
  active: boolean;
  url: string | null;
  type: 'quick' | 'token' | 'none';
  error: string | null;
  port?: number;
}

export interface MultiTunnelStatus {
  tline: TunnelItemStatus;
  customs: TunnelItemStatus[];
}

class ActiveTunnel {
  private tunnelProcess: ChildProcess | null = null;
  private activeUrl: string | null = null;
  private tunnelType: 'quick' | 'token' | 'none' = 'none';
  private lastError: string | null = null;
  private localPort: number | null = null;

  startQuick(port: number, onStatusChange: () => void): void {
    this.stop();

    this.tunnelType = 'quick';
    this.lastError = null;
    this.activeUrl = null;
    this.localPort = port;

    console.log(`Starting Cloudflare Quick Tunnel for port ${port}...`);
    this.tunnelProcess = spawn('cloudflared', ['tunnel', '--url', `http://localhost:${port}`]);

    this.tunnelProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log(`[cloudflared-${port}-logs] ${output.trim()}`);

      const match = output.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
      if (match) {
        this.activeUrl = match[0];
        console.log(`Cloudflare Quick Tunnel for port ${port} active at: ${this.activeUrl}`);
        onStatusChange();
      }
    });

    this.tunnelProcess.on('close', (code) => {
      console.log(`Cloudflare tunnel process for port ${port} exited with code ${code}`);
      this.resetStatus();
      onStatusChange();
    });

    this.tunnelProcess.on('error', (err) => {
      console.error(`Failed to start cloudflared process for port ${port}:`, err);
      this.lastError = err.message;
      this.resetStatus();
      onStatusChange();
    });
  }

  startToken(token: string, onStatusChange: () => void): void {
    this.stop();

    this.tunnelType = 'token';
    this.lastError = null;
    this.activeUrl = 'Managed by Cloudflare Panel (Token Tunnel)';
    this.localPort = null;

    console.log(`Starting Cloudflare Named Tunnel with token...`);
    this.tunnelProcess = spawn('cloudflared', ['tunnel', 'run', '--token', token]);

    this.tunnelProcess.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log(`[cloudflared-token-logs] ${output.trim()}`);
      if (output.includes('Error')) {
        this.lastError = output.trim();
        onStatusChange();
      }
    });

    this.tunnelProcess.on('close', (code) => {
      console.log(`Cloudflare token tunnel process exited with code ${code}`);
      this.resetStatus();
      onStatusChange();
    });

    this.tunnelProcess.on('error', (err) => {
      console.error('Failed to start cloudflared process for token tunnel:', err);
      this.lastError = err.message;
      this.resetStatus();
      onStatusChange();
    });
  }

  stop(): void {
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

  getStatus(): TunnelItemStatus {
    return {
      active: this.tunnelProcess !== null,
      url: this.activeUrl,
      type: this.tunnelType,
      error: this.lastError,
      port: this.localPort || undefined
    };
  }
}

class TunnelManager {
  private tlineTunnel = new ActiveTunnel();
  private customTunnels = new Map<number, ActiveTunnel>();

  constructor() {
    // Ensure all processes are cleaned up on application exit
    process.on('exit', () => {
      this.tlineTunnel.stop();
      for (const tunnel of this.customTunnels.values()) {
        tunnel.stop();
      }
    });
  }

  isCloudflaredInstalled(): boolean {
    try {
      execSync('cloudflared --version', { stdio: 'ignore' });
      return true;
    } catch (e) {
      return false;
    }
  }

  getTlineTunnel(): ActiveTunnel {
    return this.tlineTunnel;
  }

  getOrCreateCustomTunnel(port: number): ActiveTunnel {
    let tunnel = this.customTunnels.get(port);
    if (!tunnel) {
      tunnel = new ActiveTunnel();
      this.customTunnels.set(port, tunnel);
    }
    return tunnel;
  }

  stopCustomTunnel(port: number): void {
    const tunnel = this.customTunnels.get(port);
    if (tunnel) {
      tunnel.stop();
      this.customTunnels.delete(port);
    }
  }

  getStatus(): MultiTunnelStatus {
    return {
      tline: this.tlineTunnel.getStatus(),
      customs: Array.from(this.customTunnels.values()).map(t => t.getStatus())
    };
  }
}

export const tunnelManager = new TunnelManager();
