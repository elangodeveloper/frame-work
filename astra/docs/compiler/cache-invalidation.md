# JARVIS Compiler: Cache Invalidation & Multi-Factor Cache Keys

## 1. Why Timestamps Are Insufficient

Many legacy build systems rely on filesystem timestamps (`mtime`) to check if a file needs recompilation. This fails in common developer scenarios:
- Branch switching (`git checkout`) updates `mtime` even if content is identical.
- Automated code formatters or IDE saves touch the file without semantic changes.
- Distributed build caches and CI machines have unsynchronized clocks.

JARVIS enforces **content-addressed, multi-factor caching**. Cached compilation results are identified solely by cryptographic hashes of their actual inputs.

---

## 2. Multi-Factor Cache Key Formulation

Every stage in JARVIS uses a composite cache key:

$$\text{CacheKey} = \text{SHA-256}(\text{ContentHash} \parallel \text{CompilerVersion} \parallel \text{ConfigHash} \parallel \text{Stage} \parallel \text{DependencySignatures})$$

```typescript
generateKey(
  contentHash: string,
  compilerVersion: string,
  configHash: string,
  stage: string,
  depSignatures = ''
): string {
  const raw = `${contentHash}:${compilerVersion}:${configHash}:${stage}:${depSignatures}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}
```

### Factors Accounted For:
1. **ContentHash**: SHA-256 of the source file content (`user.component.html`, `user.component.css`, `user.component.ts`).
2. **CompilerVersion**: e.g., `'0.1.0'`. When the Rust compiler binary or TypeScript pipeline updates, all old cached artifacts are cleanly missed.
3. **ConfigHash**: SHA-256 of compiler flags, target environment, minification settings, and theming configuration.
4. **Stage**: The specific stage (`'template'`, `'style'`, `'typescript'`, `'codegen'`).
5. **DependencySignatures**: Concatenated hashes of imported public contracts.

---

## 3. Storage Hierarchy

The `CompilerCache` maintains a two-tiered cache:
1. **L1 Memory Cache**: Instant lookup via `Map<string, CacheEntry>`.
2. **L2 Disk Cache**: Persistent storage in `.jarvis/cache/<hash>.json` across restarts and dev-server sessions.

### Cache Entry Structure
```typescript
export interface CacheEntry {
  key: string;
  stage: string;
  code: string;
  ast?: any;
  ir?: any;
  diagnostics?: any[];
  timestamp: number;
  contentHash: string;
}
```

---

## 4. Cache Invalidation Triggers

A cache entry is never updated in-place; it is either hit or replaced by a new content key. Invalidation triggers:
- **File content edit**: Produces a new `contentHash`, leading to a new cache key.
- **Compiler configuration change**: `setConfigHash()` immediately invokes `this.cache.clear()`.
- **Public contract alteration**: Dependent components produce new composite keys containing the updated `depSignatures`.
- **Corrupted disk entries**: Caught during `JSON.parse` and treated as cache misses with fresh fallback recompilation.
