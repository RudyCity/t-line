import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  it('triggers onZoomIn on Ctrl+=, Ctrl++, Cmd++, and NumpadAdd', () => {
    const onZoomIn = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        onNewTerminal: vi.fn(),
        onCloseTab: vi.fn(),
        onNextTab: vi.fn(),
        onPrevTab: vi.fn(),
        onJumpToTab: vi.fn(),
        onZoomIn,
      })
    );

    // Ctrl + =
    const evt1 = new KeyboardEvent('keydown', { key: '=', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evt1);
    expect(onZoomIn).toHaveBeenCalledTimes(1);
    expect(evt1.defaultPrevented).toBe(true);

    // Ctrl + + (Shift+= on US keyboard)
    const evt2 = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evt2);
    expect(onZoomIn).toHaveBeenCalledTimes(2);
    expect(evt2.defaultPrevented).toBe(true);

    // Cmd + + (macOS metaKey)
    const evt3 = new KeyboardEvent('keydown', { key: '+', metaKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evt3);
    expect(onZoomIn).toHaveBeenCalledTimes(3);

    // Ctrl + NumpadAdd
    const evt4 = new KeyboardEvent('keydown', { code: 'NumpadAdd', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evt4);
    expect(onZoomIn).toHaveBeenCalledTimes(4);

    // Alt + = (legacy shortcut)
    const evt5 = new KeyboardEvent('keydown', { key: '=', altKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evt5);
    expect(onZoomIn).toHaveBeenCalledTimes(5);
  });

  it('triggers onZoomOut on Ctrl+-, Cmd+-, and NumpadSubtract', () => {
    const onZoomOut = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        onNewTerminal: vi.fn(),
        onCloseTab: vi.fn(),
        onNextTab: vi.fn(),
        onPrevTab: vi.fn(),
        onJumpToTab: vi.fn(),
        onZoomOut,
      })
    );

    // Ctrl + -
    const evt1 = new KeyboardEvent('keydown', { key: '-', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evt1);
    expect(onZoomOut).toHaveBeenCalledTimes(1);
    expect(evt1.defaultPrevented).toBe(true);

    // Cmd + -
    const evt2 = new KeyboardEvent('keydown', { key: '-', metaKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evt2);
    expect(onZoomOut).toHaveBeenCalledTimes(2);

    // Ctrl + NumpadSubtract
    const evt3 = new KeyboardEvent('keydown', { code: 'NumpadSubtract', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evt3);
    expect(onZoomOut).toHaveBeenCalledTimes(3);

    // Alt + - (legacy shortcut)
    const evt4 = new KeyboardEvent('keydown', { key: '-', altKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evt4);
    expect(onZoomOut).toHaveBeenCalledTimes(4);
  });

  it('triggers onZoomReset on Ctrl+0, Cmd+0, and Alt+0', () => {
    const onZoomReset = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        onNewTerminal: vi.fn(),
        onCloseTab: vi.fn(),
        onNextTab: vi.fn(),
        onPrevTab: vi.fn(),
        onJumpToTab: vi.fn(),
        onZoomReset,
      })
    );

    // Ctrl + 0
    const evt1 = new KeyboardEvent('keydown', { key: '0', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evt1);
    expect(onZoomReset).toHaveBeenCalledTimes(1);
    expect(evt1.defaultPrevented).toBe(true);

    // Cmd + 0
    const evt2 = new KeyboardEvent('keydown', { key: '0', metaKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evt2);
    expect(onZoomReset).toHaveBeenCalledTimes(2);

    // Alt + 0
    const evt3 = new KeyboardEvent('keydown', { key: '0', altKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(evt3);
    expect(onZoomReset).toHaveBeenCalledTimes(3);
  });

  it('allows zoom shortcuts even when focused on an input element', () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const onNewTerminal = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        onNewTerminal,
        onCloseTab: vi.fn(),
        onNextTab: vi.fn(),
        onPrevTab: vi.fn(),
        onJumpToTab: vi.fn(),
        onZoomIn,
        onZoomOut,
      })
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    // Normal shortcuts like Alt+T should be skipped when in input
    const altT = new KeyboardEvent('keydown', { key: 't', altKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(altT);
    expect(onNewTerminal).not.toHaveBeenCalled();

    // Zoom shortcuts should still work
    const ctrlPlus = new KeyboardEvent('keydown', { key: '+', ctrlKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(ctrlPlus);
    expect(onZoomIn).toHaveBeenCalledTimes(1);

    const ctrlMinus = new KeyboardEvent('keydown', { key: '-', ctrlKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(ctrlMinus);
    expect(onZoomOut).toHaveBeenCalledTimes(1);

    document.body.removeChild(input);
  });

  it('triggers onCloseTab on Alt+W and Ctrl+W outside inputs and xterm', () => {
    const onCloseTab = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts({
        onNewTerminal: vi.fn(),
        onCloseTab,
        onNextTab: vi.fn(),
        onPrevTab: vi.fn(),
        onJumpToTab: vi.fn(),
      })
    );

    // Alt + W
    const altW = new KeyboardEvent('keydown', { key: 'w', altKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(altW);
    expect(onCloseTab).toHaveBeenCalledTimes(1);
    expect(altW.defaultPrevented).toBe(true);

    // Ctrl + W
    const ctrlW = new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(ctrlW);
    expect(onCloseTab).toHaveBeenCalledTimes(2);
    expect(ctrlW.defaultPrevented).toBe(true);

    // Cmd + W (macOS)
    const cmdW = new KeyboardEvent('keydown', { key: 'w', metaKey: true, bubbles: true, cancelable: true });
    window.dispatchEvent(cmdW);
    expect(onCloseTab).toHaveBeenCalledTimes(3);

    // Inside xterm helper textarea: Ctrl+W should NOT close tab (preserves readline unix-word-rubout)
    const xtermEl = document.createElement('textarea');
    xtermEl.className = 'xterm-helper-textarea';
    document.body.appendChild(xtermEl);

    const xtermCtrlW = new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, bubbles: true, cancelable: true });
    xtermEl.dispatchEvent(xtermCtrlW);
    expect(onCloseTab).toHaveBeenCalledTimes(3); // unchanged

    // But Alt+W in xterm DOES close tab
    const xtermAltW = new KeyboardEvent('keydown', { key: 'w', altKey: true, bubbles: true, cancelable: true });
    xtermEl.dispatchEvent(xtermAltW);
    expect(onCloseTab).toHaveBeenCalledTimes(4);

    document.body.removeChild(xtermEl);
  });
});
