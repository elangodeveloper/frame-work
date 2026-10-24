//! Per-file and per-unit caching keyed by content hash, with disk persistence and versioning.

use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use crate::diagnostics::Diagnostic;

pub const COMPILER_VERSION: &str = "0.1.0";

/// Computes SHA-256 content hash of template source.
pub fn hash_template(source: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(source.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Computes a versioned cache key incorporating compiler version, project config hash, unit type, and content.
pub fn compute_unit_cache_key(
    compiler_version: &str,
    config_hash: &str,
    unit_type: &str,
    source: &str,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(compiler_version.as_bytes());
    hasher.update(b":");
    hasher.update(config_hash.as_bytes());
    hasher.update(b":");
    hasher.update(unit_type.as_bytes());
    hasher.update(b":");
    hasher.update(source.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Thread-safe in-memory cache for compiled templates and units.
pub struct TemplateCache {
    entries: RwLock<HashMap<String, String>>,
    disk_dir: Option<PathBuf>,
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
            disk_dir: None,
        }
    }

    pub fn with_disk_dir<P: Into<PathBuf>>(disk_dir: P) -> Self {
        let dir = disk_dir.into();
        let _ = fs::create_dir_all(&dir);
        Self {
            entries: RwLock::new(HashMap::new()),
            disk_dir: Some(dir),
        }
    }

    pub fn set_disk_dir<P: Into<PathBuf>>(&mut self, disk_dir: P) {
        let dir = disk_dir.into();
        let _ = fs::create_dir_all(&dir);
        self.disk_dir = Some(dir);
    }

    pub fn get(&self, hash: &str) -> Option<String> {
        // 1. Check in-memory cache
        if let Ok(lock) = self.entries.read() {
            if let Some(code) = lock.get(hash) {
                return Some(code.clone());
            }
        }

        // 2. Check disk cache if configured
        if let Some(ref disk_dir) = self.disk_dir {
            let file_path = disk_dir.join(format!("{}.cache", hash));
            if file_path.exists() {
                if let Ok(content) = fs::read_to_string(&file_path) {
                    // Populate memory cache
                    if let Ok(mut lock) = self.entries.write() {
                        lock.insert(hash.to_string(), content.clone());
                    }
                    return Some(content);
                }
            }
        }

        None
    }

    pub fn insert(&self, hash: String, code: String) {
        // Write to disk cache if configured
        if let Some(ref disk_dir) = self.disk_dir {
            let file_path = disk_dir.join(format!("{}.cache", hash));
            let _ = fs::write(file_path, &code);
        }

        // Write to in-memory cache
        if let Ok(mut lock) = self.entries.write() {
            lock.insert(hash, code);
        }
    }

    pub fn contains(&self, hash: &str) -> bool {
        if self.entries.read().is_ok_and(|map| map.contains_key(hash)) {
            return true;
        }
        if let Some(ref disk_dir) = self.disk_dir {
            return disk_dir.join(format!("{}.cache", hash)).exists();
        }
        false
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
        if let Some(ref disk_dir) = self.disk_dir {
            let _ = fs::remove_dir_all(disk_dir);
            let _ = fs::create_dir_all(disk_dir);
        }
    }

    pub fn invalidate_if_version_changed(&self, expected_version: &str, expected_config_hash: &str) -> bool {
        if let Some(ref disk_dir) = self.disk_dir {
            let changed = Self::check_and_invalidate_dir(disk_dir, expected_version, expected_config_hash);
            if changed {
                if let Ok(mut lock) = self.entries.write() {
                    lock.clear();
                }
            }
            changed
        } else {
            false
        }
    }

    pub fn check_and_invalidate_dir(cache_dir: &Path, expected_version: &str, expected_config_hash: &str) -> bool {
        let version_file = cache_dir.join("compiler.version");
        let config_file = cache_dir.join("config.hash");

        let mut needs_invalidation = false;

        if let Ok(ver) = fs::read_to_string(&version_file) {
            if ver.trim() != expected_version {
                needs_invalidation = true;
            }
        } else {
            needs_invalidation = true;
        }

        if let Ok(ch) = fs::read_to_string(&config_file) {
            if ch.trim() != expected_config_hash {
                needs_invalidation = true;
            }
        } else {
            needs_invalidation = true;
        }

        if needs_invalidation {
            let _ = fs::remove_dir_all(cache_dir);
            let _ = fs::create_dir_all(cache_dir);
            let _ = fs::write(version_file, expected_version);
            let _ = fs::write(config_file, expected_config_hash);
            true
        } else {
            false
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
