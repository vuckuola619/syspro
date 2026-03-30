// ─────────────────────────────────────────────────────────────────────────────
// SABI — System Analytics & Boost Infrastructure
// Thin Router: module declarations + Tauri command registration
// ─────────────────────────────────────────────────────────────────────────────

mod error;
mod util;
mod modules;

use tracing::info;

// ── Re-export all module commands for generate_handler! ──
use modules::system::*;
use modules::cleaner::*;
use modules::performance::*;
use modules::privacy::*;
use modules::network::*;
use modules::disk::*;
use modules::security::*;
use modules::ai::*;
use modules::cache::*;
use modules::batch::*;
use modules::policy::*;
use modules::audit::*;
use modules::webhook::*;
use modules::rollback::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env()
            .add_directive("info".parse().unwrap()))
        .init();

    info!("[SABI] Application starting...");

    // Fix blank white screen when running as administrator.
    // WebView2 cannot access the default user data directory when elevated.
    // Setting WEBVIEW2_USER_DATA_FOLDER to a writable path that works in both contexts.
    if std::env::var("WEBVIEW2_USER_DATA_FOLDER").is_err() {
        let data_dir = std::path::PathBuf::from(
            std::env::var("LOCALAPPDATA")
                .or_else(|_| std::env::var("PROGRAMDATA"))
                .unwrap_or_else(|_| "C:\\ProgramData".to_string())
        ).join("SABI").join("WebView2");
        std::fs::create_dir_all(&data_dir).ok();
        std::env::set_var("WEBVIEW2_USER_DATA_FOLDER", &data_dir);
        info!("[SABI] WebView2 data folder set to: {:?}", data_dir);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // ── System ──
            get_system_overview,
            run_health_check,
            get_system_details,
            get_live_stats,
            get_installed_apps,
            uninstall_app,
            scan_app_leftovers,
            clean_app_leftovers,
            check_software_updates,
            update_software_winget,
            update_all_software,
            get_services,
            set_service_status,
            scan_drivers,
            update_driver,
            get_update_history,
            get_user_profiles,
            export_system_report,
            save_text_file,
            open_in_explorer,
            delete_folder,
            create_restore_point,
            list_restore_points,
            open_system_protection,
            // ── Cleaner ──
            scan_junk_files,
            clean_junk_files,
            scan_duplicate_files,
            clean_duplicate_files,
            scan_registry_issues,
            backup_registry,
            clean_registry_issues,
            analyze_registry_fragmentation,
            run_registry_defrag,
            scan_slim_targets,
            clean_slim_target,
            get_smart_clean_config,
            quick_junk_scan,
            scan_uwp_junk,
            clean_uwp_junk,
            scan_cloud_caches,
            clean_cloud_cache,
            // ── Performance ──
            get_startup_items,
            toggle_startup_item,
            get_processes,
            optimize_memory,
            get_boot_info,
            get_context_menu_items,
            get_schedule_config,
            set_schedule_config,
            run_one_click_optimize,
            run_benchmark,
            activate_turbo_boost,
            deactivate_turbo_boost,
            get_process_priorities,
            set_process_priority,
            // ── Privacy ──
            scan_privacy_traces,
            clean_privacy_traces,
            get_privacy_settings,
            set_privacy_setting,
            get_windows_tweaks,
            set_windows_tweak,
            get_edge_settings,
            set_edge_setting,
            scan_bloatware,
            remove_bloatware,
            restore_bloatware,
            scan_browser_extensions,
            get_popup_settings,
            set_popup_setting,
            // ── Network ──
            test_dns_servers,
            flush_dns,
            set_dns_server,
            get_network_connections,
            read_hosts_file,
            add_hosts_entry,
            block_telemetry_hosts,
            remove_hosts_entry,
            get_firewall_rules,
            toggle_firewall_rule,
            add_firewall_rule,
            get_network_speed,
            run_speed_test,
            get_current_dns,
            get_dns_config,
            get_dns_providers_list,
            set_dns_provider,
            reset_dns_to_auto,
            get_hosts_block_status,
            enable_hosts_blocking,
            disable_hosts_blocking,
            pause_windows_updates,
            // ── Disk ──
            analyze_disk_space,
            analyze_fragmentation,
            run_defrag,
            scan_large_files,
            delete_file,
            scan_empty_folders,
            clean_empty_folders,
            get_smart_health,
            shred_files,
            split_file,
            join_files,
            get_recycle_bin_items,
            restore_recycle_bin_item,
            empty_recycle_bin,
            // ── Security ──
            hide_file_or_folder,
            unhide_file_or_folder,
            list_hidden_files,
            generate_password,
            get_defender_status,
            run_defender_scan,
            update_defender_definitions,
            get_login_events,
            // ── AI / Smart Features ──
            get_optimization_score,
            generate_iso27001_report,
            check_for_app_update,
            download_driver_update,
            // ── Cache + Batch ──
            get_cached_dashboard,
            invalidate_all_caches,
            batch_invoke,
            // ── Policy Engine ──
            get_policy,
            check_feature_allowed,
            // ── Audit Log ──
            get_audit_log,
            get_audit_log_all,
            export_audit_log,
            verify_audit_chain,
            // ── SIEM Webhook ──
            get_webhook_config,
            save_webhook_config,
            test_webhook,
            // ── Rollback / Snapshots ──
            list_snapshots,
            undo_snapshot,
            purge_expired_snapshots,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}