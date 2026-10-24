import { bootstrap, type ComponentRef } from '../../runtime/src/index.ts';
import { TestRenderer, type MockElement } from '../../renderer/src/index.ts';

import { flushJobs } from '../../reactive/src/index.ts';

export class ComponentFixture<T> {
  readonly componentRef: ComponentRef<T>;
  readonly instance: T;
  readonly hostElement: MockElement;
  readonly renderer: TestRenderer;

  constructor(componentRef: ComponentRef<T>, renderer: TestRenderer) {
    this.componentRef = componentRef;
    this.instance = componentRef.instance;
    this.hostElement = componentRef.hostElement as MockElement;
    this.renderer = renderer;
  }

  detectChanges(): void {
    flushJobs();
  }

  destroy(): void {
    this.componentRef.destroy();
  }
}

export class TestBed {
  static createComponent<T>(ComponentClass: new (...args: any[]) => T): ComponentFixture<T> {
    const renderer = new TestRenderer();
    const container = renderer.createElement('root-container');
    const ref = bootstrap(ComponentClass, container, renderer);
    return new ComponentFixture<T>(ref, renderer);
  }
}
