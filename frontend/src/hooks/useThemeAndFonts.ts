import { useState, useEffect } from 'react';

export interface ThemePreset {
  name: string;
  bgMain: string;
  bgSidebar: string;
  bgCard: string;
  bgCardHover: string;
  borderColor: string;
  textMain: string;
  textMuted: string;
  textDark: string;
  defaultAccent: string;
  bgRadialDot: string;
}

export const THEMES: Record<string, ThemePreset> = {
  'calm-light': {
    name: 'Hybrid Calm - Light',
    bgMain: '#F8F9FB', bgSidebar: '#F0F2F5', bgCard: '#FFFFFF',
    bgCardHover: '#EFF2F7', borderColor: '#DDE3EB',
    textMain: '#242B38', textMuted: '#586578', textDark: '#677488',
    defaultAccent: '#5369A5', bgRadialDot: 'transparent',
  },
  'calm-dark': {
    name: 'Hybrid Calm - Dark',
    bgMain: '#1B2029', bgSidebar: '#171B23', bgCard: '#242B36',
    bgCardHover: '#303949', borderColor: '#3B4554',
    textMain: '#F0F2F7', textMuted: '#B8C3D2', textDark: '#A5B0C0',
    defaultAccent: '#8095D3', bgRadialDot: 'transparent',
  },
  default: {
    name: 'Default Dark',
    bgMain: '#0e1117',
    bgSidebar: '#0a0d12',
    bgCard: '#151921',
    bgCardHover: '#1c222c',
    borderColor: '#242a36',
    textMain: '#f1f5f9',
    textMuted: '#94a3b8',
    textDark: '#64748b',
    defaultAccent: '#3b82f6',
    bgRadialDot: 'transparent',
  },
  dracula: {
    name: 'Dracula',
    bgMain: '#21222c',
    bgSidebar: '#191a21',
    bgCard: '#282a36',
    bgCardHover: '#343746',
    borderColor: '#44475a',
    textMain: '#f8f8f2',
    textMuted: '#a2aabc',
    textDark: '#6272a4',
    defaultAccent: '#bd93f9',
    bgRadialDot: 'transparent',
  },
  cyberpunk: {
    name: 'Cyberpunk Neon',
    bgMain: '#110e1b',
    bgSidebar: '#0c0914',
    bgCard: '#1a1628',
    bgCardHover: '#251f38',
    borderColor: '#2e2642',
    textMain: '#f8fafc',
    textMuted: '#a3a6b8',
    textDark: '#6b6e82',
    defaultAccent: '#f43f5e',
    bgRadialDot: 'transparent',
  },
  forest: {
    name: 'Forest Green',
    bgMain: '#0c1410',
    bgSidebar: '#080e0b',
    bgCard: '#131e19',
    bgCardHover: '#1a2922',
    borderColor: '#21332a',
    textMain: '#ecfdf5',
    textMuted: '#8da398',
    textDark: '#566a60',
    defaultAccent: '#10b981',
    bgRadialDot: 'transparent',
  },
  nord: {
    name: 'Nord Frost',
    bgMain: '#242933',
    bgSidebar: '#1e222a',
    bgCard: '#2e3440',
    bgCardHover: '#3b4252',
    borderColor: '#434c5e',
    textMain: '#eceff4',
    textMuted: '#d8dee9',
    textDark: '#7b88a1',
    defaultAccent: '#88c0d0',
    bgRadialDot: 'transparent',
  },
  light: {
    name: 'Light Mode',
    bgMain: '#f8fafc',
    bgSidebar: '#f1f5f9',
    bgCard: '#ffffff',
    bgCardHover: '#f1f5f9',
    borderColor: '#e2e8f0',
    textMain: '#0f172a',
    textMuted: '#475569',
    textDark: '#64748b',
    defaultAccent: '#2563eb',
    bgRadialDot: 'transparent',
  }
};

export type CalmDensity = 'comfortable' | 'compact';
export type CalmMotion = 'minimal' | 'off';

export function applyCalmPreferences(density?: CalmDensity, motion?: CalmMotion): void {
  const savedDensity = density ?? (localStorage.getItem('tline-calm-density') === 'compact' ? 'compact' : 'comfortable');
  const savedMotion = motion ?? (localStorage.getItem('tline-calm-motion') === 'off' ? 'off' : 'minimal');
  document.documentElement.dataset.calmDensity = savedDensity;
  document.documentElement.dataset.calmMotion = savedMotion;
}

