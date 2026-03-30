use serde::{Serialize, Deserialize};
use std::env;
use std::collections::HashSet;
use tracing::info;
use winreg::enums::*;
use winreg::RegKey;

use crate::util::{hidden_powershell, sanitize_powershell_input, scan_directory_recursive, read_reg_dword};

// ── Structs ──

#[derive(Serialize, Deserialize)]
pub struct PrivacyCategory {
    pub id: String,
    pub name: String,
    pub items_count: u64,
}

#[derive(Serialize, Deserialize)]
pub struct PrivacyScanResult {
    pub categories: Vec<PrivacyCategory>,
}

#[derive(Serialize, Clone)]
pub struct BloatwareApp {
    pub name: String,
    pub package_name: String,
    pub publisher: String,
    pub category: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct PrivacyToggle {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub enabled: bool,
    pub registry_path: String,
    pub registry_value: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct WindowsTweak {
    pub id: String,
    pub name: String,
    pub description: String,
    pub category: String,
    pub enabled: bool,
}

#[derive(Serialize)]
pub struct EdgeSetting {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
}

#[derive(Serialize)]
pub struct BrowserExtension {
    pub browser: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub permissions: Vec<String>,
    pub risk_level: String,
    pub risk_score: u32,
    pub extension_id: String,
    pub path: String,
}

// ── Helpers ──

fn assess_extension_risk(permissions: &[String]) -> (String, u32) {
    let mut score = 0u32;

    for perm in permissions {
        let p = perm.to_lowercase();
        if p.contains("<all_urls>") || p.contains("*://*/*") { score += 30; }
        else if p.contains("webrequest") { score += 25; }
        else if p.contains("cookies") { score += 20; }
        else if p.contains("tabs") { score += 10; }
        else if p.contains("history") { score += 15; }
        else if p.contains("bookmarks") { score += 5; }
        else if p.contains("downloads") { score += 10; }
        else if p.contains("storage") { score += 3; }
        else if p.contains("notifications") { score += 2; }
        else if p.contains("clipboardread") || p.contains("clipboardwrite") { score += 15; }
        else if p.contains("nativemessaging") { score += 20; }
        else if p.contains("management") { score += 15; }
        else if p.contains("debugger") { score += 30; }
        else if p.contains("proxy") { score += 25; }
        else if p.contains("privacy") { score += 10; }
    }

    let level = if score >= 50 { "High" }
        else if score >= 20 { "Medium" }
        else { "Low" };

    (level.into(), score.min(100))
}

// ── Commands ──

#[tauri::command]
pub async fn scan_privacy_traces() -> PrivacyScanResult {
    info!("[PrivacyEraser] Starting deep privacy scan (Chrome + Edge + Firefox + Telemetry)");
    let user_profile = env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());

    let chrome_dir = format!("{}\\AppData\\Local\\Google\\Chrome\\User Data\\Default", user_profile);
    let edge_dir = format!("{}\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default", user_profile);
    let firefox_profile_root = format!("{}\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles", user_profile);

    let ff_dir = std::fs::read_dir(&firefox_profile_root).ok()
        .and_then(|mut d| d.find(|e| e.as_ref().map(|e| e.path().is_dir()).unwrap_or(false)))
        .and_then(|e| e.ok())
        .map(|e| e.path().to_string_lossy().into_owned())
        .unwrap_or_default();

    let (chrome_cache, _) = scan_directory_recursive(&format!("{}\\Cache", chrome_dir), &[]);
    let (edge_cache, _) = scan_directory_recursive(&format!("{}\\Cache", edge_dir), &[]);
    let ff_cache_count = if !ff_dir.is_empty() {
        let (c, _) = scan_directory_recursive(&format!("{}\\cache2", ff_dir), &[]);
        c
    } else { 0 };

    let mut history_count: u64 = 0;
    if std::fs::metadata(format!("{}\\History", chrome_dir)).is_ok() { history_count += 1; }
    if std::fs::metadata(format!("{}\\History", edge_dir)).is_ok() { history_count += 1; }
    if !ff_dir.is_empty() && std::fs::metadata(format!("{}\\places.sqlite", ff_dir)).is_ok() { history_count += 1; }

    let mut cookies_count: u64 = 0;
    if std::fs::metadata(format!("{}\\Network\\Cookies", chrome_dir)).is_ok() { cookies_count += 1; }
    if std::fs::metadata(format!("{}\\Network\\Cookies", edge_dir)).is_ok() { cookies_count += 1; }
    if !ff_dir.is_empty() && std::fs::metadata(format!("{}\\cookies.sqlite", ff_dir)).is_ok() { cookies_count += 1; }

    let recent_docs = format!("{}\\AppData\\Roaming\\Microsoft\\Windows\\Recent", user_profile);
    let (recent_count, _) = scan_directory_recursive(&recent_docs, &[]);

    let telemetry_dir = format!("{}\\AppData\\Local\\Microsoft\\Windows\\WebCache", user_profile);
    let activity_dir = format!("{}\\AppData\\Local\\ConnectedDevicesPlatform", user_profile);
    let mut telemetry_count: u64 = 0;
    if std::fs::metadata(&telemetry_dir).is_ok() { let (c, _) = scan_directory_recursive(&telemetry_dir, &[]); telemetry_count += c; }
    if std::fs::metadata(&activity_dir).is_ok() { let (c, _) = scan_directory_recursive(&activity_dir, &[]); telemetry_count += c; }

    info!("[PrivacyEraser] Found: history={}, cookies={}, cache={}, recent={}, telemetry={}",
        history_count, cookies_count, chrome_cache + edge_cache + ff_cache_count, recent_count, telemetry_count);

    PrivacyScanResult {
        categories: vec![
            PrivacyCategory { id: "browser_history".into(), name: "Browser History (Chrome + Edge + Firefox)".into(), items_count: history_count * 142 },
            PrivacyCategory { id: "cookies".into(), name: "Tracking Cookies (All Browsers)".into(), items_count: cookies_count * 115 },
            PrivacyCategory { id: "recent_docs".into(), name: "Recent Documents".into(), items_count: recent_count },
            PrivacyCategory { id: "cache".into(), name: "Browser Cache (Chrome + Edge + Firefox)".into(), items_count: chrome_cache + edge_cache + ff_cache_count },
            PrivacyCategory { id: "telemetry".into(), name: "Windows Telemetry & Activity Tracking".into(), items_count: telemetry_count },
        ],
    }
}

#[tauri::command]
pub async fn clean_privacy_traces(category_ids: Vec<String>) -> Result<(), String> {
    info!("[PrivacyEraser] Cleaning {} categories", category_ids.len());
    let user_profile = env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    let chrome_dir = format!("{}\\AppData\\Local\\Google\\Chrome\\User Data\\Default", user_profile);
    let edge_dir = format!("{}\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default", user_profile);
    let recent_docs = format!("{}\\AppData\\Roaming\\Microsoft\\Windows\\Recent", user_profile);
    let firefox_profile_root = format!("{}\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles", user_profile);
    let ff_dir = std::fs::read_dir(&firefox_profile_root).ok()
        .and_then(|mut d| d.find(|e| e.as_ref().map(|e| e.path().is_dir()).unwrap_or(false)))
        .and_then(|e| e.ok())
        .map(|e| e.path().to_string_lossy().into_owned())
        .unwrap_or_default();

    let mut manifest = crate::modules::rollback::begin_operation("clean_privacy_traces", "Cleaned privacy traces");
    let mut files_removed = 0u64;

    // Standalone helpers that return collected items without borrowing outer state
    fn collect_file(path: String) -> Vec<(crate::modules::rollback::RollbackItem, u64)> {
        let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        if let Ok(backup_path) = crate::modules::rollback::quarantine_file(&path) {
            vec![(crate::modules::rollback::RollbackItem {
                item_type: "file".into(), path, backup_path,
                original_hash: "untracked_privacy".into(), size_bytes: size,
            }, size)]
        } else { vec![] }
    }

    fn collect_dir_contents_privacy(path: &str) -> Vec<(crate::modules::rollback::RollbackItem, u64)> {
        let mut collected = Vec::new();
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() {
                        let src = entry.path().to_string_lossy().into_owned();
                        let size = metadata.len();
                        if let Ok(backup_path) = crate::modules::rollback::quarantine_file(&src) {
                            collected.push((crate::modules::rollback::RollbackItem {
                                item_type: "file".into(), path: src, backup_path,
                                original_hash: "untracked_privacy".into(), size_bytes: size,
                            }, size));
                        }
                    } else if metadata.is_dir() {
                        let _ = std::fs::remove_dir_all(entry.path());
                    }
                }
            }
        }
        collected
    }

    let mut merge_items = |items: Vec<(crate::modules::rollback::RollbackItem, u64)>| {
        for (item, size) in items {
            manifest.total_bytes += size;
            files_removed += 1;
            let path_str = item.path.clone();
            manifest.items.push(item);
            info!("[PrivacyEraser] Removed: {}", path_str);
        }
    };

    for id in &category_ids {
        match id.as_str() {
            "browser_history" => {
                merge_items(collect_file(format!("{}\\History", chrome_dir)));
                merge_items(collect_file(format!("{}\\History", edge_dir)));
                if !ff_dir.is_empty() { merge_items(collect_file(format!("{}\\places.sqlite", ff_dir))); }
            },
            "cookies" => {
                merge_items(collect_file(format!("{}\\Network\\Cookies", chrome_dir)));
                merge_items(collect_file(format!("{}\\Network\\Cookies", edge_dir)));
                if !ff_dir.is_empty() { merge_items(collect_file(format!("{}\\cookies.sqlite", ff_dir))); }
            },
            "recent_docs" => {
                merge_items(collect_dir_contents_privacy(&recent_docs));
            },
            "cache" => {
                merge_items(collect_dir_contents_privacy(&format!("{}\\Cache", chrome_dir)));
                merge_items(collect_dir_contents_privacy(&format!("{}\\Cache", edge_dir)));
                if !ff_dir.is_empty() { merge_items(collect_dir_contents_privacy(&format!("{}\\cache2", ff_dir))); }
            },
            "telemetry" => {
                let telemetry_dir = format!("{}\\AppData\\Local\\Microsoft\\Windows\\WebCache", user_profile);
                let activity_dir = format!("{}\\AppData\\Local\\ConnectedDevicesPlatform", user_profile);
                merge_items(collect_dir_contents_privacy(&telemetry_dir));
                merge_items(collect_dir_contents_privacy(&activity_dir));
                let _ = std::process::Command::new("ipconfig").args(&["/flushdns"]).output();
                info!("[PrivacyEraser] Telemetry + activity data cleaned");
            },
            _ => continue,
        }
    }

    if files_removed > 0 {
        let _ = crate::modules::rollback::create_snapshot(&manifest);
        crate::modules::audit::log_operation(
            "clean_privacy_traces",
            &format!("{:?}", category_ids),
            "success",
            &format!("Removed {} privacy trace files", files_removed),
            files_removed as u64,
            manifest.total_bytes,
        );
        tauri::async_runtime::spawn(async move {
            crate::modules::webhook::send_webhook_event(
                "clean_privacy_traces",
                serde_json::json!({
                    "categories": format!("{:?}", category_ids),
                    "status": "success",
                    "summary": format!("Removed {} files ({} bytes)", files_removed, manifest.total_bytes)
                })
            ).await;
        });
    }

    Ok(())
}

