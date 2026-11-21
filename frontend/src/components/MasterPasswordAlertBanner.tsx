import React, { useState, useEffect } from 'react';
import { ShieldAlert, ArrowRight, X } from 'lucide-react';

export interface MasterPasswordAlertBannerProps {
  configured: boolean;
  onOpenSecuritySettings: () => void;
}

export const MasterPasswordAlertBanner: React.FC<MasterPasswordAlertBannerProps> = ({
  configured,
  onOpenSecuritySettings,
}) => {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('tline-dismiss-master-pw-alert') === 'true';
    } catch {
      return false;
    }
  });

  // If password becomes configured, reset dismissed state for future changes
  useEffect(() => {
    if (configured) {
      try {
        sessionStorage.removeItem('tline-dismiss-master-pw-alert');
      } catch {}
      setDismissed(false);
    }
  }, [configured]);

  if (configured || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem('tline-dismiss-master-pw-alert', 'true');
    } catch {}
  };

  return (
    <aside
      aria-label="Peringatan keamanan master password"
      className="relative z-40 flex items-center justify-between gap-3 border-b border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs text-[var(--text-main)]"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <ShieldAlert size={16} className="text-amber-500 shrink-0" aria-hidden="true" />
        <p className="truncate">
          <span className="font-semibold text-amber-400 mr-1.5">Master password belum dipasang:</span>
          <span className="text-[var(--text-muted)]">
            Akses lokal desktop aktif, namun akses remote/tunnel belum terlindungi.
          </span>
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenSecuritySettings}
          className="inline-flex items-center gap-1.5 rounded border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/60 transition-colors focus:outline-none focus:ring-1 focus:ring-amber-400"
        >
          <span>Pasang Password</span>
          <ArrowRight size={12} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          title="Tutup pemberitahuan"
          aria-label="Tutup pemberitahuan master password"
          className="rounded p-1 text-slate-400 hover:text-slate-200 hover:bg-amber-500/15 transition-colors focus:outline-none"
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
};
