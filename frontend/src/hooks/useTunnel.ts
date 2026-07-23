import { useState, useEffect } from 'react';
import { logFetchError } from '../utils/network';

export interface TunnelItemStatus {
  active: boolean;
  url: string | null;
  type: 'quick' | 'token' | 'none';
  error: string | null;
  port?: number;
}

export interface MultiTunnelStatus {
  tline: TunnelItemStatus;
  custom: TunnelItemStatus;
}

export function useTunnel(
  isAuthenticated: boolean,
  showAlert: (title: string, message: string) => void
) {
  const [tunnelStatus, setTunnelStatus] = useState<MultiTunnelStatus>({
    tline: { active: false, url: null, type: 'none', error: null },
    custom: { active: false, url: null, type: 'none', error: null }
  });
  const [showTunnelModal, setShowTunnelModal] = useState<boolean>(false);
  const [tunnelToken, setTunnelToken] = useState<string>('');
  const [tunnelLoading, setTunnelLoading] = useState<{ tline: boolean; custom: boolean }>({
    tline: false,
    custom: false
  });
  const [tunnelTarget, setTunnelTarget] = useState<'tline' | 'custom'>('tline');
  const [customTunnelPort, setCustomTunnelPort] = useState<number>(80);

  const fetchTunnelStatus = async () => {
    try {
      const res = await fetch('/api/tunnel/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setTunnelStatus(data);
    } catch (e) {
      logFetchError('Failed to fetch tunnel status', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTunnelStatus();
      const interval = setInterval(fetchTunnelStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleStartTunnel = async (target: 'tline' | 'custom', type: 'quick' | 'token', customPort?: number) => {
    if (type === 'token') {
      setTunnelTarget(target);
      if (target === 'custom' && customPort) {
        setCustomTunnelPort(customPort);
      }
      setShowTunnelModal(true);
      return;
    }
    
    setTunnelLoading(prev => ({ ...prev, [target]: true }));
    try {
      const res = await fetch('/api/tunnel/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ type: 'quick', target, port: customPort })
      });
      const data = await res.json();
      if (data.success) {
        await fetchTunnelStatus();
      } else {
        showAlert('Tunnel Error', data.error);
      }
    } catch (e) {
      showAlert('Tunnel Error', 'Failed to start quick tunnel.');
    } finally {
      setTunnelLoading(prev => ({ ...prev, [target]: false }));
    }
  };

  const handleStartTokenTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tunnelToken) return;

    const target = tunnelTarget;
    setTunnelLoading(prev => ({ ...prev, [target]: true }));
    try {
      const res = await fetch('/api/tunnel/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ 
          type: 'token', 
          token: tunnelToken, 
          target,
          port: target === 'custom' ? customTunnelPort : undefined
        })
      });
      const data = await res.json();
      if (data.success) {
        setShowTunnelModal(false);
        setTunnelToken('');
        await fetchTunnelStatus();
      } else {
        showAlert('Tunnel Error', data.error);
      }
    } catch (e) {
      showAlert('Tunnel Error', 'Failed to start named tunnel.');
    } finally {
      setTunnelLoading(prev => ({ ...prev, [target]: false }));
    }
  };

  const handleStopTunnel = async (target: 'tline' | 'custom') => {
    setTunnelLoading(prev => ({ ...prev, [target]: true }));
    try {
      const res = await fetch('/api/tunnel/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ target })
      });
      const data = await res.json();
      if (data.success) {
        await fetchTunnelStatus();
      }
    } catch (e) {
      logFetchError('Failed to stop tunnel', e);
    } finally {
      setTunnelLoading(prev => ({ ...prev, [target]: false }));
    }
  };

  return {
    tunnelStatus,
    showTunnelModal,
    setShowTunnelModal,
    tunnelToken,
    setTunnelToken,
    tunnelLoading,
    fetchTunnelStatus,
    handleStartTunnel,
    handleStartTokenTunnel,
    handleStopTunnel,
    tunnelTarget,
    setTunnelTarget,
    customTunnelPort,
    setCustomTunnelPort
  };
}