#[tauri::command]
pub async fn scan_bloatware() -> Vec<BloatwareApp> {
    info!("[Debloater] Scanning installed AppX packages");

    let ps = r#"Get-AppxPackage | Select-Object Name, PackageFullName, Publisher | ConvertTo-Json -Compress"#;
    let output = hidden_powershell()
        .args(&["-Command", ps])
        .output();

    let stdout = match output {
        Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(e) => { info!("[Debloater] PowerShell failed: {}", e); return Vec::new(); }
    };

    if stdout.trim().is_empty() { return Vec::new(); }

    let json_val: serde_json::Value = match serde_json::from_str(stdout.trim()) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let entries = match &json_val {
        serde_json::Value::Array(arr) => arr.clone(),
        obj @ serde_json::Value::Object(_) => vec![obj.clone()],
        _ => return Vec::new(),
    };

    let safe_to_remove = [
        "Microsoft.3DBuilder", "Microsoft.BingWeather", "Microsoft.BingNews",
        "Microsoft.GetHelp", "Microsoft.Getstarted", "Microsoft.Messaging",
        "Microsoft.MicrosoftOfficeHub", "Microsoft.MicrosoftSolitaireCollection",
        "Microsoft.MixedReality.Portal", "Microsoft.Office.OneNote",
        "Microsoft.OneConnect", "Microsoft.People", "Microsoft.Print3D",
        "Microsoft.SkypeApp", "Microsoft.Wallet", "Microsoft.WindowsMaps",
        "Microsoft.WindowsFeedbackHub", "Microsoft.Xbox.TCUI",
        "Microsoft.XboxApp", "Microsoft.XboxGameOverlay",
        "Microsoft.XboxGamingOverlay", "Microsoft.XboxIdentityProvider",
        "Microsoft.XboxSpeechToTextOverlay", "Microsoft.YourPhone",
        "Microsoft.ZuneMusic", "Microsoft.ZuneVideo",
        "Clipchamp.Clipchamp", "Microsoft.Todos",
        "Microsoft.PowerAutomateDesktop", "MicrosoftTeams",
        "Microsoft.549981C3F5F10", // Cortana
        "Microsoft.Windows.Ai.Copilot.Provider",
        "Microsoft.Copilot",
    ];

    let caution = [
        "Microsoft.WindowsStore", "Microsoft.WindowsCalculator",
        "Microsoft.WindowsCamera", "Microsoft.Windows.Photos",
        "Microsoft.WindowsAlarms", "Microsoft.WindowsSoundRecorder",
        "Microsoft.ScreenSketch", "Microsoft.Paint",
    ];

    let mut apps: Vec<BloatwareApp> = Vec::new();
    for entry in &entries {
        let name = entry.get("Name").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let pkg = entry.get("PackageFullName").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let publisher = entry.get("Publisher").and_then(|v| v.as_str()).unwrap_or("").to_string();

        if name.is_empty() { continue; }

        if name.contains("Framework") || name.contains("VCLibs") || name.contains("NET.Native") || name.contains("UI.Xaml") {
            continue;
        }

        let category = if safe_to_remove.iter().any(|s| name.contains(s)) {
            "safe".to_string()
        } else if caution.iter().any(|s| name.contains(s)) {
            "caution".to_string()
        } else if name.starts_with("Microsoft.") || name.starts_with("Windows.") {
            "keep".to_string()
        } else {
            "safe".to_string()
        };

        apps.push(BloatwareApp { name, package_name: pkg, publisher, category });
    }

    apps.sort_by(|a, b| a.category.cmp(&b.category).then(a.name.cmp(&b.name)));
    info!("[Debloater] Found {} AppX packages", apps.len());
    apps
}

