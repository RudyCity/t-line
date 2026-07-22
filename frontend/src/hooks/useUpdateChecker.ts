import { useState, useCallback } from 'react';
import { version } from '../../package.json';
import { logFetchError } from '../utils/network';

const DEFAULT_VERSION = version || '1.3.397';

export function useUpdateChecker() {
  const [appVersion, setAppVersion] = useState<string>(DEFAULT_VERSION);
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
      if (typeof window !== 'undefined' && navigator && !navigator.onLine) {
        return; // Skip checking if browser is offline
      }
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
      } else {
        setUpdateAvailable(false);
      }
    } catch (err) {
      logFetchError('Failed to check for updates', err);
    }
  }, []);

  const fetchLocalVersion = useCallback(async () => {
    try {
      const res = await fetch('/api/system/version');
      if (!res.ok) {
        checkUpdates(DEFAULT_VERSION);
        return;
      }
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        checkUpdates(DEFAULT_VERSION);
        return;
      }
      const data = await res.json();
      if (data && data.version) {
        setAppVersion(data.version);
        checkUpdates(data.version);
      } else {
        checkUpdates(DEFAULT_VERSION);
      }
    } catch (e) {
      logFetchError('Failed to fetch local version', e);
      checkUpdates(DEFAULT_VERSION);
    }
  }, [checkUpdates]);

  return {
    appVersion,
    latestVersion,
    updateAvailable,
    fetchLocalVersion
  };
}

