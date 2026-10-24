# Theme Management & Dynamic Swapping

## 1. Runtime Theming Engine
JARVIS provides declarative and fine-grained runtime theme switching via provideTheme() from @jarvis/styles. Themes are controlled at runtime by manipulating the [data-jarvis-theme] attribute on the root document element (<html>).

## 2. Supported Themes
- light: Standard light mode palette.
- dark: Contrast-preserving dark mode palette.
- system: Auto-detected via window.matchMedia('(prefers-color-scheme: dark)').

## 3. Usage Example
`	ypescript
import { provideTheme } from '@jarvis/styles';

const themeManager = provideTheme({ defaultTheme: 'system' });
themeManager.setTheme('dark');
console.log(themeManager.getTheme()); // 'dark'
`
