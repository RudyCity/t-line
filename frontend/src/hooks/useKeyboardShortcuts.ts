import { useEffect, useCallback } from 'react';

export interface KeyboardShortcutsOptions {
  /** Buka terminal baru (Alt+T) */
  onNewTerminal: () => void;
  /** Tutup tab aktif (Alt+W / Ctrl+W) */
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
  /** Zoom in/out/reset (Ctrl+= / Ctrl+- / Ctrl+0 / Alt+= / Alt+- / Alt+0) */
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onZoomReset?: () => void;
  onQuickSnapshot?: () => void;
  /** Buka shell spesifik via Ctrl+Shift+1..4 (PowerShell/CMD/Git Bash/WSL). */
  onOpenShellByDigit?: (digit: number) => void;
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
 *   Alt+W / Ctrl+W → Close active tab (Ctrl+W reserved for readline inside xterm)
 *   Alt+]          → Next tab
 *   Alt+[          → Previous tab
 *   Alt+1-9        → Jump to tab N
 *   Alt+D          → Split horizontal (side-by-side)
 *   Alt+E          → Split vertical (top-bottom)
 *   Ctrl+= / Ctrl++ / Alt+= / Alt++ → Zoom in
 *   Ctrl+- / Alt+- → Zoom out
 *   Ctrl+0 / Alt+0 → Zoom reset (100% / default size)
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
  onZoomReset,
  onQuickSnapshot,
  onOpenShellByDigit,
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
      const isAltGr = (Boolean(e.getModifierState && e.getModifierState('AltGraph'))) || (e.ctrlKey && e.altKey);
      const ctrlOrCmd = (e.ctrlKey || e.metaKey) && !isAltGr;
      const alt = e.altKey && !isAltGr;
      const shift = e.shiftKey;

      // ── Zoom In (Ctrl+=, Ctrl++, Cmd+=, Cmd++, Alt+=, Alt++, Numpad+) ──
      const isZoomInKey = e.key === '=' || e.key === '+' || e.code === 'NumpadAdd' || e.key === 'Add';
      if ((ctrlOrCmd || alt) && isZoomInKey) {
        e.preventDefault();
        onZoomIn?.();
        return;
      }

      // ── Zoom Out (Ctrl+-, Cmd+-, Alt+-, Numpad-) ─────────────────────
      const isZoomOutKey = e.key === '-' || e.key === '_' || e.code === 'NumpadSubtract' || e.key === 'Subtract';
      if ((ctrlOrCmd || alt) && isZoomOutKey) {
        e.preventDefault();
        onZoomOut?.();
        return;
      }

      // ── Zoom Reset (Ctrl+0, Cmd+0, Alt+0, Numpad0) ───────────────────
      const isZoomResetKey = e.key === '0' || e.code === 'Numpad0';
      if ((ctrlOrCmd || alt) && isZoomResetKey) {
        e.preventDefault();
        onZoomReset?.();
        return;
      }

      // Skip non-zoom shortcuts if in a real input field (but not xterm)
      if (isInInput(e.target)) return;

      // ── Alt+T — New Terminal ────────────────────────────
      if (alt && !shift && e.key === 't') {
        e.preventDefault();
        onNewTerminal();
        return;
      }

      // ── Alt+W or (Ctrl+W / Cmd+W outside xterm) — Close current tab ───
      const isXterm = Boolean(
        (e.target as HTMLElement)?.classList?.contains('xterm-helper-textarea') ||
        (e.target as HTMLElement)?.closest?.('.xterm')
      );
      if (!shift && (e.key === 'w' || e.key === 'W') && (alt || (ctrlOrCmd && !isXterm))) {
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

      // ── Ctrl+Shift+1..4 — Open shell by digit ──────────
      if (e.ctrlKey && shift && e.key >= '1' && e.key <= '4') {
        e.preventDefault();
        onOpenShellByDigit?.(parseInt(e.key));
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

      // ── Alt+S — Quick Snapshot ──────────────────────────
      if (alt && !shift && e.key === 's') {
        e.preventDefault();
        onQuickSnapshot?.();
        return;
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [
    enabled,
    isInInput,
    onNewTerminal,
    onCloseTab,
    onNextTab,
    onPrevTab,
    onJumpToTab,
    onSplitHorizontal,
    onSplitVertical,
    onZoomIn,
    onZoomOut,
    onZoomReset,
    onQuickSnapshot,
    onOpenShellByDigit
  ]);
}
