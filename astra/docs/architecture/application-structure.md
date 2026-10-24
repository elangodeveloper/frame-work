# JARVIS: Standardized Application Structure

## 1. Generated Application Anatomy

When an application developer executes:
```bash
jarvis create app employee-app
```
JARVIS scaffolds an enterprise application engineered around feature cohesion, centralized styling, and clean architectural boundaries.

```text
employee-app/
├── public/
│   └── favicon.svg
├── src/
│   ├── app/
│   │   ├── app.component.ts       # Root host component
│   │   ├── app.component.html     # Root template with layout
│   │   ├── app.component.css      # Host layout styling
│   │   ├── app.component.spec.ts  # Root component tests
│   │   ├── app.routes.ts          # Root route declarations
│   │   └── app.config.ts          # App-wide providers & theme config
│   │
│   ├── features/                  # Business domains (Feature-based)
│   │   └── employees/
│   │       ├── employees.routes.ts
│   │       ├── pages/
│   │       │   └── employee-list/
│   │       │       ├── employee-list.page.ts
│   │       │       ├── employee-list.page.html
│   │       │       ├── employee-list.page.css
│   │       │       └── employee-list.page.spec.ts
│   │       ├── components/
│   │       │   └── employee-card/
│   │       │       ├── employee-card.component.ts
│   │       │       ├── employee-card.component.html
│   │       │       ├── employee-card.component.css
│   │       │       └── employee-card.component.spec.ts
│   │       ├── services/
│   │       │   └── employee.service.ts
│   │       ├── repositories/
│   │       │   └── employee.repository.ts
│   │       ├── models/
│   │       │   └── employee.model.ts
│   │       └── interfaces/
│   │           └── employee-repository.interface.ts
│   │
│   ├── shared/                    # Reusable cross-feature components & pipes
│   │   ├── components/
│   │   ├── directives/
│   │   └── pipes/
│   │
│   ├── core/                      # Application-wide singleton infrastructure
│   │   ├── services/              # Auth, Session, Storage
│   │   ├── tokens/                # API_BASE_URL, THEME_CONFIG
│   │   └── guards/                # Global Route Guards
│   │
│   ├── styles/                    # Centralized styling architecture
│   │   ├── styles.css             # Main stylesheet & imports
│   │   ├── tokens.css             # Design tokens & CSS custom properties
│   │   └── themes.css             # Light/Dark & preset theme swaps
│   │
│   └── main.ts                    # Application bootstrap entrypoint
│
├── dist/                          # Compiled production bundles
├── jarvis.config.ts               # Compiler & bundler configuration
├── package.json                   # Application dependencies
└── tsconfig.json                  # TypeScript compiler options
```

---

## 2. Directory Responsibilities

| Directory | Scope | Purpose | Reusability Rule |
| :--- | :--- | :--- | :--- |
| **`src/app/`** | Application Root | Defines application shell layout, top-level routes, navigation bar, and root outlet. | Root singleton only. |
| **`src/features/`** | Business Domains | Encapsulates all components, pages, services, models, and stores belonging to specific business capabilities (e.g., `employees/`, `billing/`). | Feature-private by default. |
| **`src/shared/`** | Generic Components | Houses UI components, generic form inputs, directives, and pipes reused across two or more independent features. | Domain-agnostic. No business logic. |
| **`src/core/`** | Singletons & Infra | Contains core application services instantiated once (Auth, HTTP Interceptors, Session). | System-wide singletons. |
| **`src/styles/`** | Theming & Tokens | Centralized CSS design tokens (`--jarvis-space-4`), themes, typography, and utility layers. | Global tokens. |

---

## 3. Promotion Rules: Feature to Shared Code

A common anti-pattern in frontend development is immediately placing every new component or service into `src/shared/`, leading to bloated, tightly coupled shared folders.

JARVIS enforces the **Rule of Three**:
1. When a component or utility is needed by only one feature, it **must** remain inside that feature (`src/features/<feature>/components/`).
2. When a component is needed across two features, analyze whether it can be parameterized without domain coupling.
3. Once a component or utility is required by **three or more distinct features**, it is promoted to `src/shared/components/`. All feature-specific types and business logic must be stripped during promotion.
