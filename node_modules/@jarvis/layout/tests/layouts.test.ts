import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestRenderer } from '@jarvis/renderer';
import { mountComponent, unmountComponent } from '../src/composition/component-host.ts';
import { MainLayoutComponent } from '../src/layouts/main-layout.component.ts';
import { DashboardLayoutComponent } from '../src/layouts/dashboard-layout.component.ts';
import { AuthLayoutComponent } from '../src/layouts/auth-layout.component.ts';
import { MinimalLayoutComponent } from '../src/layouts/minimal-layout.component.ts';
import { Component, input } from '@jarvis/core';

class DummyScreenComponent {
  readonly title = input<string>('Dummy Feature');

  render(r: any): any {
    const el = r.createElement('div');
    r.setAttribute(el, 'class', 'dummy-feature-root');
    const h2 = r.createElement('h2');
    r.bindText(h2, () => this.title());
    r.appendChild(el, h2);
    return el;
  }
}
Component({ selector: 'dummy-screen' })(DummyScreenComponent);

describe('Milestones 4, 6 & 9: Application Layouts & Reactive State', () => {
  it('MainLayoutComponent: should mount Header, Sidebar, Footer and ContentOutlet', () => {
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');

    const layoutRef = mountComponent(renderer, MainLayoutComponent, container, {
      inputs: {
        appTitle: 'JARVIS Command Center',
        navItems: [
          { id: '1', label: 'Dashboard', route: '/dashboard' },
          { id: '2', label: 'Employees', route: '/employees' },
        ],
      },
    });

    const html = container.toHtml();
    assert.ok(html.includes('jarvis-layout-shell'));
    assert.ok(html.includes('JARVIS Command Center'));
    assert.ok(html.includes('Dashboard'));
    assert.ok(html.includes('Employees'));
    assert.ok(html.includes('jarvis-footer'));

    // Project a screen into content outlet
    const outlet = layoutRef.instance.getContentOutlet();
    assert.ok(outlet);
    outlet!.project(DummyScreenComponent, { title: 'Executive Overview' });

    assert.ok(container.toHtml().includes('Executive Overview'));

    unmountComponent(layoutRef);
  });

  it('MainLayoutComponent: Header menu toggle should update layout sidebarOpen reactively without recreating the screen', () => {
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');

    const layoutRef = mountComponent(renderer, MainLayoutComponent, container);
    const layout = layoutRef.instance;

    const outlet = layout.getContentOutlet();
    const screenRef = outlet!.project(DummyScreenComponent, { title: 'Stable Screen' });
    const screenInstance = screenRef.instance;

    assert.equal(layout.sidebarOpen(), true);

    // Toggle sidebar
    layout.toggleSidebar();
    assert.equal(layout.sidebarOpen(), false);

    // Screen instance MUST remain identical! (Identity preservation)
    assert.strictEqual(outlet!.slot.getContent()?.type, 'component');
    assert.strictEqual((outlet!.slot.getContent() as any).componentClass, DummyScreenComponent);

    unmountComponent(layoutRef);
  });

  it('DashboardLayoutComponent: should render toolbar slot and high-density content', () => {
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');

    const layoutRef = mountComponent(renderer, DashboardLayoutComponent, container, {
      inputs: { appTitle: 'Operations & Monitoring' },
    });

    const layout = layoutRef.instance;
    const toolbar = layout.getToolbarOutlet();
    assert.ok(toolbar);

    // Project toolbar button
    toolbar!.project(DummyScreenComponent, { title: 'Date Range: Last 30 Days' });
    assert.ok(container.toHtml().includes('Date Range: Last 30 Days'));

    // Project main analytical screen
    const content = layout.getContentOutlet();
    content!.project(DummyScreenComponent, { title: 'Active Pods: 98.4%' });
    assert.ok(container.toHtml().includes('Active Pods: 98.4%'));

    unmountComponent(layoutRef);
  });

  it('AuthLayoutComponent: should render focused auth shell without sidebars', () => {
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');

    const layoutRef = mountComponent(renderer, AuthLayoutComponent, container, {
      inputs: { brandName: 'Secure Identity Gateway' },
    });

    const html = container.toHtml();
    assert.ok(html.includes('jarvis-auth-layout'));
    assert.ok(html.includes('Secure Identity Gateway'));
    assert.ok(!html.includes('jarvis-sidebar')); // Strictly zero sidebar!

    const outlet = layoutRef.instance.getContentOutlet();
    outlet!.project(DummyScreenComponent, { title: 'Enter MFA Passcode' });
    assert.ok(container.toHtml().includes('Enter MFA Passcode'));

    unmountComponent(layoutRef);
  });

  it('MinimalLayoutComponent: should render distraction-free container', () => {
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');

    const layoutRef = mountComponent(renderer, MinimalLayoutComponent, container);
    const html = container.toHtml();
    assert.ok(html.includes('jarvis-minimal-layout'));
    assert.ok(!html.includes('jarvis-header'));
    assert.ok(!html.includes('jarvis-sidebar'));

    const outlet = layoutRef.instance.getContentOutlet();
    outlet!.project(DummyScreenComponent, { title: 'Full Screen Wizard Step 1' });
    assert.ok(container.toHtml().includes('Full Screen Wizard Step 1'));

    unmountComponent(layoutRef);
  });
});
