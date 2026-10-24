import { DOMRenderer } from '@jarvis/renderer';
import { provideRouter } from '@jarvis/router';
import { LayoutRouterOutlet, defaultLayoutRegistry } from '@jarvis/layout';
import { routes } from './src/app.routes.ts';

export function init() {
  const renderer = new DOMRenderer();
  const router = provideRouter(routes, { initialUrl: '/dashboard' });

  const rootEl = document.getElementById('app-root');
  if (!rootEl) {
    console.error('Mount point #app-root not found');
    return;
  }

  const outlet = new LayoutRouterOutlet(renderer, router, rootEl, {
    registry: defaultLayoutRegistry,
  });

  // Bind interactive demo buttons
  const btnDashboard = document.getElementById('btn-route-dashboard');
  const btnEmployees = document.getElementById('btn-route-employees');
  const btnLogin = document.getElementById('btn-route-login');

  btnDashboard?.addEventListener('click', () => router.navigate(['dashboard']));
  btnEmployees?.addEventListener('click', () => router.navigate(['employees']));
  btnLogin?.addEventListener('click', () => router.navigate(['login']));

  console.log('[JARVIS] Layout Composition Showcase mounted successfully.');
  return { router, outlet };
}

if (typeof document !== 'undefined') {
  init();
}
