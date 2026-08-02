import React, { useState, useRef, useEffect } from 'react';
import { Plus, Terminal as TerminalIcon, ChevronDown, Check, Wrench } from 'lucide-react';
import {
  SHELL_OPTIONS,
  ShellMeta,
  getShellMeta,
  buildCustomShell,
  customShellPath,
  isCustomShell
} from '../utils/shellUtils';

export interface NewTerminalButtonProps {
  defaultShell?: string;
  setDefaultShell?: (val: string) => void;
  cwd?: string;
  /** Map of shell availability (e.g. { wsl: false }). Overrides defaults. */
  shellAvailability?: Record<string, boolean>;
  /** Recently used shell values, most recent first. */
  recentShells?: string[];
  onOpenTerminal: (name: string, cwd: string, shellType?: string, initialCommand?: string) => void;
}

const RECENT_KEY = 'tline-recent-shells';

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function pushRecent(value: string): string[] {
  const cur = loadRecent().filter((v) => v !== value);
  const next = [value, ...cur].slice(0, 6);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {}
  return next;
}

export const NewTerminalButton: React.FC<NewTerminalButtonProps> = ({
  defaultShell = 'powershell',
  setDefaultShell,
  cwd = '',
  shellAvailability,
  recentShells,
  onOpenTerminal
}) => {
  const [open, setOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customPath, setCustomPath] = useState('');
  const [command, setCommand] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCustom(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const isAvailable = (opt: ShellMeta): boolean => {
    if (shellAvailability && opt.value in shellAvailability) return !!shellAvailability[opt.value];
    return opt.available !== false;
  };

  const doOpen = (shell: string) => {
    pushRecent(shell);
    onOpenTerminal('Shell', cwd, shell, command || undefined);
    if (setDefaultShell) setDefaultShell(shell);
    setOpen(false);
    setCommand('');
    setShowCustom(false);
  };

  const handleCustom = () => {
    const p = customPath.trim();
    if (!p) return;
    doOpen(buildCustomShell(p));
    setCustomPath('');
  };

  // Recent shells to surface on top (deduped against canonical options).
  const recents = (recentShells || loadRecent())
    .filter((v) => v && !SHELL_OPTIONS.some((o) => o.value === v))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 4);

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
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); setShowCustom(false); }}
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
            minWidth: '200px', padding: '4px', borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)'
          }}
        >
          <div style={{ padding: '4px 8px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
            New Terminal
          </div>

          {/* Inline command (item 8) */}
          <input
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Initial command (optional)"
            className="custom-shell-input"
            style={{
              width: 'calc(100% - 8px)', margin: '2px 4px 4px', padding: '4px 6px',
              fontSize: '11px', background: 'var(--bg-card)', color: 'var(--text-main)',
              border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none'
            }}
          />

          {/* Recent shells (item 7) */}
          {recents.length > 0 && (
            <>
              <div style={{ padding: '2px 8px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', opacity: 0.7, fontWeight: 600 }}>
                Recent
              </div>
              {recents.map((rec) => {
                const meta = getShellMeta(rec);
                return (
                  <MenuItem key={`rec-${rec}`} label={isCustomShell(rec) ? `Custom: ${customShellPath(rec)}` : meta.label} color={meta.color} onClick={() => doOpen(rec)} />
                );
              })}
            </>
          )}

          {SHELL_OPTIONS.map((opt) => {
            const avail = isAvailable(opt);
            return (
              <MenuItem
                key={opt.value}
                label={opt.label}
                color={opt.color}
                shortcut={opt.shortcut}
                disabled={!avail}
                selected={opt.value === defaultShell}
                onClick={() => avail && doOpen(opt.value)}
              />
            );
          })}

          {/* Custom shell path (item 5) */}
          {showCustom ? (
            <div style={{ display: 'flex', gap: '4px', padding: '4px' }}>
              <input
                value={customPath}
                onChange={(e) => setCustomPath(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCustom(); }}
                placeholder="C:\\path\\to\\shell.exe"
                autoFocus
                style={{
                  flex: 1, padding: '4px 6px', fontSize: '11px',
                  background: 'var(--bg-card)', color: 'var(--text-main)',
                  border: '1px solid var(--border-color)', borderRadius: '6px', outline: 'none'
                }}
              />
              <button onClick={handleCustom} className="action-btn" title="Open" style={{ padding: '4px 6px' }}>
                <Plus size={12} />
              </button>
            </div>
          ) : (
            <button
              className="menu-item"
              onClick={() => setShowCustom(true)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '6px 8px', borderRadius: '6px', textAlign: 'left',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '12px', color: 'var(--text-muted)'
              }}
            >
              <Wrench size={13} />
              <span>Custom shell path...</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const MenuItem: React.FC<{
  label: string;
  color: string;
  shortcut?: string;
  disabled?: boolean;
  selected?: boolean;
  onClick: () => void;
}> = ({ label, color, shortcut, disabled, selected, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="menu-item"
    style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
      padding: '6px 8px', borderRadius: '6px', textAlign: 'left',
      background: 'transparent', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '12px', color: disabled ? 'var(--text-muted)' : 'var(--text-main)', opacity: disabled ? 0.5 : 1
    }}
    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)'; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
  >
    <TerminalIcon size={13} style={{ color }} />
    <span style={{ flex: 1 }}>{label}</span>
    {shortcut && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{shortcut}</span>}
    {selected && <Check size={12} className="text-[var(--color-primary)]" />}
  </button>
);
