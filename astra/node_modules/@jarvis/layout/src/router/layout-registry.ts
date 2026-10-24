import type { LayoutDefinition, LayoutConfig } from '../contracts/layout.contract.ts';
import { MainLayoutComponent } from '../layouts/main-layout.component.ts';
import { DashboardLayoutComponent } from '../layouts/dashboard-layout.component.ts';
import { AuthLayoutComponent } from '../layouts/auth-layout.component.ts';
import { MinimalLayoutComponent } from '../layouts/minimal-layout.component.ts';

/**
 * LayoutRegistry manages registered layout components and configurations.
 * Prevents hard-coding layout names throughout the router or compiler.
 */
export class LayoutRegistry {
  private static readonly instance = new LayoutRegistry();
  private readonly registry = new Map<string, LayoutDefinition>();

  constructor() {
    // Register standard out-of-the-box JARVIS layouts
    this.register('main', MainLayoutComponent, {
      showHeader: true,
      showSidebar: true,
      showFooter: true,
      contentWidth: 'normal',
    }, 'Standard enterprise application shell');

    this.register('dashboard', DashboardLayoutComponent, {
      showHeader: true,
      showSidebar: true,
      showFooter: false,
      contentWidth: 'wide',
    }, 'High-density analytics and operations dashboard');

    this.register('auth', AuthLayoutComponent, {
      showHeader: false,
      showSidebar: false,
      showFooter: true,
      contentWidth: 'narrow',
    }, 'Focused authentication and identity management');

    this.register('minimal', MinimalLayoutComponent, {
      showHeader: false,
      showSidebar: false,
      showFooter: false,
      contentWidth: 'wide',
    }, 'Distraction-free full viewport container');
  }

  static getDefault(): LayoutRegistry {
    return LayoutRegistry.instance;
  }

  register(name: string, component: any, defaultConfig?: LayoutConfig, description?: string): void {
    this.registry.set(name.toLowerCase(), {
      name: name.toLowerCase(),
      component,
      defaultConfig,
      description,
    });
  }

  get(name: string): LayoutDefinition | undefined {
    return this.registry.get(name.toLowerCase());
  }

  has(name: string): boolean {
    return this.registry.has(name.toLowerCase());
  }

  all(): LayoutDefinition[] {
    return Array.from(this.registry.values());
  }

  getRegisteredNames(): string[] {
    return Array.from(this.registry.keys());
  }

  clear(): void {
    this.registry.clear();
  }
}

export const defaultLayoutRegistry = LayoutRegistry.getDefault();
