/**
 * @jarvis/styles TypeScript API
 * Theme provider, design token maps, and CSS encapsulation utilities.
 */

export type JarvisTheme = 'light' | 'dark' | 'system';

export interface ThemeConfigOptions {
  defaultTheme?: JarvisTheme;
  attributeName?: string;
}

export interface ThemeManager {
  getTheme(): JarvisTheme;
  setTheme(theme: JarvisTheme): void;
}

export function provideTheme(options: ThemeConfigOptions = {}): ThemeManager {
  let currentTheme: JarvisTheme = options.defaultTheme || 'light';
  const attr = options.attributeName || 'data-jarvis-theme';

  const applyTheme = (theme: JarvisTheme) => {
    if (typeof document !== 'undefined' && document.documentElement) {
      if (theme === 'system') {
        const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute(attr, prefersDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute(attr, theme);
      }
    }
  };

  applyTheme(currentTheme);

  return {
    getTheme(): JarvisTheme {
      return currentTheme;
    },
    setTheme(theme: JarvisTheme): void {
      currentTheme = theme;
      applyTheme(theme);
    }
  };
}

export const JARVIS_TOKENS = {
  colors: {
    primary: 'var(--jarvis-color-primary)',
    secondary: 'var(--jarvis-color-secondary)',
    surface: 'var(--jarvis-color-surface)',
    background: 'var(--jarvis-color-background)',
    text: 'var(--jarvis-color-text)'
  },
  spacing: {
    1: 'var(--jarvis-space-1)',
    2: 'var(--jarvis-space-2)',
    3: 'var(--jarvis-space-3)',
    4: 'var(--jarvis-space-4)',
    6: 'var(--jarvis-space-6)',
    8: 'var(--jarvis-space-8)'
  },
  radii: {
    sm: 'var(--jarvis-radius-sm)',
    md: 'var(--jarvis-radius-md)',
    lg: 'var(--jarvis-radius-lg)',
    full: 'var(--jarvis-radius-full)'
  },
  typography: {
    fontFamily: 'var(--jarvis-font-sans)',
    sizeSm: 'var(--jarvis-font-size-sm)',
    sizeBase: 'var(--jarvis-font-size-base)',
    sizeLg: 'var(--jarvis-font-size-lg)'
  }
};
