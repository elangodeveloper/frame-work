import { signal, type Signal } from '@jarvis/reactive';
import type { SlotContent } from './content-slot.ts';

/**
 * SlotContext coordinates multi-slot projection between active screens and the active layout.
 * Completely decouples screens from the layout's internal DOM structure.
 */
export class SlotContext {
  private readonly slots = new Map<string, Signal<SlotContent>>();

  getSlotSignal(name: string): Signal<SlotContent> {
    let sig = this.slots.get(name);
    if (!sig) {
      sig = signal<SlotContent>(null);
      this.slots.set(name, sig);
    }
    return sig;
  }

  setSlotComponent(slotName: string, componentClass: any, inputs?: Record<string, any>, outputs?: Record<string, (val: any) => void>): void {
    const sig = this.getSlotSignal(slotName);
    sig.set({ type: 'component', componentClass, inputs, outputs });
  }

  setSlotRender(slotName: string, renderFn: (renderer: any) => any): void {
    const sig = this.getSlotSignal(slotName);
    sig.set({ type: 'render', renderFn });
  }

  clearSlot(slotName: string): void {
    const sig = this.slots.get(slotName);
    if (sig) {
      sig.set(null);
    }
  }

  clearAll(): void {
    for (const sig of this.slots.values()) {
      sig.set(null);
    }
  }
}
