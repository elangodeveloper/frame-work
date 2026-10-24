import type { Renderer } from '@jarvis/renderer';
import type { ComponentRef } from '@jarvis/runtime';
import { mountComponent, unmountComponent } from './component-host.ts';
import { signal, effect, type Signal } from '@jarvis/reactive';

export type SlotContent =
  | { type: 'component'; componentClass: any; inputs?: Record<string, any>; outputs?: Record<string, (val: any) => void> }
  | { type: 'element'; element: any }
  | { type: 'render'; renderFn: (renderer: Renderer) => any }
  | null;

/**
 * Manages projected content within a designated slot.
 * Ensures proper component lifecycle, reactive input updates, and clean teardown.
 */
export class ContentSlot {
  readonly name: string;
  private readonly renderer: Renderer;
  private readonly container: any;
  private activeComponentRef: ComponentRef | null = null;
  private activeElement: any = null;
  private currentContent: SlotContent = null;

  constructor(name: string, container: any, renderer: Renderer) {
    this.name = name;
    this.container = container;
    this.renderer = renderer;
  }

  getElement(): any {
    return this.container;
  }

  getContent(): SlotContent {
    return this.currentContent;
  }

  /**
   * Projects a component into this slot.
   * If the component class is identical to what's already mounted, updates inputs instead of recreating DOM.
   */
  projectComponent<T>(
    ComponentClass: new (...args: any[]) => T,
    inputs?: Record<string, any>,
    outputs?: Record<string, (val: any) => void>
  ): ComponentRef<T> {
    if (this.activeComponentRef && this.activeComponentRef.instance instanceof ComponentClass) {
      // Identity preservation: update inputs without recreating the DOM tree
      if (inputs) {
        for (const [key, val] of Object.entries(inputs)) {
          this.activeComponentRef.setInput(key, val);
        }
      }
      return this.activeComponentRef as ComponentRef<T>;
    }

    this.clear();

    const ref = mountComponent(this.renderer, ComponentClass, this.container, { inputs, outputs });
    this.activeComponentRef = ref;
    this.currentContent = { type: 'component', componentClass: ComponentClass, inputs, outputs };
    return ref;
  }

  /**
   * Projects an existing DOM/Test element into this slot.
   */
  projectElement(element: any): void {
    this.clear();
    this.activeElement = element;
    this.renderer.appendChild(this.container, element);
    this.currentContent = { type: 'element', element };
  }

  /**
   * Projects custom rendered content via render function.
   */
  projectRender(renderFn: (renderer: Renderer) => any): void {
    this.clear();
    const node = renderFn(this.renderer);
    if (node) {
      this.activeElement = node;
      this.renderer.appendChild(this.container, node);
    }
    this.currentContent = { type: 'render', renderFn };
  }

  /**
   * Cleans up and disposes any projected content in this slot.
   */
  clear(): void {
    if (this.activeComponentRef) {
      unmountComponent(this.activeComponentRef);
      this.activeComponentRef = null;
    }
    if (this.activeElement && this.container) {
      try {
        this.renderer.removeChild(this.container, this.activeElement);
      } catch (err) {
        // Element may already have been removed by child
      }
      this.activeElement = null;
    }
    this.currentContent = null;
  }

  destroy(): void {
    this.clear();
  }
}

/**
 * SlotOutlet component that can be placed inside layouts.
 */
export class SlotOutlet {
  readonly name: string;
  readonly slot: ContentSlot;
  private readonly element: any;

  constructor(renderer: Renderer, name = 'content', customElement?: any) {
    this.name = name;
    this.element = customElement || renderer.createElement('div');
    renderer.setAttribute(this.element, 'class', `jarvis-slot-outlet slot-${name}`);
    renderer.setAttribute(this.element, 'data-slot-name', name);
    this.slot = new ContentSlot(name, this.element, renderer);
  }

  getElement(): any {
    return this.element;
  }

  project<T>(ComponentClass: new (...args: any[]) => T, inputs?: Record<string, any>, outputs?: Record<string, (val: any) => void>): ComponentRef<T> {
    return this.slot.projectComponent(ComponentClass, inputs, outputs);
  }

  clear(): void {
    this.slot.clear();
  }

  destroy(): void {
    this.slot.destroy();
  }
}
