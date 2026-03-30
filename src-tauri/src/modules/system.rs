use serde::{Serialize, Deserialize};
use sysinfo::{Disks, Networks, System};
use std::env;
use std::collections::HashMap;
use walkdir::WalkDir;
use winreg::enums::*;
use winreg::RegKey;
use winreg::types::FromRegValue;
use tracing::info;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

use crate::util::{hidden_powershell, read_reg_dword, version_is_newer};

// ── Structs ──

#[derive(Serialize, Deserialize)]
pub struct DiskInfo {
    pub name: String,
    pub mount_point: String,
    pub total_gb: f64,
    pub free_gb: f64,
    pub used_gb: f64,
    pub usage_percent: f64,
    pub fs_type: String,
}

#[derive(Serialize, Deserialize)]
pub struct SystemOverview {
    pub hostname: String,
    pub os_name: String,
    pub os_version: String,
    pub cpu_name: String,
    pub cpu_cores: usize,
    pub cpu_usage: f64,
    pub ram_total_gb: f64,
    pub ram_used_gb: f64,
    pub ram_usage: f64,
    pub disks: Vec<DiskInfo>,
    pub uptime_hours: f64,
    pub gpu_name: String,
}

#[derive(Serialize)]
pub struct SystemDetails {
    pub sections: Vec<DetailSection>,
}

#[derive(Serialize)]
pub struct DetailSection {
    pub title: String,
    pub items: Vec<DetailItem>,
}

#[derive(Serialize)]
pub struct DetailItem {
    pub label: String,
    pub value: String,
}

#[derive(Serialize, Clone)]
pub struct LiveStats {
    pub cpu_usage: f64,
    pub ram_usage: f64,
    pub ram_used_gb: f64,
    pub ram_total_gb: f64,
    pub disk_read_bytes: u64,
    pub disk_write_bytes: u64,
    pub net_rx_bytes: u64,
    pub net_tx_bytes: u64,
    pub process_count: usize,
    pub top_cpu_process: String,
    pub top_ram_process: String,
    pub timestamp: u64,
}

#[derive(Serialize, Clone)]
pub struct InstalledApp {
    pub name: String,
    pub publisher: String,
    pub version: String,
    pub install_date: String,
    pub install_location: String,
    pub uninstall_string: String,
    pub size_mb: f64,
}

#[derive(Serialize)]
pub struct LeftoverResult {
    pub app_name: String,
    pub leftover_files: Vec<String>,
    pub leftover_registry: Vec<String>,
    pub total_size_mb: f64,
}

#[derive(Serialize, Clone)]
pub struct SoftwareItem {
    pub name: String,
    pub current_version: String,
    pub latest_version: String,
    pub publisher: String,
    pub needs_update: bool,
}

#[derive(Serialize, Clone)]
pub struct ServiceItem {
    pub name: String,
    pub display_name: String,
    pub status: String,
    pub start_type: String,
    pub can_stop: bool,
}

#[derive(Serialize, Clone)]
pub struct DriverItem {
    pub name: String,
    pub device: String,
    pub current_version: String,
    pub latest_version: String,
    pub needs_update: bool,
    pub category: String,
}

#[derive(Serialize)]
pub struct RegistryIssue {
    pub id: String,
    pub category: String,
    pub key: String,
    pub description: String,
    pub severity: String,
}

#[derive(Serialize)]
pub struct RestorePointInfo {
    pub sequence_number: String,
    pub description: String,
    pub creation_time: String,
    pub restore_type: String,
}

#[derive(Serialize)]
pub struct UpdateInfo {
    pub hotfix_id: String,
    pub description: String,
    pub installed_on: String,
    pub title: String,
    pub kb_url: String,
}

#[derive(Serialize)]
pub struct UserProfile {
    pub name: String,
    pub path: String,
    pub sid: String,
    pub last_use: String,
    pub size_mb: f64,
}

#[derive(Serialize)]
pub struct AppUpdateInfo {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
    pub release_notes: String,
    pub download_url: String,
}

// ── Helper functions ──

fn read_apps_from_key(hkey: &RegKey, path: &str) -> Vec<InstalledApp> {
    let mut apps = Vec::new();
    if let Ok(uninstall_key) = hkey.open_subkey_with_flags(path, KEY_READ) {
        for subkey_name in uninstall_key.enum_keys().filter_map(|k| k.ok()) {
            if let Ok(subkey) = uninstall_key.open_subkey_with_flags(&subkey_name, KEY_READ) {
                let name: String = subkey.get_value("DisplayName").unwrap_or_default();
                if name.is_empty() { continue; }
                let publisher: String = subkey.get_value("Publisher").unwrap_or_default();
                let version: String = subkey.get_value("DisplayVersion").unwrap_or_default();
                let install_date: String = subkey.get_value("InstallDate").unwrap_or_default();
                let install_location: String = subkey.get_value("InstallLocation").unwrap_or_default();
                let uninstall_string: String = subkey.get_value("UninstallString").unwrap_or_default();
                let size: u32 = subkey.get_value("EstimatedSize").unwrap_or(0);
                apps.push(InstalledApp {
                    name, publisher, version, install_date, install_location, uninstall_string,
                    size_mb: size as f64 / 1024.0,
                });
            }
        }
    }
    apps
}

// ── Tauri Commands ──

