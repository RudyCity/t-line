import { useState, useEffect } from 'react';
import { Info, Copy, Check, X } from 'lucide-react';

interface ToastItem {
  id: string;
  message: string;
}

export function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const handleToast = (event: Event) => {
      const customEvent = event as CustomEvent<{ message: string }>;
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = {
        id,
        message: customEvent.detail.message || 'Session Re-attached'
      };
      setToasts(prev => {
        const next = [...prev, newToast];
        return next.slice(-3);
      });

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    };

    window.addEventListener('tline-toast', handleToast);
    return () => {
      window.removeEventListener('tline-toast', handleToast);
    };
  }, []);

  const handleCopy = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch (err) {
      console.error('Failed to copy toast text:', err);
    }
  };

  const handleDismiss = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map(toast => {
        const isCopied = copiedId === toast.id;
        return (
          <div key={toast.id} className="toast-item group">
            <Info size={14} className="shrink-0" style={{ color: 'var(--color-primary)' }} />
            <span className="flex-1 font-medium">{toast.message}</span>
            <div className="flex items-center gap-1 ml-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => handleCopy(toast.id, toast.message)}
                title={isCopied ? 'Tersalin' : 'Salin pesan'}
                className="p-1 rounded hover:bg-white/10 active:scale-95 transition-all text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                {isCopied ? (
                  <Check size={11} className="text-emerald-400" />
                ) : (
                  <Copy size={11} />
                )}
              </button>
              <button
                type="button"
                onClick={() => handleDismiss(toast.id)}
                title="Tutup"
                className="p-1 rounded hover:bg-white/10 active:scale-95 transition-all text-[var(--text-muted)] hover:text-red-400 cursor-pointer"
              >
                <X size={11} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
