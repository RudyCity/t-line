import React from 'react';
import { Info, Shield, Eye, EyeOff, RefreshCw, Download, CheckCircle, XCircle, Loader2, ArrowUpCircle, Palette } from 'lucide-react';
import { FormField, Input, Button, Select } from './Form';
import { THEMES, UI_FONTS, MONO_FONTS } from '../hooks/useThemeAndFonts';

export interface SettingsModalProps {
  show: boolean;
  onClose: () => void;
  token: string;
  workspacesCount: number;
  showAlert: (title: string, message: string) => void;
  appVersion?: string;
  updateAvailable?: boolean;
  latestVersion?: string;
  theme?: string;
  setTheme?: (t: string) => void;
  accentColor?: string;
  setAccentColor?: (c: string) => void;
  fontSans?: string;
  setFontSans?: (f: string) => void;
  fontMono?: string;
  setFontMono?: (f: string) => void;
  terminalFontSize?: number;
  setTerminalFontSize?: (s: number) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  show,
  onClose,
  token,
  workspacesCount,
  showAlert,
  appVersion,
  updateAvailable,
  latestVersion,
  theme = 'default',
  setTheme = () => {},
  accentColor = '#a855f7',
  setAccentColor = () => {},
  fontSans = 'Outfit',
  setFontSans = () => {},
  fontMono = 'JetBrains Mono',
  setFontMono = () => {},
  terminalFontSize = 12,
  setTerminalFontSize = () => {}
}) => {
  const [activeTab, setActiveTab] = React.useState<'general' | 'appearance' | 'security' | 'connections'>('general');
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  // Update check state
  type UpdateCheckStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error' | 'dev';
  const [updateCheckStatus, setUpdateCheckStatus] = React.useState<UpdateCheckStatus>('idle');
  const [updateCheckVersion, setUpdateCheckVersion] = React.useState<string | null>(null);
  const [updateCheckPercent, setUpdateCheckPercent] = React.useState<number>(0);
  const [updateCheckError, setUpdateCheckError] = React.useState<string | null>(null);

  const isElectron = typeof window !== 'undefined' && !!(window as any).electron;

  // Listen to global update-status events from main process
  React.useEffect(() => {
    if (!isElectron) return;
    const electron = (window as any).electron;
    if (typeof electron.onUpdateStatus !== 'function') return;
    const unlisten = electron.onUpdateStatus((payload: any) => {
      if (payload.status === 'checking')   setUpdateCheckStatus('checking');
      if (payload.status === 'available')  { setUpdateCheckStatus('available');  setUpdateCheckVersion(payload.version ?? null); }
      if (payload.status === 'downloading'){ setUpdateCheckStatus('downloading'); setUpdateCheckPercent(payload.percent ?? 0); setUpdateCheckVersion(payload.version ?? null); }
      if (payload.status === 'ready')      { setUpdateCheckStatus('ready');       setUpdateCheckVersion(payload.version ?? null); }
      if (payload.status === 'not-available') setUpdateCheckStatus('up-to-date');
      if (payload.status === 'error')      { setUpdateCheckStatus('error');       setUpdateCheckError(payload.message ?? 'Unknown error'); }
    });
    return unlisten;
  }, [isElectron]);

  const handleCheckForUpdates = React.useCallback(async () => {
    if (!isElectron) return;
    setUpdateCheckStatus('checking');
    setUpdateCheckError(null);
    setUpdateCheckVersion(null);
    const result = await (window as any).electron.checkForUpdates();
    if (result?.status === 'dev') setUpdateCheckStatus('dev');
  }, [isElectron]);

  const handleInstallUpdate = React.useCallback(() => {
    if (!isElectron) return;
    (window as any).electron.installUpdate();
  }, [isElectron]);

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
      
      // Auto-refresh logs if Connections tab is open
      if (activeTab === 'connections') {
        const interval = setInterval(() => {
          fetchConnections();
        }, 5000);
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
            className={`sidebar-panel-tab ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
            style={{ padding: '12px' }}
          >
            <Palette size={14} />
            <span>Appearance</span>
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
                  {updateAvailable ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>v{appVersion}</span>
                      <a
                        href="https://github.com/RudyCity/t-line/releases"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: '0.75rem', color: '#f59e0b', textDecoration: 'none', fontWeight: 'bold' }}
                        title={`Click to download v${latestVersion}`}
                      >
                        (Update: v{latestVersion})
                      </a>
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>v{appVersion || '1.3.73'}</span>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active Workspaces</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-main)', fontFamily: 'var(--font-mono)' }}>{workspacesCount}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Backend Connection</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', fontWeight: 'bold' }}>Active</span>
                </div>

              {/* Software Update Row */}
              {isElectron && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Software Update</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {/* Status badge */}
                    {updateCheckStatus === 'checking' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#94a3b8' }}>
                        <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} />
                        Checking…
                      </span>
                    )}
                    {updateCheckStatus === 'up-to-date' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#34d399' }}>
                        <CheckCircle size={12} />
                        Up to date
                      </span>
                    )}
                    {updateCheckStatus === 'available' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#a855f7' }}>
                        <ArrowUpCircle size={12} />
                        {updateCheckVersion ? `v${updateCheckVersion} available` : 'Available'}
                      </span>
                    )}
                    {updateCheckStatus === 'downloading' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#60a5fa' }}>
                        <Download size={12} />
                        Downloading… {updateCheckPercent}%
                      </span>
                    )}
                    {updateCheckStatus === 'ready' && (
                      <button
                        id="settings-install-update-btn"
                        type="button"
                        onClick={handleInstallUpdate}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          fontSize: '0.75rem', fontWeight: 600,
                          padding: '3px 10px', borderRadius: '6px',
                          background: 'rgba(168, 85, 247, 0.2)',
                          border: '1px solid rgba(168, 85, 247, 0.4)',
                          color: '#c084fc', cursor: 'pointer'
                        }}
                      >
                        <RefreshCw size={11} />
                        Restart &amp; Install{updateCheckVersion ? ` v${updateCheckVersion}` : ''}
                      </button>
                    )}
                    {updateCheckStatus === 'error' && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#f87171' }} title={updateCheckError ?? ''}>
                        <XCircle size={12} />
                        Failed
                      </span>
                    )}
                    {updateCheckStatus === 'dev' && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Dev mode</span>
                    )}
                    {/* Check button — shown except while checking or downloading */}
                    {updateCheckStatus !== 'checking' && updateCheckStatus !== 'downloading' && updateCheckStatus !== 'ready' && (
                      <button
                        id="settings-check-update-btn"
                        type="button"
                        onClick={handleCheckForUpdates}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '4px',
                          fontSize: '0.75rem', fontWeight: 500,
                          padding: '3px 10px', borderRadius: '6px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          color: '#94a3b8', cursor: 'pointer'
                        }}
                      >
                        <RefreshCw size={11} />
                        Check
                      </button>
                    )}
                  </div>
                </div>
              )}

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

          {activeTab === 'appearance' && (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                
                {/* Theme Selector */}
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                    Theme Preset
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
                    {Object.entries(THEMES).map(([key, preset]) => {
                      const isSelected = theme === key;
                      return (
                        <div
                          key={key}
                          onClick={() => setTheme(key)}
                          style={{
                            padding: '8px 10px',
                            borderRadius: '8px',
                            background: isSelected ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                            border: isSelected ? '1.5px solid var(--color-primary)' : '1.5px solid var(--border-color)',
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected ? '0 0 8px var(--color-primary-glow)' : 'none'
                          }}
                        >
                          <span style={{ fontSize: '0.75rem', fontWeight: isSelected ? 600 : 400, color: isSelected ? 'var(--text-main)' : 'var(--text-muted)' }}>
                            {preset.name}
                          </span>
                          <div style={{ display: 'flex', gap: '3px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: preset.bgMain, border: '1px solid rgba(255,255,255,0.1)' }} />
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: preset.bgSidebar, border: '1px solid rgba(255,255,255,0.1)' }} />
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: preset.defaultAccent, border: '1px solid rgba(255,255,255,0.1)' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Accent Color Selector */}
                <div>
                  <h4 style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '8px' }}>
                    Primary Accent Color
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {[
                      { name: 'Violet', value: '#a855f7' },
                      { name: 'Blue', value: '#3b82f6' },
                      { name: 'Emerald', value: '#10b981' },
                      { name: 'Amber', value: '#f59e0b' },
                      { name: 'Rose', value: '#ef4444' },
                      { name: 'Cyan', value: '#06b6d4' },
                      { name: 'Indigo', value: '#6366f1' },
                    ].map(preset => {
                      const isSelected = accentColor.toLowerCase() === preset.value.toLowerCase();
                      return (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => setAccentColor(preset.value)}
                          style={{
                            width: '22px',
                            height: '22px',
                            borderRadius: '50%',
                            background: preset.value,
                            border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)',
                            cursor: 'pointer',
                            padding: 0,
                            boxShadow: isSelected ? `0 0 6px ${preset.value}` : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'transform 0.1s ease',
                            transform: isSelected ? 'scale(1.1)' : 'none',
                          }}
                          title={preset.name}
                        >
                          {isSelected && (
                            <span style={{ color: '#ffffff', fontSize: '9px', fontWeight: 'bold' }}>✓</span>
                          )}
                        </button>
                      );
                    })}
                    
                    {/* Custom Color Input */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '4px' }}>
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        style={{
                          width: '22px',
                          height: '22px',
                          padding: 0,
                          border: 'none',
                          borderRadius: '50%',
                          background: 'none',
                          cursor: 'pointer'
                        }}
                        title="Custom Color"
                      />
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {accentColor.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Fonts Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
                  <FormField label="UI Font Family" className="mb-0">
                    <Select
                      value={fontSans}
                      onChange={(val) => setFontSans(val)}
                      options={Object.keys(UI_FONTS).map(f => ({ value: f, label: f }))}
                      searchable={true}
                    />
                  </FormField>
                  <FormField label="Terminal Font Family" className="mb-0">
                    <Select
                      value={fontMono}
                      onChange={(val) => setFontMono(val)}
                      options={Object.keys(MONO_FONTS).map(f => ({ value: f, label: f }))}
                      searchable={true}
                    />
                  </FormField>
                </div>

                {/* Terminal Font Size Slider */}
                <FormField label={`Terminal Font Size (${terminalFontSize}px)`} className="mb-0">
                  <input
                    type="range"
                    min="8"
                    max="24"
                    value={terminalFontSize}
                    onChange={(e) => setTerminalFontSize(Number(e.target.value))}
                    style={{
                      width: '100%',
                      accentColor: 'var(--color-primary)',
                      cursor: 'pointer'
                    }}
                  />
                </FormField>

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
