import { useState, useEffect } from 'react';
import { logFetchError } from '../utils/network';

export interface SystemStats {
  backend: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
  system: {
    total: number;
    free: number;
    platform: string;
  };
  desktop?: {
    desktopRss: number;
    webviewTotal: number;
    desktopTotal: number;
  };
}

export function useSystemStats(isAuthenticated: boolean) {
  const [systemStats, setSystemStats] = useState<SystemStats | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setSystemStats(null);
      return;
    }

    let disposed = false;
    let inFlight = false;
    const fetchStats = async () => {
      if (disposed || inFlight || document.hidden) return;
      inFlight = true;
      try {
        const res = await fetch('/api/system/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) throw new Error('Failed to fetch system stats');
        const data = await res.json();

        // Check if running in Electron or Tauri and fetch desktop metrics
        let desktop = undefined;
        if ((window as any).electron?.getMemoryUsage) {
          try {
            const electronStats = await (window as any).electron.getMemoryUsage();
            if (electronStats) {
              desktop = electronStats;
            }
          } catch (e) {
            console.error('Failed to fetch desktop memory usage:', e);
          }
        } else if ((window as any).__TAURI__?.core?.invoke) {
          try {
            const tauriStats = await (window as any).__TAURI__.core.invoke('get_memory_usage');
            if (tauriStats) {
              desktop = tauriStats;
            }
          } catch (e) {
            console.error('Failed to fetch Tauri desktop memory usage:', e);
          }
        }

        if (disposed) return;
        const next: SystemStats = { ...data, desktop };
        setSystemStats(prev => {
          if (prev &&
              Math.abs(prev.backend.rss - next.backend.rss) < 4 * 1024 * 1024 &&
              Math.abs(prev.backend.heapUsed - next.backend.heapUsed) < 4 * 1024 * 1024 &&
              Math.abs(prev.system.free - next.system.free) < 16 * 1024 * 1024 &&
              Math.abs((prev.desktop?.desktopTotal || 0) - (next.desktop?.desktopTotal || 0)) < 4 * 1024 * 1024) {
            return prev;
          }
          return next;
        });
      } catch (e) {
        if (!disposed) logFetchError('Error fetching system stats', e);
      } finally {
        inFlight = false;
      }
    };

    void fetchStats();
    // Visibility-aware and shared in-flight requests avoid overlapping native
    // memory probes; small fluctuations need not repaint the entire dashboard.
    const interval = setInterval(() => { void fetchStats(); }, 15000);
    const onVisibility = () => { if (!document.hidden) void fetchStats(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      disposed = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [isAuthenticated]);

  return systemStats;
}
