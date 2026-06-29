import React, { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, CheckCircle, XCircle, Loader2, ArrowUpCircle, X } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'ready'
  | 'error';

interface UpdateState {
  status: UpdateStatus;
  version?: string;
  percent?: number;
  bytesPerSecond?: number;
  transferred?: number;
  total?: number;
  message?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UpdateNotification() {
  const [state, setState] = useState<UpdateState>({ status: 'idle' });
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isElectron = typeof window !== 'undefined' && !!(window as any).electron;

  useEffect(() => {
    if (!isElectron) return;
    const electron = (window as any).electron;
    if (typeof electron.onUpdateStatus !== 'function') return;

    const unlisten = electron.onUpdateStatus((payload: any) => {
      setState(payload as UpdateState);

      // Show notification for meaningful states only
      if (['available', 'downloading', 'ready', 'error'].includes(payload.status)) {
        setVisible(true);
        setDismissed(false);
      }
      // Hide for non-available / checking (silent)
      if (payload.status === 'not-available') {
        setVisible(false);
      }
    });

    return unlisten;
  }, [isElectron]);

  const handleInstall = useCallback(() => {
    if (!isElectron) return;
    (window as any).electron.installUpdate();
  }, [isElectron]);

  const handleCheckNow = useCallback(async () => {
    if (!isElectron) return;
    setState({ status: 'checking' });
    setVisible(true);
    await (window as any).electron.checkForUpdates();
  }, [isElectron]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setVisible(false);
  }, []);

  if (!isElectron || !visible || dismissed) return null;

  // ─── Status Configs ───────────────────────────────────────────────────────

  const renderContent = () => {
    switch (state.status) {
      case 'checking':
        return (
          <div className="update-notification-row">
            <Loader2 size={16} className="update-icon update-icon--spin" />
            <span className="update-text">Checking for updates…</span>
          </div>
        );

      case 'available':
        return (
          <div className="update-notification-row">
            <ArrowUpCircle size={16} className="update-icon update-icon--purple" />
            <div className="update-info">
              <span className="update-title">Update available</span>
              {state.version && (
                <span className="update-version">v{state.version}</span>
              )}
            </div>
            <span className="update-badge">Downloading…</span>
          </div>
        );

      case 'downloading':
        return (
          <div className="update-notification-col">
            <div className="update-notification-row">
              <Download size={16} className="update-icon update-icon--blue" />
              <div className="update-info">
                <span className="update-title">Downloading update</span>
                {state.version && <span className="update-version">v{state.version}</span>}
              </div>
              <span className="update-percent">{state.percent ?? 0}%</span>
            </div>
            <div className="update-progress-bar-track">
              <div
                className="update-progress-bar-fill"
                style={{ width: `${state.percent ?? 0}%` }}
              />
            </div>
            {state.bytesPerSecond && state.total && (
              <span className="update-speed">
                {formatBytes(state.bytesPerSecond)}/s · {formatBytes(state.transferred ?? 0)} / {formatBytes(state.total)}
              </span>
            )}
          </div>
        );

      case 'ready':
        return (
          <div className="update-notification-row">
            <CheckCircle size={16} className="update-icon update-icon--green" />
            <div className="update-info">
              <span className="update-title">Ready to install</span>
              {state.version && <span className="update-version">v{state.version}</span>}
            </div>
            <button
              id="update-install-btn"
              className="update-btn update-btn--primary"
              onClick={handleInstall}
            >
              <RefreshCw size={12} />
              Restart &amp; Install
            </button>
          </div>
        );

      case 'error':
        return (
          <div className="update-notification-row">
            <XCircle size={16} className="update-icon update-icon--red" />
            <div className="update-info">
              <span className="update-title">Update failed</span>
              <span className="update-version update-version--error">{state.message}</span>
            </div>
            <button
              id="update-retry-btn"
              className="update-btn update-btn--ghost"
              onClick={handleCheckNow}
            >
              Retry
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const content = renderContent();
  if (!content) return null;

  return (
    <div className="update-notification" role="status" aria-live="polite">
      {content}
      {state.status !== 'downloading' && (
        <button
          className="update-dismiss-btn"
          onClick={handleDismiss}
          title="Dismiss"
          aria-label="Dismiss update notification"
        >
          <X size={12} />
        </button>
      )}
    </div>
  );
}
