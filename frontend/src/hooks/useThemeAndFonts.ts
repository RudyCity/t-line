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
  default: {
    name: 'Default Dark',
    bgMain: '#05070c',
    bgSidebar: '#090c14',
    bgCard: 'rgba(17, 24, 39, 0.45)',
    bgCardHover: 'rgba(31, 41, 55, 0.55)',
    borderColor: 'rgba(255, 255, 255, 0.06)',
    textMain: '#f8fafc',
    textMuted: '#94a3b8',
    textDark: '#64748b',
    defaultAccent: '#a855f7',
    bgRadialDot: 'rgba(255, 255, 255, 0.02)',
  },
  dracula: {
    name: 'Dracula',
    bgMain: '#1e1f29',
    bgSidebar: '#282a36',
    bgCard: 'rgba(40, 42, 54, 0.5)',
    bgCardHover: 'rgba(68, 71, 90, 0.5)',
    borderColor: 'rgba(98, 114, 164, 0.2)',
    textMain: '#f8f8f2',
    textMuted: '#6272a4',
    textDark: '#44475a',
    defaultAccent: '#bd93f9',
    bgRadialDot: 'rgba(255, 255, 255, 0.01)',
  },
  cyberpunk: {
    name: 'Cyberpunk Neon',
    bgMain: '#0b0813',
    bgSidebar: '#120924',
    bgCard: 'rgba(26, 15, 46, 0.45)',
    bgCardHover: 'rgba(50, 24, 85, 0.55)',
    borderColor: 'rgba(255, 0, 127, 0.15)',
    textMain: '#f8fafc',
    textMuted: '#ff007f',
    textDark: '#861f68',
    defaultAccent: '#ff007f',
    bgRadialDot: 'rgba(255, 255, 255, 0.02)',
  },
  forest: {
    name: 'Forest Green',
    bgMain: '#070d0a',
    bgSidebar: '#0c1712',
    bgCard: 'rgba(16, 28, 21, 0.45)',
    bgCardHover: 'rgba(24, 45, 34, 0.55)',
    borderColor: 'rgba(16, 185, 129, 0.1)',
    textMain: '#f0fdf4',
    textMuted: '#86efac',
    textDark: '#3f6212',
    defaultAccent: '#10b981',
    bgRadialDot: 'rgba(255, 255, 255, 0.01)',
  },
  nord: {
    name: 'Nord Frost',
    bgMain: '#2e3440',
    bgSidebar: '#242933',
    bgCard: 'rgba(46, 52, 64, 0.5)',
    bgCardHover: 'rgba(59, 66, 82, 0.5)',
    borderColor: 'rgba(76, 86, 106, 0.3)',
    textMain: '#eceff4',
    textMuted: '#d8dee9',
    textDark: '#4c566a',
    defaultAccent: '#88c0d0',
    bgRadialDot: 'rgba(255, 255, 255, 0.01)',
  },
  light: {
    name: 'Light Mode',
    bgMain: '#f8fafc',
    bgSidebar: '#f1f5f9',
    bgCard: 'rgba(255, 255, 255, 0.7)',
    bgCardHover: 'rgba(241, 245, 249, 0.9)',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    textMain: '#0f172a',
    textMuted: '#64748b',
    textDark: '#94a3b8',
    defaultAccent: '#6366f1',
    bgRadialDot: 'rgba(0, 0, 0, 0.02)',
  }
};

export const UI_FONTS = {
  Outfit: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Inter: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Poppins: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Roboto: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Montserrat: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  Ubuntu: "'Ubuntu', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Geist Sans': "'Geist Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'SF Pro': "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Segoe UI', Roboto, sans-serif",
  'Plus Jakarta Sans': "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Lato': "'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Open Sans': "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Nunito': "'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'Sora': "'Sora', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  'DM Sans': "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
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

    root.style.setProperty('--accent-color', accentColor);
    root.style.setProperty('--color-primary', accentColor);

    const isLight = theme === 'light';
    root.style.setProperty(
      '--color-primary-hover',
      `color-mix(in srgb, ${accentColor} 80%, ${isLight ? '#000000' : '#ffffff'})`
    );
    root.style.setProperty(
      '--color-primary-glow',
      `color-mix(in srgb, ${accentColor} 35%, transparent)`
    );
    root.style.setProperty(
      '--border-glow',
      `color-mix(in srgb, ${accentColor} 15%, transparent)`
    );

    root.style.setProperty('--bg-radial-dot', preset.bgRadialDot);
    root.style.setProperty(
      '--bg-radial-glow1',
      `color-mix(in srgb, ${accentColor} 8%, transparent)`
    );
    root.style.setProperty(
      '--bg-radial-glow2',
      `color-mix(in srgb, ${preset.textMain} 4%, transparent)`
    );
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
