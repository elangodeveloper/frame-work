import { describe, it, expect } from 'vitest';
import { AboutComponent } from './about.component.ts';

describe('AboutComponent', () => {
  it('should create instance', () => {
    const component = new AboutComponent();
    expect(component).toBeDefined();
  });
});
