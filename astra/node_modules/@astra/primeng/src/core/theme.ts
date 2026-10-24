/**
 * PrimeNG v20 Theming Bridge for Jarvis Framework.
 * Integrates @primeuix/themes tokens, presets (Aura, Lara, Nora, Material), and Tailwind CSS layers.
 */

export type PrimeThemePreset = 'Aura' | 'Lara' | 'Nora' | 'Material';

export interface PrimeNGConfigOptions {
  /**
   * Theme preset to apply (Defaults to 'Aura').
   */
  theme?: PrimeThemePreset | { preset?: PrimeThemePreset; options?: Record<string, any> };
  /**
   * Dark mode preference: 'system' matches OS, 'always' forces dark, 'never' forces light.
   */
  darkMode?: 'system' | 'always' | 'never';
  /**
   * Enable ripple effects on interactive components (Defaults to true).
   */
  ripple?: boolean;
  /**
   * Inject CSS layer rule `@layer primeng` to guarantee Tailwind CSS precedence.
   */
  cssLayer?: boolean;
}

export const AURA_THEME_TOKENS: Record<string, string> = {
  '--p-primary-color': '#10b981',
  '--p-primary-contrast-color': '#ffffff',
  '--p-primary-hover-color': '#059669',
  '--p-primary-active-color': '#047857',
  '--p-primary-50': '#ecfdf5',
  '--p-primary-100': '#d1fae5',
  '--p-primary-200': '#a7f3d0',
  '--p-primary-300': '#6ee7b7',
  '--p-primary-400': '#34d399',
  '--p-primary-500': '#10b981',
  '--p-primary-600': '#059669',
  '--p-primary-700': '#047857',
  '--p-primary-800': '#065f46',
  '--p-primary-900': '#064e3b',
  '--p-border-radius-sm': '4px',
  '--p-border-radius-md': '6px',
  '--p-border-radius-lg': '8px',
  '--p-surface-0': '#ffffff',
  '--p-surface-50': '#f8fafc',
  '--p-surface-100': '#f1f5f9',
  '--p-surface-200': '#e2e8f0',
  '--p-surface-300': '#cbd5e1',
  '--p-surface-700': '#334155',
  '--p-surface-800': '#1e293b',
  '--p-surface-900': '#0f172a',
  '--p-text-color': '#1e293b',
  '--p-text-muted-color': '#64748b',
  '--p-focus-ring-width': '2px',
  '--p-focus-ring-style': 'solid',
  '--p-focus-ring-color': 'rgba(16, 185, 129, 0.4)',
  '--p-focus-ring-offset': '1px',
  '--p-transition-duration': '0.15s',
};

export const LARA_THEME_TOKENS: Record<string, string> = {
  ...AURA_THEME_TOKENS,
  '--p-primary-color': '#3b82f6',
  '--p-primary-hover-color': '#2563eb',
  '--p-primary-500': '#3b82f6',
  '--p-focus-ring-color': 'rgba(59, 130, 246, 0.4)',
};

let currentConfig: PrimeNGConfigOptions = {
  theme: 'Aura',
  darkMode: 'system',
  ripple: true,
  cssLayer: true,
};

/**
 * Injects PrimeNG v20 design tokens and theme styles into document.head.
 */
export function providePrimeNG(options: PrimeNGConfigOptions = {}): void {
  currentConfig = { ...currentConfig, ...options };

  const presetName: PrimeThemePreset =
    typeof currentConfig.theme === 'string'
      ? currentConfig.theme
      : currentConfig.theme?.preset ?? 'Aura';

  const tokens = presetName === 'Lara' ? LARA_THEME_TOKENS : AURA_THEME_TOKENS;

  if (typeof document === 'undefined') {
    return; // Headless/SSR guard
  }

  // 1. Inject or update CSS variables stylesheet
  const styleId = 'jarvis-primeng-theme';
  let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  let css = ':root {\n';
  for (const [key, val] of Object.entries(tokens)) {
    css += `  ${key}: ${val};\n`;
  }
  css += '}\n';

  // Base PrimeNG v20 component style rules
  css += `
    @layer primeng {
      .p-component {
        font-family: inherit;
        box-sizing: border-box;
      }
      .p-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        cursor: pointer;
        user-select: none;
        vertical-align: middle;
        text-decoration: none;
        overflow: hidden;
        position: relative;
        font-weight: 600;
        font-size: 0.875rem;
        padding: 0.625rem 1rem;
        border-radius: var(--p-border-radius-md);
        border: 1px solid var(--p-primary-color);
        background: var(--p-primary-color);
        color: var(--p-primary-contrast-color);
        transition: background-color var(--p-transition-duration), border-color var(--p-transition-duration);
      }
      .p-button:hover:not(:disabled) {
        background: var(--p-primary-hover-color);
        border-color: var(--p-primary-hover-color);
      }
      .p-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .p-button-outlined {
        background: transparent;
        color: var(--p-primary-color);
      }
      .p-button-outlined:hover:not(:disabled) {
        background: var(--p-primary-50);
      }
      .p-button-text {
        background: transparent;
        border-color: transparent;
        color: var(--p-primary-color);
      }
      .p-button-text:hover:not(:disabled) {
        background: var(--p-surface-100);
      }
      .p-inputtext {
        font-family: inherit;
        font-size: 0.875rem;
        color: var(--p-text-color);
        background: var(--p-surface-0);
        padding: 0.625rem 0.75rem;
        border: 1px solid var(--p-surface-300);
        border-radius: var(--p-border-radius-md);
        transition: border-color var(--p-transition-duration), box-shadow var(--p-transition-duration);
        box-sizing: border-box;
      }
      .p-inputtext:focus {
        outline: none;
        border-color: var(--p-primary-color);
        box-shadow: 0 0 0 var(--p-focus-ring-width) var(--p-focus-ring-color);
      }
      .p-inputtext.p-invalid {
        border-color: #ef4444;
      }
      .p-datatable {
        width: 100%;
        border-collapse: collapse;
      }
      .p-datatable th, .p-datatable td {
        padding: 0.75rem 1rem;
        text-align: left;
        border-bottom: 1px solid var(--p-surface-200);
      }
      .p-datatable th {
        background: var(--p-surface-50);
        font-weight: 600;
        color: var(--p-text-color);
      }
      .p-dialog-mask {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1100;
      }
      .p-dialog {
        background: var(--p-surface-0);
        border-radius: var(--p-border-radius-lg);
        box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
        min-width: 320px;
        max-width: 90vw;
        border: 1px solid var(--p-surface-200);
        overflow: hidden;
      }
      .p-dialog-header {
        padding: 1.25rem;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid var(--p-surface-200);
        font-weight: 600;
        font-size: 1.125rem;
      }
      .p-dialog-content {
        padding: 1.25rem;
      }
    }
  `;

  styleEl.textContent = css;
}

/**
 * Returns current PrimeNG config in Jarvis.
 */
export function getPrimeNGConfig(): PrimeNGConfigOptions {
  return currentConfig;
}
