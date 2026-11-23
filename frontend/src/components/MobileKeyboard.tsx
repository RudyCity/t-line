import React, { useState } from 'react';

export interface MobileKeyboardProps {
  onKeyInput: (data: string) => void;
  onClose?: () => void;
}

export function MobileKeyboard({ onKeyInput, onClose }: MobileKeyboardProps): React.JSX.Element {
  const [isSymbolMode, setIsSymbolMode] = useState(false);
  const [isShiftActive, setIsShiftActive] = useState(false);
  const [isCtrlActive, setIsCtrlActive] = useState(false);
  const [isAltActive, setIsAltActive] = useState(false);

  const handleCharPress = (char: string) => {
    let result = '';

    if (isCtrlActive) {
      // Map Ctrl+A to Ctrl+Z -> \x01 to \x1a
      const code = char.toLowerCase().charCodeAt(0) - 96;
      if (code >= 1 && code <= 26) {
        result = String.fromCharCode(code);
      } else {
        result = char; // fallback
      }
      setIsCtrlActive(false);
    } else if (isAltActive) {
      // Prepend ESC code
      result = '\x1b' + (isShiftActive ? char.toUpperCase() : char.toLowerCase());
      setIsAltActive(false);
    } else {
      result = isShiftActive ? char.toUpperCase() : char.toLowerCase();
    }

    onKeyInput(result);
  };

  const handleSpecialPress = (key: string) => {
    switch (key) {
      case 'Esc':
        onKeyInput('\x1b');
        break;
      case 'Tab':
        onKeyInput('\t');
        break;
      case 'Enter':
        onKeyInput('\r');
        break;
      case 'Space':
        onKeyInput(' ');
        break;
      case 'Backspace':
        onKeyInput('\x7f');
        break;
      case 'Up':
        onKeyInput('\x1b[A');
        break;
      case 'Down':
        onKeyInput('\x1b[B');
        break;
      case 'Right':
        onKeyInput('\x1b[C');
        break;
      case 'Left':
        onKeyInput('\x1b[D');
        break;
      default:
        break;
    }
  };

  const letterRows = [
    ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
    ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
    ['z', 'x', 'c', 'v', 'b', 'n', 'm']
  ];

  const symbolRows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"'],
    ['.', ',', '?', '!', "'", '_', '|', '\\', '`']
  ];

  const rows = isSymbolMode ? symbolRows : letterRows;

  return (
    <div 
      className="mobile-keyboard border-t p-2 select-none z-45 flex flex-col gap-1.5 w-full shrink-0"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
        backgroundColor: 'color-mix(in srgb, var(--r-ui-color-surface, var(--bg-sidebar)) 95%, transparent)',
        borderTopColor: 'var(--r-ui-color-border-subtle)'
      }}
    >
      {/* Modifier Toolbar Row */}
      <div className="flex gap-1 justify-between w-full">
        <button
          onClick={() => handleSpecialPress('Esc')}
          className="flex-1 py-1.5 bg-[var(--r-ui-color-canvas)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-sm)] text-[11px] text-[var(--r-ui-color-text-secondary)] font-semibold cursor-pointer active:bg-[var(--r-ui-color-surface-elevated)]"
        >
          Esc
        </button>
        <button
          onClick={() => handleSpecialPress('Tab')}
          className="flex-1 py-1.5 bg-[var(--r-ui-color-canvas)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-sm)] text-[11px] text-[var(--r-ui-color-text-secondary)] font-semibold cursor-pointer active:bg-[var(--r-ui-color-surface-elevated)]"
        >
          Tab
        </button>
        <button
          onClick={() => setIsCtrlActive(v => !v)}
          className={`flex-1 py-1.5 border rounded-[var(--r-ui-radius-sm)] text-[11px] font-semibold cursor-pointer transition-all ${
            isCtrlActive
              ? 'bg-[var(--r-ui-color-accent-primary)] border-[var(--r-ui-color-accent-primary)] text-[var(--r-ui-color-text-inverse)]'
              : 'bg-[var(--r-ui-color-canvas)] border-[var(--r-ui-color-border-subtle)] text-[var(--r-ui-color-text-secondary)] active:bg-[var(--r-ui-color-surface-elevated)]'
          }`}
        >
          Ctrl
        </button>
        <button
          onClick={() => setIsAltActive(v => !v)}
          className={`flex-1 py-1.5 border rounded-[var(--r-ui-radius-sm)] text-[11px] font-semibold cursor-pointer transition-all ${
            isAltActive
              ? 'bg-[var(--r-ui-color-accent-primary)] border-[var(--r-ui-color-accent-primary)] text-[var(--r-ui-color-text-inverse)]'
              : 'bg-[var(--r-ui-color-canvas)] border-[var(--r-ui-color-border-subtle)] text-[var(--r-ui-color-text-secondary)] active:bg-[var(--r-ui-color-surface-elevated)]'
          }`}
        >
          Alt
        </button>

        {/* Arrow Keys Pad */}
        <div className="flex gap-1 items-center shrink-0 ml-2">
          <button
            onClick={() => handleSpecialPress('Left')}
            className="w-8 py-1.5 bg-[var(--r-ui-color-canvas)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-sm)] text-[11px] text-[var(--r-ui-color-text-secondary)] font-semibold cursor-pointer active:bg-[var(--r-ui-color-surface-elevated)] flex items-center justify-center"
          >
            ←
          </button>
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={() => handleSpecialPress('Up')}
              className="w-8 py-0.5 bg-[var(--r-ui-color-canvas)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-sm)] text-[10px] text-[var(--r-ui-color-text-secondary)] font-semibold cursor-pointer active:bg-[var(--r-ui-color-surface-elevated)] flex items-center justify-center"
              style={{ padding: '2px 0' }}
            >
              ↑
            </button>
            <button
              onClick={() => handleSpecialPress('Down')}
              className="w-8 py-0.5 bg-[var(--r-ui-color-canvas)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-sm)] text-[10px] text-[var(--r-ui-color-text-secondary)] font-semibold cursor-pointer active:bg-[var(--r-ui-color-surface-elevated)] flex items-center justify-center"
              style={{ padding: '2px 0' }}
            >
              ↓
            </button>
          </div>
          <button
            onClick={() => handleSpecialPress('Right')}
            className="w-8 py-1.5 bg-[var(--r-ui-color-canvas)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-sm)] text-[11px] text-[var(--r-ui-color-text-secondary)] font-semibold cursor-pointer active:bg-[var(--r-ui-color-surface-elevated)] flex items-center justify-center"
          >
            →
          </button>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-8 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-[var(--r-ui-radius-sm)] text-[11px] text-rose-400 font-bold cursor-pointer active:bg-rose-600 active:text-white flex items-center justify-center ml-1 shrink-0"
            title="Hide Keyboard"
          >
            ✕
          </button>
        )}
      </div>

      {/* Main Keys Rows */}
      <div className="flex flex-col gap-1.5 w-full">
        {/* Row 1 */}
        <div className="flex gap-1 justify-center w-full">
          {rows[0].map(k => (
            <button
              key={k}
              onClick={() => handleCharPress(k)}
              className="flex-1 py-2.5 bg-[var(--r-ui-color-surface)] hover:bg-[var(--r-ui-color-surface-elevated)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-sm)] text-[12px] text-[var(--r-ui-color-text-primary)] font-semibold cursor-pointer active:bg-[var(--r-ui-color-accent-subtle)] active:border-[var(--r-ui-color-accent-primary)]/50 flex items-center justify-center"
            >
              {isShiftActive ? k.toUpperCase() : k}
            </button>
          ))}
        </div>

        {/* Row 2 */}
        <div className="flex gap-1 justify-center w-full px-[5%]">
          {rows[1].map(k => (
            <button
              key={k}
              onClick={() => handleCharPress(k)}
              className="flex-1 py-2.5 bg-[var(--r-ui-color-surface)] hover:bg-[var(--r-ui-color-surface-elevated)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-sm)] text-[12px] text-[var(--r-ui-color-text-primary)] font-semibold cursor-pointer active:bg-[var(--r-ui-color-accent-subtle)] active:border-[var(--r-ui-color-accent-primary)]/50 flex items-center justify-center"
            >
              {isShiftActive ? k.toUpperCase() : k}
            </button>
          ))}
        </div>

        {/* Row 3 */}
        <div className="flex gap-1 justify-center w-full">
          {/* Shift Toggle */}
          <button
            onClick={() => setIsShiftActive(v => !v)}
            className={`w-[12%] py-2.5 border rounded-[var(--r-ui-radius-sm)] text-[11px] font-semibold cursor-pointer transition-all flex items-center justify-center ${
              isShiftActive
                ? 'bg-[var(--r-ui-color-accent-primary)] border-[var(--r-ui-color-accent-primary)] text-[var(--r-ui-color-text-inverse)]'
                : 'bg-[var(--r-ui-color-canvas)] border-[var(--r-ui-color-border-subtle)] text-[var(--r-ui-color-text-secondary)] active:bg-[var(--r-ui-color-surface-elevated)]'
            }`}
          >
            {isShiftActive ? '⬆' : '⇧'}
          </button>

          {rows[2].map(k => (
            <button
              key={k}
              onClick={() => handleCharPress(k)}
              className="flex-1 py-2.5 bg-[var(--r-ui-color-surface)] hover:bg-[var(--r-ui-color-surface-elevated)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-sm)] text-[12px] text-[var(--r-ui-color-text-primary)] font-semibold cursor-pointer active:bg-[var(--r-ui-color-accent-subtle)] active:border-[var(--r-ui-color-accent-primary)]/50 flex items-center justify-center"
            >
              {isShiftActive ? k.toUpperCase() : k}
            </button>
          ))}

          {/* Backspace */}
          <button
            onClick={() => handleSpecialPress('Backspace')}
            className="w-[15%] py-2.5 bg-[var(--r-ui-color-canvas)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-sm)] text-[11px] text-[var(--r-ui-color-text-secondary)] font-semibold cursor-pointer active:bg-[var(--r-ui-color-surface-elevated)] flex items-center justify-center"
          >
            ⌫
          </button>
        </div>

        {/* Row 4 (Space & Enter & Switch layouts) */}
        <div className="flex gap-1 justify-center w-full">
          <button
            onClick={() => setIsSymbolMode(v => !v)}
            className="w-[18%] py-2.5 bg-[var(--r-ui-color-canvas)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-sm)] text-[11px] font-semibold cursor-pointer active:bg-[var(--r-ui-color-surface-elevated)] text-[var(--r-ui-color-text-secondary)] flex items-center justify-center"
          >
            {isSymbolMode ? 'abc' : '?123'}
          </button>
          
          <button
            onClick={() => handleSpecialPress('Space')}
            className="flex-1 py-2.5 bg-[var(--r-ui-color-surface)] hover:bg-[var(--r-ui-color-surface-elevated)] border border-[var(--r-ui-color-border-subtle)] rounded-[var(--r-ui-radius-sm)] text-[12px] text-[var(--r-ui-color-text-primary)] font-medium cursor-pointer active:bg-[var(--r-ui-color-accent-subtle)] active:border-[var(--r-ui-color-accent-primary)]/50 flex items-center justify-center"
          >
            Space
          </button>

          <button
            onClick={() => handleSpecialPress('Enter')}
            className="w-[20%] py-2.5 bg-[var(--r-ui-color-accent-primary)] hover:opacity-90 border border-[var(--r-ui-color-accent-primary)] rounded-[var(--r-ui-radius-sm)] text-[11px] text-[var(--r-ui-color-text-inverse)] font-bold cursor-pointer active:opacity-100 flex items-center justify-center"
          >
            ↵ Enter
          </button>
        </div>
      </div>
    </div>
  );
}
