import { useState, useCallback } from 'react';

export function useUpdateChecker() {
  const [appVersion, setAppVersion] = useState<string>('1.3.73');
  const [latestVersion, setLatestVersion] = useState<string>('');
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);

  const isVersionGreater = (latest: string, current: string): boolean => {
    const lParts = latest.split('.').map(Number);
    const cParts = current.split('.').map(Number);
    for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
      const l = lParts[i] || 0;
      const c = cParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  };

  const checkUpdates = useCallback(async (currentVer: string) => {
    try {
      const res = await fetch('https://api.github.com/repos/RudyCity/t-line/releases/latest');
      if (!res.ok) return;
      const data = await res.json();
      const latest = data.tag_name;
      if (!latest) return;
      const cleanLatest = latest.startsWith('v') ? latest.slice(1) : latest;
      const cleanCurrent = currentVer.startsWith('v') ? currentVer.slice(1) : currentVer;
      
      if (isVersionGreater(cleanLatest, cleanCurrent)) {
        setLatestVersion(cleanLatest);
        setUpdateAvailable(true);
        
        // Dispatch toast notification after a small delay
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('tline-toast', {
            detail: { message: `New Update Available: v${cleanLatest}! Click the version badge in the footer to download.` }
          }));
        }, 3000);
      }
    } catch (err) {
      console.error('Failed to check for updates:', err);
    }
  }, []);

  const fetchLocalVersion = useCallback(async () => {
    try {
      const res = await fetch('/api/system/version');
      const data = await res.json();
      if (data.version) {
        setAppVersion(data.version);
        checkUpdates(data.version);
      }
    } catch (e) {
      console.error('Failed to fetch local version:', e);
      checkUpdates('1.3.73');
    }
  }, [checkUpdates]);

  return {
    appVersion,
    latestVersion,
    updateAvailable,
    fetchLocalVersion
  };
}
