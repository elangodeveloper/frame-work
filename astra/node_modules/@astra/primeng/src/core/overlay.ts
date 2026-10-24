/**
 * Overlay and Portal Management Service for modal dialogs and dropdown panels.
 */

export interface OverlayOptions {
  dismissOnEscape?: boolean;
  onDismiss?: () => void;
}

export class OverlayService {
  private static zIndexStack = 1100;
  private static escapeListenerAttached = false;
  private static activeOverlays: Array<{ id: number; onDismiss?: () => void }> = [];
  private static nextId = 1;

  /**
   * Allocates the next highest z-index in the overlay stack.
   */
  static nextZIndex(): number {
    this.zIndexStack += 10;
    return this.zIndexStack;
  }

  /**
   * Registers an open overlay to participate in escape key listeners and viewport management.
   */
  static register(options: OverlayOptions = {}): number {
    const id = this.nextId++;
    this.activeOverlays.push({ id, onDismiss: options.onDismiss });

    if (options.dismissOnEscape !== false && !this.escapeListenerAttached && typeof window !== 'undefined') {
      this.escapeListenerAttached = true;
      window.addEventListener('keydown', this.handleKeyDown);
    }

    return id;
  }

  /**
   * Unregisters an overlay when closed.
   */
  static unregister(id: number): void {
    this.activeOverlays = this.activeOverlays.filter((o) => o.id !== id);
    if (this.activeOverlays.length === 0 && this.escapeListenerAttached && typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.handleKeyDown);
      this.escapeListenerAttached = false;
    }
  }

  private static handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.activeOverlays.length > 0) {
      const topOverlay = this.activeOverlays[this.activeOverlays.length - 1];
      if (topOverlay && topOverlay.onDismiss) {
        topOverlay.onDismiss();
      }
    }
  };
}
