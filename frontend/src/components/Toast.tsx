import { useState, useEffect } from 'react';
import { Info } from 'lucide-react';

interface ToastItem {
  id: string;
  message: string;
}

export function Toast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

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
        return next.slice(-2);
      });

      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3000);
    };

    window.addEventListener('tline-toast', handleToast);
    return () => {
      window.removeEventListener('tline-toast', handleToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <div key={toast.id} className="toast-item">
          <Info size={13} className="shrink-0 animate-pulse" style={{ color: 'var(--accent-color)' }} />
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
