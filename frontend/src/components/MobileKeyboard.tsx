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
      className="mobile-keyboard border-t border-purple-500/10 bg-[#07090f]/95 p-2 select-none z-45 flex flex-col gap-1.5 w-full shrink-0"
      style={{
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)'
      }}
    >
      {/* Modifier Toolbar Row */}
      <div className="flex gap-1 justify-between w-full">
        <button
          onClick={() => handleSpecialPress('Esc')}
          className="flex-1 py-1.5 bg-slate-900/60 border border-white/5 rounded text-[11px] text-slate-300 font-semibold cursor-pointer active:bg-slate-800"
        >
          Esc
        </button>
        <button
          onClick={() => handleSpecialPress('Tab')}
          className="flex-1 py-1.5 bg-slate-900/60 border border-white/5 rounded text-[11px] text-slate-300 font-semibold cursor-pointer active:bg-slate-800"
        >
          Tab
        </button>
        <button
          onClick={() => setIsCtrlActive(v => !v)}
          className={`flex-1 py-1.5 border rounded text-[11px] font-semibold cursor-pointer transition-all ${
            isCtrlActive
              ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/25'
              : 'bg-slate-900/60 border-white/5 text-slate-300 active:bg-slate-800'
          }`}
        >
          Ctrl
        </button>
        <button
          onClick={() => setIsAltActive(v => !v)}
          className={`flex-1 py-1.5 border rounded text-[11px] font-semibold cursor-pointer transition-all ${
            isAltActive
              ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/25'
              : 'bg-slate-900/60 border-white/5 text-slate-300 active:bg-slate-800'
          }`}
        >
          Alt
        </button>

        {/* Arrow Keys Pad */}
        <div className="flex gap-1 items-center shrink-0 ml-2">
          <button
            onClick={() => handleSpecialPress('Left')}
            className="w-8 py-1.5 bg-slate-900/60 border border-white/5 rounded text-[11px] text-slate-300 font-semibold cursor-pointer active:bg-slate-800 flex items-center justify-center"
          >
            ←
          </button>
          <div className="flex flex-col gap-1 shrink-0">
            <button
              onClick={() => handleSpecialPress('Up')}
              className="w-8 py-0.5 bg-slate-900/60 border border-white/5 rounded text-[10px] text-slate-300 font-semibold cursor-pointer active:bg-slate-800 flex items-center justify-center"
              style={{ padding: '2px 0' }}
            >
              ↑
            </button>
            <button
              onClick={() => handleSpecialPress('Down')}
              className="w-8 py-0.5 bg-slate-900/60 border border-white/5 rounded text-[10px] text-slate-300 font-semibold cursor-pointer active:bg-slate-800 flex items-center justify-center"
              style={{ padding: '2px 0' }}
            >
              ↓
            </button>
          </div>
          <button
            onClick={() => handleSpecialPress('Right')}
            className="w-8 py-1.5 bg-slate-900/60 border border-white/5 rounded text-[11px] text-slate-300 font-semibold cursor-pointer active:bg-slate-800 flex items-center justify-center"
          >
            →
          </button>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="w-8 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded text-[11px] text-red-400 font-bold cursor-pointer active:bg-red-600 active:text-white flex items-center justify-center ml-1 shrink-0"
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
              className="flex-1 py-2.5 bg-slate-800/40 hover:bg-slate-800 border border-white/5 rounded text-[12px] text-slate-100 font-semibold cursor-pointer active:bg-purple-600/30 active:border-purple-500/50 flex items-center justify-center"
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
              className="flex-1 py-2.5 bg-slate-800/40 hover:bg-slate-800 border border-white/5 rounded text-[12px] text-slate-100 font-semibold cursor-pointer active:bg-purple-600/30 active:border-purple-500/50 flex items-center justify-center"
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
            className={`w-[12%] py-2.5 border rounded text-[11px] font-semibold cursor-pointer transition-all flex items-center justify-center ${
              isShiftActive
                ? 'bg-purple-600 border-purple-500 text-white shadow-md shadow-purple-600/25'
                : 'bg-slate-900/60 border-white/5 text-slate-400 active:bg-slate-800'
            }`}
          >
            {isShiftActive ? '⬆' : '⇧'}
          </button>

          {rows[2].map(k => (
            <button
              key={k}
              onClick={() => handleCharPress(k)}
              className="flex-1 py-2.5 bg-slate-800/40 hover:bg-slate-800 border border-white/5 rounded text-[12px] text-slate-100 font-semibold cursor-pointer active:bg-purple-600/30 active:border-purple-500/50 flex items-center justify-center"
            >
              {isShiftActive ? k.toUpperCase() : k}
            </button>
          ))}

          {/* Backspace */}
          <button
            onClick={() => handleSpecialPress('Backspace')}
            className="w-[15%] py-2.5 bg-slate-900/60 border border-white/5 rounded text-[11px] text-slate-400 font-semibold cursor-pointer active:bg-slate-800 flex items-center justify-center"
          >
            ⌫
          </button>
        </div>

        {/* Row 4 (Space & Enter & Switch layouts) */}
        <div className="flex gap-1 justify-center w-full">
          <button
            onClick={() => setIsSymbolMode(v => !v)}
            className="w-[18%] py-2.5 bg-slate-900/60 border border-white/5 rounded text-[11px] font-semibold cursor-pointer active:bg-slate-800 flex items-center justify-center"
          >
            {isSymbolMode ? 'abc' : '?123'}
          </button>
          
          <button
            onClick={() => handleSpecialPress('Space')}
            className="flex-1 py-2.5 bg-slate-800/40 hover:bg-slate-800 border border-white/5 rounded text-[12px] text-slate-100 font-medium cursor-pointer active:bg-purple-600/30 active:border-purple-500/50 flex items-center justify-center"
          >
            Space
          </button>

          <button
            onClick={() => handleSpecialPress('Enter')}
            className="w-[20%] py-2.5 bg-purple-600 hover:bg-purple-500 border border-purple-500 rounded text-[11px] text-white font-bold cursor-pointer active:bg-purple-700 flex items-center justify-center"
          >
            ↵ Enter
          </button>
        </div>
      </div>
    </div>
  );
}
