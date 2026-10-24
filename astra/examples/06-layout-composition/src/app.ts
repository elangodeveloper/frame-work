import { DOMRenderer } from '@jarvis/renderer';
import { provideRouter } from '@jarvis/router';
import { LayoutRouterOutlet, defaultLayoutRegistry } from '@jarvis/layout';
import { routes } from './app.routes.ts';

export function bootstrapApp(mountElementId = 'app-root') {
  const renderer = new DOMRenderer();
  const router = provideRouter(routes);

  let hostEl: any = null;
  if (typeof document !== 'undefined') {
    hostEl = document.getElementById(mountElementId);
  }

  const outlet = new LayoutRouterOutlet(renderer, router, hostEl, {
    registry: defaultLayoutRegistry,
  });

  return { router, outlet, renderer };
}

if (typeof document !== 'undefined') {
  bootstrapApp();
}
