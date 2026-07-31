import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface SessionIdBadgeProps {
  sessionId: string;
}

export const SessionIdBadge: React.FC<SessionIdBadgeProps> = ({ sessionId }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sessionId);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = sessionId;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center py-1.5 gap-1.5 text-[10px] font-mono text-[var(--text-muted)]/50 select-none">
      <span className="tracking-wider truncate max-w-[200px]" title={sessionId}>
        {sessionId}
      </span>
      <button
        onClick={handleCopy}
        className="hover:text-[var(--color-primary)] transition-colors shrink-0"
        title="Copy session ID"
      >
        {copied ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Copy className="w-3 h-3" />
        )}
      </button>
    </div>
  );
};

export default SessionIdBadge;