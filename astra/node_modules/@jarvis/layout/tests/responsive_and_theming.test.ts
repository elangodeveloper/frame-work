import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { TestRenderer } from '@jarvis/renderer';
import { mountComponent, unmountComponent } from '../src/composition/component-host.ts';
import { MainLayoutComponent } from '../src/layouts/main-layout.component.ts';
import { LayoutStateService } from '../src/state/layout-state.service.ts';
import { provideTheme, JARVIS_TOKENS } from '@jarvis/styles';
import { flushJobs } from '@jarvis/reactive';

describe('Milestones 8 & 10: Responsive Engine & Theme Integration', () => {
  it('should manage responsive mobile drawer and backdrop overlay', () => {
    const renderer = new TestRenderer();
    const container = renderer.createElement('div');

    const layoutRef = mountComponent(renderer, MainLayoutComponent, container);
    const layout = layoutRef.instance;

    assert.equal(layout.mobileDrawerOpen(), false);

    // Open mobile drawer
    layout.toggleMobileDrawer();
    flushJobs();
    assert.equal(layout.mobileDrawerOpen(), true);

    const html = container.toHtml();
    assert.ok(html.includes('jarvis-drawer-backdrop--active'));

    // Close mobile drawer
    layout.closeMobileDrawer();
    flushJobs();
    assert.equal(layout.mobileDrawerOpen(), false);

    unmountComponent(layoutRef);
  });

  it('LayoutStateService should maintain synchronized reactive signals', () => {
    const service = new LayoutStateService();

    assert.equal(service.sidebarOpen(), true);
    assert.equal(service.isMobile(), false);
    assert.equal(service.isSidebarVisible(), true);

    service.setMobile(true);
    assert.equal(service.isMobile(), true);
    assert.equal(service.isSidebarVisible(), false); // Hidden on mobile until drawer opens

    service.toggleMobileDrawer();
    assert.equal(service.mobileDrawerOpen(), true);
    assert.equal(service.isSidebarVisible(), true); // Visible because drawer is open

    service.closeMobileDrawer();
    assert.equal(service.mobileDrawerOpen(), false);
  });

  it('should integrate with centralized JARVIS design tokens and theme manager', () => {
    assert.ok(JARVIS_TOKENS.colors.surface);
    assert.ok(JARVIS_TOKENS.colors.background);
    assert.ok(JARVIS_TOKENS.spacing[4]);

    const themeManager = provideTheme({ defaultTheme: 'light' });
    assert.equal(themeManager.getTheme(), 'light');

    themeManager.setTheme('dark');
    assert.equal(themeManager.getTheme(), 'dark');
  });
});
