# JARVIS: CLI Architecture & Code Generation Reference

## 1. Developer CLI Overview

The JARVIS CLI provides automated scaffolding, development server coordination, and Ahead-of-Time (AOT) application bundling.

```bash
jarvis <command> [schematic] [target] [options]
```

---

## 2. Available CLI Commands

### 2.1 Application Creation
```bash
jarvis create app <app-name> [--force]
```
Scaffolds a complete Angular-inspired enterprise application with feature-based directory organization, centralized styles, routing, and starter employee feature.

### 2.2 Component Generation
```bash
jarvis generate component <path> [--prefix <val>] [--style <css|scss>] [--skip-tests] [--force]
```
Aliases: `jarvis g c <path>`  
**Generated Artifacts**:
- `<path>/<name>.component.ts`
- `<path>/<name>.component.html`
- `<path>/<name>.component.css`
- `<path>/<name>.component.spec.ts`

### 2.3 Page Generation
```bash
jarvis generate page <path> [--skip-tests] [--force]
```
Aliases: `jarvis g p <path>`  
Generates a smart feature page component with page layout, route-readiness, and spec file.

### 2.4 Service Generation
```bash
jarvis generate service <path> [--skip-tests] [--force]
```
Aliases: `jarvis g s <path>`  
Generates an `@Injectable()` service injecting `HttpClient` and an accompanying spec file.

### 2.5 Directive Generation
```bash
jarvis generate directive <path> [--prefix <val>] [--skip-tests]
```
Aliases: `jarvis g d <path>`  
Generates a `@Directive()` class with element attachment lifecycle.

### 2.6 Pipe Generation
```bash
jarvis generate pipe <path> [--skip-tests]
```
Generates a `@Pipe()` class implementing `PipeTransform`.

### 2.7 Route Guard Generation
```bash
jarvis generate guard <path> [--skip-tests]
```
Generates a functional `CanActivateFn` guard.

### 2.8 Domain Model Generation
```bash
jarvis generate model <path>
```
Generates domain TypeScript interfaces.

### 2.9 Repository Generation (DIP)
```bash
jarvis generate repository <path>
```
Generates both:
1. `<path>/<name>-repository.interface.ts` (Abstraction contract)
2. `<path>/<name>.repository.ts` (Concrete `@Injectable()` implementation)

---

## 3. Collision Protection

The CLI prevents accidental file overwrite:
- If any target file already exists, the command terminates with a descriptive error:
  `[JARVIS CLI Error] File already exists: ... Use --force to overwrite.`
- Passing `--force` explicitly allows controlled overwrites during migrations.
