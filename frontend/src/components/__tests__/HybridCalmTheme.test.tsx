import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { THEMES, applyCalmPreferences, useThemeAndFonts } from '../../hooks/useThemeAndFonts';
import { SuperAgentGroupedMessages } from '../SuperAgentGroupedMessages';
import { SettingsModal } from '../SettingsModal';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.className = '';
  delete document.documentElement.dataset.calmDensity;
  delete document.documentElement.dataset.calmMotion;
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('Hybrid Calm presentation', () => {
  it('keeps default primary, muted, and body text at or above AA contrast', () => {
    const luminance = (hex: string) => {
      const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
      return rgb.reduce((total, x, i) => total + [0.2126, 0.7152, 0.0722][i] *
        (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4), 0);
    };
    const contrast = (a: string, b: string) => {
      const [x, y] = [luminance(a), luminance(b)].sort((a, b) => b - a);
      return (x + 0.05) / (y + 0.05);
    };
    for (const key of ['calm-light', 'calm-dark']) {
      const theme = THEMES[key];
      expect(contrast(theme.bgMain, theme.textMain)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.bgMain, theme.textMuted)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(theme.bgMain, theme.defaultAccent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('adds independent light and dark presets without removing legacy themes', () => {
    expect(THEMES['calm-light'].bgMain).toBe('#F8F9FB');
    expect(THEMES['calm-dark'].bgMain).toBe('#1B2029');
    expect(THEMES['calm-light'].defaultAccent).not.toEqual(THEMES.default.defaultAccent);
    expect(THEMES.default.name).toBe('Default Dark');
    expect(THEMES.light.name).toBe('Light Mode');
  });

  it('persists the new theme, keeps legacy light styles, and broadcasts its selection', () => {
    const onChange = vi.fn();
    window.addEventListener('tline-theme-change', onChange);
    const { result } = renderHook(() => useThemeAndFonts());
    act(() => result.current.setTheme('calm-light'));
    expect(localStorage.getItem('tline-theme')).toBe('calm-light');
    expect(document.documentElement.classList.contains('theme-calm-light')).toBe(true);
    expect(document.documentElement.classList.contains('theme-light')).toBe(true);
    expect(document.documentElement.classList.contains('theme-calm')).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    window.removeEventListener('tline-theme-change', onChange);
  });

  it('applies stored density and motion, and distinguishes dark appearance', () => {
    localStorage.setItem('tline-theme', 'calm-dark');
    localStorage.setItem('tline-calm-density', 'compact');
    localStorage.setItem('tline-calm-motion', 'off');
    renderHook(() => useThemeAndFonts());
    expect(document.documentElement.classList.contains('theme-calm-dark')).toBe(true);
    expect(document.documentElement.classList.contains('theme-light')).toBe(false);
    expect(document.documentElement.dataset.calmDensity).toBe('compact');
    expect(document.documentElement.dataset.calmMotion).toBe('off');
    applyCalmPreferences('comfortable', 'minimal');
    expect(document.documentElement.dataset.calmDensity).toBe('comfortable');
    expect(document.documentElement.dataset.calmMotion).toBe('minimal');
  });

  it('exposes persistent comfort settings on Appearance', () => {
    const chooseTheme = vi.fn();
    render(<SettingsModal show token="test" workspacesCount={0} onClose={() => {}} showAlert={() => {}}
      theme="calm-light" setTheme={chooseTheme} />);
    fireEvent.click(screen.getByRole('button', { name: /Appearance/ }));
    const density = screen.getByRole('combobox', { name: /Information density/ });
    const motion = screen.getByRole('combobox', { name: /Interface motion/ });
    fireEvent.change(density, { target: { value: 'compact' } });
    fireEvent.change(motion, { target: { value: 'off' } });
    expect(localStorage.getItem('tline-calm-density')).toBe('compact');
    expect(localStorage.getItem('tline-calm-motion')).toBe('off');
    expect(document.documentElement.dataset.calmMotion).toBe('off');
    fireEvent.click(screen.getByRole('button', { name: /Hybrid Calm - Dark/ }));
    expect(chooseTheme).toHaveBeenCalledWith('calm-dark');
  });

  it('collapses process details by default in Calm mode but keeps keyboard-accessible expansion', () => {
    localStorage.setItem('tline-theme', 'calm-light');
    render(<SuperAgentGroupedMessages
      isSystemNoiseMsg={() => false}
      messages={[
        { role: 'user', text: 'Investigate a build failure' },
        { role: 'tool', toolName: 'read_file', text: 'Read file result', result: 'Success' },
        { role: 'assistant', text: 'Build failure investigated.' },
      ]}
    />);
    const toggle = screen.getByRole('button', { name: /Process steps/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
  });
});