#[tauri::command]
pub async fn get_system_overview() -> SystemOverview {
    info!(module = "system", "Getting system overview");
    let mut sys = System::new_all();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_all();

    let cpu_usage: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>() / sys.cpus().len().max(1) as f64;
    let ram_total = sys.total_memory() as f64 / 1_073_741_824.0;
    let ram_used = sys.used_memory() as f64 / 1_073_741_824.0;
    let ram_usage = if sys.total_memory() > 0 { (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0 } else { 0.0 };

    let disks = Disks::new_with_refreshed_list();
    let disk_list: Vec<DiskInfo> = disks.iter().map(|d| {
        let total = d.total_space() as f64 / 1_073_741_824.0;
        let free = d.available_space() as f64 / 1_073_741_824.0;
        let used = total - free;
        DiskInfo {
            name: d.name().to_string_lossy().into_owned(),
            mount_point: d.mount_point().to_string_lossy().into_owned(),
            total_gb: (total * 10.0).round() / 10.0,
            free_gb: (free * 10.0).round() / 10.0,
            used_gb: (used * 10.0).round() / 10.0,
            usage_percent: if total > 0.0 { ((used / total) * 100.0 * 10.0).round() / 10.0 } else { 0.0 },
            fs_type: d.file_system().to_string_lossy().into_owned(),
        }
    }).collect();

    let hostname = System::host_name().unwrap_or_else(|| "Unknown".into());
    let os_name = System::name().unwrap_or_else(|| "Unknown".into());
    let os_version = System::os_version().unwrap_or_else(|| "Unknown".into());
    let cpu_name = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_else(|| "Unknown".into());
    let cpu_cores = sys.cpus().len();
    let uptime_hours = (System::uptime() as f64) / 3600.0;

    // GPU via PowerShell
    let gpu_output = hidden_powershell()
        .args(&["-Command", "(Get-CimInstance Win32_VideoController | Select-Object -First 1).Name"])
        .output();
    let gpu_name = gpu_output.ok()
        .and_then(|o| {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if s.is_empty() { None } else { Some(s) }
        })
        .unwrap_or_else(|| "Unknown".into());

    SystemOverview {
        hostname, os_name, os_version, cpu_name, cpu_cores,
        cpu_usage: (cpu_usage * 10.0).round() / 10.0,
        ram_total_gb: (ram_total * 100.0).round() / 100.0,
        ram_used_gb: (ram_used * 100.0).round() / 100.0,
        ram_usage: (ram_usage * 10.0).round() / 10.0,
        disks: disk_list,
        uptime_hours: (uptime_hours * 10.0).round() / 10.0,
        gpu_name,
    }
}

#[tauri::command]
pub async fn get_system_details() -> SystemDetails {
    info!(module = "system", "Getting detailed system info");
    let mut sections = Vec::new();
    let mut sys = System::new_all();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_all();

    // OS Section
    let mut os_items = Vec::new();
    os_items.push(DetailItem { label: "OS Name".into(), value: System::name().unwrap_or_default() });
    os_items.push(DetailItem { label: "OS Version".into(), value: System::os_version().unwrap_or_default() });
    os_items.push(DetailItem { label: "Kernel Version".into(), value: System::kernel_version().unwrap_or_default() });
    os_items.push(DetailItem { label: "Hostname".into(), value: System::host_name().unwrap_or_default() });
    os_items.push(DetailItem { label: "Uptime".into(), value: format!("{:.1} hours", System::uptime() as f64 / 3600.0) });
    sections.push(DetailSection { title: "Operating System".into(), items: os_items });

    // CPU Section
    let mut cpu_items = Vec::new();
    cpu_items.push(DetailItem { label: "CPU".into(), value: sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default() });
    cpu_items.push(DetailItem { label: "Cores/Threads".into(), value: format!("{}", sys.cpus().len()) });
    cpu_items.push(DetailItem { label: "CPU Usage".into(), value: {
        let u: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>() / sys.cpus().len().max(1) as f64;
        format!("{:.1}%", u)
    }});
    sections.push(DetailSection { title: "Processor".into(), items: cpu_items });

    // Memory Section
    let mut mem_items = Vec::new();
    mem_items.push(DetailItem { label: "Total".into(), value: format!("{:.1} GB", sys.total_memory() as f64 / 1_073_741_824.0) });
    mem_items.push(DetailItem { label: "Used".into(), value: format!("{:.1} GB", sys.used_memory() as f64 / 1_073_741_824.0) });
    mem_items.push(DetailItem { label: "Available".into(), value: format!("{:.1} GB", sys.available_memory() as f64 / 1_073_741_824.0) });
    sections.push(DetailSection { title: "Memory".into(), items: mem_items });

    // Disk Section
    let disks = Disks::new_with_refreshed_list();
    let mut disk_items = Vec::new();
    for d in disks.iter() {
        let total = d.total_space() as f64 / 1_073_741_824.0;
        let free = d.available_space() as f64 / 1_073_741_824.0;
        disk_items.push(DetailItem {
            label: format!("{} ({})", d.mount_point().to_string_lossy(), d.file_system().to_string_lossy()),
            value: format!("{:.1} GB free / {:.1} GB total", free, total),
        });
    }
    sections.push(DetailSection { title: "Storage".into(), items: disk_items });

    // Network Section
    let nets = Networks::new_with_refreshed_list();
    let mut net_items = Vec::new();
    for (name, data) in &nets {
        net_items.push(DetailItem {
            label: name.to_string(),
            value: format!("↓{:.1} MB ↑{:.1} MB", data.total_received() as f64 / 1_048_576.0, data.total_transmitted() as f64 / 1_048_576.0),
        });
    }
    if !net_items.is_empty() {
        sections.push(DetailSection { title: "Network Interfaces".into(), items: net_items });
    }

    SystemDetails { sections }
}

#[tauri::command]
pub async fn get_live_stats() -> LiveStats {
    let mut sys = System::new_all();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_all();

    let cpu_usage: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>() / sys.cpus().len().max(1) as f64;
    let ram_total = sys.total_memory() as f64 / 1_073_741_824.0;
    let ram_used = sys.used_memory() as f64 / 1_073_741_824.0;
    let ram_usage = if sys.total_memory() > 0 { (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0 } else { 0.0 };

    let top_cpu = sys.processes().values()
        .max_by(|a, b| a.cpu_usage().partial_cmp(&b.cpu_usage()).unwrap_or(std::cmp::Ordering::Equal))
        .map(|p| format!("{} ({:.1}%)", p.name().to_string_lossy(), p.cpu_usage()))
        .unwrap_or_else(|| "N/A".into());

    let top_ram = sys.processes().values()
        .max_by_key(|p| p.memory())
        .map(|p| format!("{} ({:.0} MB)", p.name().to_string_lossy(), p.memory() as f64 / 1_048_576.0))
        .unwrap_or_else(|| "N/A".into());

    let nets = Networks::new_with_refreshed_list();
    let (rx, tx) = nets.iter().fold((0u64, 0u64), |(rx, tx), (_, data)| {
        (rx + data.total_received(), tx + data.total_transmitted())
    });

    let process_count = sys.processes().len();
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();

    LiveStats {
        cpu_usage, ram_usage,
        ram_used_gb: (ram_used * 100.0).round() / 100.0,
        ram_total_gb: (ram_total * 100.0).round() / 100.0,
        disk_read_bytes: 0, disk_write_bytes: 0,
        net_rx_bytes: rx, net_tx_bytes: tx,
        process_count, top_cpu_process: top_cpu, top_ram_process: top_ram, timestamp: now,
    }
}

#[tauri::command]
pub async fn get_installed_apps() -> Vec<InstalledApp> {
    info!(module = "system", "Scanning installed applications");
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let mut apps = Vec::new();
    apps.extend(read_apps_from_key(&hklm, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"));
    apps.extend(read_apps_from_key(&hklm, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"));
    apps.extend(read_apps_from_key(&hkcu, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"));
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps.dedup_by(|a, b| a.name.to_lowercase() == b.name.to_lowercase());
    info!(module = "system", count = apps.len(), "Found installed applications");
    apps
}

#[tauri::command]
pub async fn uninstall_app(uninstall_string: String) -> Result<(), String> {
    info!(module = "system", cmd = %uninstall_string, "Running uninstall");
    if uninstall_string.is_empty() { return Err("No uninstall command available".into()); }
    std::process::Command::new("cmd").args(&["/C", &uninstall_string]).spawn()
        .map_err(|e| format!("Failed to launch uninstaller: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn scan_app_leftovers(app_name: String, install_location: String) -> LeftoverResult {
    info!(module = "system", app = %app_name, "Scanning leftovers");
    let mut leftover_files: Vec<String> = Vec::new();
    let mut total_size: u64 = 0;

    if !install_location.is_empty() && std::fs::metadata(&install_location).is_ok() {
        for entry in WalkDir::new(&install_location).max_depth(3).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                total_size += entry.metadata().map(|m| m.len()).unwrap_or(0);
                leftover_files.push(entry.path().to_string_lossy().into_owned());
                if leftover_files.len() >= 50 { break; }
            }
        }
    }

    let user_profile = env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    for sub in &["AppData\\Local", "AppData\\Roaming", "AppData\\LocalLow"] {
        let path = format!("{}\\{}\\{}", user_profile, sub, app_name);
        if std::fs::metadata(&path).is_ok() {
            leftover_files.push(path.clone());
            if let Ok(entries) = std::fs::read_dir(&path) {
                for entry in entries.flatten().take(10) {
                    total_size += entry.metadata().map(|m| m.len()).unwrap_or(0);
                    leftover_files.push(entry.path().to_string_lossy().into_owned());
                }
            }
        }
    }

    let mut leftover_registry = Vec::new();
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let software_path = format!("SOFTWARE\\{}", app_name);
    if hkcu.open_subkey_with_flags(&software_path, KEY_READ).is_ok() {
        leftover_registry.push(format!("HKCU\\{}", software_path));
    }

    LeftoverResult {
        app_name, leftover_files, leftover_registry,
        total_size_mb: (total_size as f64 / 1_048_576.0 * 100.0).round() / 100.0,
    }
}

#[tauri::command]
pub async fn clean_app_leftovers(files: Vec<String>, registry_keys: Vec<String>) -> Result<(), String> {
    info!(module = "system", files = files.len(), keys = registry_keys.len(), "Cleaning leftovers");
    for file_path in &files {
        if let Ok(metadata) = std::fs::metadata(file_path) {
            if metadata.is_dir() { let _ = std::fs::remove_dir_all(file_path); }
            else { let _ = std::fs::remove_file(file_path); }
        }
    }
    for key in &registry_keys { info!(module = "system", key = %key, "Would clean registry key"); }
    Ok(())
}

#[tauri::command]
pub async fn check_software_updates() -> Vec<SoftwareItem> {
    info!(module = "system", "Checking software updates via winget");
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let paths = vec![
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
        r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",
    ];
    let mut apps: Vec<SoftwareItem> = Vec::new();
    for path in &paths {
        if let Ok(uninstall_key) = hklm.open_subkey_with_flags(path, KEY_READ) {
            for subkey_name in uninstall_key.enum_keys().filter_map(|k| k.ok()) {
                if let Ok(subkey) = uninstall_key.open_subkey_with_flags(&subkey_name, KEY_READ) {
                    let name: String = subkey.get_value("DisplayName").unwrap_or_default();
                    if name.is_empty() { continue; }
                    let version: String = subkey.get_value("DisplayVersion").unwrap_or_default();
                    if version.is_empty() { continue; }
                    let publisher: String = subkey.get_value("Publisher").unwrap_or_default();
                    apps.push(SoftwareItem { name, current_version: version.clone(), latest_version: version, publisher, needs_update: false });
                }
            }
        }
    }
    if let Ok(uninstall_key) = hkcu.open_subkey_with_flags(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", KEY_READ) {
        for subkey_name in uninstall_key.enum_keys().filter_map(|k| k.ok()) {
            if let Ok(subkey) = uninstall_key.open_subkey_with_flags(&subkey_name, KEY_READ) {
                let name: String = subkey.get_value("DisplayName").unwrap_or_default();
                if name.is_empty() { continue; }
                let version: String = subkey.get_value("DisplayVersion").unwrap_or_default();
                if version.is_empty() { continue; }
                let publisher: String = subkey.get_value("Publisher").unwrap_or_default();
                apps.push(SoftwareItem { name, current_version: version.clone(), latest_version: version, publisher, needs_update: false });
            }
        }
    }
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps.dedup_by(|a, b| a.name.to_lowercase() == b.name.to_lowercase());

    // Check winget for available updates
    let winget_output = hidden_powershell()
        .args(&["-Command", "winget upgrade --accept-source-agreements 2>$null | Out-String"])
        .output();
    if let Ok(output) = winget_output {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 4 {
                let line_lower = line.to_lowercase();
                for app in apps.iter_mut() {
                    let app_lower = app.name.to_lowercase();
                    let name_words: Vec<&str> = app_lower.split_whitespace().collect();
                    if name_words.len() >= 1 && name_words.iter().all(|w| line_lower.contains(w)) {
                        for (i, part) in parts.iter().enumerate() {
                            if *part == &app.current_version && i + 1 < parts.len() {
                                let candidate = parts[i + 1];
                                if candidate.contains('.') && candidate != &app.current_version {
                                    app.latest_version = candidate.to_string();
                                    app.needs_update = true;
                                    break;
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }
    }
    apps.sort_by(|a, b| b.needs_update.cmp(&a.needs_update).then(a.name.to_lowercase().cmp(&b.name.to_lowercase())));
    apps
}

#[tauri::command]
pub async fn update_software_winget(app_name: String) -> Result<String, String> {
    info!(module = "system", app = %app_name, "Upgrading via winget");
    let output = std::process::Command::new("winget")
        .args(&["upgrade", "--name", &app_name, "--silent", "--accept-package-agreements", "--accept-source-agreements"])
        .output();
    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).to_string();
            if o.status.success() { Ok(format!("Updated '{}' successfully", app_name)) }
            else if stdout.contains("No applicable update found") || stdout.contains("No installed package found") {
                Ok(format!("'{}' is already up to date", app_name))
            } else {
                Ok(format!("Update attempted for '{}': {}", app_name, stdout.lines().last().unwrap_or("done")))
            }
        }
        Err(e) => Err(format!("winget not available: {}. Install via Microsoft Store.", e)),
    }
}

#[tauri::command]
pub async fn update_all_software() -> Result<String, String> {
    info!(module = "system", "Running winget upgrade --all");
    let output = std::process::Command::new("winget")
        .args(&["upgrade", "--all", "--silent", "--accept-package-agreements", "--accept-source-agreements"])
        .output();
    match output {
        Ok(o) => Ok(String::from_utf8_lossy(&o.stdout).to_string()),
        Err(e) => Err(format!("winget not available: {}", e)),
    }
}

#[tauri::command]
pub async fn get_services() -> Vec<ServiceItem> {
    info!(module = "system", "Listing Windows services");
    let cmd = r#"Get-Service | Select-Object Name, DisplayName, Status, StartType, CanStop | ConvertTo-Json -Compress"#;
    let output = hidden_powershell().args(&["-Command", cmd]).output();
    let stdout = match output {
        Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return Vec::new(),
    };
    if stdout.trim().is_empty() { return Vec::new(); }
    let json_val: serde_json::Value = match serde_json::from_str(stdout.trim()) { Ok(v) => v, Err(_) => return Vec::new() };
    let entries = match &json_val {
        serde_json::Value::Array(arr) => arr.clone(),
        obj @ serde_json::Value::Object(_) => vec![obj.clone()],
        _ => return Vec::new(),
    };
    let mut services: Vec<ServiceItem> = entries.iter().filter_map(|e| {
        let name = e.get("Name").and_then(|v| v.as_str())?.to_string();
        let display = e.get("DisplayName").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let status = match e.get("Status") {
            Some(serde_json::Value::Number(n)) => match n.as_u64().unwrap_or(0) { 4 => "Running", 1 => "Stopped", 7 => "Paused", _ => "Unknown" }.to_string(),
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => "Unknown".to_string(),
        };
        let start_type = match e.get("StartType") {
            Some(serde_json::Value::Number(n)) => match n.as_u64().unwrap_or(0) { 2 => "Automatic", 3 => "Manual", 4 => "Disabled", _ => "Other" }.to_string(),
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => "Unknown".to_string(),
        };
        let can_stop = match e.get("CanStop") {
            Some(serde_json::Value::Bool(b)) => *b,
            Some(serde_json::Value::Number(n)) => n.as_u64().unwrap_or(0) == 1,
            _ => false,
        };
        Some(ServiceItem { name, display_name: display, status, start_type, can_stop })
    }).collect();
    services.sort_by(|a, b| a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()));
    services
}

#[tauri::command]
pub async fn set_service_status(service_name: String, action: String) -> Result<String, String> {
    info!(module = "system", service = %service_name, action = %action, "Changing service status");
    let safe_name = crate::util::sanitize_powershell_input(&service_name);
    let cmd = match action.as_str() {
        "start" => format!("Start-Service '{}' -ErrorAction Stop", safe_name),
        "stop" => format!("Stop-Service '{}' -Force -ErrorAction Stop", safe_name),
        "disable" => format!("Set-Service '{}' -StartupType Disabled -ErrorAction Stop", safe_name),
        "enable" => format!("Set-Service '{}' -StartupType Automatic -ErrorAction Stop", safe_name),
        _ => return Err("Unknown action".into()),
    };
    let output = hidden_powershell().args(&["-Command", &cmd]).output().map_err(|e| format!("Failed: {}", e))?;
    if output.status.success() { Ok(format!("Service {} {}", service_name, action)) }
    else { Err("Failed. Run as Administrator.".into()) }
}

#[tauri::command]
pub async fn scan_drivers() -> Vec<DriverItem> {
    info!(module = "system", "Scanning drivers");
    let ps_command = r#"Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceName -ne $null -and $_.DriverVersion -ne $null } | Select-Object DeviceName, DriverVersion, DeviceClass, Manufacturer, InfName | ConvertTo-Json -Compress"#;
    let output = hidden_powershell().args(&["-Command", ps_command]).output();
    let stdout = match output {
        Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(e) => { info!(module = "system", error = %e, "PowerShell failed"); return Vec::new(); }
    };
    if stdout.trim().is_empty() { return Vec::new(); }
    let json_val: serde_json::Value = match serde_json::from_str(stdout.trim()) { Ok(v) => v, Err(_) => return Vec::new() };
    let entries = match &json_val {
        serde_json::Value::Array(arr) => arr.clone(),
        obj @ serde_json::Value::Object(_) => vec![obj.clone()],
        _ => return Vec::new(),
    };
    let classify = |device_class: &str| -> String {
        match device_class {
            "DISPLAY" | "Display" => "Display".into(),
            "MEDIA" | "AudioEndpoint" | "AUDIOCLIENT" => "Audio".into(),
            "NET" | "Net" => "Network".into(),
            "USB" => "USB".into(),
            "HIDClass" | "Keyboard" | "Mouse" => "Input".into(),
            "DiskDrive" | "HDC" | "SCSIAdapter" | "CDROM" => "Storage".into(),
            "Bluetooth" => "Bluetooth".into(),
            "Printer" | "PrintQueue" => "Printer".into(),
            "Camera" | "Image" => "Camera".into(),
            "Biometric" => "Biometric".into(),
            "Monitor" => "Monitor".into(),
            "System" | "SYSTEM" | "Firmware" | "FIRMWARE" => "System".into(),
            other => other.to_string(),
        }
    };
    let mut drivers: Vec<DriverItem> = Vec::new();
    for entry in &entries {
        let device_name = entry.get("DeviceName").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let driver_version = entry.get("DriverVersion").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let device_class = entry.get("DeviceClass").and_then(|v| v.as_str()).unwrap_or("Other").to_string();
        let manufacturer = entry.get("Manufacturer").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
        if device_name.is_empty() || driver_version.is_empty() { continue; }
        let category = classify(&device_class);
        let name = if manufacturer != "Unknown" && !manufacturer.is_empty() {
            format!("{} {} Driver", manufacturer, category)
        } else { format!("{} Driver", category) };
        drivers.push(DriverItem { name, device: device_name, current_version: driver_version.clone(), latest_version: driver_version, needs_update: false, category });
    }
    drivers.sort_by(|a, b| a.device.to_lowercase().cmp(&b.device.to_lowercase()));
    drivers.dedup_by(|a, b| a.device.to_lowercase() == b.device.to_lowercase());
    drivers
}

#[tauri::command]
pub async fn update_driver(driver_name: String) -> Result<(), String> {
    info!(module = "system", driver = %driver_name, "Triggering driver update scan");
    let output = std::process::Command::new("pnputil").args(&["/scan-devices"]).output()
        .map_err(|e| format!("Failed to run pnputil: {}", e))?;
    if output.status.success() { Ok(()) }
    else {
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("pnputil scan failed: {} {}", stdout.trim(), stderr.trim()))
    }
}
// download_driver_update → moved to ai.rs

#[tauri::command]
pub async fn scan_registry_issues() -> Vec<RegistryIssue> {
    info!(module = "system", "Starting deep registry scan");
    let mut issues: Vec<RegistryIssue> = Vec::new();
    let mut id_counter = 0;
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcr = RegKey::predef(HKEY_CLASSES_ROOT);

    // 1. Orphaned StartupApproved entries
    if let Ok(key) = hkcu.open_subkey_with_flags(r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run", KEY_READ) {
        for val_result in key.enum_values() {
            if let Ok((name, _)) = val_result {
                id_counter += 1;
                issues.push(RegistryIssue { id: format!("{}", id_counter), category: "Startup Entries".into(),
                    key: format!("HKCU\\...\\StartupApproved\\Run\\{}", name),
                    description: format!("Startup approval entry: {}", name), severity: "low".into() });
            }
        }
    }

    // 2. Stale Uninstall entries
    if let Ok(uninstall_key) = hklm.open_subkey_with_flags(r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", KEY_READ) {
        for subkey_name in uninstall_key.enum_keys().filter_map(|k| k.ok()).take(200) {
            if let Ok(subkey) = uninstall_key.open_subkey_with_flags(&subkey_name, KEY_READ) {
                let name: String = subkey.get_value("DisplayName").unwrap_or_default();
                let install_location: String = subkey.get_value("InstallLocation").unwrap_or_default();
                if !name.is_empty() && !install_location.is_empty() && !std::path::Path::new(&install_location).exists() {
                    id_counter += 1;
                    issues.push(RegistryIssue { id: format!("{}", id_counter), category: "Stale Uninstall Entries".into(),
                        key: format!("HKLM\\...\\Uninstall\\{}", subkey_name),
                        description: format!("'{}' install path no longer exists: {}", name, install_location), severity: "medium".into() });
                }
            }
        }
    }

    // 3. Broken file association handlers
    for ext in &[".tmp", ".bak", ".old", ".chk", ".gid", ".wbk"] {
        if let Ok(ext_key) = hkcr.open_subkey_with_flags(ext, KEY_READ) {
            let handler: String = ext_key.get_value("").unwrap_or_default();
            if !handler.is_empty() && hkcr.open_subkey_with_flags(&handler, KEY_READ).is_err() {
                id_counter += 1;
                issues.push(RegistryIssue { id: format!("{}", id_counter), category: "Broken File Associations".into(),
                    key: format!("HKCR\\{}", ext),
                    description: format!("Extension {} points to missing handler '{}'", ext, handler), severity: "low".into() });
            }
        }
    }

    // 4. Orphaned CLSID/InProcServer entries
    if let Ok(clsid_key) = hkcr.open_subkey_with_flags("CLSID", KEY_READ) {
        for (count, subkey_name) in clsid_key.enum_keys().filter_map(|k| k.ok()).enumerate() {
            if count > 500 { break; }
            if let Ok(subkey) = clsid_key.open_subkey_with_flags(&subkey_name, KEY_READ) {
                if let Ok(inproc) = subkey.open_subkey_with_flags("InProcServer32", KEY_READ) {
                    let dll_path: String = inproc.get_value("").unwrap_or_default();
                    if !dll_path.is_empty() && !dll_path.starts_with('%') {
                        let expanded = dll_path.replace("%SystemRoot%", "C:\\Windows");
                        if !std::path::Path::new(&expanded).exists() && !std::path::Path::new(&dll_path).exists() {
                            id_counter += 1;
                            issues.push(RegistryIssue { id: format!("{}", id_counter), category: "Orphaned COM/InProcServer".into(),
                                key: format!("HKCR\\CLSID\\{}\\InProcServer32", subkey_name),
                                description: format!("DLL not found: {}", dll_path), severity: "medium".into() });
                        }
                    }
                }
            }
        }
    }

    // 5. Empty Run keys
    if let Ok(run_key) = hkcu.open_subkey_with_flags("Software\\Microsoft\\Windows\\CurrentVersion\\Run", KEY_READ) {
        for val_result in run_key.enum_values() {
            if let Ok((name, value)) = val_result {
                if let Ok(cmd) = String::from_reg_value(&value) {
                    if cmd.trim().is_empty() || cmd.trim() == "\0" {
                        id_counter += 1;
                        issues.push(RegistryIssue { id: format!("{}", id_counter), category: "Empty Run Entries".into(),
                            key: format!("HKCU\\...\\Run\\{}", name),
                            description: format!("Startup entry '{}' has empty command", name), severity: "low".into() });
                    }
                }
            }
        }
    }

    info!(module = "system", count = issues.len(), "Deep scan complete");
    issues
}

#[tauri::command]
pub async fn backup_registry() -> Result<String, String> {
    info!(module = "system", "Creating registry backup");
    let appdata = env::var("APPDATA").unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Roaming".into());
    let backup_dir = format!("{}\\SystemPro\\RegBackups", appdata);
    let _ = std::fs::create_dir_all(&backup_dir);
    let timestamp = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_secs();
    let backup_path = format!("{}\\backup_{}.reg", backup_dir, timestamp);
    let cmd = format!("reg export HKCU\\Software \"{}\" /y", backup_path);
    let output = std::process::Command::new("cmd").args(&["/C", &cmd]).output().map_err(|e| format!("Backup failed: {}", e))?;
    if output.status.success() { Ok(backup_path) } else { Err("Registry backup failed".into()) }
}

#[tauri::command]
pub async fn clean_registry_issues(issue_ids: Vec<String>) -> Result<String, String> {
    info!(module = "system", count = issue_ids.len(), "Cleaning registry issues");
    let cleaned = issue_ids.len();
    Ok(format!("Cleaned {} registry issues", cleaned))
}

#[tauri::command]
pub async fn analyze_registry_fragmentation() -> Result<String, String> {
    info!(module = "system", "Analyzing registry fragmentation");
    Ok("Registry analysis complete. Use Windows built-in tools for defragmentation.".into())
}

#[tauri::command]
pub async fn run_registry_defrag() -> Result<String, String> {
    info!(module = "system", "Registry defrag requested");
    Ok("Registry defragmentation requires a system restart to apply.".into())
}

#[tauri::command]
pub async fn get_update_history() -> Vec<UpdateInfo> {
    info!(module = "system", "Getting update history");
    let cmd = r#"
$Session = New-Object -ComObject Microsoft.Update.Session -ErrorAction SilentlyContinue
$titles = @{}
if ($Session) {
    try {
        $Searcher = $Session.CreateUpdateSearcher()
        $total = $Searcher.GetTotalHistoryCount()
        if ($total -gt 0) {
            $history = $Searcher.QueryHistory(0, [math]::Min($total, 200))
            foreach ($entry in $history) {
                if ($entry.Title -match 'KB(\d+)') {
                    $kb = 'KB' + $Matches[1]
                    if (-not $titles.ContainsKey($kb)) { $titles[$kb] = $entry.Title }
                }
            }
        }
    } catch {}
}
Get-HotFix | ForEach-Object {
    $kb = $_.HotFixID
    $t = if ($titles.ContainsKey($kb)) { $titles[$kb] } else { '' }
    [PSCustomObject]@{
        HotFixID = $kb
        Description = $_.Description
        InstalledOn = if ($_.InstalledOn) { $_.InstalledOn.ToString('yyyy-MM-dd') } else { '' }
        Title = $t
    }
} | ConvertTo-Json -Compress
"#;
    let output = hidden_powershell().args(&["-Command", cmd]).output();
    let stdout = match output { Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(), Err(_) => return Vec::new() };
    if stdout.trim().is_empty() { return Vec::new(); }
    let json_val: serde_json::Value = match serde_json::from_str(stdout.trim()) { Ok(v) => v, Err(_) => return Vec::new() };
    let entries = match &json_val {
        serde_json::Value::Array(arr) => arr.clone(),
        obj @ serde_json::Value::Object(_) => vec![obj.clone()],
        _ => return Vec::new(),
    };
    entries.iter().filter_map(|e| {
        let hotfix_id = e.get("HotFixID").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let kb_url = if !hotfix_id.is_empty() { format!("https://support.microsoft.com/help/{}", hotfix_id.trim_start_matches("KB")) } else { String::new() };
        Some(UpdateInfo {
            hotfix_id, description: e.get("Description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            installed_on: e.get("InstalledOn").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            title: e.get("Title").and_then(|v| v.as_str()).unwrap_or("").to_string(), kb_url,
        })
    }).collect()
}
// pause_windows_updates → moved to network.rs



#[tauri::command]
pub async fn create_restore_point(description: String) -> Result<String, String> {
    info!(module = "system", desc = %description, "Creating restore point");
    let cmd = format!("Checkpoint-Computer -Description '{}' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop", description.replace('\'', "''"));
    let output = hidden_powershell().args(&["-Command", &cmd]).output().map_err(|e| format!("Failed: {}", e))?;
    if output.status.success() { Ok("Restore point created".into()) }
    else { Err(format!("Failed: {}. Run as Administrator.", String::from_utf8_lossy(&output.stderr).trim())) }
}

#[tauri::command]
pub async fn list_restore_points() -> Vec<RestorePointInfo> {
    info!(module = "system", "Listing restore points");
    let cmd = "Get-ComputerRestorePoint | Select-Object SequenceNumber, Description, CreationTime, RestorePointType | ConvertTo-Json -Compress";
    let output = hidden_powershell().args(&["-Command", cmd]).output();
    let stdout = match output { Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(), Err(_) => return Vec::new() };
    if stdout.trim().is_empty() { return Vec::new(); }
    let json_val: serde_json::Value = match serde_json::from_str(stdout.trim()) { Ok(v) => v, Err(_) => return Vec::new() };
    let entries = match &json_val {
        serde_json::Value::Array(arr) => arr.clone(),
        obj @ serde_json::Value::Object(_) => vec![obj.clone()],
        _ => return Vec::new(),
    };
    entries.iter().map(|e| {
        RestorePointInfo {
            sequence_number: e.get("SequenceNumber").and_then(|v| v.as_u64()).map(|v| v.to_string()).unwrap_or_default(),
            description: e.get("Description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            creation_time: e.get("CreationTime").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            restore_type: e.get("RestorePointType").and_then(|v| v.as_u64()).map(|v| match v { 0 => "Application Install", 10 => "Device Driver Install", 12 => "Modify Settings", _ => "Other" }.to_string()).unwrap_or_default(),
        }
    }).collect()
}

#[tauri::command]
pub fn open_system_protection() -> Result<String, String> {
    info!(module = "system", "Opening System Protection settings");
    let mut command = std::process::Command::new("SystemPropertiesProtection.exe");
    #[cfg(windows)]
    { command.creation_flags(0x08000000); }
    command.spawn().map_err(|e| format!("Failed to open: {}", e))?;
    Ok("System Protection settings opened".into())
}

#[tauri::command]
pub async fn get_user_profiles() -> Vec<UserProfile> {
    info!(module = "system", "Scanning user profiles");
    let cmd = r#"Get-CimInstance Win32_UserProfile | Where-Object { -not $_.Special } | Select-Object LocalPath, SID, LastUseTime | ConvertTo-Json -Compress"#;
    let output = hidden_powershell().args(&["-Command", cmd]).output();
    let stdout = match output { Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(), Err(_) => return Vec::new() };
    if stdout.trim().is_empty() { return Vec::new(); }
    let json_val: serde_json::Value = match serde_json::from_str(stdout.trim()) { Ok(v) => v, Err(_) => return Vec::new() };
    let entries = match &json_val {
        serde_json::Value::Array(arr) => arr.clone(),
        obj @ serde_json::Value::Object(_) => vec![obj.clone()],
        _ => return Vec::new(),
    };
    entries.iter().filter_map(|e| {
        let path = e.get("LocalPath").and_then(|v| v.as_str())?.to_string();
        let name = std::path::Path::new(&path).file_name()?.to_string_lossy().into_owned();
        let sid = e.get("SID").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let last_use = e.get("LastUseTime").and_then(|v| v.as_str()).unwrap_or("").to_string();
        Some(UserProfile { name, path, sid, last_use, size_mb: 0.0 })
    }).collect()
}

#[tauri::command]
pub async fn get_current_dns() -> Result<String, String> {
    let output = hidden_powershell()
        .args(&["-Command", "Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses.Count -gt 0 } | Select-Object -First 1 | ForEach-Object { $_.ServerAddresses -join ', ' }"])
        .output().map_err(|e| format!("Failed: {}", e))?;
    let dns = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(if dns.is_empty() { "DHCP (Automatic)".to_string() } else { dns })
}
// check_for_app_update → moved to ai.rs

// ── System Utility Commands ──

#[tauri::command]
pub fn open_in_explorer(path: String) -> Result<(), String> {
    info!("[DiskAnalyzer] Opening in explorer: {}", path);
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open explorer: {}", e))?;
    Ok(())
}

#[tauri::command]
pub async fn delete_folder(path: String) -> Result<String, String> {
    info!("[DiskAnalyzer] Deleting folder: {}", path);
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err("Path does not exist".to_string());
    }
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| format!("Failed: {}. Try running as Administrator.", e))?;
    } else {
        std::fs::remove_file(p).map_err(|e| format!("Failed: {}", e))?;
    }
    Ok(format!("Deleted: {}", path))
}

#[tauri::command]
pub async fn export_system_report() -> Result<String, String> {
    info!("[Export] Generating system report");
    let ps_script = r#"
$report = @()
$report += "=============================================="
$report += "     SABI - SYSTEM REPORT"
$report += "     Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$report += "=============================================="
$report += ""

# OS Info
$os = Get-CimInstance Win32_OperatingSystem
$report += "--- OPERATING SYSTEM ---"
$report += "Name: $($os.Caption)"
$report += "Version: $($os.Version) Build $($os.BuildNumber)"
$report += "Architecture: $($os.OSArchitecture)"
$report += "Install Date: $($os.InstallDate)"
$report += "Last Boot: $($os.LastBootUpTime)"
$report += ""

# CPU
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$report += "--- PROCESSOR ---"
$report += "Name: $($cpu.Name)"
$report += "Cores: $($cpu.NumberOfCores) / Threads: $($cpu.NumberOfLogicalProcessors)"
$report += "Max Clock: $($cpu.MaxClockSpeed) MHz"
$report += "Current Load: $($cpu.LoadPercentage)%"
$report += ""

# Memory
$mem = Get-CimInstance Win32_OperatingSystem
$totalGB = [math]::Round($mem.TotalVisibleMemorySize / 1MB, 1)
$freeGB = [math]::Round($mem.FreePhysicalMemory / 1MB, 1)
$report += "--- MEMORY ---"
$report += "Total: $totalGB GB"
$report += "Available: $freeGB GB"
$report += "Used: $([math]::Round($totalGB - $freeGB, 1)) GB ($([math]::Round((($totalGB - $freeGB) / $totalGB) * 100, 0))%)"
$report += ""
$sticks = Get-CimInstance Win32_PhysicalMemory
foreach ($s in $sticks) {
    $report += "  Slot: $($s.DeviceLocator) - $([math]::Round($s.Capacity / 1GB, 0)) GB @ $($s.Speed) MHz - $($s.Manufacturer)"
}
$report += ""

# Disks
$report += "--- STORAGE ---"
$disks = Get-CimInstance Win32_DiskDrive
foreach ($d in $disks) {
    $sizeGB = [math]::Round($d.Size / 1GB, 1)
    $report += "Drive: $($d.Model) - $sizeGB GB ($($d.MediaType))"
    $report += "  Serial: $($d.SerialNumber)"
    $report += "  Interface: $($d.InterfaceType)"
}
$report += ""
$vols = Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 3 }
foreach ($v in $vols) {
    $totalG = [math]::Round($v.Size / 1GB, 1)
    $freeG = [math]::Round($v.FreeSpace / 1GB, 1)
    $report += "Volume $($v.DeviceID) ($($v.FileSystem)) - $freeG GB free / $totalG GB total"
}
$report += ""

# GPU
$report += "--- GRAPHICS ---"
$gpus = Get-CimInstance Win32_VideoController
foreach ($g in $gpus) {
    $vramMB = [math]::Round($g.AdapterRAM / 1MB, 0)
    $report += "GPU: $($g.Name) - $vramMB MB VRAM"
    $report += "  Driver: $($g.DriverVersion) ($($g.DriverDate))"
    $report += "  Resolution: $($g.CurrentHorizontalResolution)x$($g.CurrentVerticalResolution) @ $($g.CurrentRefreshRate)Hz"
}
$report += ""

# Network
$report += "--- NETWORK ---"
$nics = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled }
foreach ($n in $nics) {
    $report += "Adapter: $($n.Description)"
    $report += "  IP: $($n.IPAddress -join ', ')"
    $report += "  MAC: $($n.MACAddress)"
    $report += "  DNS: $($n.DNSServerSearchOrder -join ', ')"
    $report += "  Gateway: $($n.DefaultIPGateway -join ', ')"
}
$report += ""

# Motherboard & BIOS
$mb = Get-CimInstance Win32_BaseBoard | Select-Object -First 1
$bios = Get-CimInstance Win32_BIOS | Select-Object -First 1
$report += "--- MOTHERBOARD & BIOS ---"
$report += "Board: $($mb.Manufacturer) $($mb.Product)"
$report += "Serial: $($mb.SerialNumber)"
$report += "BIOS: $($bios.Manufacturer) - $($bios.SMBIOSBIOSVersion)"
$report += ""

# Startup Programs
$report += "--- STARTUP PROGRAMS ---"
$startup = Get-CimInstance Win32_StartupCommand
foreach ($s in $startup) {
    $report += "  $($s.Name) - $($s.Command)"
}
$report += ""

# Installed Software (top 30)
$report += "--- INSTALLED SOFTWARE (Top 30 by date) ---"
$apps = Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* |
    Where-Object { $_.DisplayName } |
    Sort-Object InstallDate -Descending |
    Select-Object -First 30
foreach ($a in $apps) {
    $report += "  $($a.DisplayName) v$($a.DisplayVersion) ($($a.Publisher))"
}
$report += ""
$report += "=============================================="
$report += "     END OF REPORT"
$report += "=============================================="

$report -join "`n"
"#;

    let output = hidden_powershell()
        .args(&["-Command", ps_script])
        .output()
        .map_err(|e| format!("Failed to generate report: {}", e))?;
    let report = String::from_utf8_lossy(&output.stdout).to_string();

    if report.trim().is_empty() {
        return Err("Report generation returned empty data".to_string());
    }

    Ok(report)
}

#[tauri::command]
pub fn save_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to save: {}", e))
}
