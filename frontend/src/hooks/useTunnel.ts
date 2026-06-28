import { useState, useEffect } from 'react';

export interface TunnelStatus {
  active: boolean;
  url: string | null;
  type: 'quick' | 'token' | 'none';
  error: string | null;
}

export function useTunnel(isAuthenticated: boolean) {
  const [tunnelStatus, setTunnelStatus] = useState<TunnelStatus>({
    active: false,
    url: null,
    type: 'none',
    error: null
  });
  const [showTunnelModal, setShowTunnelModal] = useState<boolean>(false);
  const [tunnelToken, setTunnelToken] = useState<string>('');
  const [tunnelLoading, setTunnelLoading] = useState<boolean>(false);

  const fetchTunnelStatus = async () => {
    try {
      const res = await fetch('/api/tunnel/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      setTunnelStatus(data);
    } catch (e) {
      console.error('Failed to fetch tunnel status:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTunnelStatus();
      const interval = setInterval(fetchTunnelStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  const handleStartTunnel = async (type: 'quick' | 'token') => {
    if (type === 'token') {
      setShowTunnelModal(true);
      return;
    }
    
    setTunnelLoading(true);
    try {
      const res = await fetch('/api/tunnel/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ type: 'quick' })
      });
      const data = await res.json();
      if (data.success) {
        await fetchTunnelStatus();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Failed to start quick tunnel.');
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleStartTokenTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tunnelToken) return;

    setTunnelLoading(true);
    try {
      const res = await fetch('/api/tunnel/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ type: 'token', token: tunnelToken })
      });
      const data = await res.json();
      if (data.success) {
        setShowTunnelModal(false);
        setTunnelToken('');
        await fetchTunnelStatus();
      } else {
        alert(data.error);
      }
    } catch (e) {
      alert('Failed to start named tunnel.');
    } finally {
      setTunnelLoading(false);
    }
  };

  const handleStopTunnel = async () => {
    setTunnelLoading(true);
    try {
      const res = await fetch('/api/tunnel/stop', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await res.json();
      if (data.success) {
        await fetchTunnelStatus();
      }
    } catch (e) {
      console.error('Failed to stop tunnel:', e);
    } finally {
      setTunnelLoading(false);
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
    handleStopTunnel
  };
}
