import { Terminal, ITheme } from '@xterm/xterm';
import { ActiveProcessSummary } from '../hooks/useTerminals';

export interface TerminalTab {
  id: string;
  name: string;
  cwd: string;
  shellType: string;
  initialCommand?: string;
}

export interface TerminalInstanceProps {
  tab: TerminalTab;
  active: boolean;
  wsConnected: boolean;
  fontSize: number;
  onTitleChange?: (title: string) => void;
  onActiveProcessesChange?: (processes: ActiveProcessSummary[]) => void;
  onFocus?: () => void;
  refreshTrigger?: number;
  isFocusedPane?: boolean;
  pid?: number;
  fontFamily?: string;
  fontWeight?: string;
  accentColor?: string;
  themeBackground?: string;
  themeForeground?: string;
  disableAutoFocus?: boolean;
  onClearInitialCommand?: (terminalId: string) => void;
}

// Helper to detect if a background color is light/bright
export function isLightColor(color: string | undefined): boolean {
  if (!color) return false;
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
    } else if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return (r * 299 + g * 587 + b * 114) / 1000 >= 128;
    }
  }
  return false;
}

export const isMobileDevice = typeof window !== 'undefined' && (
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
  window.innerWidth <= 768 || 
  'ontouchstart' in window
);

export const isRemoteConnection = () => {
  if (typeof window === 'undefined') return false;
  const protocol = window.location.protocol;
  const host = window.location.hostname;
  if (protocol === 'file:' || !host || window.navigator.userAgent.includes('Electron')) {
    return false;
  }
  return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
};

export const isPromptReady = (term: Terminal) => {
  try {
    const activeBuf = term.buffer.active;
    const cursorY = activeBuf.cursorY;
    for (let y = cursorY; y >= Math.max(0, cursorY - 1); y--) {
      const line = activeBuf.getLine(y);
      if (!line) continue;
      const text = line.translateToString(true).trim();
      if (text.endsWith('>') || text.endsWith('$') || text.endsWith('%') || text.endsWith('#')) {
        return true;
      }
    }
  } catch (e) {
    console.error('Error checking prompt readiness:', e);
  }
  return false;
};

export function getActualFontSize(fontSize: number): number {
  const isMobileOrTablet = typeof window !== 'undefined' && (
    window.innerWidth <= 1024 || 
    ('ontouchstart' in window && window.innerWidth < 1280)
  );
  if (isMobileOrTablet && typeof window !== 'undefined') {
    const mobileSavedFont = localStorage.getItem('tline-mobile-font-size');
    return mobileSavedFont ? parseInt(mobileSavedFont, 10) : 9;
  }
  return fontSize;
}

export function getTerminalTheme(
  themeBackground?: string,
  themeForeground?: string,
  accentColor?: string
): ITheme {
  const isLight = isLightColor(themeBackground);
  return {
    background: themeBackground || '#000000',
    foreground: themeForeground || '#f8fafc',
    cursor: accentColor || '#6366f1',
    cursorAccent: themeBackground || '#000000',
    selectionBackground: isLight
      ? (accentColor ? `color-mix(in srgb, ${accentColor} 40%, #000000)` : '#334155')
      : (accentColor ? `color-mix(in srgb, ${accentColor} 30%, transparent)` : 'rgba(99, 102, 241, 0.3)'),
    selectionForeground: '#ffffff',
    selectionInactiveBackground: isLight
      ? (accentColor ? `color-mix(in srgb, ${accentColor} 20%, #000000)` : '#475569')
      : (accentColor ? `color-mix(in srgb, ${accentColor} 15%, transparent)` : 'rgba(99, 102, 241, 0.15)'),
    black: isLight ? '#0f172a' : '#4a5568',
    red: '#ef4444',
    green: isLight ? '#15803d' : '#10b981',
    yellow: isLight ? '#b45309' : '#f59e0b',
    blue: isLight ? '#1d4ed8' : '#3b82f6',
    magenta: isLight ? '#7e22ce' : '#6366f1',
    cyan: isLight ? '#0369a1' : '#06b6d4',
    white: isLight ? '#0f172a' : '#cbd5e1',
    brightBlack: isLight ? '#475569' : '#718096',
    brightRed: '#f87171',
    brightGreen: isLight ? '#166534' : '#34d399',
    brightYellow: isLight ? '#d97706' : '#fbbf24',
    brightBlue: isLight ? '#1e40af' : '#60a5fa',
    brightMagenta: isLight ? '#6b21a8' : '#818cf8',
    brightCyan: isLight ? '#075985' : '#22d3ee',
    brightWhite: isLight ? '#0f172a' : '#f1f5f9',
  };
}

export function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text)
      .then(() => true)
      .catch((err) => {
        console.error('Clipboard API failed, trying fallback:', err);
        return fallbackCopyText(text);
      });
  } else {
    return Promise.resolve(fallbackCopyText(text));
  }
}

function fallbackCopyText(text: string): boolean {
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback copy failed:', err);
    return false;
  }
}
