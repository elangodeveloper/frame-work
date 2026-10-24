import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestRenderer } from '@jarvis/renderer';
import { input, Component, type OnInit, type OnDestroy } from '@jarvis/core';
import { flushJobs } from '@jarvis/reactive';
import { SlotOutlet, ContentSlot } from '../src/composition/content-slot.ts';
import { SlotContext } from '../src/composition/slot-context.ts';

class ScreenAlphaComponent implements OnInit, OnDestroy {
  readonly pageTitle = input<string>('Alpha Screen');
  destroyed = false;

  onInit(): void {}

  onDestroy(): void {
    this.destroyed = true;
  }

  render(r: any): any {
    const el = r.createElement('section');
    r.setAttribute(el, 'class', 'screen-alpha');
    const h1 = r.createElement('h1');
    r.bindText(h1, () => this.pageTitle());
    r.appendChild(el, h1);
    return el;
  }
}
Component({ selector: 'screen-alpha' })(ScreenAlphaComponent);

class ScreenBetaComponent implements OnInit, OnDestroy {
  readonly message = input<string>('Beta Screen Content');
  destroyed = false;

  onInit(): void {}

  onDestroy(): void {
    this.destroyed = true;
  }

  render(r: any): any {
    const el = r.createElement('section');
    r.setAttribute(el, 'class', 'screen-beta');
    const p = r.createElement('p');
    r.bindText(p, () => this.message());
    r.appendChild(el, p);
    return el;
  }
}
Component({ selector: 'screen-beta' })(ScreenBetaComponent);

describe('Milestone 3: Content Projection & Slot Outlets', () => {
  it('should project a screen component into a named slot outlet', () => {
    const renderer = new TestRenderer();
    const outlet = new SlotOutlet(renderer, 'content');

    const ref = outlet.project(ScreenAlphaComponent, { pageTitle: 'Overview Dashboard' });
    assert.ok(outlet.getElement().toHtml().includes('Overview Dashboard'));
    assert.equal(ref.instance.destroyed, false);

    outlet.destroy();
    assert.equal(ref.instance.destroyed, true);
  });

  it('should preserve component identity and update inputs when same component class is projected', () => {
    const renderer = new TestRenderer();
    const outlet = new SlotOutlet(renderer, 'content');

    const ref1 = outlet.project(ScreenAlphaComponent, { pageTitle: 'Initial Page' });
    const instanceId1 = ref1.instance;
    assert.ok(outlet.getElement().toHtml().includes('Initial Page'));

    // Project again with updated inputs
    const ref2 = outlet.project(ScreenAlphaComponent, { pageTitle: 'Updated Page' });
    flushJobs();
    assert.strictEqual(ref1.instance, ref2.instance); // Identity preserved!
    assert.equal(ref1.instance.destroyed, false);
    assert.ok(outlet.getElement().toHtml().includes('Updated Page'));

    outlet.destroy();
  });

  it('should cleanly destroy previous projected screen when a new screen is projected', () => {
    const renderer = new TestRenderer();
    const outlet = new SlotOutlet(renderer, 'content');

    const alphaRef = outlet.project(ScreenAlphaComponent, { pageTitle: 'Alpha' });
    assert.equal(alphaRef.instance.destroyed, false);
    assert.ok(outlet.getElement().toHtml().includes('Alpha'));

    // Project Beta screen
    const betaRef = outlet.project(ScreenBetaComponent, { message: 'Welcome to Beta' });
    assert.equal(alphaRef.instance.destroyed, true); // Alpha is destroyed!
    assert.equal(betaRef.instance.destroyed, false);
    assert.ok(outlet.getElement().toHtml().includes('Welcome to Beta'));
    assert.ok(!outlet.getElement().toHtml().includes('screen-alpha'));

    outlet.destroy();
    assert.equal(betaRef.instance.destroyed, true);
  });

  it('should support dynamic slot coordination via SlotContext without coupling', () => {
    const context = new SlotContext();
    const actionSlotSig = context.getSlotSignal('header-actions');

    assert.equal(actionSlotSig(), null);

    context.setSlotRender('header-actions', (r) => {
      const btn = r.createElement('button');
      btn.textContent = 'Save Record';
      return btn;
    });

    const current = actionSlotSig();
    assert.ok(current);
    assert.equal(current?.type, 'render');

    context.clearSlot('header-actions');
    assert.equal(actionSlotSig(), null);
  });
});
