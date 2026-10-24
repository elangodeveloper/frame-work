import { describe, it, expect } from 'vitest';
import { HomeComponent } from './home.component.ts';

describe('HomeComponent', () => {
  it('should initialize with greeting signal', () => {
    const component = new HomeComponent();
    expect(component.greeting()).toBe('Welcome to the Jarvis Enterprise Framework');
  });
});