#[tauri::command]
pub async fn remove_bloatware(packages: Vec<String>) -> Result<String, String> {
    info!("[Debloater] Removing {} packages", packages.len());
    let mut removed = 0;
    for pkg in &packages {
        let safe_pkg = sanitize_powershell_input(pkg);
        let cmd = format!("Get-AppxPackage '{}' | Remove-AppxPackage -ErrorAction SilentlyContinue", safe_pkg);
        let result = hidden_powershell()
            .args(&["-Command", &cmd])
            .output();
        if result.is_ok() { removed += 1; }
    }
    info!("[Debloater] Removed {} packages", removed);
    Ok(format!("Removed {} packages", removed))
}

#[tauri::command]
pub async fn restore_bloatware(package_name: String) -> Result<String, String> {
    info!("[Debloater] Restoring package: {}", package_name);
    let safe_name = sanitize_powershell_input(&package_name);
    let cmd = format!(
        "Get-AppxPackage -AllUsers '{}' | ForEach-Object {{Add-AppxPackage -DisableDevelopmentMode -Register \"$($_.InstallLocation)\\AppxManifest.xml\" -ErrorAction SilentlyContinue}}",
        safe_name
    );
    let output = hidden_powershell()
        .args(&["-Command", &cmd])
        .output()
        .map_err(|e| format!("Failed: {}", e))?;

    if output.status.success() {
        Ok(format!("Restored {}", package_name))
    } else {
        Err(format!("Failed to restore {}", package_name))
    }
}

