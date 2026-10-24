import { describe, it } from 'node:test';
import assert from 'node:assert';
import { provideTheme, JARVIS_TOKENS } from '../src/index.ts';

describe('@jarvis/styles - Theming & Design Tokens', () => {
  it('should expose centralized jarvis design tokens', () => {
    assert.strictEqual(JARVIS_TOKENS.colors.primary, 'var(--jarvis-color-primary)');
    assert.strictEqual(JARVIS_TOKENS.spacing[4], 'var(--jarvis-space-4)');
    assert.strictEqual(JARVIS_TOKENS.radii.md, 'var(--jarvis-radius-md)');
  });

  it('should provide theme manager with default and custom swapping', () => {
    const themer = provideTheme({ defaultTheme: 'light' });
    assert.strictEqual(themer.getTheme(), 'light');

    themer.setTheme('dark');
    assert.strictEqual(themer.getTheme(), 'dark');
  });
});