export const UI_FONTS = {
  Outfit: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Poppins: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Roboto: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Montserrat: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Ubuntu: "'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Geist Sans': "'Geist Sans', 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'SF Pro': "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
  'Plus Jakarta Sans': "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Lato': "'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Open Sans': "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Nunito': "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Sora': "'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'DM Sans': "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Space Grotesk': "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Manrope': "'Manrope', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Work Sans': "'Work Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Cabin': "'Cabin', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  System: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
};

export const MONO_FONTS = {
  'JetBrains Mono': "'JetBrains Mono', monospace",
  'Fira Code': "'Fira Code', monospace",
  'Source Code Pro': "'Source Code Pro', monospace",
  'Ubuntu Mono': "'Ubuntu Mono', monospace",
  'Courier New': "'Courier New', Courier, monospace",
  'Geist Mono': "'Geist Mono', 'JetBrains Mono', 'Fira Code', monospace",
  'SF Mono': "'SF Mono', SFMono-Regular, Consolas, 'Liberation Mono', Menlo, monospace",
  'Cascadia Code': "'Cascadia Code', 'Segoe UI Mono', Consolas, monospace",
  'IBM Plex Mono': "'IBM Plex Mono', 'Courier New', monospace",
  'Inconsolata': "'Inconsolata', monospace",
  'Hack': "'Hack', monospace",
  'Roboto Mono': "'Roboto Mono', monospace",
  'Space Mono': "'Space Mono', monospace",
  'Anonymous Pro': "'Anonymous Pro', monospace",
  System: "monospace",
};

