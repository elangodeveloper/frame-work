/**
 * JARVIS Employee Portal: Application Entrypoint
 * Bootstraps PortalAppComponent with DOMRenderer and Router
 */

import { DOMRenderer } from '@jarvis/renderer';
import { providePrimeNG } from '@jarvis/primeng';
import { bootstrap } from '@jarvis/runtime';
import { PortalAppComponent } from './src/portal-app.component.ts';

// 1. Initialize PrimeNG Theming Bridge
providePrimeNG({
  theme: 'Aura',
  ripple: true,
  cssLayer: true,
});

// 2. Mount Application into #app-root
const renderer = new DOMRenderer();
const container = document.getElementById('app-root') || document.body;

const appRef = bootstrap(PortalAppComponent, container, renderer);
const router = appRef.instance.router;

// 3. Global click interceptor for SPA navigation
document.addEventListener('click', (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  const anchor = target?.closest('a') as HTMLAnchorElement | null;
  if (!anchor) return;

  const href = anchor.getAttribute('href');
  if (href && href.startsWith('/') && !href.startsWith('//')) {
    event.preventDefault();
    const cleanPath = href.replace(/^\//, '');
    router.navigate(cleanPath ? [cleanPath] : []);
  }
});

// 4. History back/forward popstate synchronization
window.addEventListener('popstate', () => {
  const path = window.location.pathname.replace(/^\//, '');
  router.navigate(path ? [path] : []);
});

console.log('✦ JARVIS Employee Portal Mounted Successfully with Fine-Grained Reactive Signals');
