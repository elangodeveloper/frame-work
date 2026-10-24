import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TestRenderer } from '../../renderer/src/index.ts';
import { flushJobs } from '../../reactive/src/index.ts';
import {
  provideRouter,
  matchRouteTree,
  parseUrl,
  RouterOutlet,
  bindRouterLink,
  type Routes,
  type ActivatedRoute,
  type Router,
} from '../src/index.ts';

class HomeComponent {
  render(renderer: any) {
    const el = renderer.createElement('div');
    renderer.appendChild(el, renderer.createText('Home View'));
    return el;
  }
}

class DashboardComponent {
  render(renderer: any) {
    const el = renderer.createElement('div');
    renderer.appendChild(el, renderer.createText('Dashboard View'));
    return el;
  }
}

class UserDetailComponent {
  activatedRoute!: ActivatedRoute;
  destroyed = false;
  onDestroy() {
    this.destroyed = true;
  }
  render(renderer: any) {
    const el = renderer.createElement('div');
    renderer.appendChild(
      el,
      renderer.createText('User ID: ' + (this.activatedRoute.params().id || 'none') + ' / Data: ' + (this.activatedRoute.data().role || 'none'))
    );
    return el;
  }
}

class LazyLoadedComponent {
  render(renderer: any) {
    const el = renderer.createElement('div');
    renderer.appendChild(el, renderer.createText('Lazy Loaded Chunk View'));
    return el;
  }
}

class NotFoundComponent {
  render(renderer: any) {
    const el = renderer.createElement('div');
    renderer.appendChild(el, renderer.createText('404 Not Found'));
    return el;
  }
}

describe('@astra/router — Enhanced Route Matching, Guards, Resolvers & Lazy Chunks', () => {
  it('parseUrl should parse pathname, query parameters and fragment', () => {
    const res = parseUrl('/employees/101?tab=history&filter=active#details');
    assert.strictEqual(res.pathname, '/employees/101');
    assert.strictEqual(res.queryParams.tab, 'history');
    assert.strictEqual(res.queryParams.filter, 'active');
    assert.strictEqual(res.fragment, 'details');
  });

  it('matchRouteTree should handle nested children, params, data inheritance and wildcards', async () => {
    const routes: Routes = [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent, data: { section: 'admin' } },
      {
        path: 'users',
        children: [
          { path: ':id', component: UserDetailComponent, data: { role: 'engineer' } },
        ],
      },
      { path: '**', component: NotFoundComponent },
    ];

    const match1 = await matchRouteTree(routes, '/');
    assert.ok(match1);
    assert.strictEqual(match1.pathname, '/dashboard');
    assert.strictEqual(match1.data.section, 'admin');

    const match2 = await matchRouteTree(routes, '/users/99');
    assert.ok(match2);
    assert.strictEqual(match2.pathname, '/users/99');
    assert.strictEqual(match2.params.id, '99');
    assert.strictEqual(match2.data.role, 'engineer');

    const match3 = await matchRouteTree(routes, '/missing/path');
    assert.ok(match3);
    assert.strictEqual(match3.route.component, NotFoundComponent);
  });

  it('should load component lazily via loadComponent callback', async () => {
    let chunkLoaded = false;
    const routes: Routes = [
      {
        path: 'lazy',
        loadComponent: async () => {
          chunkLoaded = true;
          return { default: LazyLoadedComponent };
        },
      },
    ];

    const router = provideRouter(routes, { initialUrl: '/' });
    assert.strictEqual(chunkLoaded, false);

    const navSuccess = await router.navigateByUrl('/lazy');
    assert.strictEqual(navSuccess, true);
    assert.strictEqual(chunkLoaded, true);
    assert.strictEqual(router.activeRoute()?.route.component, LazyLoadedComponent);
  });

  it('should execute parallel resolvers and populate resolvedData into route signals', async () => {
    const routes: Routes = [
      {
        path: 'profile',
        component: HomeComponent,
        resolve: {
          user: async () => ({ name: 'Astra Architect' }),
          perms: async () => ['read', 'write'],
        },
      },
    ];

    const router = provideRouter(routes, { initialUrl: '/' });
    await router.navigateByUrl('/profile');

    const snapshot = router.activatedRoute.snapshot;
    assert.ok(snapshot);
    assert.deepStrictEqual(snapshot.resolvedData.user, { name: 'Astra Architect' });
    assert.deepStrictEqual(snapshot.resolvedData.perms, ['read', 'write']);
    assert.deepStrictEqual(router.activatedRoute.data().user, { name: 'Astra Architect' });
  });

  it('should cancel or supersede an in-flight navigation when a newer navigation starts', async () => {
    let firstNavFinished = false;
    const routes: Routes = [
      {
        path: 'slow',
        loadComponent: async () => {
          await new Promise((res) => setTimeout(res, 50));
          firstNavFinished = true;
          return HomeComponent;
        },
      },
      { path: 'fast', component: DashboardComponent },
    ];

    const router = provideRouter(routes, { initialUrl: '/' });
    const p1 = router.navigateByUrl('/slow');
    const p2 = router.navigateByUrl('/fast');

    const [res1, res2] = await Promise.all([p1, p2]);
    assert.strictEqual(res1, false, 'First navigation should be superseded');
    assert.strictEqual(res2, true, 'Second navigation should complete');
    assert.strictEqual(router.currentUrl(), '/fast');
  });

  it('RouterOutlet should cleanly render components and cleanup on destruction', async () => {
    const renderer = new TestRenderer();
    const host = renderer.createElement('div');
    const routes: Routes = [
      { path: 'users/:id', component: UserDetailComponent, data: { role: 'lead' } },
    ];

    const router = provideRouter(routes, { initialUrl: '/' });
    const outlet = new RouterOutlet(renderer, router, host);

    await router.navigateByUrl('/users/42');
    flushJobs();

    assert.ok(host.toHtml().includes('User ID: 42'));
    assert.ok(host.toHtml().includes('Data: lead'));

    outlet.destroy();
    assert.strictEqual(host.children.length, 0);
  });
});
