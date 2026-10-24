//! Per-file template caching keyed by content hash.

use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::sync::RwLock;
use crate::diagnostics::Diagnostic;

/// Computes SHA-256 content hash of template source.
pub fn hash_template(source: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(source.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Thread-safe in-memory cache for compiled templates.
pub struct TemplateCache {
    entries: RwLock<HashMap<String, String>>,
}

impl Default for TemplateCache {
    fn default() -> Self {
        Self::new()
    }
}

impl TemplateCache {
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
        }
    }

    pub fn get(&self, hash: &str) -> Option<String> {
        self.entries.read().ok()?.get(hash).cloned()
    }

    pub fn insert(&self, hash: String, code: String) {
        if let Ok(mut lock) = self.entries.write() {
            lock.insert(hash, code);
        }
    }

    pub fn contains(&self, hash: &str) -> bool {
        self.entries.read().is_ok_and(|map| map.contains_key(hash))
    }

    pub fn len(&self) -> usize {
        self.entries.read().map_or(0, |map| map.len())
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn clear(&self) {
        if let Ok(mut lock) = self.entries.write() {
            lock.clear();
        }
    }
}

/// Global shared template cache instance.
static GLOBAL_CACHE: std::sync::OnceLock<TemplateCache> = std::sync::OnceLock::new();

pub fn global_cache() -> &'static TemplateCache {
    GLOBAL_CACHE.get_or_init(TemplateCache::new)
}

/// Compiles a template using the provided cache, bypassing compilation if content hash matches.
pub fn compile_template_cached(
    source: &str,
    cache: &TemplateCache,
) -> Result<String, Diagnostic> {
    let hash = hash_template(source);
    if let Some(cached) = cache.get(&hash) {
        return Ok(cached);
    }

    let code = crate::compile_template(source)?;
    cache.insert(hash, code.clone());
    Ok(code)
}