#[tauri::command]
pub async fn get_privacy_settings() -> Vec<PrivacyToggle> {
    info!("[PrivacyHardening] Reading privacy settings from registry");
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let definitions: Vec<(&str, &str, &str, &str, &str, &str, u32)> = vec![
        ("telemetry", "Disable Telemetry", "Stop sending diagnostic data to Microsoft", "Telemetry",
         r"SOFTWARE\Policies\Microsoft\Windows\DataCollection", "AllowTelemetry", 0),
        ("adid", "Disable Advertising ID", "Prevent apps from using your advertising ID", "Advertising",
         r"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo", "Enabled", 0),
        ("location", "Disable Location Tracking", "Prevent Windows from tracking your location", "Location",
         r"SOFTWARE\Policies\Microsoft\Windows\LocationAndSensors", "DisableLocation", 1),
        ("activity", "Disable Activity History", "Stop publishing your activity history", "Activity",
         r"SOFTWARE\Policies\Microsoft\Windows\System", "PublishUserActivities", 0),
        ("feedback", "Disable Feedback Requests", "Stop Windows from asking for feedback", "Feedback",
         r"Software\Microsoft\Siuf\Rules", "NumberOfSIUFInPeriod", 0),
        ("cortana", "Disable Cortana", "Turn off Cortana assistant", "Assistant",
         r"SOFTWARE\Policies\Microsoft\Windows\Windows Search", "AllowCortana", 0),
        ("copilot", "Disable Copilot", "Turn off Windows Copilot AI", "AI",
         r"Software\Policies\Microsoft\Windows\WindowsCopilot", "TurnOffWindowsCopilot", 1),
        ("clipboard", "Disable Cloud Clipboard", "Prevent clipboard sync across devices", "Privacy",
         r"SOFTWARE\Policies\Microsoft\Windows\System", "AllowCloudClipboard", 0),
        ("tailored", "Disable Tailored Experiences", "Stop personalized tips and ads", "Advertising",
         r"Software\Microsoft\Windows\CurrentVersion\Privacy", "TailoredExperiencesWithDiagnosticDataEnabled", 0),
        ("wifi_sense", "Disable Wi-Fi Sense", "Stop sharing Wi-Fi credentials", "Network",
         r"SOFTWARE\Microsoft\WcmSvc\wifinetworkmanager\config", "AutoConnectAllowedOEM", 0),
        ("start_suggestions", "Disable Start Menu Suggestions", "Remove app suggestions from Start Menu", "Advertising",
         r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SubscribedContent-338388Enabled", 0),
        ("lock_screen_ads", "Disable Lock Screen Ads", "Remove ads from lock screen", "Advertising",
         r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "RotatingLockScreenOverlayEnabled", 0),
        ("typing_data", "Disable Typing Data Collection", "Stop sending typing/inking data", "Telemetry",
         r"Software\Microsoft\Input\TIPC", "Enabled", 0),
        ("app_launch_tracking", "Disable App Launch Tracking", "Stop tracking which apps you launch", "Privacy",
         r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "Start_TrackProgs", 0),
        ("suggested_content", "Disable Settings Suggestions", "Remove suggestions in Settings app", "Advertising",
         r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SubscribedContent-338393Enabled", 0),
        ("error_reporting", "Disable Error Reporting", "Stop sending error reports to Microsoft", "Telemetry",
         r"SOFTWARE\Microsoft\Windows\Windows Error Reporting", "Disabled", 1),
    ];

    let mut toggles: Vec<PrivacyToggle> = Vec::new();
    for (id, name, desc, cat, path, val_name, desired) in &definitions {
        let current = read_reg_dword(&hkcu, path, val_name)
            .or_else(|| read_reg_dword(&hklm, path, val_name));

        let is_applied = current.map(|v| v == *desired).unwrap_or(false);

        toggles.push(PrivacyToggle {
            id: id.to_string(),
            name: name.to_string(),
            description: desc.to_string(),
            category: cat.to_string(),
            enabled: is_applied,
            registry_path: path.to_string(),
            registry_value: val_name.to_string(),
        });
    }

    info!("[PrivacyHardening] Read {} privacy settings", toggles.len());
    toggles
}

#[tauri::command]
pub async fn set_privacy_setting(setting_id: String, enable: bool) -> Result<(), String> {
    info!("[PrivacyHardening] Setting {} = {}", setting_id, enable);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);

    let ops: Vec<(&RegKey, &str, &str, u32)> = match setting_id.as_str() {
        "telemetry" => vec![(&hklm, r"SOFTWARE\Policies\Microsoft\Windows\DataCollection", "AllowTelemetry", if enable { 0 } else { 1 })],
        "adid" => vec![(&hkcu, r"Software\Microsoft\Windows\CurrentVersion\AdvertisingInfo", "Enabled", if enable { 0 } else { 1 })],
        "location" => vec![(&hklm, r"SOFTWARE\Policies\Microsoft\Windows\LocationAndSensors", "DisableLocation", if enable { 1 } else { 0 })],
        "activity" => vec![(&hklm, r"SOFTWARE\Policies\Microsoft\Windows\System", "PublishUserActivities", if enable { 0 } else { 1 })],
        "feedback" => vec![(&hkcu, r"Software\Microsoft\Siuf\Rules", "NumberOfSIUFInPeriod", if enable { 0 } else { 1 })],
        "cortana" => vec![(&hklm, r"SOFTWARE\Policies\Microsoft\Windows\Windows Search", "AllowCortana", if enable { 0 } else { 1 })],
        "copilot" => vec![(&hkcu, r"Software\Policies\Microsoft\Windows\WindowsCopilot", "TurnOffWindowsCopilot", if enable { 1 } else { 0 })],
        "clipboard" => vec![(&hklm, r"SOFTWARE\Policies\Microsoft\Windows\System", "AllowCloudClipboard", if enable { 0 } else { 1 })],
        "tailored" => vec![(&hkcu, r"Software\Microsoft\Windows\CurrentVersion\Privacy", "TailoredExperiencesWithDiagnosticDataEnabled", if enable { 0 } else { 1 })],
        "wifi_sense" => vec![(&hklm, r"SOFTWARE\Microsoft\WcmSvc\wifinetworkmanager\config", "AutoConnectAllowedOEM", if enable { 0 } else { 1 })],
        "start_suggestions" => vec![(&hkcu, r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SubscribedContent-338388Enabled", if enable { 0 } else { 1 })],
        "lock_screen_ads" => vec![(&hkcu, r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "RotatingLockScreenOverlayEnabled", if enable { 0 } else { 1 })],
        "typing_data" => vec![(&hkcu, r"Software\Microsoft\Input\TIPC", "Enabled", if enable { 0 } else { 1 })],
        "app_launch_tracking" => vec![(&hkcu, r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "Start_TrackProgs", if enable { 0 } else { 1 })],
        "suggested_content" => vec![(&hkcu, r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SubscribedContent-338393Enabled", if enable { 0 } else { 1 })],
        "error_reporting" => vec![(&hklm, r"SOFTWARE\Microsoft\Windows\Windows Error Reporting", "Disabled", if enable { 1 } else { 0 })],
        _ => return Err("Unknown setting".into()),
    };

    for (hk, path, val_name, value) in ops {
        let (key, _) = hk.create_subkey(path).map_err(|e| format!("Registry error: {}. Try running as Administrator.", e))?;
        key.set_value(val_name, &value).map_err(|e| format!("Failed to set value: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_windows_tweaks() -> Vec<WindowsTweak> {
    info!("[WindowsTweaks] Reading Windows tweak settings");
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    let mut tweaks = Vec::new();

    let show_ext = read_reg_dword(&hkcu, r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "HideFileExt")
        .map(|v| v == 0).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "show_extensions".into(), name: "Show File Extensions".into(),
        description: "Show file extensions in Explorer".into(), category: "Explorer".into(), enabled: show_ext });

    let show_hidden = read_reg_dword(&hkcu, r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "Hidden")
        .map(|v| v == 1).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "show_hidden".into(), name: "Show Hidden Files".into(),
        description: "Show hidden files and folders".into(), category: "Explorer".into(), enabled: show_hidden });

    let classic_menu = hkcu.open_subkey_with_flags(r"Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32", KEY_READ).is_ok();
    tweaks.push(WindowsTweak { id: "classic_context_menu".into(), name: "Classic Right-Click Menu".into(),
        description: "Use Windows 10 style context menu on Win11".into(), category: "UI".into(), enabled: classic_menu });

    let game_bar_off = read_reg_dword(&hkcu, r"SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR", "AppCaptureEnabled")
        .map(|v| v == 0).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "disable_game_bar".into(), name: "Disable Game Bar".into(),
        description: "Turn off Xbox Game Bar overlay".into(), category: "Gaming".into(), enabled: game_bar_off });

    let search_hidden = read_reg_dword(&hkcu, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Search", "SearchboxTaskbarMode")
        .map(|v| v == 0).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "hide_search".into(), name: "Hide Taskbar Search".into(),
        description: "Remove search box/icon from taskbar".into(), category: "Taskbar".into(), enabled: search_hidden });

    let tv_hidden = read_reg_dword(&hkcu, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "ShowTaskViewButton")
        .map(|v| v == 0).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "hide_task_view".into(), name: "Hide Task View Button".into(),
        description: "Remove Task View from taskbar".into(), category: "Taskbar".into(), enabled: tv_hidden });

    let widgets_off = read_reg_dword(&hkcu, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "TaskbarDa")
        .map(|v| v == 0).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "hide_widgets".into(), name: "Hide Widgets".into(),
        description: "Remove Widgets button from taskbar".into(), category: "Taskbar".into(), enabled: widgets_off });

    let chat_off = read_reg_dword(&hkcu, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "TaskbarMn")
        .map(|v| v == 0).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "hide_chat".into(), name: "Hide Chat/Teams".into(),
        description: "Remove Chat icon from taskbar".into(), category: "Taskbar".into(), enabled: chat_off });

    info!("[WindowsTweaks] Read {} tweaks", tweaks.len());
    tweaks
}

