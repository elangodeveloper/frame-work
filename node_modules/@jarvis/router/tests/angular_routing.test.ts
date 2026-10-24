import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestRenderer } from '../../renderer/src/index.ts';
import { flushJobs, signal, computed } from '../../reactive/src/index.ts';
import { input } from '../../core/src/index.ts';
import {
  provideRouter,
  RouteConfigError,
  RedirectCommand,
  RouterOutlet,
  bindRouterLink,
  withComponentInputBinding,
  withInMemoryScrolling,
  withRouterConfig,
  withNavigationErrorHandler,
  withDebugTracing,
  withPreloading,
  PreloadAllModules,
  type Routes,
  type Router,
  type RouteMatch,
  type ActivatedRouteSnapshot,
  type RouterStateSnapshot,
} from '../src/index.ts';

class TestComponent {
  readonly id = input<string>('');
  readonly name = input<string>('');
  renderCount = 0;

  render(renderer: any) {
    this.renderCount++;
    const el = renderer.createElement('div');
    renderer.appendChild(el, renderer.createText(`Comp ID=${this.id() || ''}`));
    return el;
  }
}

class ChildComponent {
  render(renderer: any) {
    const el = renderer.createElement('span');
    renderer.appendChild(el, renderer.createText('Child View'));
    return el;
  }
}

