import React, { useState } from 'react';
import { Eye, Monitor, X, Image as ImageIcon } from 'lucide-react';

interface VisualArtifactViewerProps {
  screenshotUrl?: string | null;
  browserStatus?: string | null;
}

export const VisualArtifactViewer: React.FC<VisualArtifactViewerProps> = ({ screenshotUrl, browserStatus }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!screenshotUrl && !browserStatus) return null;

  return (
    <>
      <div className="p-2.5 bg-[var(--r-ui-color-surface)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-md)] flex items-center justify-between text-xs">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-emerald-400" />
          <span className="text-[var(--r-ui-color-text-secondary)] font-medium">Browser Automation Artifact</span>
          {browserStatus && (
            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono">
              {browserStatus}
            </span>
          )}
        </div>

        {screenshotUrl && (
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-md transition-colors text-[11px]"
          >
            <Eye className="w-3.5 h-3.5" /> Preview Screenshot
          </button>
        )}
      </div>

      {isOpen && screenshotUrl && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[var(--r-ui-color-surface)] border border-[var(--r-ui-color-border-standard)] rounded-[var(--r-ui-radius-lg)] shadow-[var(--r-ui-shadow-lg)] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-[var(--r-ui-color-border-subtle)] bg-[var(--r-ui-color-canvas)]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--r-ui-color-text-primary)]">
                <ImageIcon className="w-4 h-4 text-emerald-400" />
                Browser Screenshot Preview
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-[var(--r-ui-color-text-secondary)] hover:text-[var(--r-ui-color-text-primary)] hover:bg-[var(--r-ui-color-surface-elevated)] rounded-[var(--r-ui-radius-sm)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-[var(--r-ui-color-canvas)]/50">
              <img src={screenshotUrl} alt="Browser screenshot" className="max-w-full h-auto rounded-[var(--r-ui-radius-md)] border border-[var(--r-ui-color-border-subtle)]" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
