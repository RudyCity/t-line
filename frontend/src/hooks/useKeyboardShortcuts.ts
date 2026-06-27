import { useEffect, useCallback } from 'react';

export interface KeyboardShortcutsOptions {
  /** Buka terminal baru (Alt+T) */
  onNewTerminal: () => void;
  /** Tutup tab aktif (Alt+W) */
  onCloseTab: () => void;
  /** Tab berikutnya (Alt+]) */
  onNextTab: () => void;
  /** Tab sebelumnya (Alt+[) */
  onPrevTab: () => void;
  /** Loncat ke tab ke-N (Alt+1..9) */
  onJumpToTab: (index: number) => void;
  /** Toggle split pane (Alt+D = horizontal, Alt+E = vertical) */
  onSplitHorizontal?: () => void;
  onSplitVertical?: () => void;
  /** Zoom in/out (Alt+= / Alt+-) */
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  /** Aktif atau tidak (false jika modal terbuka, dll) */
  enabled?: boolean;
}

/**
 * useKeyboardShortcuts
 *
 * Global keyboard shortcuts untuk t-line terminal manager.
 * Menggunakan Alt+ agar kompatibel di browser (Chrome/Firefox mencegat Ctrl+T/W/Tab).
 * Shortcut tidak aktif saat user sedang fokus di dalam elemen input/textarea biasa.
 *
 * Shortcut Reference:
 *   Alt+T          → New Terminal
 *   Alt+W          → Close active tab
 *   Alt+]          → Next tab
 *   Alt+[          → Previous tab
 *   Alt+1-9        → Jump to tab N
 *   Alt+D          → Split horizontal (side-by-side)
 *   Alt+E          → Split vertical (top-bottom)
 *   Alt+= / Alt++  → Zoom in
 *   Alt+-          → Zoom out
 *   Ctrl+Shift+F   → Search in terminal (handled inside TerminalInstance)
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
    // Allow shortcuts even when xterm canvas textarea is focused
    if (el.classList?.contains('xterm-helper-textarea')) return false;
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      // Skip if in a real input field (but not xterm)
      if (isInInput(e.target)) return;

      const alt = e.altKey;
      const shift = e.shiftKey;

      // ── Alt+T — New Terminal ────────────────────────────
      if (alt && !shift && e.key === 't') {
        e.preventDefault();
        onNewTerminal();
        return;
      }

      // ── Alt+W — Close current tab ───────────────────────
      if (alt && !shift && e.key === 'w') {
        e.preventDefault();
        onCloseTab();
        return;
      }

      // ── Alt+] — Next tab ────────────────────────────────
      if (alt && !shift && (e.key === ']' || e.key === 'ArrowRight')) {
        e.preventDefault();
        onNextTab();
        return;
      }

      // ── Alt+[ — Previous tab ────────────────────────────
      if (alt && !shift && (e.key === '[' || e.key === 'ArrowLeft')) {
        e.preventDefault();
        onPrevTab();
        return;
      }

      // ── Alt+1..9 — Jump to tab N ────────────────────────
      if (alt && !shift && e.key >= '1' && e.key <= '9') {
        e.preventDefault();
        onJumpToTab(parseInt(e.key) - 1);
        return;
      }

      // ── Alt+D — Split horizontal ─────────────────────────
      if (alt && !shift && e.key === 'd') {
        e.preventDefault();
        onSplitHorizontal?.();
        return;
      }

      // ── Alt+E — Split vertical ───────────────────────────
      if (alt && !shift && e.key === 'e') {
        e.preventDefault();
        onSplitVertical?.();
        return;
      }

      // ── Alt+= or Alt++ — Zoom in ─────────────────────────
      if (alt && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        onZoomIn?.();
        return;
      }

      // ── Alt+- — Zoom out ─────────────────────────────────
      if (alt && e.key === '-') {
        e.preventDefault();
        onZoomOut?.();
        return;
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [enabled, isInInput, onNewTerminal, onCloseTab, onNextTab, onPrevTab, onJumpToTab, onSplitHorizontal, onSplitVertical, onZoomIn, onZoomOut]);
}
