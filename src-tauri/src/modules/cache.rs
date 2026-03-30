use serde::{Serialize, de::DeserializeOwned};
use std::path::PathBuf;
use std::time::{SystemTime, Duration};
use tracing::info;

// ── Cache directory ──

fn cache_dir() -> PathBuf {
    let base = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("C:\\ProgramData"))
        .join("SABI")
        .join("cache");
    std::fs::create_dir_all(&base).ok();
    base
}

fn cache_path(key: &str) -> PathBuf {
    cache_dir().join(format!("{}.cbor", key))
}

// ── Public API ──

/// Write a serializable value to disk as CBOR.
pub fn write_cache<T: Serialize>(key: &str, data: &T) {
    let path = cache_path(key);
    match std::fs::File::create(&path) {
        Ok(file) => {
            if let Err(e) = ciborium::into_writer(data, file) {
                info!("[Cache] Write error for {}: {}", key, e);
                let _ = std::fs::remove_file(&path);
            }
        }
        Err(e) => info!("[Cache] Cannot create {}: {}", key, e),
    }
}

/// Read a cached value if it exists and is within max_age.
pub fn read_cache<T: DeserializeOwned>(key: &str, max_age: Duration) -> Option<T> {
    let path = cache_path(key);
    let meta = std::fs::metadata(&path).ok()?;
    let modified = meta.modified().ok()?;
    let age = SystemTime::now().duration_since(modified).ok()?;
    if age > max_age {
        return None;
    }
    let file = std::fs::File::open(&path).ok()?;
    ciborium::from_reader(file).ok()
}

/// Delete a specific cache entry.
pub fn invalidate(key: &str) {
    let _ = std::fs::remove_file(cache_path(key));
}

/// Delete all cache entries.
pub fn invalidate_all() {
    if let Ok(entries) = std::fs::read_dir(cache_dir()) {
        for entry in entries.flatten() {
            if entry.path().extension().map(|e| e == "cbor").unwrap_or(false) {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }
    info!("[Cache] All caches invalidated");
}

// ── Cache TTLs ──

pub const TTL_LIVE: Duration = Duration::from_secs(5 * 60);        // 5 min
pub const TTL_SCAN: Duration = Duration::from_secs(30 * 60);       // 30 min
pub const TTL_HEAVY: Duration = Duration::from_secs(6 * 60 * 60);  // 6 hours

// ── Cache Keys ──

pub const KEY_OVERVIEW: &str = "dashboard_overview";
pub const KEY_JUNK: &str = "junk_scan";
pub const KEY_STARTUP: &str = "startup_items";
pub const KEY_PRIVACY: &str = "privacy_scan";
pub const KEY_NETWORK: &str = "network_speed";
pub const KEY_DISK_HEALTH: &str = "disk_health";
pub const KEY_DEFENDER: &str = "defender_status";
pub const KEY_FIREWALL: &str = "firewall_rules";
pub const KEY_SOFTWARE: &str = "software_updates";
pub const KEY_REGISTRY: &str = "registry_issues";
pub const KEY_HEALTH: &str = "health_score";
pub const KEY_OPT_SCORE: &str = "optimization_score";

// ── CachedDashboard (aggregate for instant load) ──

use super::system::SystemOverview;
use super::performance::HealthScore;
use super::cleaner::JunkScanResult;
use super::privacy::PrivacyScanResult;
use super::performance::StartupItem;
use super::network::NetworkSpeed;
use super::disk::DiskHealthInfo;
use super::security::DefenderStatus;
use super::network::FirewallRule;

#[derive(Serialize, serde::Deserialize)]
pub struct CachedDashboard {
    pub overview: Option<SystemOverview>,
    pub junk: Option<JunkScanResult>,
    pub startup: Option<Vec<StartupItem>>,
    pub privacy: Option<PrivacyScanResult>,
    pub network: Option<Vec<NetworkSpeed>>,
    pub disk_health: Option<Vec<DiskHealthInfo>>,
    pub defender: Option<DefenderStatus>,
    pub firewall_rules: Option<Vec<FirewallRule>>,
    pub software_updates: Option<usize>,
    pub registry_count: Option<usize>,
    pub health: Option<HealthScore>,
}

#[tauri::command]
pub async fn get_cached_dashboard() -> Option<CachedDashboard> {
    info!("[Cache] Loading cached dashboard");
    Some(CachedDashboard {
        overview: read_cache(KEY_OVERVIEW, TTL_LIVE),
        junk: read_cache(KEY_JUNK, TTL_SCAN),
        startup: read_cache(KEY_STARTUP, TTL_SCAN),
        privacy: read_cache(KEY_PRIVACY, TTL_SCAN),
        network: read_cache(KEY_NETWORK, TTL_LIVE),
        disk_health: read_cache(KEY_DISK_HEALTH, TTL_HEAVY),
        defender: read_cache(KEY_DEFENDER, TTL_SCAN),
        firewall_rules: read_cache(KEY_FIREWALL, TTL_SCAN),
        software_updates: read_cache(KEY_SOFTWARE, TTL_HEAVY),
        registry_count: read_cache(KEY_REGISTRY, TTL_SCAN),
        health: read_cache(KEY_HEALTH, TTL_LIVE),
    })
}

#[tauri::command]
pub async fn invalidate_all_caches() -> Result<(), String> {
    invalidate_all();
    Ok(())
}
