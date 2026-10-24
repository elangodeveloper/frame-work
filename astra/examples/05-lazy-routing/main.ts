import { provideRouter, RouterOutlet, type Routes } from '../../packages/router/src/index.ts';
import { DOMRenderer } from '../../packages/renderer/src/index.ts';
import { DashboardComponent } from './dashboard.ts';

export const adminGuard = async () => true;
export const analyticsResolver = async () => ({ metric: 'RealTime_TPS_9800' });

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent, title: 'Astra - Dashboard' },
  {
    path: 'analytics',
    loadComponent: () => import('./analytics.ts'),
    resolve: { metricData: analyticsResolver },
    title: 'Astra - Analytics',
  },
  {
    path: 'admin',
    loadComponent: () => import('./admin.ts'),
    canActivate: [adminGuard],
    title: 'Astra - Admin',
  },
];

export const router = provideRouter(routes);
const renderer = new DOMRenderer();
if (typeof document !== 'undefined') {
  const host = document.getElementById('router-outlet');
  if (host) new RouterOutlet(renderer, router, host);
}
console.log('Astra 3-feature app information loaded');
