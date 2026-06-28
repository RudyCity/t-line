import React from 'react';
import { Info, Shield, Eye, EyeOff } from 'lucide-react';
import { FormField, Input, Button } from './Form';

export interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  token: string;
  workspacesCount: number;
  showAlert: (title: string, message: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  show,
  onClose,
  token,
  workspacesCount,
  showAlert
}) => {
  const [activeTab, setActiveTab] = React.useState<'general' | 'security' | 'connections'>('general');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Access Control State
  const [connections, setConnections] = React.useState<any[]>([]);
  const [ipRules, setIpRules] = React.useState<Record<string, string>>({});
  const [loginBlocks, setLoginBlocks] = React.useState<Record<string, any>>({});

  const fetchConnections = async () => {
    try {
      const res = await fetch('/api/security/connections', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setConnections(data.accesses || []);
        setIpRules(data.rules || {});
        setLoginBlocks(data.loginBlocks || {});
      }
    } catch (e) {
      console.error('Failed to fetch connections:', e);
    }
  };

  React.useEffect(() => {
    if (show) {
      fetchConnections();
      
      // Auto-refresh logs every 10 seconds if Access Control tab is open
      if (activeTab === 'connections') {
        const interval = setInterval(fetchConnections, 10000);
        return () => clearInterval(interval);
      }
    }
  }, [show, activeTab]);

  const handleToggleRule = async (ip: string, currentRule: string | undefined) => {
    const newRule = currentRule === 'block' ? 'allow' : 'block';
    try {
      const res = await fetch('/api/security/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ip, rule: newRule })
      });
      if (res.ok) {
        const data = await res.json();
        setIpRules(data.rules || {});
        setLoginBlocks(data.loginBlocks || {});
        fetchConnections();
      } else {
        const errData = await res.json();
        showAlert('Security Rule Error', errData.error || 'Failed to update rule');
      }
    } catch (e) {
      showAlert('Security Rule Error', 'Error updating security rule.');
    }
  };

  if (!show) return null;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess('Password updated successfully.');
        localStorage.setItem('token', data.token);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setError(data.error || 'Failed to update password.');
      }
    } catch (err) {
      setError('An error occurred during password change.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content glass-panel" style={{ maxWidth: '480px', padding: 0, overflow: 'hidden' }}>
        <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="modal-title">Settings</h3>
          <button type="button" className="action-btn" onClick={onClose}>×</button>
        </div>

        {/* Tabs navigation */}
        <div className="sidebar-panel-tabs" style={{ background: 'rgba(0,0,0,0.15)' }}>
          <button
            type="button"
            className={`sidebar-panel-tab ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
            style={{ padding: '12px' }}
          >
            <Info size={14} />
            <span>General</span>
          </button>
          <button
            type="button"
            className={`sidebar-panel-tab ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
            style={{ padding: '12px' }}
          >
            <Shield size={14} />
            <span>Security</span>
          </button>
          <button
            type="button"
            className={`sidebar-panel-tab ${activeTab === 'connections' ? 'active' : ''}`}
            onClick={() => setActiveTab('connections')}
            style={{ padding: '12px' }}
          >
            <Shield size={14} />
            <span>Access Control</span>
          </button>
        </div>

        <div style={{ padding: '20px' }}>
          {activeTab === 'general' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Application Version</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>v1.0.3</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Workspaces</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{workspacesCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Backend Connection</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 'bold' }}>Active</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Client OS Platform</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                    {window.navigator.userAgent.includes('Windows') ? 'Windows' : 'Unix-like'}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <Button type="button" onClick={onClose}>Close</Button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <form onSubmit={handlePasswordChange}>
              {error && (
                <div style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginBottom: '12px', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  {error}
                </div>
              )}
              {success && (
                <div style={{ color: 'var(--color-success)', fontSize: '0.8rem', marginBottom: '12px', background: 'rgba(16, 185, 129, 0.1)', padding: '8px 12px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  {success}
                </div>
              )}

              <FormField label="Current Master Password">
                <div className="relative flex items-center">
                  <Input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    placeholder="Enter current password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>

              <FormField label="New Master Password">
                <div className="relative flex items-center">
                  <Input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="Min 6 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>

              <FormField label="Confirm New Master Password">
                <div className="relative flex items-center">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="Retype new password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </FormField>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
                <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
                  Cancel
                </Button>
                <Button type="submit" loading={loading} disabled={loading}>
                  {loading ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </form>
          )}

          {activeTab === 'connections' && (
            <div>
              <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.1)', padding: '10px', borderRadius: '8px' }}>
                <Shield size={16} className="text-purple-400 shrink-0" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Manage client devices accessing your server. You can block individual IPs to prevent unauthorized web or terminal connection requests.
                </span>
              </div>

              <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-main)' }}>
                Active & Recent Devices
              </h4>
              <div style={{ maxHeight: '140px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '6px', background: 'rgba(0,0,0,0.1)' }}>
                {connections.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', padding: '16px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    No connection history logged.
                  </div>
                ) : (
                  connections.map(conn => {
                    const isBlocked = ipRules[conn.ip] === 'block' || loginBlocks[conn.ip] !== undefined;
                    const relativeTime = Math.max(0, Math.round((Date.now() - conn.lastActive) / 1000));
                    let timeStr = 'Just now';
                    if (relativeTime >= 60) {
                      const mins = Math.floor(relativeTime / 60);
                      timeStr = `${mins}m ago`;
                    } else if (relativeTime > 5) {
                      timeStr = `${relativeTime}s ago`;
                    }
                    
                    return (
                      <div key={conn.ip} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 8px', borderRadius: '4px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.03)', fontSize: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1, paddingRight: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{conn.deviceType}</span>
                            <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                              {conn.path.split('/')[2] || 'api'}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem', color: 'var(--text-muted)' }} className="truncate">
                            {conn.ip}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7 }}>
                            Last Active: {timeStr}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleToggleRule(conn.ip, isBlocked ? 'block' : undefined)}
                          className={`btn ${isBlocked ? 'btn-secondary' : 'btn-danger'}`}
                          style={{ padding: '3px 8px', fontSize: '0.65rem', height: '22px', cursor: 'pointer', flexShrink: 0, borderRadius: '4px' }}
                        >
                          {isBlocked ? 'Unblock' : 'Block'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Blocked Login IPs Section */}
              {Object.keys(loginBlocks).length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', color: 'var(--color-danger)' }}>
                    Blocked Login Attempts ({Object.keys(loginBlocks).length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '6px', padding: '6px', background: 'rgba(239, 68, 68, 0.02)' }}>
                    {Object.keys(loginBlocks).map(ip => {
                      const blockInfo = loginBlocks[ip];
                      const dateStr = new Date(blockInfo.blockedAt).toLocaleTimeString();
                      return (
                        <div key={ip} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.04)', border: '1px solid rgba(239, 68, 68, 0.08)', fontSize: '0.75rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-danger)', fontWeight: 600 }}>{ip}</span>
                            <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                              Blocked at {dateStr} (Failed attempts: {blockInfo.attempts})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleToggleRule(ip, 'block')}
                            className="btn btn-secondary"
                            style={{ padding: '3px 6px', fontSize: '0.65rem', height: '20px', cursor: 'pointer', borderRadius: '4px' }}
                          >
                            Unblock
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {Object.keys(ipRules).length > 0 && (
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '8px', color: 'rgb(248, 113, 113)' }}>
                    Blocked IPs ({Object.keys(ipRules).length})
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto' }}>
                    {Object.keys(ipRules).map(ip => (
                      <div key={ip} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.1)', fontSize: '0.75rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', color: 'rgb(248, 113, 113)' }}>{ip}</span>
                        <button
                          type="button"
                          onClick={() => handleToggleRule(ip, 'block')}
                          className="btn btn-secondary"
                          style={{ padding: '3px 6px', fontSize: '0.65rem', height: '20px', cursor: 'pointer', borderRadius: '4px' }}
                        >
                          Unblock
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                <Button type="button" onClick={onClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
