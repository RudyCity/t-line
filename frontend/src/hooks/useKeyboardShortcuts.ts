import { useEffect, useCallback } from 'react';

export interface KeyboardShortcutsOptions {
  /** Buka terminal baru (Ctrl+T) */
  onNewTerminal: () => void;
  /** Tutup tab aktif (Ctrl+W) */
  onCloseTab: () => void;
  /** Tab berikutnya (Ctrl+Tab) */
  onNextTab: () => void;
  /** Tab sebelumnya (Ctrl+Shift+Tab) */
  onPrevTab: () => void;
  /** Loncat ke tab ke-N (Ctrl+1..9) */
  onJumpToTab: (index: number) => void;
  /** Toggle split pane (Ctrl+Shift+D = horizontal, Ctrl+Shift+E = vertical) */
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
  /** Zoom in/out (Ctrl+= / Ctrl+-) */
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  /** Aktif atau tidak (false jika modal terbuka, dll) */
  enabled?: boolean;
}

/**
 * useKeyboardShortcuts
 *
 * Global keyboard shortcuts untuk t-line terminal manager.
 * Shortcut tidak aktif saat user sedang fokus di dalam elemen input/textarea.
 */
export function useKeyboardShortcuts({
  onNewTerminal,
  onCloseTab,
  onNextTab,
  onPrevTab,
  onJumpToTab,
  onSplitHorizontal,
  onSplitVertical,
  onZoomIn,
  onZoomOut,
  enabled = true,
}: KeyboardShortcutsOptions) {

  const isInInput = useCallback((target: EventTarget | null): boolean => {
    if (!target) return false;
    const el = target as HTMLElement;
    const tag = el.tagName?.toLowerCase();
    // Allow shortcuts even when xterm canvas is focused
    if (el.classList?.contains('xterm-helper-textarea')) return false;
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Skip if in a real input field (but not xterm)
      if (isInInput(e.target)) return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // ── Ctrl+T — New Terminal ───────────────────────────
      if (ctrl && !shift && e.key === 't') {
        e.preventDefault();
        onNewTerminal();
        return;
      }

      // ── Ctrl+W — Close current tab ──────────────────────
      if (ctrl && !shift && e.key === 'w') {
        e.preventDefault();
        onCloseTab();
        return;
      }

      // ── Ctrl+Tab — Next tab ─────────────────────────────
      if (ctrl && !shift && e.key === 'Tab') {
        e.preventDefault();
        onNextTab();
        return;
      }

      // ── Ctrl+Shift+Tab — Previous tab ───────────────────
      if (ctrl && shift && e.key === 'Tab') {
        e.preventDefault();
        onPrevTab();
        return;
      }

      // ── Ctrl+1..9 — Jump to tab N ───────────────────────
      if (ctrl && !shift && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        onJumpToTab(parseInt(e.key) - 1);
        return;
      }

      // ── Ctrl+Shift+D — Split horizontal ─────────────────
      if (ctrl && shift && e.key === 'D') {
        e.preventDefault();
        onSplitHorizontal?.();
        return;
      }

      // ── Ctrl+Shift+E — Split vertical ───────────────────
      if (ctrl && shift && e.key === 'E') {
        e.preventDefault();
        onSplitVertical?.();
        return;
      }

      // ── Ctrl+= — Zoom in ────────────────────────────────
      if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        onZoomIn?.();
        return;
      }

      // ── Ctrl+- — Zoom out ───────────────────────────────
      if (ctrl && e.key === '-') {
        e.preventDefault();
        onZoomOut?.();
        return;
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [enabled, isInInput, onNewTerminal, onCloseTab, onNextTab, onPrevTab, onJumpToTab, onSplitHorizontal, onSplitVertical, onZoomIn, onZoomOut]);
}