describe('PHASE 2: Angular-style Routing Complete Verification', () => {
  describe('2.1 Routes & Startup Config Validation', () => {
    it('should throw clear error when both component and loadComponent are specified', () => {
      const routes: Routes = [
        { path: 'bad', component: TestComponent, loadComponent: async () => TestComponent },
      ];
      assert.throws(() => provideRouter(routes), (err: any) => {
        assert.ok(err instanceof RouteConfigError);
        assert.ok(err.message.includes('both "component" and "loadComponent"'));
        return true;
      });
    });

    it('should throw clear error when both children and loadChildren are specified', () => {
      const routes: Routes = [
        { path: 'bad', children: [], loadChildren: async () => [] },
      ];
      assert.throws(() => provideRouter(routes), (err: any) => {
        assert.ok(err instanceof RouteConfigError);
        assert.ok(err.message.includes('both "children" and "loadChildren"'));
        return true;
      });
    });

    it('should detect redirect loop to self', () => {
      const routes: Routes = [
        { path: 'loop', redirectTo: 'loop' },
      ];
      assert.throws(() => provideRouter(routes), (err: any) => {
        assert.ok(err instanceof RouteConfigError);
        assert.ok(err.message.includes('Redirect loop detected'));
        return true;
      });
    });

    it('should detect duplicate route definitions on the same outlet without canMatch', () => {
      const routes: Routes = [
        { path: 'dup', component: TestComponent },
        { path: 'dup', component: ChildComponent },
      ];
      assert.throws(() => provideRouter(routes), (err: any) => {
        assert.ok(err instanceof RouteConfigError);
        assert.ok(err.message.includes('Duplicate route definition detected'));
        return true;
      });
    });
  });

  describe('2.2 Router, createUrlTree & Navigation Extras', () => {
    it('should handle queryParamsHandling merge and preserve', async () => {
      const router = provideRouter([{ path: 'list', component: TestComponent }], { initialUrl: '/list?page=1&sort=asc' });
      await router.navigateByUrl('/list?page=1&sort=asc');

      // Merge: keep page=1, add filter=active
      const treeMerge = router.createUrlTree(['list'], {
        queryParams: { filter: 'active' },
        queryParamsHandling: 'merge',
      });
      assert.strictEqual(router.serializeUrl(treeMerge), '/list?page=1&sort=asc&filter=active');

      // Preserve: ignore new params, keep existing
      const treePreserve = router.createUrlTree(['list'], {
        queryParams: { newParam: 'ignored' },
        queryParamsHandling: 'preserve',
      });
      assert.strictEqual(router.serializeUrl(treePreserve), '/list?page=1&sort=asc');
    });

    it('should handle fragment and preserveFragment', async () => {
      const router = provideRouter([{ path: 'docs', component: TestComponent }], { initialUrl: '/docs#section1' });
      await router.navigateByUrl('/docs#section1');

      const treePreserveFrag = router.createUrlTree(['docs'], {
        preserveFragment: true,
      });
      assert.strictEqual(router.serializeUrl(treePreserveFrag), '/docs#section1');
    });

    it('should support isActive for exact and subset checks', async () => {
      const router = provideRouter([
        { path: 'admin', component: TestComponent },
        { path: 'admin/users', component: ChildComponent },
      ], { initialUrl: '/admin/users?sort=asc#top' });
      await router.navigateByUrl('/admin/users?sort=asc#top');

      // Exact match on full url
      assert.strictEqual(router.isActive('/admin/users?sort=asc#top'), true);
      // Path mismatch on exact
      assert.strictEqual(router.isActive('/admin', { paths: 'exact', queryParams: 'ignored', fragment: 'ignored' }), false);
      // Path subset match
      assert.strictEqual(router.isActive('/admin', { paths: 'subset', queryParams: 'ignored', fragment: 'ignored' }), true);
    });
  });

  describe('2.4 & 2.6 ActivatedRoute signals & Multi-value Query Parameters', () => {
    it('should support multi-value query parameters and queryParamMap get/getAll/has/keys', async () => {
      const router = provideRouter([
        { path: 'search', component: TestComponent },
      ], { initialUrl: '/' });

      await router.navigateByUrl('/search?tag=rust&tag=typescript&order=desc');

      const qMap = router.activatedRoute.queryParamMap();
      assert.strictEqual(qMap.has('tag'), true);
      assert.strictEqual(qMap.has('missing'), false);
      assert.strictEqual(qMap.get('tag'), 'rust');
      assert.deepStrictEqual(qMap.getAll('tag'), ['rust', 'typescript']);
      assert.deepStrictEqual(qMap.getAll('order'), ['desc']);
      assert.ok(qMap.keys.includes('tag'));
      assert.ok(qMap.keys.includes('order'));
    });
  });

  describe('2.5 Route Parameters, Reactivity & Route Reuse', () => {
    it('should update the SAME component instance reactively without recreating it (employees/1 -> employees/2)', async () => {
      const renderer = new TestRenderer();
      const host = renderer.createElement('div');
      const routes: Routes = [
        { path: 'employees/:id', component: TestComponent },
      ];

      const router = provideRouter(routes, { initialUrl: '/employees/1' }, withComponentInputBinding());
      const outlet = new RouterOutlet(renderer, router, host);

      await router.navigateByUrl('/employees/1');
      flushJobs();

      const instance1 = outlet.component;
      assert.ok(instance1);
      assert.strictEqual(instance1.id(), '1');
      assert.strictEqual(instance1.renderCount, 1);

      // Navigate to employees/2
      await router.navigateByUrl('/employees/2');
      flushJobs();

      const instance2 = outlet.component;
      // MUST be the exact same instance!
      assert.strictEqual(instance1, instance2, 'Component instance must be reused!');
      assert.strictEqual(instance2.id(), '2', 'Signal input must update reactively to 2!');
      // Did NOT re-run render() / recreate DOM
      assert.strictEqual(instance2.renderCount, 1);

      outlet.destroy();
    });

    it('should decode URL encoded route parameters properly', async () => {
      const router = provideRouter([
        { path: 'files/:filename', component: TestComponent },
      ], { initialUrl: '/' });

      await router.navigateByUrl('/files/my%20document%20%231.pdf');
      assert.strictEqual(router.activatedRoute.params().filename, 'my document #1.pdf');
      assert.strictEqual(router.activatedRoute.paramMap().get('filename'), 'my document #1.pdf');
    });
  });

  describe('2.7 Child routes & Named Outlets', () => {
    it('should parse and serialize named/auxiliary outlets e.g. /home(sidebar:chat)', () => {
      const router = provideRouter([]);
      const tree = router.parseUrl('/home(sidebar:chat//secondary:help)');
      assert.strictEqual(tree.root.segments[0].path, 'home');
      assert.ok(tree.root.children['sidebar']);
      assert.strictEqual(tree.root.children['sidebar'].segments[0].path, 'chat');
      assert.ok(tree.root.children['secondary']);
      assert.strictEqual(tree.root.children['secondary'].segments[0].path, 'help');

      const serialized = router.serializeUrl(tree);
      assert.strictEqual(serialized, '/home(sidebar:chat//secondary:help)');
    });
  });

  describe('2.9 & 2.10 Guards Order & Resolvers', () => {
    it('should execute guards in exact order: canMatch -> canDeactivate -> canActivate -> resolvers', async () => {
      const order: string[] = [];

      class CompWithDeactivate {
        render(r: any) { return r.createElement('div'); }
      }

      const routes: Routes = [
        {
          path: 'step1',
          component: CompWithDeactivate,
          canDeactivate: [
            async () => {
              order.push('canDeactivate');
              return true;
            },
          ],
        },
        {
          path: 'step2',
          component: TestComponent,
          canMatch: [
            async () => {
              order.push('canMatch');
              return true;
            },
          ],
          canActivate: [
            async () => {
              order.push('canActivate');
              return true;
            },
          ],
          resolve: {
            data: async () => {
              order.push('resolve');
              return { done: true };
            },
          },
          title: async () => {
            order.push('titleResolver');
            return 'Step 2 Title';
          },
        },
      ];

      const router = provideRouter(routes, { initialUrl: '/step1' });
      await router.navigateByUrl('/step1');

      order.length = 0; // reset
      await router.navigateByUrl('/step2');

      assert.deepStrictEqual(order, [
        'canMatch',
        'canDeactivate',
        'canActivate',
        'resolve',
        'titleResolver',
      ]);
      assert.strictEqual(router.activatedRoute.title(), 'Step 2 Title');
    });

    it('should short-circuit navigation and redirect when a guard returns RedirectCommand', async () => {
      const router = provideRouter([
        {
          path: 'protected',
          component: TestComponent,
          canActivate: [
            () => new RedirectCommand(router.parseUrl('/login?returnUrl=/protected')),
          ],
        },
        { path: 'login', component: ChildComponent },
      ], { initialUrl: '/' });

      const success = await router.navigateByUrl('/protected');
      assert.strictEqual(success, true);
      assert.strictEqual(router.url(), '/login?returnUrl=/protected');
    });
  });

  describe('2.11 Navigation Lifecycle Events', () => {
    it('should emit the complete navigation event stream in order', async () => {
      const eventsRecorded: string[] = [];
      const routes: Routes = [
        {
          path: 'page',
          component: TestComponent,
          canActivate: [() => true],
          resolve: { x: () => 1 },
        },
      ];

      const router = provideRouter(routes, { initialUrl: '/' });
      router.events.subscribe((evt) => {
        if (evt.id === 2) {
          eventsRecorded.push(evt.type);
        }
      });

      await router.navigateByUrl('/page');

      assert.deepStrictEqual(eventsRecorded, [
        'NavigationStart',
        'RoutesRecognized',
        'GuardsCheckStart',
        'GuardsCheckEnd',
        'ResolveStart',
        'ResolveEnd',
        'ActivationStart',
        'ActivationEnd',
        'NavigationEnd',
      ]);
    });
  });

  describe('2.8 Lazy Loading & Preloading Strategies', () => {
    it('canMatch should prevent lazy loading when false', async () => {
      let loaded = false;
      const routes: Routes = [
        {
          path: 'admin',
          canMatch: [() => false],
          loadComponent: async () => {
            loaded = true;
            return TestComponent;
          },
        },
        {
          path: 'admin',
          component: ChildComponent,
        },
      ];

      const router = provideRouter(routes, { initialUrl: '/' });
      await router.navigateByUrl('/admin');

      assert.strictEqual(loaded, false, 'Lazy component should not have been loaded!');
      assert.strictEqual(router.activeRoute()?.route.component, ChildComponent);
    });

    it('PreloadAllModules should preload all lazy chunks on startup', () => {
      let preloaded = false;
      const routes: Routes = [
        {
          path: 'lazy-route',
          loadComponent: async () => {
            preloaded = true;
            return TestComponent;
          },
        },
      ];

      provideRouter(routes, withPreloading(PreloadAllModules));
      assert.strictEqual(preloaded, true, 'Lazy chunk should be preloaded immediately');
    });
  });
});
