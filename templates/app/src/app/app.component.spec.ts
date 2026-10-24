import { describe, it, expect } from 'vitest';
import { AppComponent } from './app.component.ts';

describe('AppComponent', () => {
  it('should initialize with title signal', () => {
    const app = new AppComponent();
    expect(app.title()).toBe('Jarvis Enterprise Portal');
  });
});
