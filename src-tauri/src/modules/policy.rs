use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;
use tracing::info;

/// Policy file location: %PROGRAMDATA%\SABI\policy.json
/// Deployed via GPO File Copy, writable only by admins.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SabiPolicy {
    /// Scheduling mode: "disabled", "daily", "weekly", "monthly"
    #[serde(default = "default_schedule")]
    pub auto_clean_schedule: String,

    /// Glob paths excluded from all scan/clean operations
    #[serde(default)]
    pub excluded_paths: Vec<String>,

    /// Feature IDs that are disabled by policy
    /// Valid IDs: registry_cleaner, debloater, file_shredder, defrag,
    ///            privacy_eraser, disk_analyzer, app_uninstaller, turbo_boost
    #[serde(default)]
    pub features_disabled: Vec<String>,

    /// Max registry keys that can be cleaned per run (safety limit)
    #[serde(default = "default_max_reg")]
    pub max_registry_keys_per_run: u32,

    /// Require admin elevation for destructive operations
    #[serde(default = "default_true")]
    pub require_admin_for_destructive: bool,

    /// UNC or local path for audit log export
    #[serde(default)]
    pub audit_log_export_path: String,

    /// Webhook URL for SIEM integration (empty = disabled)
    #[serde(default)]
    pub webhook_url: String,

    /// Maximum snapshot retention count
    #[serde(default = "default_max_snapshots")]
    pub max_snapshots: u32,
}

fn default_schedule() -> String { "disabled".to_string() }
fn default_max_reg() -> u32 { 500 }
fn default_true() -> bool { true }
fn default_max_snapshots() -> u32 { 30 }

impl Default for SabiPolicy {
    fn default() -> Self {
        Self {
            auto_clean_schedule: default_schedule(),
            excluded_paths: Vec::new(),
            features_disabled: Vec::new(),
            max_registry_keys_per_run: default_max_reg(),
            require_admin_for_destructive: true,
            audit_log_export_path: String::new(),
            webhook_url: String::new(),
            max_snapshots: default_max_snapshots(),
        }
    }
}

/// Get the policy file path: %PROGRAMDATA%\SABI\policy.json
fn policy_path() -> PathBuf {
    let base = std::env::var("PROGRAMDATA")
        .unwrap_or_else(|_| "C:\\ProgramData".to_string());
    PathBuf::from(base).join("SABI").join("policy.json")
}

/// Load policy from disk. Returns defaults if file doesn't exist or is invalid.
pub fn load_policy() -> SabiPolicy {
    let path = policy_path();
    if !path.exists() {
        info!("[Policy] No policy file at {:?}, using defaults", path);
        return SabiPolicy::default();
    }
    match fs::read_to_string(&path) {
        Ok(content) => {
            match serde_json::from_str::<SabiPolicy>(&content) {
                Ok(policy) => {
                    info!("[Policy] Loaded policy: {} disabled features, {} excluded paths",
                        policy.features_disabled.len(), policy.excluded_paths.len());
                    policy
                }
                Err(e) => {
                    info!("[Policy] Failed to parse {:?}: {}, using defaults", path, e);
                    SabiPolicy::default()
                }
            }
        }
        Err(e) => {
            info!("[Policy] Failed to read {:?}: {}, using defaults", path, e);
            SabiPolicy::default()
        }
    }
}

/// Check if a feature is disabled by policy
pub fn is_feature_disabled(feature_id: &str) -> bool {
    let policy = load_policy();
    policy.features_disabled.iter().any(|f| f == feature_id)
}

/// Check if a path is excluded by policy globs
pub fn is_path_excluded(path: &str) -> bool {
    let policy = load_policy();
    let path_lower = path.to_lowercase();
    policy.excluded_paths.iter().any(|pattern| {
        let pat = pattern.to_lowercase().replace('*', "");
        path_lower.starts_with(&pat)
    })
}

// ── Tauri Commands ──

#[tauri::command]
pub async fn get_policy() -> SabiPolicy {
    load_policy()
}

#[tauri::command]
pub async fn check_feature_allowed(feature_id: String) -> Result<bool, String> {
    Ok(!is_feature_disabled(&feature_id))
}
