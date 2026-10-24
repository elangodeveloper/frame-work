import type { CanDeactivateFn } from '@jarvis/router';

export interface HasPendingChanges {
  hasPendingChanges?: () => boolean;
}

export const unsavedChangesGuard: CanDeactivateFn<HasPendingChanges> = (component) => {
  if (component && typeof component.hasPendingChanges === 'function') {
    if (component.hasPendingChanges()) {
      return false;
    }
  }
  return true;
};
