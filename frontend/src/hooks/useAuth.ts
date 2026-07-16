import React, { useState, useEffect, useCallback } from 'react';
import { wsManager } from '../services/websocket';
import { getRuntimeSearchParams } from '../utils/runtimeQuery';
import { logFetchError } from '../utils/network';

export function useAuth() {
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const checkAuth = useCallback(async () => {
    try {
      const urlParams = getRuntimeSearchParams();
      const urlToken = urlParams.get('token');
      if (urlToken) {
        localStorage.setItem('token', urlToken);
        wsManager.setToken(urlToken);
      }

      const token = localStorage.getItem('token');
      
      // 1. Check setup status
      const setupRes = await fetch('/api/auth/setup-status');
      const setupData = await setupRes.json();
      setSetupRequired(setupData.setupRequired);

      if (setupData.setupRequired) {
        setLoading(false);
        return;
      }

      // 2. Verify token if exists
      if (token) {
        const verifyRes = await fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const verifyData = await verifyRes.json();
        if (verifyData.valid) {
          setIsAuthenticated(true);
        } else {
          localStorage.removeItem('token');
        }
      }
    } catch (e) {
      logFetchError('Auth check failed', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSetup = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    try {
      const res = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        wsManager.setToken(data.token);
        setIsAuthenticated(true);
        setSetupRequired(false);
      } else {
        setAuthError(data.error);
      }
    } catch (e) {
      setAuthError('Failed to execute setup.');
    }
  }, [password]);

  const handleLogin = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        wsManager.setToken(data.token);
        setIsAuthenticated(true);
      } else {
        setAuthError(data.error);
      }
    } catch (e) {
      setAuthError('Failed to execute login.');
    }
  }, [password]);

  const handleLogout = useCallback((
    setTabs: React.Dispatch<React.SetStateAction<any[]>>,
    setTerminalInstances: React.Dispatch<React.SetStateAction<Record<string, any>>>,
    setActiveTabId: (id: string) => void
  ) => {
    localStorage.removeItem('token');
    localStorage.removeItem('tline-tabs-v2');
    localStorage.removeItem('tline-terminal-instances-v2');
    localStorage.removeItem('tline-active-tab-id');
    setTabs([]);
    setTerminalInstances({});
    setActiveTabId('');
    setIsAuthenticated(false);
    setPassword('');
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Global fetch interceptor to handle 401 (Unauthorized) errors dynamically.
  // When running in Tauri, it attempts to recover the new local bypass token
  // from the main app URL. If recovery succeeds, the failed request is retried
  // transparently. Otherwise, the user is logged out.
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const requestInit: RequestInit = init || {};
      const response = await originalFetch(input, requestInit);

      if (response.status === 401) {
        const urlStr = typeof input === 'string' ? input : (input as Request).url;
        const isAuthEndpoint = urlStr.includes('/api/auth/login') || 
                               urlStr.includes('/api/auth/setup') || 
                               urlStr.includes('/api/auth/verify') ||
                               urlStr.includes('/api/auth/setup-status');
        
        if (!isAuthEndpoint) {
          const oldToken = localStorage.getItem('token');
          let tokenUpdated = false;
          let newToken = '';

          // 1. Try to recover token if running in Tauri
          if ((window as any).__TAURI__?.core?.invoke) {
            try {
              const appUrl: string = await (window as any).__TAURI__.core.invoke('get_app_url');
              if (appUrl) {
                const urlObj = appUrl.startsWith('http://') || appUrl.startsWith('https://')
                  ? new URL(appUrl)
                  : new URL(appUrl, window.location.origin);
                const tokenParam = urlObj.searchParams.get('token');
                if (tokenParam && tokenParam !== oldToken) {
                  newToken = tokenParam;
                  localStorage.setItem('token', newToken);
                  wsManager.setToken(newToken);
                  wsManager.reconnect();
                  tokenUpdated = true;
                }
              }
            } catch (e) {
              console.error('Failed to auto-recover bypass token from Tauri:', e);
            }
          }

          if (tokenUpdated && newToken) {
            // 2. Retry the request with the new token
            const headers = new Headers(requestInit.headers || {});
            headers.set('Authorization', `Bearer ${newToken}`);
            const retryInit = {
              ...requestInit,
              headers
            };
            console.log(`Retrying request to ${urlStr} with recovered token.`);
            return originalFetch(input, retryInit);
          } else {
            // 3. Fallback to logout
            console.warn(`Unauthorized request to ${urlStr}. Logging out.`);
            localStorage.removeItem('token');
            wsManager.disconnect();
            setIsAuthenticated(false);
          }
        }
      }
      return response;
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, [setIsAuthenticated]);

  return {
    setupRequired,
    setSetupRequired,
    isAuthenticated,
    setIsAuthenticated,
    authError,
    setAuthError,
    password,
    setPassword,
    loading,
    setLoading,
    checkAuth,
    handleSetup,
    handleLogin,
    handleLogout
  };
}
