import React, { useState, useEffect, useCallback } from 'react';
import { wsManager } from '../services/websocket';

export function useAuth() {
  const [setupRequired, setSetupRequired] = useState<boolean | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  const checkAuth = useCallback(async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
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
      console.error('Auth check failed:', e);
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
