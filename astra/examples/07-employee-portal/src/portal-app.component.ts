import { Component, type OnInit, type OnDestroy } from '@jarvis/core';
import type { Renderer } from '@jarvis/renderer';
import { effect } from '@jarvis/reactive';
import { provideRouter, RouterOutlet, type Router } from '@jarvis/router';
import { AuthBrandPanelComponent } from './features/authentication/components/auth-brand-panel/auth-brand-panel.component.ts';
import { authRoutes } from './features/authentication/authentication.routes.ts';
import { AuthenticationService } from './features/authentication/services/authentication.service.ts';
import { OrganizationConfigService } from './features/authentication/services/organization-config.service.ts';

/**
 * PortalAppComponent: Master Root Component for JARVIS Employee Portal
 * Implements balanced split-screen layout with architectural brand identity
 * on the left, and fine-grained reactive auth workflows on the right.
 */
export class PortalAppComponent implements OnInit, OnDestroy {
  readonly authService: AuthenticationService;
  readonly orgConfig: OrganizationConfigService;
  readonly router: Router;
  value:string = 'portal-app-component';
  private outlet: RouterOutlet | null = null;
  private cleanupFns: Array<() => void> = [];

  constructor(
    authService?: AuthenticationService,
    orgConfig?: OrganizationConfigService,
    router?: Router
  ) {
    this.authService = authService || new AuthenticationService();
    this.orgConfig = orgConfig || new OrganizationConfigService();
    this.router =
      router ||
      provideRouter(authRoutes, {
        initialUrl: '/login',
      });
  }

  onInit(): void {
    // Session restoration
    this.authService.restoreSession();
  }

  render(r: Renderer): any {
    const root = r.createElement('div');
    r.setAttribute(root, 'class', 'jarvis-auth-split');

    // 1. Left Region: Brand & Identity Panel (Hidden on mobile)
    const brandPanel = new AuthBrandPanelComponent();
    const brandNode = brandPanel.render(r);
    r.appendChild(root, brandNode);

    // 2. Right Region: Authentication Flow Panel
    const authPanel = r.createElement('main');
    r.setAttribute(authPanel, 'class', 'jarvis-auth-panel');
    r.setAttribute(authPanel, 'id', 'main-auth-content');

    const authContent = r.createElement('div');
    r.setAttribute(authContent, 'class', 'jarvis-auth-content');

    // Mount RouterOutlet for dynamic screen resolution
    this.outlet = new RouterOutlet(r, this.router);
    r.appendChild(authContent, this.outlet.getElement());
    r.appendChild(authPanel, authContent);
    r.appendChild(root, authPanel);

    // 3. Reactively adapt layout between focused auth and expansive dashboard
    const routeLayoutSub = effect(() => {
      const url = this.router.currentUrl();
      const isDashboard = url.includes('dashboard') || url.includes('workspace');
      if (isDashboard) {
        r.setAttribute(root, 'class', 'jarvis-auth-split jarvis-auth-split--dashboard');
        r.setAttribute(authPanel, 'class', 'jarvis-auth-panel jarvis-auth-panel--dashboard');
        r.setAttribute(authContent, 'class', 'jarvis-auth-content jarvis-auth-content--dashboard');
      } else {
        r.setAttribute(root, 'class', 'jarvis-auth-split');
        r.setAttribute(authPanel, 'class', 'jarvis-auth-panel');
        r.setAttribute(authContent, 'class', 'jarvis-auth-content');
      }
    });
    this.cleanupFns.push(routeLayoutSub);

    return root;
  }

  onDestroy(): void {
    for (const cleanup of this.cleanupFns) {
      try {
        cleanup();
      } catch (e) {
        console.error('[PortalAppComponent] Cleanup error:', e);
      }
    }
    this.cleanupFns = [];

    if (this.outlet) {
      this.outlet.destroy();
      this.outlet = null;
    }
    if (this.router) {
      this.router.destroy();
    }
  }
}

Component({
  selector: 'app-portal-root',
  templateUrl: './portal-app.component.html',
  styleUrl: './portal-app.component.css',
})(PortalAppComponent);
