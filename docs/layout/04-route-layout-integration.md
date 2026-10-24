# Route & Layout Integration in JARVIS

## 1. Declarative Route Layout Metadata

JARVIS separates route resolution from visual presentation. Routes declare which layout shell they belong to via the `data.layout` property:

```typescript
import type { Routes } from '@jarvis/router';
import { DashboardPage } from './features/dashboard/dashboard.page.ts';
import { EmployeeListPage } from './features/employees/employee-list.page.ts';
import { LoginPage } from './features/authentication/login.page.ts';

export const routes: Routes = [
  {
    path: '/dashboard',
    component: DashboardPage,
    data: { layout: 'main' },
  },
  {
    path: '/employees',
    component: EmployeeListPage,
    data: { layout: 'main' },
  },
  {
    path: '/login',
    component: LoginPage,
    data: { layout: 'auth' },
  },
];
```

---

## 2. Layout Registry (`LayoutRegistry`)

Layouts are registered in a central registry rather than hard-coded into the router or compiler:

```typescript
import { LayoutRegistry, defaultLayoutRegistry } from '@jarvis/layout';
import { CustomAdminLayout } from './layouts/admin-layout.ts';

// Register a custom layout
defaultLayoutRegistry.register('admin', CustomAdminLayout, {
  showHeader: true,
  showSidebar: true,
  contentWidth: 'wide',
}, 'Custom administration portal layout');
```

Built-in layouts available by default:
- `'main'`: `MainLayoutComponent` (Header + Sidebar + Content + Footer)
- `'dashboard'`: `DashboardLayoutComponent` (Toolbar slot + Mini sidebar)
- `'auth'`: `AuthLayoutComponent` (Centered card shell without sidebars)
- `'minimal'`: `MinimalLayoutComponent` (Full viewport container)

If an unknown layout name is specified in a route, JARVIS produces a diagnostic error:
```
[JARVIS Layout Error] Unknown layout 'invalid-layout' requested by route '/test'. Registered layouts: [main, dashboard, auth, minimal].
```

---

## 3. Layout Persistence vs. Layout Transition

The `LayoutRouterOutlet` inspects the active route and coordinates layout lifecycle:

```
Route Navigation: /dashboard (layout: 'main') -> /employees (layout: 'main')
  ┌────────────────────────────────────────────────────────┐
  │ MainLayoutComponent Instance PRESERVED                 │
  │ • Sidebar state (open/collapsed) REMAINS INTACT        │
  │ • Header DOM REMAINS INTACT                            │
  │ • Only Content Outlet unmounts Dashboard -> mounts Emp │
  └────────────────────────────────────────────────────────┘

Route Navigation: /employees (layout: 'main') -> /login (layout: 'auth')
  ┌────────────────────────────────────────────────────────┐
  │ Layout Transition Triggered                            │
  │ • MainLayoutComponent.onDestroy() called               │
  │ • MainLayout DOM removed                               │
  │ • AuthLayoutComponent instantiated & mounted           │
  │ • LoginPage mounted inside AuthLayout Content Outlet   │
  └────────────────────────────────────────────────────────┘
```

---

## 4. Nested Route Layout Inheritance

Child routes automatically inherit the layout defined on their parent route unless explicitly overridden:

```typescript
{
  path: '/admin',
  data: { layout: 'main' },
  children: [
    { path: 'users', component: UserListPage },     // Inherits 'main' layout
    { path: 'roles', component: RoleListPage },     // Inherits 'main' layout
    { path: 'kiosk', component: KioskPage, data: { layout: 'minimal' } }, // Overrides to 'minimal'
  ]
}
```
