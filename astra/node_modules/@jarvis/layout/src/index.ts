/**
 * @jarvis/layout: Public API
 * Native layout composition, slot projection, responsive engine, and route-layout integration.
 */

export * from './contracts/layout.contract.ts';
export * from './composition/component-host.ts';
export * from './composition/content-slot.ts';
export * from './composition/slot-context.ts';
export * from './primitives/container.ts';
export * from './primitives/stack.ts';
export * from './primitives/grid.ts';
export * from './primitives/split-pane.ts';
export * from './primitives/sidebar-region.ts';
export * from './primitives/content-region.ts';
export * from './components/header.component.ts';
export * from './components/sidebar.component.ts';
export * from './components/footer.component.ts';
export * from './layouts/main-layout.component.ts';
export * from './layouts/dashboard-layout.component.ts';
export * from './layouts/auth-layout.component.ts';
export * from './layouts/minimal-layout.component.ts';
export * from './router/layout-registry.ts';
export * from './router/layout-router-outlet.ts';
export * from './state/layout-state.service.ts';
