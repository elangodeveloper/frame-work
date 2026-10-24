# JARVIS: Feature-Based Code Organization

## 1. Domain-Driven Modular Design

In traditional technical-layer architectures, code is divided by entity type:
```text
src/
├── components/   # All 150 components mixed together
├── services/     # All 80 services mixed together
└── models/       # All 120 interfaces mixed together
```
This causes high coupling, fragmented cognitive context, and severe merge conflicts in multi-developer teams.

JARVIS enforces **Feature-Based Organization**:
All artifacts related to a single business capability (domain) are colocated inside `src/features/<feature-name>/`:

```text
src/features/employees/
├── employees.routes.ts                    # Feature-level routing table
├── pages/
│   └── employee-list/
│       ├── employee-list.page.ts          # Page-level smart container
│       ├── employee-list.page.html
│       ├── employee-list.page.css
│       └── employee-list.page.spec.ts
├── components/
│   └── employee-card/
│       ├── employee-card.component.ts     # Presentation component
│       ├── employee-card.component.html
│       ├── employee-card.component.css
│       └── employee-card.component.spec.ts
├── services/
│   └── employee.service.ts                # Application operations & business logic
├── repositories/
│   ├── employee.repository.ts             # Concrete data source implementation
│   └── employee-repository.interface.ts   # Contract interface (DIP)
├── models/
│   └── employee.model.ts                  # Domain entities & value objects
└── state/
    └── employee.store.ts                  # Feature-scoped reactive signal store
```

---

## 2. Distinction: Pages vs. Components

JARVIS explicitly distinguishes between **Pages** and **Components**:

### Feature Pages (`.page.ts`)
- Mapped directly to route URLs in `employees.routes.ts`.
- Act as "smart containers" or coordinators.
- Inject feature services and stores.
- Orchestrate data loading and bind data to child presentation components.
- Do not define reusable UI layouts.

### Presentation Components (`.component.ts`)
- Pure presentation units.
- Receive data solely via signal inputs (`input()`, `input.required()`).
- Emit events solely via signal outputs (`output()`).
- Do not make HTTP requests directly.
- Fully reusable and testable in isolation.

---

## 3. Cross-Feature Isolation Rules

1. **No Deep Imports into Neighboring Features**:
   - `features/billing/` may NOT import from `features/employees/components/employee-card/employee-card.component.ts`.
   - If feature `billing` needs employee data, it must depend on an exported public service or interface, or the component must be promoted to `src/shared/`.
2. **Independent Lazy Loading**:
   - Every feature exposes a `routes` file (e.g., `employees.routes.ts`) allowing the root router to lazy-load the entire feature chunk on demand:
     ```typescript
     {
       path: 'employees',
       loadChildren: () => import('../features/employees/employees.routes.ts').then(m => m.employeeRoutes)
     }
     ```
