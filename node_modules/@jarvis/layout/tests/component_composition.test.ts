import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestRenderer } from '@jarvis/renderer';
import { signal, flushJobs } from '@jarvis/reactive';
import { input, output, Component, type OnInit, type OnDestroy } from '@jarvis/core';
import { mountComponent, unmountComponent } from '../src/composition/component-host.ts';

class ChildCardComponent implements OnInit, OnDestroy {
  readonly title = input<string>('Default Card');
  readonly count = input<number>(0);
  readonly actionClicked = output<string>();

  initialized = false;
  destroyed = false;

  onInit(): void {
    this.initialized = true;
  }

  triggerClick(): void {
    this.actionClicked.emit(`Clicked on ${this.title()}`);
  }

  onDestroy(): void {
    this.destroyed = true;
  }

  render(r: any): any {
    const el = r.createElement('div');
    r.setAttribute(el, 'class', 'child-card');
    const h2 = r.createElement('h2');
    r.bindText(h2, () => this.title());
    r.appendChild(el, h2);
    return el;
  }
}

Component({ selector: 'test-child' })(ChildCardComponent);

describe('Milestone 2: Component Composition & Contracts', () => {
  it('should mount child component with initial inputs and call onInit', () => {
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');

    const ref = mountComponent(renderer, ChildCardComponent, container, {
      inputs: { title: 'First Card', count: 42 },
    });

    assert.equal(ref.instance.initialized, true);
    assert.equal(ref.instance.title(), 'First Card');
    assert.equal(ref.instance.count(), 42);
    assert.ok(container.toHtml().includes('First Card'));

    unmountComponent(ref);
    assert.equal(ref.instance.destroyed, true);
  });

  it('should reactively update input values via setInput without recreating instance', () => {
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');

    const ref = mountComponent(renderer, ChildCardComponent, container, {
      inputs: { title: 'Initial Title' },
    });

    assert.equal(ref.instance.title(), 'Initial Title');
    assert.ok(container.toHtml().includes('Initial Title'));

    ref.setInput('title', 'Updated Title');
    flushJobs();
    assert.equal(ref.instance.title(), 'Updated Title');
    assert.ok(container.toHtml().includes('Updated Title'));

    unmountComponent(ref);
  });

  it('should subscribe to child component outputs and handle events without RxJS', () => {
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');

    let emittedMessage = '';
    const ref = mountComponent(renderer, ChildCardComponent, container, {
      inputs: { title: 'Analytics Card' },
      outputs: {
        actionClicked: (msg: string) => {
          emittedMessage = msg;
        },
      },
    });

    ref.instance.triggerClick();
    assert.equal(emittedMessage, 'Clicked on Analytics Card');

    unmountComponent(ref);
    // After unmount, listeners should be cleaned up
    assert.equal(ref.instance.destroyed, true);
  });
});
