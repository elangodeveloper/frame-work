import { describe, it, expect } from 'vitest';
import { NotFoundComponent } from './not-found.component.ts';

describe('NotFoundComponent', () => {
  it('should instantiate successfully', () => {
    const comp = new NotFoundComponent();
    expect(comp).toBeDefined();
  });
});