export function useThemeAndFonts() {
  const [theme, setThemeState] = useState<string>(() => {
    return localStorage.getItem('tline-theme') || 'default';
  });

  const [accentColor, setAccentColorState] = useState<string>(() => {
    const saved = localStorage.getItem('tline-accent-color');
    if (saved) return saved;
    const activeTheme = localStorage.getItem('tline-theme') || 'default';
    return THEMES[activeTheme]?.defaultAccent || THEMES.default.defaultAccent;
  });

  const [fontSans, setFontSansState] = useState<string>(() => {
    return localStorage.getItem('tline-font-sans') || 'Outfit';
  });

  const [fontMono, setFontMonoState] = useState<string>(() => {
    return localStorage.getItem('tline-font-mono') || 'JetBrains Mono';
  });

  const [fontSansWeight, setFontSansWeightState] = useState<string>(() => {
    return localStorage.getItem('tline-font-sans-weight') || '400';
  });

  const [fontMonoWeight, setFontMonoWeightState] = useState<string>(() => {
    return localStorage.getItem('tline-font-mono-weight') || '400';
  });

  const setTheme = (newTheme: string) => {
    if (THEMES[newTheme]) {
      setThemeState(newTheme);
      localStorage.setItem('tline-theme', newTheme);
      const preset = THEMES[newTheme];
      setAccentColorState(preset.defaultAccent);
      localStorage.setItem('tline-accent-color', preset.defaultAccent);
      window.dispatchEvent(new CustomEvent('tline-theme-change', { detail: { theme: newTheme } }));
    }
  };

  const setAccentColor = (color: string) => {
    setAccentColorState(color);
    localStorage.setItem('tline-accent-color', color);
  };

  const setFontSans = (fontName: string) => {
    setFontSansState(fontName);
    localStorage.setItem('tline-font-sans', fontName);
  };

  const setFontMono = (fontName: string) => {
    setFontMonoState(fontName);
    localStorage.setItem('tline-font-mono', fontName);
  };

  const setFontSansWeight = (weight: string) => {
    setFontSansWeightState(weight);
    localStorage.setItem('tline-font-sans-weight', weight);
  };

  const setFontMonoWeight = (weight: string) => {
    setFontMonoWeightState(weight);
    localStorage.setItem('tline-font-mono-weight', weight);
  };

  // Loading thirty font families on initial HTML paint blocks low-memory
  // WebViews. Fetch only a saved/selected non-default font when needed.
  useEffect(() => {
    const requested = [
      fontSans === 'Geist Sans' ? 'Geist' : fontSans,
      fontMono
    ];
    const localFonts = new Set([
      'System', 'SF Pro', 'SF Mono', 'Courier New', 'Cascadia Code', 'Hack',
      'Outfit', 'JetBrains Mono'
    ]);
    for (const name of requested) {
      if (localFonts.has(name) || document.querySelector('link[data-tline-font="' + name + '"]')) continue;
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.setAttribute('data-tline-font', name);
      const family = encodeURIComponent(name).replace(/%20/g, '+');
      link.href = 'https://fonts.googleapis.com/css2?family=' + family + ':wght@400;700&display=swap';
      document.head.appendChild(link);
    }
  }, [fontSans, fontMono]);

  useEffect(() => {
    const root = document.documentElement;
    const preset = THEMES[theme] || THEMES.default;

    root.style.setProperty('--bg-main', preset.bgMain);
    root.style.setProperty('--bg-sidebar', preset.bgSidebar);
    root.style.setProperty('--bg-card', preset.bgCard);
    root.style.setProperty('--bg-card-hover', preset.bgCardHover);
    root.style.setProperty('--border-color', preset.borderColor);
    root.style.setProperty('--text-main', preset.textMain);
    root.style.setProperty('--text-muted', preset.textMuted);
    root.style.setProperty('--text-dark', preset.textDark);

    const fontSansValue = UI_FONTS[fontSans as keyof typeof UI_FONTS] || UI_FONTS.Outfit;
    const fontMonoValue = MONO_FONTS[fontMono as keyof typeof MONO_FONTS] || MONO_FONTS['JetBrains Mono'];
    root.style.setProperty('--font-sans', fontSansValue);
    root.style.setProperty('--font-mono', fontMonoValue);
    root.style.setProperty('--font-sans-weight', fontSansWeight);
    root.style.setProperty('--font-mono-weight', fontMonoWeight);

    const isCalm = theme === 'calm-light' || theme === 'calm-dark';
    const isLight = theme === 'light' || theme === 'calm-light';
    // Reuse light-mode adaptations, while scoping calm-only presentation changes.
    root.className = `theme-${theme}${isLight ? ' theme-light' : ''}${isCalm ? ' theme-calm' : ''}`;
    applyCalmPreferences();

    root.style.setProperty('--accent-color', accentColor);
    root.style.setProperty('--color-primary', accentColor);

    root.style.setProperty(
      '--color-primary-hover',
      `color-mix(in srgb, ${accentColor} 80%, ${isLight ? '#000000' : '#ffffff'})`
    );
    root.style.setProperty(
      '--color-primary-glow',
      `color-mix(in srgb, ${accentColor} ${isCalm ? '6%' : '12%'}, transparent)`
    );
    root.style.setProperty(
      '--border-glow',
      `color-mix(in srgb, ${accentColor} ${isCalm ? '6%' : '12%'}, transparent)`
    );

    root.style.setProperty('--bg-radial-dot', preset.bgRadialDot);
    root.style.setProperty(
      '--bg-radial-glow1',
      'transparent'
    );
    root.style.setProperty(
      '--bg-radial-glow2',
      'transparent'
    );

    // Light/dark adaptive semantic tokens
    if (isLight) {
      root.style.setProperty('--surface-overlay', 'rgba(0, 0, 0, 0.04)');
      root.style.setProperty('--surface-overlay-hover', 'rgba(0, 0, 0, 0.07)');
      root.style.setProperty('--surface-overlay-active', 'rgba(0, 0, 0, 0.1)');
      root.style.setProperty('--surface-inverse', 'rgba(0, 0, 0, 0.04)');
      root.style.setProperty('--scrollbar-thumb', 'rgba(0, 0, 0, 0.15)');
      root.style.setProperty('--scrollbar-thumb-hover', 'rgba(0, 0, 0, 0.25)');
      root.style.setProperty('--tree-connector-color', 'rgba(0, 0, 0, 0.15)');
      root.style.setProperty('--tab-active-bg', `color-mix(in srgb, ${accentColor} 10%, transparent)`);
      root.style.setProperty('--tab-active-border', `color-mix(in srgb, ${accentColor} 35%, transparent)`);
      root.style.setProperty('--tab-active-color', `color-mix(in srgb, ${accentColor} 80%, #000000)`);
      root.style.setProperty('--tab-close-hover-bg', 'rgba(0, 0, 0, 0.12)');
      root.style.setProperty('--tooltip-bg', 'rgba(255, 255, 255, 0.97)');
      root.style.setProperty('--tooltip-border', `color-mix(in srgb, ${accentColor} 30%, transparent)`);
      root.style.setProperty('--tooltip-text', '#0f172a');
      root.style.setProperty('--tooltip-title', `color-mix(in srgb, ${accentColor} 70%, #000000)`);
      root.style.setProperty('--tooltip-path', '#64748b');
      root.style.setProperty('--tooltip-branch', '#b45309');
      root.style.setProperty('--toast-bg', 'rgba(255, 255, 255, 0.97)');
      root.style.setProperty('--toast-border', `color-mix(in srgb, ${accentColor} 30%, transparent)`);
      root.style.setProperty('--toast-text', `color-mix(in srgb, ${accentColor} 15%, #0f172a)`);
      root.style.setProperty('--ws-dropdown-bg', 'rgba(255, 255, 255, 0.98)');
      root.style.setProperty('--ws-dropdown-border', 'rgba(0, 0, 0, 0.1)');
      root.style.setProperty('--ws-dropdown-shadow', '0 10px 25px -5px rgba(0,0,0,0.08), 0 8px 10px -6px rgba(0,0,0,0.08)');
      root.style.setProperty('--glass-shadow', 'none');
      root.style.setProperty('--tooltip-shadow', 'none');
      root.style.setProperty('--toast-shadow', 'none');
      root.style.setProperty('--panel-header-bg', 'rgba(0, 0, 0, 0.04)');
      root.style.setProperty('--sidebar-tabs-bg', 'rgba(0, 0, 0, 0.04)');
      root.style.setProperty('--window-btn-hover-bg', 'rgba(0, 0, 0, 0.07)');
    } else {
      root.style.setProperty('--surface-overlay', 'rgba(255, 255, 255, 0.04)');
      root.style.setProperty('--surface-overlay-hover', 'rgba(255, 255, 255, 0.08)');
      root.style.setProperty('--surface-overlay-active', 'rgba(255, 255, 255, 0.12)');
      root.style.setProperty('--surface-inverse', 'rgba(0, 0, 0, 0.2)');
      root.style.setProperty('--scrollbar-thumb', 'rgba(255, 255, 255, 0.1)');
      root.style.setProperty('--scrollbar-thumb-hover', 'rgba(255, 255, 255, 0.2)');
      root.style.setProperty('--tree-connector-color', 'rgba(255, 255, 255, 0.15)');
      root.style.setProperty('--tab-active-bg', `color-mix(in srgb, ${accentColor} 8%, transparent)`);
      root.style.setProperty('--tab-active-border', `color-mix(in srgb, ${accentColor} 25%, transparent)`);
      root.style.setProperty('--tab-active-color', `color-mix(in srgb, ${accentColor} 80%, #ffffff)`);
      root.style.setProperty('--tab-close-hover-bg', 'rgba(255, 255, 255, 0.15)');
      root.style.setProperty('--tooltip-bg', 'rgba(15, 23, 42, 0.95)');
      root.style.setProperty('--tooltip-border', `color-mix(in srgb, ${accentColor} 40%, transparent)`);
      root.style.setProperty('--tooltip-text', '#f1f5f9');
      root.style.setProperty('--tooltip-title', `color-mix(in srgb, ${accentColor} 90%, #ffffff)`);
      root.style.setProperty('--tooltip-path', 'var(--text-muted)');
      root.style.setProperty('--tooltip-branch', '#fbbf24');
      root.style.setProperty('--toast-bg', 'rgba(14, 17, 26, 0.9)');
      root.style.setProperty('--toast-border', `color-mix(in srgb, ${accentColor} 30%, transparent)`);
      root.style.setProperty('--toast-text', `color-mix(in srgb, ${accentColor} 30%, #ffffff)`);
      root.style.setProperty('--ws-dropdown-bg', 'rgba(15, 23, 42, 0.98)');
      root.style.setProperty('--ws-dropdown-border', `color-mix(in srgb, ${accentColor} 25%, transparent)`);
      root.style.setProperty('--ws-dropdown-shadow', 'none');
      root.style.setProperty('--glass-shadow', 'none');
      root.style.setProperty('--tooltip-shadow', 'none');
      root.style.setProperty('--toast-shadow', 'none');
      root.style.setProperty('--panel-header-bg', 'rgba(0, 0, 0, 0.25)');
      root.style.setProperty('--sidebar-tabs-bg', 'rgba(0, 0, 0, 0.2)');
      root.style.setProperty('--window-btn-hover-bg', 'rgba(255, 255, 255, 0.08)');
    }

    // Sync theme settings to Electron desktop config
    if ((window as any).electron?.saveThemeSettings) {
      (window as any).electron.saveThemeSettings({
        theme,
        accentColor,
        fontSans,
        fontMono,
        fontSansWeight,
        fontMonoWeight,
        preset
      });
    }
  }, [theme, accentColor, fontSans, fontMono, fontSansWeight, fontMonoWeight]);

  return {
    theme,
    setTheme,
    accentColor,
    setAccentColor,
    fontSans,
    setFontSans,
    fontMono,
    setFontMono,
    fontSansWeight,
    setFontSansWeight,
    fontMonoWeight,
    setFontMonoWeight,
    THEMES,
    UI_FONTS,
    MONO_FONTS,
  };
}
