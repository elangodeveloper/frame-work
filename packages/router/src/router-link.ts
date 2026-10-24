import type { Renderer } from '../../renderer/src/index.ts';
import { signal, effect, type Signal } from '../../core/src/index.ts';
import type { Router } from './router.ts';
import type { NavigationExtras, UrlTree } from './types.ts';
import { serializeUrl, parseUrl } from './url-tree.ts';

export interface RouterLinkOptions extends NavigationExtras {
  activeClass?: string | string[];
  exact?: boolean;
  ariaCurrentWhenActive?: 'page' | 'step' | 'location' | 'date' | 'time' | boolean;
  preloadOnHover?: boolean;
  preloadOnFocus?: boolean;
}

export interface RouterLinkActiveRef {
  readonly isActive: Signal<boolean>;
  destroy(): void;
}

/**
 * Binds Angular-like [routerLink] and [routerLinkActive] behavior to a DOM element.
 * - Renders real href on <a>.
 * - Ctrl/Cmd/Shift/middle-click fall through to browser.
 * - Syncs active classes & aria-current.
 * - Configurable hover/focus lazy preloading.
 */
export function bindRouterLink(
  renderer: Renderer,
  element: any,
  router: Router,
  targetUrlOrCommands: string | any[] | UrlTree,
  options: RouterLinkOptions = {}
): RouterLinkActiveRef {
  const tree: UrlTree =
    typeof targetUrlOrCommands === 'object' && targetUrlOrCommands !== null && 'root' in targetUrlOrCommands
      ? (targetUrlOrCommands as UrlTree)
      : Array.isArray(targetUrlOrCommands)
      ? router.createUrlTree(targetUrlOrCommands, options)
      : router.createUrlTree([targetUrlOrCommands], options);

  const targetUrl = serializeUrl(tree);

  // Set real href on <a> tags for semantic HTML and accessibility
  renderer.setAttribute(element, 'href', targetUrl);

  // Preload lazy chunk on hover or focus if configured
  const triggerPreload = () => {
    const match = router.routes.find((r) => {
      const p = r.path?.replace(/^\/|\/$/g, '');
      const t = targetUrl.replace(/^\/|\/$/g, '').split('?')[0];
      return p === t || (p && t.startsWith(p));
    });
    if (match?.loadComponent) {
      match.loadComponent();
    }
  };

  const unlistenHover = options.preloadOnHover
    ? renderer.listen(element, 'mouseenter', triggerPreload)
    : () => {};

  const unlistenFocus = options.preloadOnFocus
    ? renderer.listen(element, 'focus', triggerPreload)
    : () => {};

  // Intercept click event
  const unlistenClick = renderer.listen(element, 'click', (event: MouseEvent) => {
    // Modifier-click or middle-click fall through to native browser behavior
    if (
      event &&
      (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
    ) {
      return;
    }

    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }

    router.navigateByUrl(tree, options);
  });

  const isActiveSignal = signal(false);
  let disposeEffect: (() => void) | null = null;

  if (options.activeClass || options.ariaCurrentWhenActive) {
    const rawClass = options.activeClass;
    const activeClasses = Array.isArray(rawClass)
      ? rawClass
      : typeof rawClass === 'string'
      ? rawClass.split(' ').filter(Boolean)
      : [];

    const exact = options.exact ?? false;

    disposeEffect = effect(() => {
      const current = router.url();
      const currentPath = current.split('?')[0].split('#')[0];
      const targetPath = targetUrl.split('?')[0].split('#')[0];

      const active = exact
        ? currentPath === targetPath
        : currentPath === targetPath || (targetPath !== '/' && currentPath.startsWith(targetPath));

      isActiveSignal.set(active);

      // Manage CSS active classes
      if (activeClasses.length > 0) {
        const existingClass =
          (element.attributes && typeof element.attributes.get === 'function'
            ? element.attributes.get('class')
            : element.className) || '';

        const classList = new Set(existingClass.split(' ').filter(Boolean));

        if (active) {
          for (const c of activeClasses) classList.add(c);
        } else {
          for (const c of activeClasses) classList.delete(c);
        }

        renderer.setAttribute(element, 'class', Array.from(classList).join(' '));
      }

      // Manage aria-current attribute
      if (options.ariaCurrentWhenActive) {
        if (active) {
          const ariaVal =
            typeof options.ariaCurrentWhenActive === 'string'
              ? options.ariaCurrentWhenActive
              : 'page';
          renderer.setAttribute(element, 'aria-current', ariaVal);
        } else {
          renderer.setAttribute(element, 'aria-current', 'false');
        }
      }
    });
  }

  const unbind: any = () => {
    unlistenClick();
    unlistenHover();
    unlistenFocus();
    if (disposeEffect) {
      disposeEffect();
      disposeEffect = null;
    }
  };
  unbind.isActive = isActiveSignal;
  unbind.destroy = unbind;

  return unbind;
}
