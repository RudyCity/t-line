/**
 * Normalize a user-selected shell identifier into the canonical shellType
 * keys expected by backend/src/terminalManager.ts createTerminal() switch:
 *   'powershell' | 'cmd' | 'gitbash' | 'wsl'
 *
 * Workspace configs and some UI selectors historically saved 'bash' (Git Bash)
 * which the backend switch never handled — an unknown value fell through to
 * the 'default' case (PowerShell). This produces the bug where changing the
 * default shell away from PowerShell does nothing / terminals run PowerShell.
 */
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
  'pwsh': 'powershell',
};

export function normalizeShellType(raw?: string | null): string {
  if (!raw) return 'powershell';
  const key = raw.trim().toLowerCase();
  return ALIASES[key] ?? key;
}
