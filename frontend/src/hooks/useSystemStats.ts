import { useState, useEffect } from 'react';

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

    const fetchStats = async () => {
      try {
        const res = await fetch('/api/system/stats', {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        });
        if (!res.ok) throw new Error('Failed to fetch system stats');
        const data = await res.json();

        // Check if running in Electron and fetch desktop metrics
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
        }

        setSystemStats({
          ...data,
          desktop
        });
      } catch (e) {
        console.error('Error fetching system stats:', e);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return systemStats;
}
