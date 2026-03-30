use std::collections::HashMap;
use std::time::Duration;
use serde_json::Value;
use tracing::{info, warn};
use tokio::time::timeout;

/// Whitelisted read-only scan/get commands that can be batched
const BATCH_WHITELIST: &[&str] = &[
    "get_system_overview",
    "scan_junk_files",
    "get_startup_items",
    "scan_privacy_traces",
    "get_network_speed",
    "get_smart_health",
    "get_defender_status",
    "get_firewall_rules",
    "check_software_updates",
    "scan_registry_issues",
    "run_health_check",
    "get_optimization_score",
    "quick_junk_scan",
];

/// Per-command timeout in seconds — prevents any single PowerShell call from hanging the batch
const CMD_TIMEOUT_SECS: u64 = 30;

/// Execute a single command by name, returning its JSON result.
async fn dispatch(cmd: &str) -> Value {
    let cmd_owned = cmd.to_string();
    let result = timeout(Duration::from_secs(CMD_TIMEOUT_SECS), async move {
        match cmd_owned.as_str() {
            "get_system_overview"    => serde_json::to_value(super::system::get_system_overview().await).unwrap_or(Value::Null),
            "scan_junk_files"        => serde_json::to_value(super::cleaner::scan_junk_files().await).unwrap_or(Value::Null),
            "get_startup_items"      => serde_json::to_value(super::performance::get_startup_items().await).unwrap_or(Value::Null),
            "scan_privacy_traces"    => serde_json::to_value(super::privacy::scan_privacy_traces().await).unwrap_or(Value::Null),
            "get_network_speed"      => serde_json::to_value(super::network::get_network_speed().await).unwrap_or(Value::Null),
            "get_smart_health"       => serde_json::to_value(super::disk::get_smart_health().await).unwrap_or(Value::Null),
            "get_defender_status"    => serde_json::to_value(super::security::get_defender_status().await.ok()).unwrap_or(Value::Null),
            "get_firewall_rules"     => serde_json::to_value(super::network::get_firewall_rules().await).unwrap_or(Value::Null),
            "check_software_updates" => serde_json::to_value(super::system::check_software_updates().await).unwrap_or(Value::Null),
            "scan_registry_issues"   => serde_json::to_value(super::system::scan_registry_issues().await).unwrap_or(Value::Null),
            "run_health_check"       => serde_json::to_value(super::performance::run_health_check().await).unwrap_or(Value::Null),
            "get_optimization_score" => match super::ai::get_optimization_score().await {
                Ok(score) => serde_json::to_value(score).unwrap_or(Value::Null),
                Err(_)    => Value::Null,
            },
            "quick_junk_scan"        => serde_json::to_value(super::cleaner::quick_junk_scan().await.ok()).unwrap_or(Value::Null),
            _ => Value::Null,
        }
    }).await;

    match result {
        Ok(value) => value,
        Err(_elapsed) => {
            warn!("[Batch] Command '{}' timed out after {}s — returning Null", cmd, CMD_TIMEOUT_SECS);
            Value::Null
        }
    }
}

#[tauri::command]
pub async fn batch_invoke(commands: Vec<String>) -> HashMap<String, Value> {
    info!("[Batch] Executing {} commands", commands.len());

    let filtered: Vec<String> = commands
        .into_iter()
        .filter(|c| BATCH_WHITELIST.contains(&c.as_str()))
        .collect();

    let mut results = HashMap::new();

    // Run all commands concurrently using tokio::join
    let futures: Vec<_> = filtered.iter().map(|cmd| {
        let cmd = cmd.clone();
        tokio::spawn(async move {
            let result = dispatch(&cmd).await;
            (cmd, result)
        })
    }).collect();

    for handle in futures {
        if let Ok((cmd, result)) = handle.await {
            // Write result to CBOR cache for instant next-launch load
            if !result.is_null() {
                use super::cache::*;
                match cmd.as_str() {
                    "get_system_overview" => write_cache(KEY_OVERVIEW, &result),
                    "scan_junk_files" => write_cache(KEY_JUNK, &result),
                    "get_startup_items" => write_cache(KEY_STARTUP, &result),
                    "scan_privacy_traces" => write_cache(KEY_PRIVACY, &result),
                    "get_network_speed" => write_cache(KEY_NETWORK, &result),
                    "get_smart_health" => write_cache(KEY_DISK_HEALTH, &result),
                    "get_defender_status" => write_cache(KEY_DEFENDER, &result),
                    "get_firewall_rules" => write_cache(KEY_FIREWALL, &result),
                    "check_software_updates" => write_cache(KEY_SOFTWARE, &result),
                    "scan_registry_issues" => write_cache(KEY_REGISTRY, &result),
                    "run_health_check" => write_cache(KEY_HEALTH, &result),
                    "get_optimization_score" => write_cache(KEY_OPT_SCORE, &result),
                    _ => {}
                }
            }
            results.insert(cmd, result);
        }
    }

    info!("[Batch] Completed {} commands", results.len());
    results
}
