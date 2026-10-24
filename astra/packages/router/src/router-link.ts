import type { Renderer } from '../../renderer/src/index.ts';
import { effect } from '../../reactive/src/index.ts';
import type { Router } from './router.ts';

export interface RouterLinkOptions {
  activeClass?: string;
  exact?: boolean;
}

/**
 * Binds Angular-like [routerLink] and [routerLinkActive] behavior to a DOM element.
 * Intercepts click events, navigates via Jarvis Router, and toggles active CSS classes.
 */
export function bindRouterLink(
  renderer: Renderer,
  element: any,
  router: Router,
  targetUrl: string,
  options: RouterLinkOptions = {}
): () => void {
  // Set href attribute for semantic HTML and accessibility
  renderer.setAttribute(element, 'href', targetUrl);

  // Intercept click event
  const unlisten = renderer.listen(element, 'click', (event: any) => {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    router.navigateByUrl(targetUrl);
  });

  // Reactive routerLinkActive class synchronization
  let disposeEffect: (() => void) | null = null;
  if (options.activeClass) {
    const activeClasses = options.activeClass.split(' ').filter(Boolean);
    const exact = options.exact ?? false;

    disposeEffect = effect(() => {
      const current = router.currentUrl();
      const currentPath = current.split('?')[0];
      const targetPath = targetUrl.split('?')[0];

      const isActive = exact
        ? currentPath === targetPath
        : currentPath === targetPath || (targetPath !== '/' && currentPath.startsWith(targetPath));

      const existingClass =
        (element.attributes && typeof element.attributes.get === 'function'
          ? element.attributes.get('class')
          : element.className) || '';

      const classList = new Set(existingClass.split(' ').filter(Boolean));

      if (isActive) {
        for (const c of activeClasses) classList.add(c);
      } else {
        for (const c of activeClasses) classList.delete(c);
      }

      renderer.setAttribute(element, 'class', Array.from(classList).join(' '));
    });
  }

  return () => {
    unlisten();
    if (disposeEffect) {
      disposeEffect();
    }
  };
}