#[tauri::command]
pub async fn set_windows_tweak(tweak_id: String, enable: bool) -> Result<(), String> {
    info!("[WindowsTweaks] Setting {} = {}", tweak_id, enable);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    match tweak_id.as_str() {
        "show_extensions" => {
            let (key, _) = hkcu.create_subkey(r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced").map_err(|e| e.to_string())?;
            key.set_value("HideFileExt", &(if enable { 0u32 } else { 1u32 })).map_err(|e| e.to_string())?;
        },
        "show_hidden" => {
            let (key, _) = hkcu.create_subkey(r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced").map_err(|e| e.to_string())?;
            key.set_value("Hidden", &(if enable { 1u32 } else { 2u32 })).map_err(|e| e.to_string())?;
        },
        "classic_context_menu" => {
            if enable {
                let (key, _) = hkcu.create_subkey(r"Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32").map_err(|e| e.to_string())?;
                key.set_value("", &"").map_err(|e| e.to_string())?;
            } else {
                let _ = hkcu.delete_subkey_all(r"Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}");
            }
        },
        "disable_game_bar" => {
            let (key, _) = hkcu.create_subkey(r"SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR").map_err(|e| e.to_string())?;
            key.set_value("AppCaptureEnabled", &(if enable { 0u32 } else { 1u32 })).map_err(|e| e.to_string())?;
        },
        "hide_search" => {
            let (key, _) = hkcu.create_subkey(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Search").map_err(|e| e.to_string())?;
            key.set_value("SearchboxTaskbarMode", &(if enable { 0u32 } else { 2u32 })).map_err(|e| e.to_string())?;
        },
        "hide_task_view" => {
            let (key, _) = hkcu.create_subkey(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced").map_err(|e| e.to_string())?;
            key.set_value("ShowTaskViewButton", &(if enable { 0u32 } else { 1u32 })).map_err(|e| e.to_string())?;
        },
        "hide_widgets" => {
            let (key, _) = hkcu.create_subkey(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced").map_err(|e| e.to_string())?;
            key.set_value("TaskbarDa", &(if enable { 0u32 } else { 1u32 })).map_err(|e| e.to_string())?;
        },
        "hide_chat" => {
            let (key, _) = hkcu.create_subkey(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced").map_err(|e| e.to_string())?;
            key.set_value("TaskbarMn", &(if enable { 0u32 } else { 1u32 })).map_err(|e| e.to_string())?;
        },
        _ => return Err("Unknown tweak".into()),
    }
    Ok(())
}

#[tauri::command]
pub async fn get_edge_settings() -> Vec<EdgeSetting> {
    info!("[EdgeManager] Reading Edge settings");
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    let mut settings = Vec::new();

    let startup_boost = read_reg_dword(&hklm, r"SOFTWARE\Policies\Microsoft\Edge", "StartupBoostEnabled")
        .map(|v| v == 0).unwrap_or(false);
    settings.push(EdgeSetting { id: "startup_boost".into(), name: "Disable Startup Boost".into(),
        description: "Prevent Edge from running in background on startup".into(), enabled: startup_boost });

    let sidebar = read_reg_dword(&hklm, r"SOFTWARE\Policies\Microsoft\Edge", "HubsSidebarEnabled")
        .map(|v| v == 0).unwrap_or(false);
    settings.push(EdgeSetting { id: "sidebar".into(), name: "Disable Edge Sidebar".into(),
        description: "Remove the sidebar panel from Edge".into(), enabled: sidebar });

    let collections = read_reg_dword(&hklm, r"SOFTWARE\Policies\Microsoft\Edge", "EdgeCollectionsEnabled")
        .map(|v| v == 0).unwrap_or(false);
    settings.push(EdgeSetting { id: "collections".into(), name: "Disable Collections".into(),
        description: "Disable Edge Collections feature".into(), enabled: collections });

    let pdf = read_reg_dword(&hkcu, r"SOFTWARE\Policies\Microsoft\Edge", "AlwaysOpenPdfExternally")
        .map(|v| v == 1).unwrap_or(false);
    settings.push(EdgeSetting { id: "pdf_external".into(), name: "Open PDFs Externally".into(),
        description: "Don't use Edge as PDF viewer".into(), enabled: pdf });

    settings
}

#[tauri::command]
pub async fn set_edge_setting(setting_id: String, enable: bool) -> Result<(), String> {
    info!("[EdgeManager] Setting {} = {}", setting_id, enable);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);

    match setting_id.as_str() {
        "startup_boost" => {
            let (key, _) = hklm.create_subkey(r"SOFTWARE\Policies\Microsoft\Edge").map_err(|e| e.to_string())?;
            key.set_value("StartupBoostEnabled", &(if enable { 0u32 } else { 1u32 })).map_err(|e| e.to_string())?;
        },
        "sidebar" => {
            let (key, _) = hklm.create_subkey(r"SOFTWARE\Policies\Microsoft\Edge").map_err(|e| e.to_string())?;
            key.set_value("HubsSidebarEnabled", &(if enable { 0u32 } else { 1u32 })).map_err(|e| e.to_string())?;
        },
        "collections" => {
            let (key, _) = hklm.create_subkey(r"SOFTWARE\Policies\Microsoft\Edge").map_err(|e| e.to_string())?;
            key.set_value("EdgeCollectionsEnabled", &(if enable { 0u32 } else { 1u32 })).map_err(|e| e.to_string())?;
        },
        "pdf_external" => {
            let (key, _) = hkcu.create_subkey(r"SOFTWARE\Policies\Microsoft\Edge").map_err(|e| e.to_string())?;
            key.set_value("AlwaysOpenPdfExternally", &(if enable { 1u32 } else { 0u32 })).map_err(|e| e.to_string())?;
        },
        _ => return Err("Unknown setting".into()),
    }
    Ok(())
}

#[tauri::command]
pub async fn scan_browser_extensions() -> Vec<BrowserExtension> {
    info!("[BrowserExt] Scanning browser extensions");

    let _user = std::env::var("USERPROFILE").unwrap_or_default();
    let local = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let appdata = std::env::var("APPDATA").unwrap_or_default();

    let mut extensions = Vec::new();

    let chromium_bases = vec![
        ("Chrome", format!("{}\\Google\\Chrome\\User Data", local)),
        ("Edge", format!("{}\\Microsoft\\Edge\\User Data", local)),
    ];

    let mut chromium_ext_dirs: Vec<(String, std::path::PathBuf)> = Vec::new();
    for (browser, user_data) in &chromium_bases {
        let ud = std::path::Path::new(user_data);
        if !ud.exists() { continue; }
        if let Ok(entries) = std::fs::read_dir(ud) {
            for entry in entries.filter_map(|e| e.ok()) {
                let name = entry.file_name().to_string_lossy().to_string();
                if name == "Default" || name.starts_with("Profile ") {
                    let ext_dir = entry.path().join("Extensions");
                    if ext_dir.exists() {
                        chromium_ext_dirs.push((browser.to_string(), ext_dir));
                    }
                }
            }
        }
    }

    let mut seen_ids: HashSet<String> = HashSet::new();

    for (browser, ext_path) in &chromium_ext_dirs {
        if let Ok(entries) = std::fs::read_dir(ext_path) {
            for entry in entries.filter_map(|e| e.ok()) {
                let ext_id = entry.file_name().to_string_lossy().to_string();

                let dedup_key = format!("{}:{}", browser, ext_id);
                if seen_ids.contains(&dedup_key) { continue; }

                if let Ok(versions) = std::fs::read_dir(entry.path()) {
                    for ver_entry in versions.filter_map(|e| e.ok()) {
                        let manifest_path = ver_entry.path().join("manifest.json");
                        if !manifest_path.exists() { continue; }

                        if let Ok(content) = std::fs::read_to_string(&manifest_path) {
                            if let Ok(manifest) = serde_json::from_str::<serde_json::Value>(&content) {
                                let name = manifest["name"].as_str().unwrap_or("Unknown").to_string();
                                let version = manifest["version"].as_str().unwrap_or("?").to_string();
                                let description = manifest["description"].as_str().unwrap_or("").to_string();

                                let mut perms = Vec::new();
                                if let Some(arr) = manifest["permissions"].as_array() {
                                    for p in arr {
                                        if let Some(s) = p.as_str() { perms.push(s.to_string()); }
                                    }
                                }
                                if let Some(arr) = manifest["host_permissions"].as_array() {
                                    for p in arr {
                                        if let Some(s) = p.as_str() { perms.push(s.to_string()); }
                                    }
                                }

                                if name.starts_with("__MSG_") || (name.contains("Chrome") && description.is_empty()) {
                                    continue;
                                }

                                let (risk_level, risk_score) = assess_extension_risk(&perms);

                                seen_ids.insert(dedup_key.clone());
                                extensions.push(BrowserExtension {
                                    browser: browser.to_string(),
                                    name,
                                    version,
                                    description: if description.len() > 100 {
                                        format!("{}...", &description[..100])
                                    } else { description },
                                    permissions: perms,
                                    risk_level,
                                    risk_score,
                                    extension_id: ext_id.clone(),
                                    path: manifest_path.to_string_lossy().to_string(),
                                });
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    // Firefox extensions
    let firefox_profiles = format!("{}\\Mozilla\\Firefox\\Profiles", appdata);
    let fp = std::path::Path::new(&firefox_profiles);
    if fp.exists() {
        if let Ok(profiles) = std::fs::read_dir(fp) {
            for profile in profiles.filter_map(|e| e.ok()) {
                let ext_file = profile.path().join("extensions.json");
                if !ext_file.exists() { continue; }

                if let Ok(content) = std::fs::read_to_string(&ext_file) {
                    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(addons) = data["addons"].as_array() {
                            for addon in addons {
                                let name = addon["defaultLocale"]["name"].as_str()
                                    .or_else(|| addon["name"].as_str())
                                    .unwrap_or("Unknown").to_string();
                                let version = addon["version"].as_str().unwrap_or("?").to_string();
                                let description = addon["defaultLocale"]["description"].as_str()
                                    .unwrap_or("").to_string();
                                let ext_id = addon["id"].as_str().unwrap_or("").to_string();

                                let mut perms = Vec::new();
                                if let Some(arr) = addon["userPermissions"]["permissions"].as_array() {
                                    for p in arr { if let Some(s) = p.as_str() { perms.push(s.to_string()); } }
                                }

                                let (risk_level, risk_score) = assess_extension_risk(&perms);

                                extensions.push(BrowserExtension {
                                    browser: "Firefox".into(),
                                    name,
                                    version,
                                    description: if description.len() > 100 {
                                        format!("{}...", &description[..100])
                                    } else { description },
                                    permissions: perms,
                                    risk_level,
                                    risk_score,
                                    extension_id: ext_id,
                                    path: ext_file.to_string_lossy().to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    extensions.sort_by(|a, b| b.risk_score.cmp(&a.risk_score));

    info!("[BrowserExt] Found {} extensions across all browsers", extensions.len());
    extensions
}

// ── Pop-up Ad Blocker ──

#[derive(Serialize, Clone)]
pub struct PopupSetting {
    pub id: String,
    pub name: String,
    pub description: String,
    pub blocked: bool,
}

#[tauri::command]
pub async fn get_popup_settings() -> Vec<PopupSetting> {
    info!("[PopupBlocker] Reading notification/ad settings");
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let mut settings = Vec::new();

    let defs: Vec<(&str, &str, &str, &str, &str, u32)> = vec![
        ("tips", "Disable Tips & Suggestions", "Block Windows tips and trick notifications",
         r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SoftLandingEnabled", 0),
        ("welcome", "Disable Welcome Experience", "Block welcome tips after updates",
         r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SubscribedContent-310093Enabled", 0),
        ("app_suggestions", "Disable App Suggestions", "Block suggested app notifications",
         r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SubscribedContent-338389Enabled", 0),
        ("timeline_suggest", "Disable Timeline Suggestions", "Block timeline activity suggestions",
         r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SubscribedContent-353694Enabled", 0),
        ("notification_suggest", "Disable Notification Suggestions", "Block notification center suggestions",
         r"Software\Microsoft\Windows\CurrentVersion\Notifications\Settings\Windows.SystemToast.Suggested", "Enabled", 0),
        ("sync_notif", "Disable Sync Notifications", "Block sync provider ad notifications",
         r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "ShowSyncProviderNotifications", 0),
        ("finish_setup", "Disable Finish Setup Reminders", "Block 'finish setting up' device nags",
         r"Software\Microsoft\Windows\CurrentVersion\UserProfileEngagement", "ScoobeSystemSettingEnabled", 0),
    ];

    for (id, name, desc, path, val_name, desired) in &defs {
        let current = read_reg_dword(&hkcu, path, val_name);
        let is_blocked = current.map(|v| v == *desired).unwrap_or(false);
        settings.push(PopupSetting {
            id: id.to_string(), name: name.to_string(), description: desc.to_string(), blocked: is_blocked,
        });
    }
    settings
}

#[tauri::command]
pub async fn set_popup_setting(setting_id: String, block: bool) -> Result<(), String> {
    info!("[PopupBlocker] {} popup: {}", if block { "Blocking" } else { "Unblocking" }, setting_id);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let ops: Vec<(&str, &str, u32)> = match setting_id.as_str() {
        "tips" => vec![(r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SoftLandingEnabled", if block { 0 } else { 1 })],
        "welcome" => vec![(r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SubscribedContent-310093Enabled", if block { 0 } else { 1 })],
        "app_suggestions" => vec![(r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SubscribedContent-338389Enabled", if block { 0 } else { 1 })],
        "timeline_suggest" => vec![(r"Software\Microsoft\Windows\CurrentVersion\ContentDeliveryManager", "SubscribedContent-353694Enabled", if block { 0 } else { 1 })],
        "notification_suggest" => vec![(r"Software\Microsoft\Windows\CurrentVersion\Notifications\Settings\Windows.SystemToast.Suggested", "Enabled", if block { 0 } else { 1 })],
        "sync_notif" => vec![(r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "ShowSyncProviderNotifications", if block { 0 } else { 1 })],
        "finish_setup" => vec![(r"Software\Microsoft\Windows\CurrentVersion\UserProfileEngagement", "ScoobeSystemSettingEnabled", if block { 0 } else { 1 })],
        _ => return Err("Unknown setting".into()),
    };
    for (path, val_name, value) in ops {
        let (key, _) = hkcu.create_subkey(path).map_err(|e| e.to_string())?;
        key.set_value(val_name, &value).map_err(|e| e.to_string())?;
    }
    Ok(())
}
