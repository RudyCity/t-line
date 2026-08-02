import React, { useState, useRef, useEffect } from 'react';
import { Plus, Terminal as TerminalIcon, ChevronDown, Check } from 'lucide-react';

export interface NewTerminalButtonProps {
  defaultShell?: string;
  setDefaultShell?: (val: string) => void;
  cwd?: string;
  onOpenTerminal: (name: string, cwd: string, shellType?: string) => void;
}

const SHELL_OPTIONS = [
  { value: 'powershell', label: 'PowerShell' },
  { value: 'cmd', label: 'Command Prompt' },
  { value: 'gitbash', label: 'Git Bash' },
  { value: 'wsl', label: 'WSL' }
];

export const NewTerminalButton: React.FC<NewTerminalButtonProps> = ({
  defaultShell = 'powershell',
  setDefaultShell,
  cwd = '',
  onOpenTerminal
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const handleClick = (shell: string) => {
    onOpenTerminal('Shell', cwd, shell);
    if (setDefaultShell) setDefaultShell(shell);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative inline-flex shrink-0" style={{ marginLeft: '6px' }}>
      {/* Main "+" button opens terminal with current default */}
      <button
        className="action-btn shrink-0"
        onClick={() => onOpenTerminal('Shell', cwd, defaultShell)}
        title="New terminal (Alt+T)"
        style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
      >
        <Plus size={14} />
      </button>
      {/* Dropdown caret to pick a shell */}
      <button
        className="action-btn shrink-0"
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        title="Pick terminal shell"
        style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, padding: '0 4px' }}
      >
        <ChevronDown size={12} />
      </button>

      {open && (
        <div
          className="glass-panel"
          style={{
            position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 1000,
            minWidth: '170px', padding: '4px', borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
          }}
        >
          <div style={{ padding: '4px 8px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
            New Terminal
          </div>
          {SHELL_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleClick(opt.value)}
              className="menu-item"
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 8px', borderRadius: '6px', textAlign: 'left',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '12px', color: 'var(--text-main)'
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >
              <TerminalIcon size={13} className="text-[var(--text-muted)]" />
              <span style={{ flex: 1 }}>{opt.label}</span>
              {opt.value === defaultShell && <Check size={12} className="text-[var(--color-primary)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
