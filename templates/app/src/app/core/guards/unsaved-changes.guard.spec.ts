import { describe, it, expect } from 'vitest';
import { unsavedChangesGuard } from './unsaved-changes.guard.ts';

describe('unsavedChangesGuard', () => {
  it('should allow deactivation when no pending changes', () => {
    const component = { hasPendingChanges: () => false };
    expect(unsavedChangesGuard(component as any)).toBe(true);
  });

  it('should block deactivation when pending changes exist', () => {
    const component = { hasPendingChanges: () => true };
    expect(unsavedChangesGuard(component as any)).toBe(false);
  });
});
