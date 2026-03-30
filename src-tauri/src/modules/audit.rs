use serde::{Serialize, Deserialize};
use sha2::{Sha256, Digest};
use chrono::Utc;
use std::fs;
use std::path::PathBuf;
use tracing::info;

/// Single audit log entry with hash chain integrity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEntry {
    /// Unique entry ID
    pub id: String,
    /// ISO-8601 timestamp
    pub timestamp: String,
    /// Windows username
    pub user: String,
    /// Operation type: "clean_junk", "clean_registry", "shred_file", "debloat", etc.
    pub operation: String,
    /// Target description (file path, registry key, app name)
    pub target: String,
    /// SHA-256 hash of affected resource before operation
    pub target_hash: String,
    /// Operation result: "success", "partial", "failed"
    pub outcome: String,
    /// Number of items/bytes affected
    pub items_affected: u64,
    pub bytes_affected: u64,
    /// SHA-256 of the previous entry (hash chain)
    pub prev_hash: String,
    /// SHA-256 of this entry (computed from all fields + prev_hash)
    pub entry_hash: String,
}

impl AuditEntry {
    /// Compute the hash of this entry's content (excluding entry_hash itself)
    fn compute_hash(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.id.as_bytes());
        hasher.update(self.timestamp.as_bytes());
        hasher.update(self.user.as_bytes());
        hasher.update(self.operation.as_bytes());
        hasher.update(self.target.as_bytes());
        hasher.update(self.target_hash.as_bytes());
        hasher.update(self.outcome.as_bytes());
        hasher.update(self.items_affected.to_le_bytes());
        hasher.update(self.bytes_affected.to_le_bytes());
        hasher.update(self.prev_hash.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

/// Get the audit log directory
fn audit_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("C:\\ProgramData"));
    base.join("SABI").join("audit")
}

/// Get today's audit log file path
fn today_log_path() -> PathBuf {
    let dir = audit_dir();
    fs::create_dir_all(&dir).ok();
    dir.join(format!("audit-{}.json", Utc::now().format("%Y-%m-%d")))
}

/// Read existing entries from today's log
fn read_log() -> Vec<AuditEntry> {
    let path = today_log_path();
    if !path.exists() {
        return Vec::new();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// Write entries to today's log
fn write_log(entries: &[AuditEntry]) {
    let path = today_log_path();
    if let Ok(json) = serde_json::to_string_pretty(entries) {
        fs::write(&path, json).ok();
    }
}

/// Get the current Windows username
fn current_user() -> String {
    std::env::var("USERNAME")
        .or_else(|_| std::env::var("USER"))
        .unwrap_or_else(|_| "SYSTEM".to_string())
}

/// Compute SHA-256 hash of a file (returns empty string on error)
pub fn hash_file(path: &str) -> String {
    match fs::read(path) {
        Ok(bytes) => {
            let mut hasher = Sha256::new();
            hasher.update(&bytes);
            format!("{:x}", hasher.finalize())
        }
        Err(_) => String::new(),
    }
}

/// Compute SHA-256 hash of a string (e.g. registry value)
pub fn hash_string(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    format!("{:x}", hasher.finalize())
}

/// Log a destructive operation. Called by cleaner, privacy, security modules.
pub fn log_operation(
    operation: &str,
    target: &str,
    target_hash: &str,
    outcome: &str,
    items_affected: u64,
    bytes_affected: u64,
) {
    let mut entries = read_log();

    let prev_hash = entries.last()
        .map(|e| e.entry_hash.clone())
        .unwrap_or_else(|| "GENESIS".to_string());

    let mut entry = AuditEntry {
        id: uuid::Uuid::new_v4().to_string(),
        timestamp: Utc::now().to_rfc3339(),
        user: current_user(),
        operation: operation.to_string(),
        target: target.to_string(),
        target_hash: target_hash.to_string(),
        outcome: outcome.to_string(),
        items_affected,
        bytes_affected,
        prev_hash,
        entry_hash: String::new(),
    };
    entry.entry_hash = entry.compute_hash();

    info!("[Audit] {} on '{}' by {} → {} ({} items)",
        entry.operation, entry.target, entry.user, entry.outcome, entry.items_affected);

    entries.push(entry);
    write_log(&entries);

    // Also export to policy-configured path if set
    let policy = super::policy::load_policy();
    if !policy.audit_log_export_path.is_empty() {
        let export_path = PathBuf::from(&policy.audit_log_export_path);
        fs::create_dir_all(&export_path).ok();
        let file = export_path.join(format!("sabi-audit-{}.json", Utc::now().format("%Y-%m-%d")));
        if let Ok(json) = serde_json::to_string_pretty(&entries) {
            fs::write(&file, json).ok();
        }
    }
}

// ── Tauri Commands ──

#[tauri::command]
pub async fn get_audit_log() -> Vec<AuditEntry> {
    read_log()
}

#[tauri::command]
pub async fn get_audit_log_all() -> Vec<AuditEntry> {
    let dir = audit_dir();
    let mut all: Vec<AuditEntry> = Vec::new();
    if let Ok(entries) = fs::read_dir(&dir) {
        let mut files: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.extension().map_or(false, |ext| ext == "json"))
            .collect();
        files.sort();
        for path in files {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(entries_file) = serde_json::from_str::<Vec<AuditEntry>>(&content) {
                    all.extend(entries_file);
                }
            }
        }
    }
    all
}

#[tauri::command]
pub async fn export_audit_log(format: String) -> Result<String, String> {
    let entries = read_log();
    match format.as_str() {
        "json" => serde_json::to_string_pretty(&entries)
            .map_err(|e| e.to_string()),
        "csv" => {
            let mut csv = String::from("id,timestamp,user,operation,target,target_hash,outcome,items_affected,bytes_affected,prev_hash,entry_hash\n");
            for e in &entries {
                csv.push_str(&format!(
                    "{},{},{},{},\"{}\",{},{},{},{},{},{}\n",
                    e.id, e.timestamp, e.user, e.operation, e.target,
                    e.target_hash, e.outcome, e.items_affected, e.bytes_affected,
                    e.prev_hash, e.entry_hash
                ));
            }
            Ok(csv)
        }
        "cef" => {
            // CEF: Common Event Format for SIEM ingestion
            let mut cef = String::new();
            for e in &entries {
                cef.push_str(&format!(
                    "CEF:0|SABI|SystemOptimizer|1.3.0|{}|{}|5|src={} dst={} outcome={} cnt={} bytesIn={} cs1={}\n",
                    e.operation, e.operation, e.user, e.target,
                    e.outcome, e.items_affected, e.bytes_affected, e.entry_hash
                ));
            }
            Ok(cef)
        }
        _ => Err(format!("Unknown format: {}. Use json, csv, or cef.", format)),
    }
}

/// Verify the integrity of the hash chain
#[tauri::command]
pub async fn verify_audit_chain() -> Result<bool, String> {
    let entries = read_log();
    if entries.is_empty() {
        return Ok(true);
    }

    // Check first entry has GENESIS as prev_hash
    if entries[0].prev_hash != "GENESIS" {
        return Ok(false);
    }

    for i in 0..entries.len() {
        // Verify entry's own hash
        let computed = entries[i].compute_hash();
        if computed != entries[i].entry_hash {
            info!("[Audit] Chain broken at entry {}: hash mismatch", i);
            return Ok(false);
        }
        // Verify chain linkage
        if i > 0 && entries[i].prev_hash != entries[i - 1].entry_hash {
            info!("[Audit] Chain broken at entry {}: prev_hash mismatch", i);
            return Ok(false);
        }
    }
    Ok(true)
}
