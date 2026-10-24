# JARVIS Architecture: Incremental Compilation & File Structure Mapping

## 1. File Structure Alignment with the Compiler Graph

The file structure of JARVIS components and applications directly mirrors the dependency structure required by the incremental compiler graph:

```text
user-card.component.ts
   │
   ├──► user-card.component.html  (Template Stage)
   │
   └──► user-card.component.css   (Style Stage)
```

By decoupling a component into separate files, JARVIS avoids treating the component as an indivisible black box.

---

## 2. Invalidation Mechanics Across Files

| File Modified | Impact Classification | Recompiled Pipeline Stages | Preserved Pipeline Stages | Browser Action |
| :--- | :--- | :--- | :--- | :--- |
| **`*.component.css`** | `css-only` | `style` | `template`, `typescript`, `codegen` | Hot CSS Swap (`<style id="...">`) |
| **`*.component.html`**| `template-only`| `template`, `codegen` | `style`, `typescript` | Hot View Factory Swap |
| **`*.component.ts` (body)**| `ts-impl` | `typescript`, `codegen` | All consumer components preserved | Hot ESM Module Reload |
| **`*.component.ts` (contract)**| `ts-public-contract` | `typescript`, `codegen` | Dependent consumers invalidated | Hot Module / Full Reload |
| **`jarvis.config.ts`**| `config` | All stages | None | Clean Rebuild & Full Reload |

---

## 3. Preservation of Unchanged Output Files

During continuous builds, the `CompilerCache` checks existing output files before executing filesystem writes:
```typescript
writeIfChanged(targetPath: string, newContent: string): boolean
```
- If the output code matches the disk content, the write is skipped.
- Preserves filesystem modification timestamps (`mtime`).
- Eliminates redundant disk I/O and prevents false watcher events.
