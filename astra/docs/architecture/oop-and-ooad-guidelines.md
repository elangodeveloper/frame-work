# JARVIS: Object-Oriented Analysis & Design (OOAD) Guidelines

## 1. Core Principles in JARVIS

JARVIS combines the clarity and structure of **Object-Oriented Programming (OOP)** with the responsiveness of **fine-grained signal reactivity**.

---

## 2. SOLID Design Guidelines

### S — Single Responsibility Principle (SRP)
- **Component Classes**: Presentation logic only. A component does not make raw HTTP calls, manage localStorage sessions, or calculate tax formulas.
- **Service Classes**: Application operations and domain orchestration.
- **Repository Classes**: Encapsulates external storage, API persistence, and data serialization.
- **Compiler Stages**: The lexer tokenizes, the parser creates the AST, the IR normalizes instructions, and the codegen emits JavaScript.

### O — Open / Closed Principle (OCP)
- Systems are open for extension but closed for modification.
- Extensibility in JARVIS is achieved via interfaces and provider swapping:
  ```typescript
  // Replace real API with in-memory mock for automated tests
  injector.provide({
    provide: EmployeeRepositoryToken,
    useClass: MockEmployeeRepository,
  });
  ```

### L — Liskov Substitution Principle (LSP)
- Subtypes must be substitutable for their base abstractions without breaking client expectations.
- Adapters (e.g. `DOMRenderer` vs `TestRenderer`) implement the `Renderer` interface identically. Code compiled against `Renderer` runs in browser DOM or headless Node tests without modification.

### I — Interface Segregation Principle (ISP)
- Clients should not be forced to depend on methods they do not use.
- Lifecycle hooks are segregated into focused, independent interfaces:
  - `OnInit` (`onInit()`)
  - `AfterRender` (`afterRender()`)
  - `OnDestroy` (`onDestroy()`)
- A component only implements the specific lifecycle hooks it requires.

### D — Dependency Inversion Principle (DIP)
- High-level modules must not depend on low-level modules; both must depend on abstractions.
- Business services depend on an interface:
  ```typescript
  export interface EmployeeRepository {
    findAll(): Promise<Employee[]>;
  }

  export class EmployeeService {
    // Injected abstraction, not concrete Axios or fetch implementation
    private readonly repo = inject(EmployeeRepositoryToken);
  }
  ```

---

## 3. Composition Over Inheritance

A major failure in legacy OOP frameworks is the creation of massive base classes (e.g. `BaseComponent` containing 50 helper methods).

JARVIS explicitly rejects deep class hierarchies:
- **Zero universal `BaseComponent`**: Components are plain TypeScript classes decorated with `@Component`.
- Functionality is shared via **Dependency Injection of focused services** (`inject(AuthService)`) and reusable **Directives** or **Adapters**.
- Inheritance is reserved strictly for specialized polymorphic domain entities where a true "is-a" relationship exists.
