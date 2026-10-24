# JARVIS: Standardized Naming Conventions

## 1. Universal Naming Rules

Consistency across files, classes, selectors, and tokens is critical for automated code generation, tooling, and team maintenance.

---

## 2. Entity Naming Reference Matrix

| Entity Type | Class / Symbol Name | File Name | Selector / Token Pattern |
| :--- | :--- | :--- | :--- |
| **Component** | `EmployeeCardComponent` | `employee-card.component.ts` | `app-employee-card` |
| **Component Template** | N/A | `employee-card.component.html` | N/A |
| **Component Stylesheet** | N/A | `employee-card.component.css` | N/A |
| **Component Spec** | N/A | `employee-card.component.spec.ts`| N/A |
| **Page Component** | `EmployeeListPage` | `employee-list.page.ts` | `app-employee-list-page` |
| **Service** | `EmployeeService` | `employee.service.ts` | N/A |
| **Repository Interface** | `EmployeeRepository` | `employee-repository.interface.ts` | N/A |
| **Repository Class** | `HttpEmployeeRepository`| `employee.repository.ts` | `EmployeeRepositoryToken` |
| **Domain Model** | `Employee` | `employee.model.ts` | N/A |
| **Directive** | `TooltipDirective` | `tooltip.directive.ts` | `[appTooltip]` |
| **Pipe** | `DateFormatPipe` | `date-format.pipe.ts` | `dateFormat` |
| **Route Guard** | `authGuard` | `auth.guard.ts` | N/A |
| **Feature Routes** | `employeeRoutes` | `employees.routes.ts` | N/A |
| **Root Component** | `AppComponent` | `app.component.ts` | `app-root` |
| **Root Routes** | `routes` | `app.routes.ts` | N/A |
| **Entrypoint** | N/A | `main.ts` | N/A |

---

## 3. Style and Token Naming Rules

Centralized CSS variables defined in `@jarvis/styles` and application stylesheets adhere to the `--jarvis-*` namespace:

- **Colors**: `--jarvis-primary`, `--jarvis-primary-hover`, `--jarvis-surface`, `--jarvis-border`, `--jarvis-text-color`.
- **Spacing**: `--jarvis-space-1` (0.25rem), `--jarvis-space-2` (0.5rem), `--jarvis-space-4` (1rem), `--jarvis-space-6` (1.5rem).
- **Border Radii**: `--jarvis-radius-sm` (0.25rem), `--jarvis-radius-md` (0.5rem), `--jarvis-radius-lg` (0.75rem).
- **Z-Index**: `--jarvis-z-modal` (1100), `--jarvis-z-overlay` (1000).
