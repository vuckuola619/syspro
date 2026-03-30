use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;
use chrono::Utc;
use tracing::info;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// A single item that can be rolled back
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollbackItem {
    /// "file" or "registry"
    pub item_type: String,
    /// Original path or registry key
    pub path: String,
    /// For files: quarantine path. For registry: exported .reg path
    pub backup_path: String,
    /// SHA-256 hash of original content
    pub original_hash: String,
    /// File size in bytes (0 for registry)
    pub size_bytes: u64,
}

/// Operation manifest — one per destructive operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationManifest {
    /// Unique operation ID
    pub id: String,
    /// ISO-8601 timestamp
    pub timestamp: String,
    /// Operation type: "clean_junk", "clean_registry", "shred", "debloat", "privacy_clean"
    pub operation: String,
    /// Human-readable description
    pub description: String,
    /// Items affected
    pub items: Vec<RollbackItem>,
    /// Total bytes affected
    pub total_bytes: u64,
    /// Whether this snapshot has been rolled back
    pub rolled_back: bool,
    /// Expiry timestamp (7 days from creation)
    pub expires_at: String,
}

/// Get snapshots directory
fn snapshots_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("C:\\ProgramData"));
    let dir = base.join("SABI").join("snapshots");
    fs::create_dir_all(&dir).ok();
    dir
}

/// Get quarantine directory (files moved here instead of deleted)
fn quarantine_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("C:\\ProgramData"));
    let dir = base.join("SABI").join("quarantine");
    fs::create_dir_all(&dir).ok();
    dir
}

/// Create a unique quarantine path for a file
fn quarantine_path(original_path: &str) -> PathBuf {
    let filename = std::path::Path::new(original_path)
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown".to_string());
    let id = uuid::Uuid::new_v4().to_string();
    quarantine_dir().join(format!("{}_{}", &id[..8], filename))
}

/// Move a file to quarantine instead of deleting it
pub fn quarantine_file(path: &str) -> Result<String, String> {
    let dest = quarantine_path(path);
    fs::copy(path, &dest).map_err(|e| format!("Failed to quarantine: {}", e))?;
    fs::remove_file(path).ok(); // Best effort remove original
    info!("[Rollback] Quarantined '{}' → '{}'", path, dest.display());
    Ok(dest.to_string_lossy().to_string())
}

/// Export a registry subtree to a .reg file for backup
pub fn backup_registry_key(key_path: &str) -> Result<String, String> {
    let dir = snapshots_dir().join("registry");
    fs::create_dir_all(&dir).ok();
    let filename = format!("reg_{}_{}.reg",
        key_path.replace('\\', "_").replace(':', ""),
        &uuid::Uuid::new_v4().to_string()[..8]);
    let dest = dir.join(&filename);

    let output = std::process::Command::new("reg")
        .args(["export", key_path, &dest.to_string_lossy(), "/y"])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .map_err(|e| format!("reg export failed: {}", e))?;

    if output.status.success() {
        info!("[Rollback] Registry backup: {} → {}", key_path, dest.display());
        Ok(dest.to_string_lossy().to_string())
    } else {
        Err(format!("reg export failed: {}",
            String::from_utf8_lossy(&output.stderr)))
    }
}

/// Save an operation manifest (compressed with zstd)
pub fn create_snapshot(manifest: &OperationManifest) -> Result<(), String> {
    let dir = snapshots_dir();
    let filename = format!("snap_{}.zst", manifest.id);
    let path = dir.join(&filename);

    let json = serde_json::to_vec(manifest).map_err(|e| e.to_string())?;
    let compressed = zstd::encode_all(json.as_slice(), 3)
        .map_err(|e| format!("zstd compress failed: {}", e))?;

    fs::write(&path, compressed).map_err(|e| e.to_string())?;
    info!("[Rollback] Snapshot created: {} ({} items, {} bytes)",
        manifest.id, manifest.items.len(), manifest.total_bytes);

    // Enforce max snapshots from policy
    let policy = super::policy::load_policy();
    enforce_max_snapshots(policy.max_snapshots as usize);

    Ok(())
}

/// Start a new operation manifest (call before destructive operation)
pub fn begin_operation(operation: &str, description: &str) -> OperationManifest {
    let now = Utc::now();
    let expires = now + chrono::Duration::days(7);
    OperationManifest {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: now.to_rfc3339(),
        operation: operation.to_string(),
        description: description.to_string(),
        items: Vec::new(),
        total_bytes: 0,
        rolled_back: false,
        expires_at: expires.to_rfc3339(),
    }
}

/// Enforce maximum snapshot count (delete oldest)
fn enforce_max_snapshots(max: usize) {
    let dir = snapshots_dir();
    let mut files: Vec<(PathBuf, std::time::SystemTime)> = fs::read_dir(&dir)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().map_or(false, |ext| ext == "zst"))
        .filter_map(|e| {
            let meta = e.metadata().ok()?;
            let modified = meta.modified().ok()?;
            Some((e.path(), modified))
        })
        .collect();

    if files.len() <= max {
        return;
    }

    files.sort_by_key(|(_, t)| *t);
    let to_remove = files.len() - max;
    for (path, _) in files.into_iter().take(to_remove) {
        fs::remove_file(&path).ok();
        info!("[Rollback] Purged old snapshot: {}", path.display());
    }
}

