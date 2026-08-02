/**
 * Shell helpers for the t-line terminal UI.
 *
 * Canonical shellType keys expected by backend/src/terminalManager.ts
 * createTerminal() switch: 'powershell' | 'cmd' | 'gitbash' | 'wsl'
 * plus a custom path variant: 'custom:<absolute-path>'.
 */

export interface ShellMeta {
  value: string;
  label: string;
  /** Short badge label shown on terminal tabs. */
  short: string;
  /** Accent color for the tab badge. */
  color: string;
  /** Keyboard shortcut (e.g. "Ctrl+Shift+1"). */
  shortcut?: string;
  /** Whether the shell is available on the host (WSL may be absent). */
  available?: boolean;
}

export const SHELL_OPTIONS: ShellMeta[] = [
  { value: 'powershell', label: 'PowerShell', short: 'PS', color: '#0366d6', shortcut: 'Ctrl+Shift+1', available: true },
  { value: 'cmd', label: 'Command Prompt', short: 'CMD', color: '#a0a0a0', shortcut: 'Ctrl+Shift+2', available: true },
  { value: 'gitbash', label: 'Git Bash', short: 'Git', color: '#f14e32', shortcut: 'Ctrl+Shift+3', available: true },
  { value: 'wsl', label: 'WSL', short: 'WSL', color: '#4b8bbe', shortcut: 'Ctrl+Shift+4', available: true }
];

export function getShellMeta(value: string): ShellMeta {
  const v = normalizeShellType(value);
  const found = SHELL_OPTIONS.find((o) => o.value === v);
  if (found) return found;
  // Custom path → generic badge
  return { value, label: v, short: v.length > 8 ? v.slice(0, 8) : v, color: '#8b5cf6' };
}

/** Map a keyboard digit 1-4 to the canonical shell. */
export function shellForDigit(digit: number): string | null {
  const idx = digit - 1;
  if (idx >= 0 && idx < SHELL_OPTIONS.length) return SHELL_OPTIONS[idx].value;
  return null;
}

export function isCustomShell(shell?: string | null): boolean {
  if (!shell) return false;
  return shell.toLowerCase().startsWith('custom:') || !SHELL_OPTIONS.some((o) => o.value === shell.toLowerCase());
}

export function customShellPath(shell: string): string {
  return shell.replace(/^custom:/i, '');
}

export function buildCustomShell(path: string): string {
  return `custom:${path}`;
}

const ALIASES: Record<string, string> = {
  'bash': 'gitbash',
  'bash.exe': 'gitbash',
  '/bin/bash': 'gitbash',
  'git-bash': 'gitbash',
  'git bash': 'gitbash',
  'sh': 'gitbash',
  'shell': 'gitbash',
  'win-bash': 'gitbash',
  'ps': 'powershell',
  'powershell.exe': 'powershell',
  'cmd.exe': 'cmd',
  'pwsh': 'powershell'
};

export function normalizeShellType(raw?: string | null): string {
  if (!raw) return 'powershell';
  if (raw.toLowerCase().startsWith('custom:')) return raw;
  const key = raw.trim().toLowerCase();
  return ALIASES[key] ?? key;
}

const OVERRIDES_KEY = 'tline-workspace-shell-overrides';

/** Returns a per-workspace shell override keyed by workspace path, or empty string. */
export function getWorkspaceShell(path?: string | null): string {
  if (!path) return '';
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    if (!raw) return '';
    const map = JSON.parse(raw);
    return map[path] || '';
  } catch {
    return '';
  }
}

/** Persist a per-workspace shell override keyed by workspace path. */
export function setWorkspaceShell(path: string | null | undefined, shell: string): void {
  if (!path) return;
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[path] = shell;
    localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map));
  } catch {}
}
