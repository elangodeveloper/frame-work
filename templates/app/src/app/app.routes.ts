import type { Routes } from '@jarvis/router';
import { HomeComponent } from './pages/home/home.component.ts';
import { NotFoundComponent } from './pages/not-found/not-found.component.ts';
import { authGuard } from './core/guards/auth.guard.ts';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', title: 'Home', component: HomeComponent },
  {
    path: 'employees',
    canActivate: [authGuard],
    loadChildren: () => import('./pages/employees/employees.routes.ts').then((m) => m.EMPLOYEE_ROUTES),
  },
  {
    path: 'about',
    title: 'About',
    loadComponent: () => import('./pages/about/about.component.ts').then((m) => m.AboutComponent),
  },
  { path: '**', title: 'Page Not Found', component: NotFoundComponent },
];