/// Read a snapshot manifest from a compressed file
fn read_snapshot(path: &PathBuf) -> Option<OperationManifest> {
    let data = fs::read(path).ok()?;
    let decompressed = zstd::decode_all(data.as_slice()).ok()?;
    serde_json::from_slice(&decompressed).ok()
}

// ── Tauri Commands ──

#[tauri::command]
pub async fn list_snapshots() -> Vec<OperationManifest> {
    let dir = snapshots_dir();
    let mut snapshots: Vec<OperationManifest> = Vec::new();

    if let Ok(entries) = fs::read_dir(&dir) {
        let mut files: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().map_or(false, |ext| ext == "zst"))
            .collect();
        files.sort();
        files.reverse(); // newest first

        for path in files.into_iter().take(30) {
            if let Some(manifest) = read_snapshot(&path) {
                snapshots.push(manifest);
            }
        }
    }

    snapshots
}

#[tauri::command]
pub async fn undo_snapshot(id: String) -> Result<String, String> {
    let dir = snapshots_dir();
    let filename = format!("snap_{}.zst", id);
    let path = dir.join(&filename);

    let mut manifest = read_snapshot(&path)
        .ok_or_else(|| format!("Snapshot {} not found", id))?;

    if manifest.rolled_back {
        return Err("This operation has already been rolled back".to_string());
    }

    let mut restored = 0u32;
    let mut errors = Vec::new();

    for item in &manifest.items {
        match item.item_type.as_str() {
            "file" => {
                // Restore from quarantine
                if std::path::Path::new(&item.backup_path).exists() {
                    match fs::copy(&item.backup_path, &item.path) {
                        Ok(_) => {
                            fs::remove_file(&item.backup_path).ok();
                            restored += 1;
                        }
                        Err(e) => errors.push(format!("{}: {}", item.path, e)),
                    }
                } else {
                    errors.push(format!("{}: quarantine file missing", item.path));
                }
            }
            "registry" => {
                // Import .reg file
                if std::path::Path::new(&item.backup_path).exists() {
                    let output = std::process::Command::new("reg")
                        .args(["import", &item.backup_path])
                        .creation_flags(0x08000000)
                        .output();
                    match output {
                        Ok(o) if o.status.success() => restored += 1,
                        Ok(o) => errors.push(format!("{}: {}", item.path,
                            String::from_utf8_lossy(&o.stderr))),
                        Err(e) => errors.push(format!("{}: {}", item.path, e)),
                    }
                } else {
                    errors.push(format!("{}: backup .reg missing", item.path));
                }
            }
            _ => errors.push(format!("{}: unknown item type", item.item_type)),
        }
    }

    manifest.rolled_back = true;

    // Rewrite the snapshot with rolled_back = true
    if let Ok(json) = serde_json::to_vec(&manifest) {
        if let Ok(compressed) = zstd::encode_all(json.as_slice(), 3) {
            fs::write(&path, compressed).ok();
        }
    }

    // Log the undo operation
    super::audit::log_operation(
        "undo_snapshot",
        &manifest.operation,
        &manifest.id,
        if errors.is_empty() { "success" } else { "partial" },
        restored as u64,
        manifest.total_bytes,
    );

    if errors.is_empty() {
        Ok(format!("✓ Restored {} items", restored))
    } else {
        Ok(format!("Restored {} items, {} errors: {}",
            restored, errors.len(), errors.join("; ")))
    }
}

#[tauri::command]
pub async fn purge_expired_snapshots() -> u32 {
    let dir = snapshots_dir();
    let now = Utc::now();
    let mut purged = 0u32;

    // Purge expired snapshots
    if let Ok(entries) = fs::read_dir(&dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            let path = entry.path();
            if path.extension().map_or(true, |ext| ext != "zst") {
                continue;
            }
            if let Some(manifest) = read_snapshot(&path) {
                if let Ok(expires) = chrono::DateTime::parse_from_rfc3339(&manifest.expires_at) {
                    if now > expires {
                        fs::remove_file(&path).ok();
                        purged += 1;
                    }
                }
            }
        }
    }

    // Purge expired quarantine files (>7 days old)
    let qdir = quarantine_dir();
    if let Ok(entries) = fs::read_dir(&qdir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if let Ok(meta) = entry.metadata() {
                if let Ok(modified) = meta.modified() {
                    if let Ok(age) = std::time::SystemTime::now().duration_since(modified) {
                        if age.as_secs() > 7 * 24 * 3600 {
                            fs::remove_file(entry.path()).ok();
                            purged += 1;
                        }
                    }
                }
            }
        }
    }

    info!("[Rollback] Purged {} expired items", purged);
    purged
}
