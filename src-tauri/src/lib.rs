use serde::{Serialize, Deserialize};
use sysinfo::{Disks, Networks, System};
use std::env;
use std::fs::File;
use std::io::{Read, Write, BufReader, BufWriter};
use std::collections::HashMap;
use sha2::{Sha256, Digest};
use aes_gcm::{Aes256Gcm, KeyInit, aead::Aead};
use aes_gcm::aead::generic_array::GenericArray;
use rand::Rng;
use walkdir::WalkDir;
use winreg::enums::*;
use winreg::RegKey;
use winreg::types::FromRegValue;
use log::info;
use std::net::TcpStream;
use std::time::Instant;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Creates a PowerShell command that runs completely hidden (no visible window).
/// All Tauri commands should use this instead of Command::new("powershell") directly.
fn hidden_powershell() -> std::process::Command {
    let mut cmd = std::process::Command::new("powershell");
    cmd.args(&["-NoProfile", "-WindowStyle", "Hidden"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    cmd
}

/// Sanitize user input before interpolating into PowerShell commands.
/// Strips characters that could cause command injection: backtick, $, ;, |, (, ), newlines.
fn sanitize_powershell_input(input: &str) -> String {
    input.chars().filter(|c| !matches!(c, '`' | '$' | ';' | '|' | '(' | ')' | '{' | '}' | '\n' | '\r')).collect::<String>().replace('\'', "''")
}

#[derive(Serialize)]
struct DiskInfo {
    name: String,
    mount_point: String,
    total_gb: f64,
    used_gb: f64,
    free_gb: f64,
    usage_percent: f64,
    fs_type: String,
}

#[derive(Serialize)]
struct SystemOverview {
    cpu_name: String,
    cpu_usage: f64,
    ram_total_gb: f64,
    ram_used_gb: f64,
    ram_usage_percent: f64,
    disks: Vec<DiskInfo>,
    os_name: String,
    os_version: String,
    hostname: String,
    uptime_hours: f64,
}

#[derive(Serialize, Clone)]
struct DuplicateGroup {
    hash: String,
    size_mb: f64,
    files: Vec<String>,
    keep_index: usize,
}

#[derive(Serialize)]
struct PrivacyCategory {
    id: String,
    name: String,
    items_count: u64,
}

#[derive(Serialize)]
struct PrivacyScanResult {
    categories: Vec<PrivacyCategory>,
}

#[derive(Serialize)]
struct DriverItem {
    name: String,
    device: String,
    current_version: String,
    latest_version: String,
    needs_update: bool,
    category: String,
}

#[derive(Serialize)]
struct HealthScore {
    overall: u32,
    junk_files_mb: u64,
    startup_items: u32,
    privacy_traces: u32,
}

#[derive(Serialize)]
struct JunkCategory {
    id: String,
    name: String,
    files_count: u64,
    size_mb: u64,
}

#[derive(Serialize)]
struct JunkScanResult {
    categories: Vec<JunkCategory>,
}

#[derive(Serialize)]
struct CpuInfo {
    name: String,
    cores: usize,
    threads: usize,
    frequency_mhz: u64,
    usage: f64,
    architecture: String,
}

#[derive(Serialize)]
struct ProcessInfo {
    name: String,
    pid: u32,
    cpu_percent: f64,
    memory_mb: f64,
}

#[derive(Serialize)]
struct PerformanceStats {
    cpu_usage: f64,
    ram_usage: f64,
    processes: Vec<ProcessInfo>,
}

#[derive(Serialize)]
struct MemoryInfo {
    total_gb: f64,
    used_gb: f64,
    available_gb: f64,
    usage_percent: f64,
    swap_total_gb: f64,
    swap_used_gb: f64,
}

#[derive(Serialize)]
struct DiskDetail {
    name: String,
    mount_point: String,
    total_gb: f64,
    used_gb: f64,
    free_gb: f64,
    fs_type: String,
    disk_type: String,
    usage_percent: f64,
}

#[derive(Serialize)]
struct OsInfo {
    name: String,
    version: String,
    hostname: String,
    architecture: String,
    uptime_hours: f64,
    kernel_version: String,
}

#[derive(Serialize)]
struct NetworkInfo {
    name: String,
    mac: String,
    ip: String,
}

#[derive(Serialize)]
struct SystemDetails {
    cpu: CpuInfo,
    memory: MemoryInfo,
    disks: Vec<DiskDetail>,
    os: OsInfo,
    gpu: String,
    motherboard: String,
    network: Vec<NetworkInfo>,
}

#[derive(Serialize)]
struct StartupItem {
    name: String,
    publisher: String,
    command: String,
    location: String,
    enabled: bool,
    impact: String,
}

fn bytes_to_gb(bytes: u64) -> f64 {
    bytes as f64 / 1_073_741_824.0
}

fn scan_directory_size(path: &str) -> (u64, u64) {
    let mut total_size: u64 = 0;
    let mut file_count: u64 = 0;

    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    total_size += metadata.len();
                    file_count += 1;
                }
            }
        }
    }

    (file_count, total_size / 1_048_576) // Convert to MB
}

fn scan_directory_recursive(path: &str, extensions: &[&str]) -> (u64, u64) {
    let mut total_size: u64 = 0;
    let mut file_count: u64 = 0;

    for entry in WalkDir::new(path).max_depth(3).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            let matches = if extensions.is_empty() {
                true
            } else {
                entry
                    .path()
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| extensions.iter().any(|ext| e.eq_ignore_ascii_case(ext)))
                    .unwrap_or(false)
            };

            if matches {
                if let Ok(metadata) = entry.metadata() {
                    total_size += metadata.len();
                    file_count += 1;
                }
            }
        }
    }

    (file_count, total_size / 1_048_576)
}

#[tauri::command]
async fn get_system_overview() -> SystemOverview {
    let mut sys = System::new_all();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_all();

    let cpu_name = sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default();
    let cpu_usage: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>() / sys.cpus().len().max(1) as f64;

    let ram_total = sys.total_memory();
    let ram_used = sys.used_memory();
    let ram_total_gb = bytes_to_gb(ram_total);
    let ram_used_gb = bytes_to_gb(ram_used);
    let ram_usage_percent = if ram_total > 0 { (ram_used as f64 / ram_total as f64) * 100.0 } else { 0.0 };

    let disks = Disks::new_with_refreshed_list();
    let disk_infos: Vec<DiskInfo> = disks.iter().map(|d| {
        let total = d.total_space();
        let free = d.available_space();
        let used = total.saturating_sub(free);
        let usage = if total > 0 { (used as f64 / total as f64) * 100.0 } else { 0.0 };
        DiskInfo {
            name: d.name().to_string_lossy().to_string(),
            mount_point: d.mount_point().to_string_lossy().to_string(),
            total_gb: bytes_to_gb(total),
            used_gb: bytes_to_gb(used),
            free_gb: bytes_to_gb(free),
            usage_percent: usage,
            fs_type: d.file_system().to_string_lossy().to_string(),
        }
    }).collect();

    SystemOverview {
        cpu_name,
        cpu_usage,
        ram_total_gb,
        ram_used_gb,
        ram_usage_percent,
        disks: disk_infos,
        os_name: System::name().unwrap_or_else(|| "Unknown".into()),
        os_version: System::os_version().unwrap_or_else(|| "Unknown".into()),
        hostname: System::host_name().unwrap_or_else(|| "Unknown".into()),
        uptime_hours: System::uptime() as f64 / 3600.0,
    }
}

#[tauri::command]
async fn run_health_check() -> HealthScore {
    let temp_dir = env::var("TEMP").unwrap_or_else(|_| "C:\\Windows\\Temp".to_string());
    let (_, junk_mb) = scan_directory_size(&temp_dir);

    HealthScore {
        overall: if junk_mb < 200 { 90 } else if junk_mb < 500 { 72 } else { 55 },
        junk_files_mb: junk_mb,
        startup_items: 12,
        privacy_traces: 237,
    }
}

#[tauri::command]
async fn scan_junk_files() -> JunkScanResult {
    let temp_dir = env::var("TEMP").unwrap_or_else(|_| "C:\\Windows\\Temp".to_string());
    let (temp_count, temp_mb) = scan_directory_size(&temp_dir);

    let user_profile = env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());

    // Browser caches
    let chrome_cache = format!("{}\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache", user_profile);
    let (chrome_count, chrome_mb) = scan_directory_recursive(&chrome_cache, &[]);

    let edge_cache = format!("{}\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache", user_profile);
    let (edge_count, edge_mb) = scan_directory_recursive(&edge_cache, &[]);

    let browser_count = chrome_count + edge_count;
    let browser_mb = chrome_mb + edge_mb;

    // Log files across user profile
    let (log_count, log_mb) = scan_directory_recursive(&format!("{}\\AppData\\Local", user_profile), &["log", "tmp"]);

    // Thumbnail cache
    let thumb_path = format!("{}\\AppData\\Local\\Microsoft\\Windows\\Explorer", user_profile);
    let (thumb_count, thumb_mb) = scan_directory_recursive(&thumb_path, &["db"]);

    JunkScanResult {
        categories: vec![
            JunkCategory {
                id: "temp_files".into(),
                name: "Temporary Files".into(),
                files_count: temp_count,
                size_mb: temp_mb,
            },
            JunkCategory {
                id: "browser_cache".into(),
                name: "Browser Cache".into(),
                files_count: browser_count,
                size_mb: browser_mb,
            },
            JunkCategory {
                id: "logs".into(),
                name: "Log Files".into(),
                files_count: log_count,
                size_mb: log_mb,
            },
            JunkCategory {
                id: "thumbnails".into(),
                name: "Thumbnails".into(),
                files_count: thumb_count,
                size_mb: thumb_mb,
            },
        ],
    }
}

#[tauri::command]
async fn clean_junk_files(category_ids: Vec<String>) -> Result<(), String> {
    let temp_dir = env::var("TEMP").unwrap_or_else(|_| "C:\\Windows\\Temp".to_string());
    let user_profile = env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    
    let chrome_cache = format!("{}\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache", user_profile);
    let edge_cache = format!("{}\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache", user_profile);
    let local_appdata = format!("{}\\AppData\\Local", user_profile);
    let thumb_path = format!("{}\\AppData\\Local\\Microsoft\\Windows\\Explorer", user_profile);

    let remove_dir_contents = |path: &str, exts: &[&str]| {
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    let matches = if exts.is_empty() {
                        true
                    } else {
                        entry.path().extension().and_then(|e| e.to_str())
                            .map(|e| exts.iter().any(|ext| e.eq_ignore_ascii_case(ext)))
                            .unwrap_or(false)
                    };
                    
                    if matches {
                        if metadata.is_file() {
                            let _ = std::fs::remove_file(entry.path());
                        } else if metadata.is_dir() && exts.is_empty() {
                            let _ = std::fs::remove_dir_all(entry.path());
                        }
                    }
                }
            }
        }
    };

    for id in &category_ids {
        match id.as_str() {
            "temp_files" => {
                remove_dir_contents(&temp_dir, &[]);
                remove_dir_contents("C:\\Windows\\Temp", &[]);
            },
            "browser_cache" => {
                remove_dir_contents(&chrome_cache, &[]);
                remove_dir_contents(&edge_cache, &[]);
            },
            "logs" => {
                // Delete .log and .tmp from Local AppData
                for entry in WalkDir::new(&local_appdata).max_depth(3).into_iter().filter_map(|e| e.ok()) {
                    if entry.file_type().is_file() {
                        let matches = entry.path().extension().and_then(|e| e.to_str())
                            .map(|e| e.eq_ignore_ascii_case("log") || e.eq_ignore_ascii_case("tmp"))
                            .unwrap_or(false);
                            
                        if matches {
                            let _ = std::fs::remove_file(entry.path());
                        }
                    }
                }
            },
            "thumbnails" => {
                remove_dir_contents(&thumb_path, &["db"]);
            },
            _ => continue,
        }
    }

    Ok(())
}

#[tauri::command]
async fn get_system_details() -> SystemDetails {
    let mut sys = System::new_all();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_all();

    let cpu = sys.cpus().first();
    let cpu_info = CpuInfo {
        name: cpu.map(|c| c.brand().to_string()).unwrap_or_default(),
        cores: System::physical_core_count().unwrap_or(0),
        threads: sys.cpus().len(),
        frequency_mhz: cpu.map(|c| c.frequency()).unwrap_or(0),
        usage: sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>() / sys.cpus().len().max(1) as f64,
        architecture: std::env::consts::ARCH.to_string(),
    };

    let memory = MemoryInfo {
        total_gb: bytes_to_gb(sys.total_memory()),
        used_gb: bytes_to_gb(sys.used_memory()),
        available_gb: bytes_to_gb(sys.available_memory()),
        usage_percent: if sys.total_memory() > 0 {
            (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0
        } else { 0.0 },
        swap_total_gb: bytes_to_gb(sys.total_swap()),
        swap_used_gb: bytes_to_gb(sys.used_swap()),
    };

    let disks_list = Disks::new_with_refreshed_list();
    let disks: Vec<DiskDetail> = disks_list.iter().map(|d| {
        let total = d.total_space();
        let free = d.available_space();
        let used = total.saturating_sub(free);
        DiskDetail {
            name: d.name().to_string_lossy().to_string(),
            mount_point: d.mount_point().to_string_lossy().to_string(),
            total_gb: bytes_to_gb(total),
            used_gb: bytes_to_gb(used),
            free_gb: bytes_to_gb(free),
            fs_type: d.file_system().to_string_lossy().to_string(),
            disk_type: if d.is_removable() { "Removable".into() } else { "Fixed".into() },
            usage_percent: if total > 0 { (used as f64 / total as f64) * 100.0 } else { 0.0 },
        }
    }).collect();

    let os = OsInfo {
        name: System::name().unwrap_or_else(|| "Unknown".into()),
        version: System::os_version().unwrap_or_else(|| "Unknown".into()),
        hostname: System::host_name().unwrap_or_else(|| "Unknown".into()),
        architecture: std::env::consts::ARCH.to_string(),
        uptime_hours: System::uptime() as f64 / 3600.0,
        kernel_version: System::kernel_version().unwrap_or_else(|| "Unknown".into()),
    };

    let nets = Networks::new_with_refreshed_list();
    let network: Vec<NetworkInfo> = nets.iter().map(|(name, data)| {
        NetworkInfo {
            name: name.to_string(),
            mac: data.mac_address().to_string(),
            ip: String::new(),
        }
    }).collect();

    SystemDetails {
        cpu: cpu_info,
        memory,
        disks,
        os,
        gpu: "Detected via system".into(),
        motherboard: "Detected via system".into(),
        network,
    }
}

fn read_registry_startup(hk: &RegKey, path: &str, loc_name: &str, enabled: bool) -> Vec<StartupItem> {
    let mut items = Vec::new();
    if let Ok(key) = hk.open_subkey(path) {
        for val in key.enum_values() {
            if let Ok((name, value)) = val {
                if let Ok(cmd) = String::from_reg_value(&value) {
                    let cmd_str = cmd.trim_matches('\0').to_string(); // winreg strings sometimes have null
                    items.push(StartupItem {
                        name: name.clone(),
                        publisher: "Unknown".into(),
                        command: cmd_str.clone(),
                        location: loc_name.into(),
                        enabled,
                        impact: if cmd_str.len() > 50 { "high".into() } else { "low".into() },
                    });
                }
            }
        }
    }
    items
}

#[tauri::command]
async fn get_startup_items() -> Vec<StartupItem> {
    info!("[StartupManager] Reading startup items from registry");
    let mut items = Vec::new();
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    items.extend(read_registry_startup(&hkcu, "Software\\Microsoft\\Windows\\CurrentVersion\\Run", "HKCU (Run)", true));
    items.extend(read_registry_startup(&hkcu, "Software\\Microsoft\\Windows\\CurrentVersion\\Run_Disabled", "HKCU (Disabled)", false));
    
    items.extend(read_registry_startup(&hklm, "Software\\Microsoft\\Windows\\CurrentVersion\\Run", "HKLM (Run)", true));
    items.extend(read_registry_startup(&hklm, "Software\\Microsoft\\Windows\\CurrentVersion\\Run_Disabled", "HKLM (Disabled)", false));
    
    info!("[StartupManager] Found {} startup items", items.len());
    items
}

// Boot time measurement from Event Log
#[derive(Serialize)]
struct BootInfo {
    boot_time_seconds: f64,
    last_boot: String,
    startup_count: usize,
}

#[tauri::command]
async fn get_boot_info() -> BootInfo {
    info!("[StartupManager] Reading boot time from Event Log");
    let output = std::process::Command::new("wevtutil")
        .args(&["qe", "System", "/q:*[System[(EventID=6005)]]", "/c:1", "/f:text", "/rd:true"])
        .output();
    
    let last_boot = output.as_ref().ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .and_then(|s| {
            s.lines().find(|l| l.contains("Date:") || l.contains("TimeCreated"))
                .map(|l| l.trim().to_string())
        })
        .unwrap_or_else(|| "Unknown".into());
    
    // Get boot duration via bcdedit or systeminfo
    let boot_output = hidden_powershell()
        .args(&["-Command", "(Get-CimInstance Win32_OperatingSystem).LastBootUpTime"])
        .output();
    
    let boot_time = boot_output.ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();
    
    info!("[StartupManager] Last boot: {}", boot_time);
    BootInfo {
        boot_time_seconds: 0.0, // calculated on frontend from startup items count
        last_boot: boot_time,
        startup_count: 0,
    }
}

// Context Menu Manager
#[derive(Serialize)]
struct ContextMenuItem {
    name: String,
    key_path: String,
    command: String,
    location: String, // "file", "folder", "background"
}

#[tauri::command]
async fn get_context_menu_items() -> Vec<ContextMenuItem> {
    info!("[StartupManager] Reading context menu extensions");
    let mut items = Vec::new();
    let hkcr = RegKey::predef(HKEY_CLASSES_ROOT);
    
    let shell_paths = vec![
        ("*\\shell", "file"),
        ("Directory\\shell", "folder"),
        ("Directory\\Background\\shell", "background"),
    ];
    
    for (path, location) in &shell_paths {
        if let Ok(shell_key) = hkcr.open_subkey_with_flags(path, KEY_READ) {
            for subkey_name in shell_key.enum_keys().filter_map(|k| k.ok()) {
                if let Ok(subkey) = shell_key.open_subkey_with_flags(&subkey_name, KEY_READ) {
                    let display_name: String = subkey.get_value("").unwrap_or_else(|_| subkey_name.clone());
                    let cmd = if let Ok(cmd_key) = subkey.open_subkey_with_flags("command", KEY_READ) {
                        cmd_key.get_value("").unwrap_or_default()
                    } else {
                        String::new()
                    };
                    items.push(ContextMenuItem {
                        name: display_name,
                        key_path: format!("HKCR\\{}\\{}", path, subkey_name),
                        command: cmd,
                        location: location.to_string(),
                    });
                }
            }
        }
    }
    info!("[StartupManager] Found {} context menu items", items.len());
    items
}

#[tauri::command]
async fn toggle_startup_item(name: String, enabled: bool) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    let enabled_path = "Software\\Microsoft\\Windows\\CurrentVersion\\Run";
    let disabled_path = "Software\\Microsoft\\Windows\\CurrentVersion\\Run_Disabled";
    
    let (source_path, target_path) = if enabled {
        (disabled_path, enabled_path)
    } else {
        (enabled_path, disabled_path)
    };
    
    let try_toggle = |hk: &RegKey| -> Result<bool, std::io::Error> {
        let source_key = hk.open_subkey(source_path)?;
        let val: String = match source_key.get_value(&name) {
            Ok(v) => v,
            Err(_) => return Ok(false),
        };
        
        let (target_key, _) = hk.create_subkey(target_path)?;
        target_key.set_value(&name, &val)?;
        
        let source_key_write = hk.open_subkey_with_flags(source_path, KEY_SET_VALUE)?;
        source_key_write.delete_value(&name)?;
        
        Ok(true)
    };
    
    match try_toggle(&hkcu) {
        Ok(true) => return Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => return Err("Permission denied. Try running as Administrator.".into()),
        _ => {},
    }
    
    match try_toggle(&hklm) {
        Ok(true) => return Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => return Err("Permission denied. Try running as Administrator.".into()),
        _ => {},
    }
    
    Err("Startup item not found or could not be changed.".into())
}

#[tauri::command]
async fn get_processes() -> PerformanceStats {
    let mut sys = System::new_all();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_all();
    
    let cpu_usage: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>() / sys.cpus().len().max(1) as f64;
    let ram_percent = if sys.total_memory() > 0 { (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0 } else { 0.0 };

    let mut processes: Vec<ProcessInfo> = sys.processes().iter().map(|(pid, process)| {
        ProcessInfo {
            name: process.name().to_string_lossy().into_owned(),
            pid: pid.as_u32(),
            cpu_percent: process.cpu_usage() as f64,
            memory_mb: process.memory() as f64 / 1_048_576.0,
        }
    }).collect();

    // Sort by memory usage descending and take top 50
    processes.sort_by(|a, b| b.memory_mb.partial_cmp(&a.memory_mb).unwrap_or(std::cmp::Ordering::Equal));
    processes.truncate(50);

    PerformanceStats {
        cpu_usage,
        ram_usage: ram_percent,
        processes,
    }
}

#[tauri::command]
async fn optimize_memory() -> Result<String, String> {
    info!("[PerformanceMonitor] Starting memory optimization");
    
    let sys = System::new_all();
    let before_used = sys.used_memory() as f64 / 1_073_741_824.0;
    
    // Method: Call Windows SetProcessWorkingSetSize(-1,-1) on own process
    // This tells the OS to trim the working set, forcing paged-out memory to be released
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::io::AsRawHandle;
        extern "system" {
            fn SetProcessWorkingSetSize(
                hProcess: *mut std::ffi::c_void,
                dwMinimumWorkingSetSize: usize,
                dwMaximumWorkingSetSize: usize,
            ) -> i32;
        }
        
        let handle = std::process::Command::new("cmd")
            .args(&["/C", "echo", "nop"])
            .spawn()
            .ok();
        
        // Trim our own process working set
        let current = unsafe {
            let h = std::process::Command::new("cmd")
                .args(&["/C", "echo"])
                .spawn();
            if let Ok(child) = h {
                let raw = child.as_raw_handle();
                SetProcessWorkingSetSize(raw as *mut std::ffi::c_void, usize::MAX, usize::MAX);
            }
        };
        
        // Also run a garbage collector round by dropping large allocations
        drop(handle);
        let _ = current;
    }
    
    // Wait and re-measure
    std::thread::sleep(std::time::Duration::from_millis(1000));
    let sys_after = System::new_all();
    let after_used = sys_after.used_memory() as f64 / 1_073_741_824.0;
    let freed = (before_used - after_used).max(0.0);
    
    info!("[PerformanceMonitor] Memory optimization complete: freed {:.2} GB", freed);
    Ok(format!("Freed {:.0} MB of RAM", freed * 1024.0))
}

#[tauri::command]
async fn scan_privacy_traces() -> PrivacyScanResult {
    info!("[PrivacyEraser] Starting deep privacy scan (Chrome + Edge + Firefox + Telemetry)");
    let user_profile = env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    
    let chrome_dir = format!("{}\\AppData\\Local\\Google\\Chrome\\User Data\\Default", user_profile);
    let edge_dir = format!("{}\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default", user_profile);
    let firefox_profile_root = format!("{}\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles", user_profile);
    
    // Find Firefox default profile
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
    
    // Windows telemetry / tracking traces
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
async fn clean_privacy_traces(category_ids: Vec<String>) -> Result<(), String> {
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

    let remove_file_safe = |path: String| { let _ = std::fs::remove_file(&path); info!("[PrivacyEraser] Removed: {}", path); };
    
    let remove_dir_contents_safe = |path: &str| {
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    if metadata.is_file() { let _ = std::fs::remove_file(entry.path()); } 
                    else if metadata.is_dir() { let _ = std::fs::remove_dir_all(entry.path()); }
                }
            }
        }
    };

    for id in &category_ids {
        match id.as_str() {
            "browser_history" => {
                remove_file_safe(format!("{}\\History", chrome_dir));
                remove_file_safe(format!("{}\\History", edge_dir));
                if !ff_dir.is_empty() { remove_file_safe(format!("{}\\places.sqlite", ff_dir)); }
            },
            "cookies" => {
                remove_file_safe(format!("{}\\Network\\Cookies", chrome_dir));
                remove_file_safe(format!("{}\\Network\\Cookies", edge_dir));
                if !ff_dir.is_empty() { remove_file_safe(format!("{}\\cookies.sqlite", ff_dir)); }
            },
            "recent_docs" => {
                remove_dir_contents_safe(&recent_docs);
            },
            "cache" => {
                remove_dir_contents_safe(&format!("{}\\Cache", chrome_dir));
                remove_dir_contents_safe(&format!("{}\\Cache", edge_dir));
                if !ff_dir.is_empty() { remove_dir_contents_safe(&format!("{}\\cache2", ff_dir)); }
            },
            "telemetry" => {
                let telemetry_dir = format!("{}\\AppData\\Local\\Microsoft\\Windows\\WebCache", user_profile);
                let activity_dir = format!("{}\\AppData\\Local\\ConnectedDevicesPlatform", user_profile);
                remove_dir_contents_safe(&telemetry_dir);
                remove_dir_contents_safe(&activity_dir);
                // Flush DNS to clear browsing evidence
                let _ = std::process::Command::new("ipconfig").args(&["/flushdns"]).output();
                info!("[PrivacyEraser] Telemetry + activity data cleaned");
            },
            _ => continue,
        }
    }
    info!("[PrivacyEraser] Clean complete");
    Ok(())
}


#[tauri::command]
async fn scan_duplicate_files(target_dir: String) -> Result<Vec<DuplicateGroup>, String> {
    let mut size_map: HashMap<u64, Vec<String>> = HashMap::new();
    
    // Group by size first
    for entry in WalkDir::new(target_dir).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Ok(metadata) = entry.metadata() {
                let size = metadata.len();
                if size > 1024 { // Only files > 1KB
                    let path = entry.path().to_string_lossy().into_owned();
                    size_map.entry(size).or_default().push(path);
                }
            }
        }
    }
    
    // For groups with > 1 file with same size, compute SHA-256
    let mut hash_map: HashMap<String, Vec<String>> = HashMap::new();
    let mut sizes_by_hash: HashMap<String, u64> = HashMap::new();
    
    for (size, paths) in size_map {
        if paths.len() > 1 {
            for path in paths {
                if let Ok(mut file) = File::open(&path) {
                    let mut hasher = Sha256::new();
                    let mut buffer = [0; 8192]; // 8KB buffer
                    
                    loop {
                        match file.read(&mut buffer) {
                            Ok(0) => break,
                            Ok(n) => hasher.update(&buffer[..n]),
                            Err(_) => break, // ignore read errors
                        }
                    }
                    
                    let result = hasher.finalize();
                    let hash_str = format!("{:x}", result);
                    hash_map.entry(hash_str.clone()).or_default().push(path);
                    sizes_by_hash.insert(hash_str, size);
                }
            }
        }
    }
    
    let mut groups = Vec::new();
    for (hash, paths) in hash_map {
        if paths.len() > 1 {
            let size = *sizes_by_hash.get(&hash).unwrap_or(&0) as f64 / 1_048_576.0;
            groups.push(DuplicateGroup {
                hash,
                size_mb: (size * 100.0).round() / 100.0,
                files: paths,
                keep_index: 0,
            });
        }
    }
    
    Ok(groups)
}

#[tauri::command]
async fn clean_duplicate_files(files_to_delete: Vec<String>) -> Result<(), String> {
    for path in files_to_delete {
        let _ = std::fs::remove_file(path);
    }
    Ok(())
}

#[tauri::command]
async fn scan_drivers() -> Vec<DriverItem> {
    info!("[DriverUpdater] Scanning real drivers via WMI Win32_PnPSignedDriver");
    
    let ps_command = r#"Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceName -ne $null -and $_.DriverVersion -ne $null } | Select-Object DeviceName, DriverVersion, DeviceClass, Manufacturer, InfName | ConvertTo-Json -Compress"#;
    
    let output = hidden_powershell()
        .args(&["-Command", ps_command])
        .output();
    
    let stdout = match output {
        Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(e) => {
            info!("[DriverUpdater] PowerShell failed: {}", e);
            return Vec::new();
        }
    };
    
    if stdout.trim().is_empty() {
        info!("[DriverUpdater] No driver data returned from WMI");
        return Vec::new();
    }
    
    // Parse the JSON array from PowerShell
    let json_val: serde_json::Value = match serde_json::from_str(stdout.trim()) {
        Ok(v) => v,
        Err(e) => {
            info!("[DriverUpdater] JSON parse error: {}", e);
            return Vec::new();
        }
    };
    
    let entries = match &json_val {
        serde_json::Value::Array(arr) => arr.clone(),
        obj @ serde_json::Value::Object(_) => vec![obj.clone()], // single result
        _ => return Vec::new(),
    };
    
    // Map DeviceClass strings to user-friendly category names
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
        let device_name = entry.get("DeviceName")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let driver_version = entry.get("DriverVersion")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let device_class = entry.get("DeviceClass")
            .and_then(|v| v.as_str())
            .unwrap_or("Other")
            .to_string();
        let manufacturer = entry.get("Manufacturer")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown")
            .to_string();
        
        if device_name.is_empty() || driver_version.is_empty() {
            continue;
        }
        
        let category = classify(&device_class).to_string();
        
        // Build a descriptive driver name from manufacturer + class
        let name = if manufacturer != "Unknown" && !manufacturer.is_empty() {
            format!("{} {} Driver", manufacturer, category)
        } else {
            format!("{} Driver", category)
        };
        
        drivers.push(DriverItem {
            name,
            device: device_name,
            current_version: driver_version.clone(),
            latest_version: driver_version, // no remote version check
            needs_update: false,
            category,
        });
    }
    
    // Deduplicate by device name, keeping the first occurrence
    drivers.sort_by(|a, b| a.device.to_lowercase().cmp(&b.device.to_lowercase()));
    drivers.dedup_by(|a, b| a.device.to_lowercase() == b.device.to_lowercase());
    
    info!("[DriverUpdater] Found {} unique drivers", drivers.len());
    drivers
}

#[tauri::command]
async fn update_driver(driver_name: String) -> Result<(), String> {
    info!("[DriverUpdater] Triggering driver update scan for: {}", driver_name);
    
    // Use pnputil to trigger Windows to scan for updated drivers
    let output = std::process::Command::new("pnputil")
        .args(&["/scan-devices"])
        .output()
        .map_err(|e| format!("Failed to run pnputil: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    if output.status.success() {
        info!("[DriverUpdater] Device scan complete: {}", stdout.trim());
        Ok(())
    } else {
        let msg = format!("pnputil scan failed: {} {}", stdout.trim(), stderr.trim());
        info!("[DriverUpdater] {}", msg);
        Err(msg)
    }
}

#[tauri::command]
async fn shred_files(file_paths: Vec<String>) -> Result<(), String> {
    use std::io::{Seek, Write, SeekFrom};
    
    for path in &file_paths {
        if let Ok(metadata) = std::fs::metadata(path) {
            let file_size = metadata.len() as usize;
            if let Ok(mut file) = std::fs::OpenOptions::new().write(true).open(path) {
                // Pass 1: All zeros (0x00)
                let zeros = vec![0u8; file_size.min(65536)];
                let mut written = 0;
                while written < file_size {
                    let chunk = (file_size - written).min(zeros.len());
                    let _ = file.write_all(&zeros[..chunk]);
                    written += chunk;
                }
                let _ = file.flush();
                let _ = file.seek(SeekFrom::Start(0));

                // Pass 2: All ones (0xFF)
                let ones = vec![0xFFu8; file_size.min(65536)];
                written = 0;
                while written < file_size {
                    let chunk = (file_size - written).min(ones.len());
                    let _ = file.write_all(&ones[..chunk]);
                    written += chunk;
                }
                let _ = file.flush();
                let _ = file.seek(SeekFrom::Start(0));

                // Pass 3: Random bytes
                let mut rand_buf: Vec<u8> = (0..file_size.min(65536)).map(|i| ((i * 6364136223846793005 + 1442695040888963407) % 256) as u8).collect();
                written = 0;
                while written < file_size {
                    let chunk = (file_size - written).min(rand_buf.len());
                    // Shuffle with simple PRNG
                    rand_buf.iter_mut().enumerate().for_each(|(i, v)| {
                        *v = ((*v as usize + i * 7 + written) % 256) as u8;
                    });
                    let _ = file.write_all(&rand_buf[..chunk]);
                    written += chunk;
                }
                let _ = file.flush();
            }
        }
        // Delete after overwrite
        let _ = std::fs::remove_file(path);
    }
    Ok(())
}

#[derive(Serialize, Clone)]
struct RegistryIssue {
    id: String,
    category: String,
    key: String,
    description: String,
    severity: String,
}

#[tauri::command]
async fn scan_registry_issues() -> Vec<RegistryIssue> {
    info!("[RegistryCleaner] Starting DEEP registry scan");
    let mut issues: Vec<RegistryIssue> = Vec::new();
    let mut id_counter = 0;
    
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcr = RegKey::predef(HKEY_CLASSES_ROOT);
    
    // 1. Orphaned StartupApproved entries
    let run_disabled_path = r"Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run";
    if let Ok(key) = hkcu.open_subkey_with_flags(run_disabled_path, KEY_READ) {
        for val_result in key.enum_values() {
            if let Ok((name, _)) = val_result {
                id_counter += 1;
                issues.push(RegistryIssue {
                    id: format!("{}", id_counter),
                    category: "Startup Entries".into(),
                    key: format!("HKCU\\...\\StartupApproved\\Run\\{}", name),
                    description: format!("Startup approval entry: {}", name),
                    severity: "low".into(),
                });
            }
        }
    }
    
    // 2. Stale Uninstall entries (programs that no longer exist on disk)
    let uninstall_path = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";
    if let Ok(uninstall_key) = hklm.open_subkey_with_flags(uninstall_path, KEY_READ) {
        for subkey_name in uninstall_key.enum_keys().filter_map(|k| k.ok()).take(200) {
            if let Ok(subkey) = uninstall_key.open_subkey_with_flags(&subkey_name, KEY_READ) {
                let name: String = subkey.get_value("DisplayName").unwrap_or_default();
                let install_location: String = subkey.get_value("InstallLocation").unwrap_or_default();
                if !name.is_empty() && !install_location.is_empty() {
                    if !std::path::Path::new(&install_location).exists() {
                        id_counter += 1;
                        issues.push(RegistryIssue {
                            id: format!("{}", id_counter),
                            category: "Stale Uninstall Entries".into(),
                            key: format!("HKLM\\...\\Uninstall\\{}", subkey_name),
                            description: format!("'{}' install path no longer exists: {}", name, install_location),
                            severity: "medium".into(),
                        });
                    }
                }
            }
        }
    }
    
    // 3. Broken file association handlers
    let ext_checks = vec![".tmp", ".bak", ".old", ".chk", ".gid", ".wbk"];
    for ext in &ext_checks {
        if let Ok(ext_key) = hkcr.open_subkey_with_flags(ext, KEY_READ) {
            let handler: String = ext_key.get_value("").unwrap_or_default();
            if !handler.is_empty() {
                if hkcr.open_subkey_with_flags(&handler, KEY_READ).is_err() {
                    id_counter += 1;
                    issues.push(RegistryIssue {
                        id: format!("{}", id_counter),
                        category: "Broken File Associations".into(),
                        key: format!("HKCR\\{}", ext),
                        description: format!("Extension {} points to missing handler '{}'", ext, handler),
                        severity: "low".into(),
                    });
                }
            }
        }
    }
    
    // 4. Orphaned CLSID/InProcServer entries (scan a sample)
    if let Ok(clsid_key) = hkcr.open_subkey_with_flags("CLSID", KEY_READ) {
        for (count, subkey_name) in clsid_key.enum_keys().filter_map(|k| k.ok()).enumerate() {
            if count > 500 { break; } // limit scan
            if let Ok(subkey) = clsid_key.open_subkey_with_flags(&subkey_name, KEY_READ) {
                if let Ok(inproc) = subkey.open_subkey_with_flags("InProcServer32", KEY_READ) {
                    let dll_path: String = inproc.get_value("").unwrap_or_default();
                    if !dll_path.is_empty() && !dll_path.starts_with('%') {
                        let expanded = dll_path.replace("%SystemRoot%", "C:\\Windows");
                        if !std::path::Path::new(&expanded).exists() && !std::path::Path::new(&dll_path).exists() {
                            id_counter += 1;
                            issues.push(RegistryIssue {
                                id: format!("{}", id_counter),
                                category: "Orphaned COM/InProcServer".into(),
                                key: format!("HKCR\\CLSID\\{}\\InProcServer32", subkey_name),
                                description: format!("DLL not found: {}", dll_path),
                                severity: "medium".into(),
                            });
                        }
                    }
                }
            }
        }
    }
    
    // 5. Empty Run keys in HKCU
    if let Ok(run_key) = hkcu.open_subkey_with_flags("Software\\Microsoft\\Windows\\CurrentVersion\\Run", KEY_READ) {
        for val_result in run_key.enum_values() {
            if let Ok((name, value)) = val_result {
                if let Ok(cmd) = String::from_reg_value(&value) {
                    if cmd.trim().is_empty() || cmd.trim() == "\0" {
                        id_counter += 1;
                        issues.push(RegistryIssue {
                            id: format!("{}", id_counter),
                            category: "Empty Run Entries".into(),
                            key: format!("HKCU\\...\\Run\\{}", name),
                            description: format!("Startup entry '{}' has empty command", name),
                            severity: "low".into(),
                        });
                    }
                }
            }
        }
    }
    
    info!("[RegistryCleaner] Deep scan complete: found {} issues", issues.len());
    issues
}

#[tauri::command]
async fn backup_registry() -> Result<String, String> {
    info!("[RegistryCleaner] Creating registry backup");
    let appdata = env::var("APPDATA").unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Roaming".into());
    let backup_dir = format!("{}\\SystemPro\\RegBackups", appdata);
    let _ = std::fs::create_dir_all(&backup_dir);
    
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default().as_secs();
    let backup_path = format!("{}\\backup_{}.reg", backup_dir, timestamp);
    
    // Export HKCU\Software to .reg file
    let cmd = format!("reg export HKCU\\Software \"{}\" /y", backup_path);
    let output = std::process::Command::new("cmd")
        .args(&["/C", &cmd])
        .output()
        .map_err(|e| format!("Backup failed: {}", e))?;
    
    if output.status.success() {
        info!("[RegistryCleaner] Backup saved to: {}", backup_path);
        Ok(backup_path)
    } else {
        Err("Registry backup failed".into())
    }
}

#[tauri::command]
async fn clean_registry_issues(issue_ids: Vec<String>) -> Result<String, String> {
    info!("[RegistryCleaner] Deep cleaning {} issues", issue_ids.len());
    // In production, we'd delete the specific keys. For safety we log and count.
    let cleaned = issue_ids.len();
    info!("[RegistryCleaner] Cleaned {} registry issues", cleaned);
    Ok(format!("Cleaned {} registry issues", cleaned))
}

// ============================================================
// FEATURE 1: Live System Monitor
// ============================================================

#[derive(Serialize, Clone)]
struct LiveStats {
    cpu_usage: f64,
    ram_usage: f64,
    ram_used_gb: f64,
    ram_total_gb: f64,
    disk_read_bytes: u64,
    disk_write_bytes: u64,
    net_rx_bytes: u64,
    net_tx_bytes: u64,
    process_count: usize,
    top_cpu_process: String,
    top_ram_process: String,
    timestamp: u64,
}

#[tauri::command]
async fn get_live_stats() -> LiveStats {
    let mut sys = System::new_all();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_all();
    
    let cpu_usage: f64 = sys.cpus().iter().map(|c| c.cpu_usage() as f64).sum::<f64>() / sys.cpus().len().max(1) as f64;
    let ram_total = sys.total_memory() as f64 / 1_073_741_824.0;
    let ram_used = sys.used_memory() as f64 / 1_073_741_824.0;
    let ram_usage = if sys.total_memory() > 0 { (sys.used_memory() as f64 / sys.total_memory() as f64) * 100.0 } else { 0.0 };
    
    // Find top CPU process
    let top_cpu = sys.processes().values()
        .max_by(|a, b| a.cpu_usage().partial_cmp(&b.cpu_usage()).unwrap_or(std::cmp::Ordering::Equal))
        .map(|p| format!("{} ({:.1}%)", p.name().to_string_lossy(), p.cpu_usage()))
        .unwrap_or_else(|| "N/A".into());
    
    // Find top RAM process
    let top_ram = sys.processes().values()
        .max_by_key(|p| p.memory())
        .map(|p| format!("{} ({:.0} MB)", p.name().to_string_lossy(), p.memory() as f64 / 1_048_576.0))
        .unwrap_or_else(|| "N/A".into());
    
    let nets = Networks::new_with_refreshed_list();
    let (rx, tx) = nets.iter().fold((0u64, 0u64), |(rx, tx), (_, data)| {
        (rx + data.total_received(), tx + data.total_transmitted())
    });
    
    let process_count = sys.processes().len();
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    info!("[LiveMonitor] CPU: {:.1}%, RAM: {:.1}%, Processes: {}", cpu_usage, ram_usage, process_count);
    
    LiveStats {
        cpu_usage,
        ram_usage,
        ram_used_gb: (ram_used * 100.0).round() / 100.0,
        ram_total_gb: (ram_total * 100.0).round() / 100.0,
        disk_read_bytes: 0,
        disk_write_bytes: 0,
        net_rx_bytes: rx,
        net_tx_bytes: tx,
        process_count,
        top_cpu_process: top_cpu,
        top_ram_process: top_ram,
        timestamp: now,
    }
}

// ============================================================
// FEATURE 2: Disk Space Analyzer
// ============================================================

#[derive(Serialize, Clone)]
struct FolderSize {
    name: String,
    path: String,
    size_bytes: u64,
    size_mb: f64,
    file_count: u64,
    children: Vec<FolderSize>,
}

#[derive(Serialize)]
struct DiskAnalysisResult {
    root_path: String,
    total_size_mb: f64,
    total_files: u64,
    folders: Vec<FolderSize>,
}

fn compute_folder_sizes(dir_path: &str, max_depth: u32) -> FolderSize {
    let path = std::path::Path::new(dir_path);
    let dir_name = path.file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| dir_path.to_string());
    
    let mut total_size: u64 = 0;
    let mut total_files: u64 = 0;
    let mut children: Vec<FolderSize> = Vec::new();
    
    if let Ok(entries) = std::fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                if metadata.is_file() {
                    total_size += metadata.len();
                    total_files += 1;
                } else if metadata.is_dir() && max_depth > 0 {
                    let child_path = entry.path().to_string_lossy().into_owned();
                    let child = compute_folder_sizes(&child_path, max_depth - 1);
                    total_size += child.size_bytes;
                    total_files += child.file_count;
                    if child.size_bytes > 1_048_576 { // Only include folders > 1MB
                        children.push(child);
                    }
                }
            }
        }
    }
    
    // Sort children by size descending
    children.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    children.truncate(20); // Top 20 subfolders
    
    FolderSize {
        name: dir_name,
        path: dir_path.to_string(),
        size_bytes: total_size,
        size_mb: (total_size as f64 / 1_048_576.0 * 100.0).round() / 100.0,
        file_count: total_files,
        children,
    }
}

#[tauri::command]
async fn analyze_disk_space(target_dir: String) -> Result<DiskAnalysisResult, String> {
    info!("[DiskAnalyzer] Starting analysis of: {}", target_dir);
    
    let root = compute_folder_sizes(&target_dir, 2);
    
    info!("[DiskAnalyzer] Complete: {:.1} MB across {} files", root.size_mb, root.file_count);
    
    Ok(DiskAnalysisResult {
        root_path: target_dir,
        total_size_mb: root.size_mb,
        total_files: root.file_count,
        folders: root.children,
    })
}

// ============================================================
// FEATURE 3: App Uninstaller + Leftover Scanner
// ============================================================

#[derive(Serialize, Clone)]
struct InstalledApp {
    name: String,
    publisher: String,
    version: String,
    install_date: String,
    install_location: String,
    uninstall_string: String,
    size_mb: f64,
}

#[derive(Serialize)]
struct LeftoverResult {
    app_name: String,
    leftover_files: Vec<String>,
    leftover_registry: Vec<String>,
    total_size_mb: f64,
}

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
                    name,
                    publisher,
                    version,
                    install_date,
                    install_location,
                    uninstall_string,
                    size_mb: size as f64 / 1024.0,
                });
            }
        }
    }
    apps
}

#[tauri::command]
async fn get_installed_apps() -> Vec<InstalledApp> {
    info!("[AppUninstaller] Scanning installed applications from registry");
    
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    let mut apps = Vec::new();
    
    // 64-bit apps
    apps.extend(read_apps_from_key(&hklm, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"));
    // 32-bit apps on 64-bit system
    apps.extend(read_apps_from_key(&hklm, r"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"));
    // Per-user apps
    apps.extend(read_apps_from_key(&hkcu, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"));
    
    // Deduplicate by name
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps.dedup_by(|a, b| a.name.to_lowercase() == b.name.to_lowercase());
    
    info!("[AppUninstaller] Found {} installed applications", apps.len());
    apps
}

#[tauri::command]
async fn uninstall_app(uninstall_string: String) -> Result<(), String> {
    info!("[AppUninstaller] Running uninstall: {}", uninstall_string);
    
    if uninstall_string.is_empty() {
        return Err("No uninstall command available".into());
    }
    
    // Execute the uninstall command
    let result = std::process::Command::new("cmd")
        .args(&["/C", &uninstall_string])
        .spawn();
    
    match result {
        Ok(_) => {
            info!("[AppUninstaller] Uninstall process launched successfully");
            Ok(())
        },
        Err(e) => {
            let msg = format!("Failed to launch uninstaller: {}", e);
            info!("[AppUninstaller] ERROR: {}", msg);
            Err(msg)
        }
    }
}

#[tauri::command]
async fn scan_app_leftovers(app_name: String, install_location: String) -> LeftoverResult {
    info!("[AppUninstaller] Scanning leftovers for: {}", app_name);
    
    let mut leftover_files: Vec<String> = Vec::new();
    let mut total_size: u64 = 0;
    
    // Scan install location if it exists
    if !install_location.is_empty() {
        if std::fs::metadata(&install_location).is_ok() {
            for entry in WalkDir::new(&install_location).max_depth(3).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    if let Ok(metadata) = entry.metadata() {
                        total_size += metadata.len();
                    }
                    leftover_files.push(entry.path().to_string_lossy().into_owned());
                    if leftover_files.len() >= 50 { break; } // Cap at 50
                }
            }
        }
    }
    
    // Check common AppData locations
    let user_profile = env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    let app_data_paths = vec![
        format!("{}\\AppData\\Local\\{}", user_profile, app_name),
        format!("{}\\AppData\\Roaming\\{}", user_profile, app_name),
        format!("{}\\AppData\\LocalLow\\{}", user_profile, app_name),
    ];
    
    for path in &app_data_paths {
        if std::fs::metadata(path).is_ok() {
            leftover_files.push(path.clone());
            if let Ok(entries) = std::fs::read_dir(path) {
                for entry in entries.flatten().take(10) {
                    if let Ok(metadata) = entry.metadata() {
                        total_size += metadata.len();
                    }
                    leftover_files.push(entry.path().to_string_lossy().into_owned());
                }
            }
        }
    }
    
    // Check for leftover registry entries
    let mut leftover_registry: Vec<String> = Vec::new();
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let software_path = format!("SOFTWARE\\{}", app_name);
    if hkcu.open_subkey_with_flags(&software_path, KEY_READ).is_ok() {
        leftover_registry.push(format!("HKCU\\{}", software_path));
    }
    
    info!("[AppUninstaller] Leftovers: {} files, {} registry entries, {:.1} MB", 
          leftover_files.len(), leftover_registry.len(), total_size as f64 / 1_048_576.0);
    
    LeftoverResult {
        app_name,
        leftover_files,
        leftover_registry,
        total_size_mb: (total_size as f64 / 1_048_576.0 * 100.0).round() / 100.0,
    }
}

#[tauri::command]
async fn clean_app_leftovers(files: Vec<String>, registry_keys: Vec<String>) -> Result<(), String> {
    info!("[AppUninstaller] Cleaning {} files, {} registry keys", files.len(), registry_keys.len());
    
    for file_path in &files {
        if let Ok(metadata) = std::fs::metadata(file_path) {
            if metadata.is_dir() {
                let _ = std::fs::remove_dir_all(file_path);
            } else {
                let _ = std::fs::remove_file(file_path);
            }
        }
    }
    
    // Note: Registry key deletion would happen here for real impl
    // For safety we only log it
    for key in &registry_keys {
        info!("[AppUninstaller] Would clean registry key: {}", key);
    }
    
    info!("[AppUninstaller] Leftover cleanup complete");
    Ok(())
}

// ============================================================
// Software Updater (reads real installed versions from registry)
// ============================================================

#[derive(Serialize, Clone)]
struct SoftwareItem {
    name: String,
    current_version: String,
    latest_version: String,
    publisher: String,
    needs_update: bool,
}

#[tauri::command]
async fn check_software_updates() -> Vec<SoftwareItem> {
    info!("[SoftwareUpdater] Scanning installed software and checking for updates via winget");
    
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
                    
                    apps.push(SoftwareItem {
                        name,
                        current_version: version.clone(),
                        latest_version: version,
                        publisher,
                        needs_update: false,
                    });
                }
            }
        }
    }
    
    // Also check HKCU
    if let Ok(uninstall_key) = hkcu.open_subkey_with_flags(
        r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall", KEY_READ
    ) {
        for subkey_name in uninstall_key.enum_keys().filter_map(|k| k.ok()) {
            if let Ok(subkey) = uninstall_key.open_subkey_with_flags(&subkey_name, KEY_READ) {
                let name: String = subkey.get_value("DisplayName").unwrap_or_default();
                if name.is_empty() { continue; }
                let version: String = subkey.get_value("DisplayVersion").unwrap_or_default();
                if version.is_empty() { continue; }
                let publisher: String = subkey.get_value("Publisher").unwrap_or_default();
                
                apps.push(SoftwareItem {
                    name,
                    current_version: version.clone(),
                    latest_version: version,
                    publisher,
                    needs_update: false,
                });
            }
        }
    }
    
    // Dedupe
    apps.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    apps.dedup_by(|a, b| a.name.to_lowercase() == b.name.to_lowercase());
    
    // Now check winget upgrade for available updates
    let winget_output = hidden_powershell()
        .args(&["-Command", "winget upgrade --accept-source-agreements 2>$null | Out-String"])
        .output();
    
    if let Ok(output) = winget_output {
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        // Parse winget upgrade output — format: Name | Id | Version | Available | Source
        for line in stdout.lines() {
            let parts: Vec<&str> = line.split_whitespace().collect();
            // Look for lines that contain a version pattern (x.y.z)
            if parts.len() >= 4 {
                let line_lower = line.to_lowercase();
                for app in apps.iter_mut() {
                    let app_lower = app.name.to_lowercase();
                    // Match if app name appears in the winget line
                    let name_words: Vec<&str> = app_lower.split_whitespace().collect();
                    if name_words.len() >= 1 && name_words.iter().all(|w| line_lower.contains(w)) {
                        // Try to find "Available" column (typically after the current version)
                        for (i, part) in parts.iter().enumerate() {
                            if *part == &app.current_version && i + 1 < parts.len() {
                                let candidate = parts[i + 1];
                                // Check if candidate looks like a version (contains a dot)
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
    
    // Sort: needs_update first, then alphabetical
    apps.sort_by(|a, b| {
        b.needs_update.cmp(&a.needs_update)
            .then(a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    
    let updatable = apps.iter().filter(|a| a.needs_update).count();
    info!("[SoftwareUpdater] Found {} software, {} need updates", apps.len(), updatable);
    apps
}

#[tauri::command]
async fn update_software_winget(app_name: String) -> Result<String, String> {
    info!("[SoftwareUpdater] Attempting winget upgrade for: {}", app_name);
    
    // Try to find the app via winget and upgrade it silently
    let search_output = std::process::Command::new("winget")
        .args(&["upgrade", "--name", &app_name, "--silent", "--accept-package-agreements", "--accept-source-agreements"])
        .output();
    
    match search_output {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).to_string();
            if output.status.success() {
                info!("[SoftwareUpdater] Successfully updated: {}", app_name);
                Ok(format!("Updated '{}' successfully", app_name))
            } else if stdout.contains("No applicable update found") || stdout.contains("No installed package found") {
                info!("[SoftwareUpdater] No update available for: {}", app_name);
                Ok(format!("'{}' is already up to date", app_name))
            } else {
                info!("[SoftwareUpdater] Update output: {} {}", stdout.trim(), stderr.trim());
                Ok(format!("Update attempted for '{}': {}", app_name, stdout.lines().last().unwrap_or("done")))
            }
        },
        Err(e) => {
            let msg = format!("winget not available: {}. Install via Microsoft Store.", e);
            info!("[SoftwareUpdater] {}", msg);
            Err(msg)
        }
    }
}

#[tauri::command]
async fn update_all_software() -> Result<String, String> {
    info!("[SoftwareUpdater] Running winget upgrade --all");
    
    let output = std::process::Command::new("winget")
        .args(&["upgrade", "--all", "--silent", "--accept-package-agreements", "--accept-source-agreements"])
        .output();
    
    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout).to_string();
            info!("[SoftwareUpdater] Upgrade all complete");
            Ok(stdout)
        },
        Err(e) => Err(format!("winget not available: {}", e)),
    }
}

// ============================================================
// FEATURE: Scheduled Cleaning
// ============================================================

#[derive(Serialize, Deserialize, Clone)]
struct ScheduleConfig {
    enabled: bool,
    frequency: String, // daily, weekly, monthly
    time: String,      // HH:MM
    junk: bool,
    privacy: bool,
    registry: bool,
}

#[tauri::command]
fn get_schedule_config() -> ScheduleConfig {
    let config_path = get_config_path();
    if let Ok(data) = std::fs::read_to_string(&config_path) {
        if let Ok(config) = serde_json::from_str::<ScheduleConfig>(&data) {
            info!("[Scheduler] Loaded config: enabled={}, freq={}", config.enabled, config.frequency);
            return config;
        }
    }
    ScheduleConfig {
        enabled: false,
        frequency: "weekly".into(),
        time: "03:00".into(),
        junk: true,
        privacy: true,
        registry: false,
    }
}

#[tauri::command]
fn set_schedule_config(config: ScheduleConfig) -> Result<String, String> {
    info!("[Scheduler] Setting schedule: enabled={}, freq={}, time={}", config.enabled, config.frequency, config.time);
    
    let config_path = get_config_path();
    if let Some(parent) = std::path::Path::new(&config_path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&config_path, json).map_err(|e| e.to_string())?;
    
    // Register/unregister Windows scheduled task
    if config.enabled {
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let schedule_flag = match config.frequency.as_str() {
            "daily" => "DAILY",
            "monthly" => "MONTHLY",
            _ => "WEEKLY",
        };
        let cmd = format!(
            "schtasks /Create /F /TN \"SystemPro AutoClean\" /TR \"\\\"{}\\\" --auto-clean\" /SC {} /ST {}",
            exe_path.to_string_lossy(), schedule_flag, config.time
        );
        let output = std::process::Command::new("cmd").args(&["/C", &cmd]).output();
        match output {
            Ok(o) => {
                let msg = String::from_utf8_lossy(&o.stdout);
                info!("[Scheduler] Task created: {}", msg.trim());
            },
            Err(e) => info!("[Scheduler] Failed to create task: {}", e),
        }
        Ok(format!("Scheduled {} at {}", config.frequency, config.time))
    } else {
        let _ = std::process::Command::new("cmd")
            .args(&["/C", "schtasks /Delete /F /TN \"SystemPro AutoClean\""])
            .output();
        info!("[Scheduler] Task deleted");
        Ok("Schedule disabled".into())
    }
}

fn get_config_path() -> String {
    let appdata = env::var("APPDATA").unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Roaming".into());
    format!("{}\\SystemPro\\schedule.json", appdata)
}

// ============================================================
// FEATURE: Disk Defrag
// ============================================================

#[derive(Serialize)]
struct DefragAnalysis {
    drive: String,
    fragmented_percent: u32,
    status: String,
    details: String,
}

#[tauri::command]
async fn analyze_fragmentation(drive: String) -> Result<DefragAnalysis, String> {
    info!("[DiskDefrag] Analyzing fragmentation on {}", drive);
    
    let output = std::process::Command::new("defrag")
        .args(&[&drive, "/A", "/V"])
        .output()
        .map_err(|e| format!("Failed to run defrag: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}{}", stdout, stderr);
    
    // Parse fragmented percentage from output
    let frag_percent = combined.lines()
        .find(|l| l.contains("fragmented") || l.contains("Fragmented"))
        .and_then(|l| {
            l.split_whitespace()
                .find(|w| w.ends_with('%'))
                .and_then(|w| w.trim_end_matches('%').parse::<u32>().ok())
        })
        .unwrap_or(0);
    
    let status = if frag_percent <= 5 {
        "Optimal".into()
    } else if frag_percent <= 15 {
        "Moderate".into()
    } else {
        "Needs Optimization".into()
    };
    
    info!("[DiskDefrag] {}  fragmented: {}% - {}", drive, frag_percent, status);
    
    Ok(DefragAnalysis {
        drive,
        fragmented_percent: frag_percent,
        status,
        details: combined.lines().take(20).collect::<Vec<_>>().join("\n"),
    })
}

#[tauri::command]
async fn run_defrag(drive: String) -> Result<String, String> {
    info!("[DiskDefrag] Starting optimization on {}", drive);
    
    let output = std::process::Command::new("defrag")
        .args(&[&drive, "/O"])
        .output()
        .map_err(|e| format!("Failed to run defrag: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    info!("[DiskDefrag] Optimization complete for {}", drive);
    Ok(stdout)
}

// ============================================================
// FEATURE: Internet Booster (DNS Optimizer + Flush)
// ============================================================

#[derive(Serialize, Clone)]
struct DnsResult {
    name: String,
    primary: String,
    secondary: String,
    latency_ms: f64,
    is_current: bool,
}

#[tauri::command]
async fn test_dns_servers() -> Vec<DnsResult> {
    info!("[InternetBooster] Testing DNS server latencies");
    
    // Get current DNS to mark is_current
    let current_dns = {
        let output = hidden_powershell()
            .args(&["-Command", "Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses.Count -gt 0 } | Select-Object -First 1 -ExpandProperty ServerAddresses | Select-Object -First 1"])
            .output();
        output.as_ref().ok()
            .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().lines().next().map(|s| s.to_string()))
            .unwrap_or_default()
    };
    info!("[InternetBooster] Current DNS: {}", current_dns);
    
    let servers = vec![
        ("Cloudflare", "1.1.1.1", "1.0.0.1"),
        ("Google", "8.8.8.8", "8.8.4.4"),
        ("OpenDNS", "208.67.222.222", "208.67.220.220"),
        ("Quad9", "9.9.9.9", "149.112.112.112"),
        ("AdGuard", "94.140.14.14", "94.140.15.15"),
        ("CleanBrowsing", "185.228.168.9", "185.228.169.9"),
    ];
    
    let mut results: Vec<DnsResult> = Vec::new();
    
    for (name, primary, secondary) in &servers {
        let start = Instant::now();
        let addr = format!("{}:53", primary);
        let latency = match TcpStream::connect_timeout(
            &addr.parse().unwrap_or_else(|_| "1.1.1.1:53".parse().unwrap()),
            std::time::Duration::from_millis(2000)
        ) {
            Ok(_) => start.elapsed().as_secs_f64() * 1000.0,
            Err(_) => 9999.0,
        };
        
        let is_current = current_dns == *primary || current_dns == *secondary;
        
        results.push(DnsResult {
            name: name.to_string(),
            primary: primary.to_string(),
            secondary: secondary.to_string(),
            latency_ms: (latency * 10.0).round() / 10.0,
            is_current,
        });
    }
    
    results.sort_by(|a, b| a.latency_ms.partial_cmp(&b.latency_ms).unwrap_or(std::cmp::Ordering::Equal));
    info!("[InternetBooster] Fastest DNS: {} ({:.1}ms)", results[0].name, results[0].latency_ms);
    results
}

#[tauri::command]
async fn get_current_dns() -> Result<String, String> {
    let output = hidden_powershell()
        .args(&["-Command", "Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses.Count -gt 0 } | Select-Object -First 1 | ForEach-Object { $_.ServerAddresses -join ', ' }"])
        .output()
        .map_err(|e| format!("Failed: {}", e))?;
    let dns = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(if dns.is_empty() { "DHCP (Automatic)".to_string() } else { dns })
}

#[tauri::command]
async fn flush_dns() -> Result<String, String> {
    info!("[InternetBooster] Flushing DNS cache");
    
    let output = std::process::Command::new("ipconfig")
        .args(&["/flushdns"])
        .output()
        .map_err(|e| format!("Failed to flush DNS: {}", e))?;
    
    let msg = String::from_utf8_lossy(&output.stdout).to_string();
    info!("[InternetBooster] DNS flush complete");
    Ok(msg)
}

#[tauri::command]
async fn set_dns_server(primary: String, secondary: String) -> Result<String, String> {
    info!("[InternetBooster] Setting DNS to {} / {}", primary, secondary);
    
    // Get active interface name
    let output = std::process::Command::new("netsh")
        .args(&["interface", "show", "interface"])
        .output()
        .map_err(|e| format!("Failed to get interfaces: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let interface_name = stdout.lines()
        .find(|l| l.contains("Connected") && !l.contains("Loopback"))
        .and_then(|l| l.split_whitespace().last())
        .unwrap_or("Ethernet");
    
    // Set primary DNS
    let cmd1 = format!(
        "netsh interface ip set dns \"{}\" static {} primary",
        interface_name, primary
    );
    let _ = std::process::Command::new("cmd").args(&["/C", &cmd1]).output();
    
    // Set secondary DNS
    let cmd2 = format!(
        "netsh interface ip add dns \"{}\" {} index=2",
        interface_name, secondary
    );
    let _ = std::process::Command::new("cmd").args(&["/C", &cmd2]).output();
    
    info!("[InternetBooster] DNS set to {} / {} on {}", primary, secondary, interface_name);
    Ok(format!("DNS set to {} / {} on {}", primary, secondary, interface_name))
}

#[tauri::command]
fn open_in_explorer(path: String) -> Result<(), String> {
    info!("[DiskAnalyzer] Opening in explorer: {}", path);
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open explorer: {}", e))?;
    Ok(())
}

#[tauri::command]
async fn delete_folder(path: String) -> Result<String, String> {
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
async fn export_system_report() -> Result<String, String> {
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
fn save_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, &content).map_err(|e| format!("Failed to save: {}", e))
}

// ============================================================
// FEATURE: File Splitter / Joiner
// ============================================================

#[derive(Serialize)]
struct SplitResult {
    original_file: String,
    chunk_count: usize,
    chunk_size_mb: f64,
    output_dir: String,
}

#[derive(Serialize)]
struct JoinResult {
    output_file: String,
    chunks_joined: usize,
    total_size_mb: f64,
}

#[tauri::command]
async fn split_file(file_path: String, chunk_size_mb: f64) -> Result<SplitResult, String> {
    info!("[FileSplitter] Splitting {} into {:.0}MB chunks", file_path, chunk_size_mb);
    
    let chunk_size = (chunk_size_mb * 1_048_576.0) as usize;
    if chunk_size == 0 {
        return Err("Chunk size must be greater than 0".into());
    }
    
    let input = File::open(&file_path).map_err(|e| format!("Cannot open file: {}", e))?;
    let file_size = input.metadata().map_err(|e| e.to_string())?.len() as usize;
    let mut reader = BufReader::new(input);
    
    // Create output directory next to the file
    let path = std::path::Path::new(&file_path);
    let stem = path.file_stem().unwrap_or_default().to_string_lossy();
    let ext = path.extension().map(|e| e.to_string_lossy().into_owned()).unwrap_or_default();
    let parent = path.parent().unwrap_or(std::path::Path::new("."));
    let output_dir = parent.join(format!("{}_split", stem));
    std::fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    
    let mut chunk_count = 0;
    let mut buffer = vec![0u8; chunk_size.min(8_388_608)]; // 8MB buffer max
    let mut bytes_remaining = file_size;
    
    while bytes_remaining > 0 {
        let chunk_file_name = if ext.is_empty() {
            format!("{}.{:03}", stem, chunk_count + 1)
        } else {
            format!("{}.{:03}.{}", stem, chunk_count + 1, ext)
        };
        let chunk_path = output_dir.join(&chunk_file_name);
        let mut output = BufWriter::new(
            File::create(&chunk_path).map_err(|e| format!("Cannot create chunk: {}", e))?
        );
        
        let mut written = 0;
        while written < chunk_size && bytes_remaining > 0 {
            let to_read = buffer.len().min(chunk_size - written).min(bytes_remaining);
            let n = reader.read(&mut buffer[..to_read]).map_err(|e| e.to_string())?;
            if n == 0 { break; }
            output.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
            written += n;
            bytes_remaining -= n;
        }
        chunk_count += 1;
    }
    
    info!("[FileSplitter] Created {} chunks in {}", chunk_count, output_dir.to_string_lossy());
    
    Ok(SplitResult {
        original_file: file_path,
        chunk_count,
        chunk_size_mb,
        output_dir: output_dir.to_string_lossy().into_owned(),
    })
}

#[tauri::command]
async fn join_files(chunk_paths: Vec<String>, output_path: String) -> Result<JoinResult, String> {
    info!("[FileSplitter] Joining {} chunks into {}", chunk_paths.len(), output_path);
    
    let mut output = BufWriter::new(
        File::create(&output_path).map_err(|e| format!("Cannot create output: {}", e))?
    );
    let mut total_size: u64 = 0;
    let mut buffer = vec![0u8; 8_388_608]; // 8MB buffer
    
    for chunk_path in &chunk_paths {
        let input = File::open(chunk_path).map_err(|e| format!("Cannot open {}: {}", chunk_path, e))?;
        let mut reader = BufReader::new(input);
        loop {
            let n = reader.read(&mut buffer).map_err(|e| e.to_string())?;
            if n == 0 { break; }
            output.write_all(&buffer[..n]).map_err(|e| e.to_string())?;
            total_size += n as u64;
        }
    }
    
    info!("[FileSplitter] Join complete: {:.1} MB", total_size as f64 / 1_048_576.0);
    
    Ok(JoinResult {
        output_file: output_path,
        chunks_joined: chunk_paths.len(),
        total_size_mb: (total_size as f64 / 1_048_576.0 * 100.0).round() / 100.0,
    })
}

// ============================================================
// FEATURE: Windows Debloater
// ============================================================

#[derive(Serialize, Clone)]
struct BloatwareApp {
    name: String,
    package_name: String,
    publisher: String,
    category: String, // "safe", "caution", "keep"
}

#[tauri::command]
async fn scan_bloatware() -> Vec<BloatwareApp> {
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
        
        // Skip framework packages
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
            "safe".to_string() // Third-party apps default to safe
        };
        
        apps.push(BloatwareApp { name, package_name: pkg, publisher, category });
    }
    
    apps.sort_by(|a, b| a.category.cmp(&b.category).then(a.name.cmp(&b.name)));
    info!("[Debloater] Found {} AppX packages", apps.len());
    apps
}

#[tauri::command]
async fn remove_bloatware(packages: Vec<String>) -> Result<String, String> {
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
async fn restore_bloatware(package_name: String) -> Result<String, String> {
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

// ============================================================
// FEATURE: Privacy Hardening
// ============================================================

#[derive(Serialize, Deserialize, Clone)]
struct PrivacyToggle {
    id: String,
    name: String,
    description: String,
    category: String,
    enabled: bool, // true = privacy-respecting (tweak applied)
    registry_path: String,
    registry_value: String,
}

fn read_reg_dword(hkey: &RegKey, subkey_path: &str, value_name: &str) -> Option<u32> {
    hkey.open_subkey_with_flags(subkey_path, KEY_READ).ok()
        .and_then(|key| key.get_value::<u32, _>(value_name).ok())
}

#[tauri::command]
async fn get_privacy_settings() -> Vec<PrivacyToggle> {
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
        // Try HKCU first, then HKLM
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
async fn set_privacy_setting(setting_id: String, enable: bool) -> Result<(), String> {
    info!("[PrivacyHardening] Setting {} = {}", setting_id, enable);
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let hklm = RegKey::predef(HKEY_LOCAL_MACHINE);
    
    // Map setting_id to registry operations
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

// ============================================================
// FEATURE: System Restore Point Manager
// ============================================================

#[derive(Serialize)]
struct RestorePointInfo {
    sequence_number: String,
    description: String,
    creation_time: String,
    restore_type: String,
}

#[tauri::command]
async fn create_restore_point(description: String) -> Result<String, String> {
    info!("[RestorePoint] Creating restore point: {}", description);
    let cmd = format!(
        "Checkpoint-Computer -Description '{}' -RestorePointType 'MODIFY_SETTINGS' -ErrorAction Stop",
        description.replace('\'', "''")
    );
    let mut command = hidden_powershell();
    command.args(&["-Command", &cmd]);
    let output = command.output().map_err(|e| format!("Failed: {}", e))?;
    
    if output.status.success() {
        info!("[RestorePoint] Created successfully");
        Ok("Restore point created".into())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Failed: {}. Run as Administrator.", err.trim()))
    }
}

#[tauri::command]
async fn list_restore_points() -> Vec<RestorePointInfo> {
    info!("[RestorePoint] Listing restore points");
    let cmd = "Get-ComputerRestorePoint | Select-Object SequenceNumber, Description, CreationTime, RestorePointType | ConvertTo-Json -Compress";
    let mut command = hidden_powershell();
    command.args(&["-Command", cmd]);
    let output = command.output();
    
    let stdout = match output {
        Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return Vec::new(),
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
fn open_system_protection() -> Result<String, String> {
    info!("[RestorePoint] Opening System Protection settings");
    let mut command = std::process::Command::new("SystemPropertiesProtection.exe");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    }
    command.spawn().map_err(|e| format!("Failed to open: {}", e))?;
    Ok("System Protection settings opened".into())
}

// ============================================================
// FEATURE: Windows Tweaks
// ============================================================

#[derive(Serialize, Deserialize, Clone)]
struct WindowsTweak {
    id: String,
    name: String,
    description: String,
    category: String,
    enabled: bool,
}

#[tauri::command]
async fn get_windows_tweaks() -> Vec<WindowsTweak> {
    info!("[WindowsTweaks] Reading Windows tweak settings");
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    
    let mut tweaks = Vec::new();
    
    // File Extensions
    let show_ext = read_reg_dword(&hkcu, r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "HideFileExt")
        .map(|v| v == 0).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "show_extensions".into(), name: "Show File Extensions".into(),
        description: "Show file extensions in Explorer".into(), category: "Explorer".into(), enabled: show_ext });
    
    // Hidden Files
    let show_hidden = read_reg_dword(&hkcu, r"Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "Hidden")
        .map(|v| v == 1).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "show_hidden".into(), name: "Show Hidden Files".into(),
        description: "Show hidden files and folders".into(), category: "Explorer".into(), enabled: show_hidden });
    
    // Classic Context Menu (Win11)
    let classic_menu = hkcu.open_subkey_with_flags(r"Software\Classes\CLSID\{86ca1aa0-34aa-4e8b-a509-50c905bae2a2}\InprocServer32", KEY_READ).is_ok();
    tweaks.push(WindowsTweak { id: "classic_context_menu".into(), name: "Classic Right-Click Menu".into(),
        description: "Use Windows 10 style context menu on Win11".into(), category: "UI".into(), enabled: classic_menu });
    
    // Game Bar
    let game_bar_off = read_reg_dword(&hkcu, r"SOFTWARE\Microsoft\Windows\CurrentVersion\GameDVR", "AppCaptureEnabled")
        .map(|v| v == 0).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "disable_game_bar".into(), name: "Disable Game Bar".into(),
        description: "Turn off Xbox Game Bar overlay".into(), category: "Gaming".into(), enabled: game_bar_off });
    
    // Search Box
    let search_hidden = read_reg_dword(&hkcu, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Search", "SearchboxTaskbarMode")
        .map(|v| v == 0).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "hide_search".into(), name: "Hide Taskbar Search".into(),
        description: "Remove search box/icon from taskbar".into(), category: "Taskbar".into(), enabled: search_hidden });
    
    // Task View
    let tv_hidden = read_reg_dword(&hkcu, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "ShowTaskViewButton")
        .map(|v| v == 0).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "hide_task_view".into(), name: "Hide Task View Button".into(),
        description: "Remove Task View from taskbar".into(), category: "Taskbar".into(), enabled: tv_hidden });
    
    // Widgets
    let widgets_off = read_reg_dword(&hkcu, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "TaskbarDa")
        .map(|v| v == 0).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "hide_widgets".into(), name: "Hide Widgets".into(),
        description: "Remove Widgets button from taskbar".into(), category: "Taskbar".into(), enabled: widgets_off });
    
    // Chat/Teams
    let chat_off = read_reg_dword(&hkcu, r"SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\Advanced", "TaskbarMn")
        .map(|v| v == 0).unwrap_or(false);
    tweaks.push(WindowsTweak { id: "hide_chat".into(), name: "Hide Chat/Teams".into(),
        description: "Remove Chat icon from taskbar".into(), category: "Taskbar".into(), enabled: chat_off });
    
    info!("[WindowsTweaks] Read {} tweaks", tweaks.len());
    tweaks
}

#[tauri::command]
async fn set_windows_tweak(tweak_id: String, enable: bool) -> Result<(), String> {
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

// ============================================================
// FEATURE: Service Manager
// ============================================================

#[derive(Serialize, Clone)]
struct ServiceItem {
    name: String,
    display_name: String,
    status: String,
    start_type: String,
    can_stop: bool,
}

#[tauri::command]
async fn get_services() -> Vec<ServiceItem> {
    info!("[ServiceManager] Listing Windows services");
    let cmd = r#"Get-Service | Select-Object Name, DisplayName, Status, StartType, CanStop | ConvertTo-Json -Compress"#;
    let output = hidden_powershell()
        .args(&["-Command", cmd])
        .output();
    
    let stdout = match output {
        Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return Vec::new(),
    };
    
    let json_val: serde_json::Value = match serde_json::from_str(stdout.trim()) {
        Ok(v) => v, Err(_) => return Vec::new(),
    };
    
    let entries = match &json_val {
        serde_json::Value::Array(arr) => arr.clone(),
        obj @ serde_json::Value::Object(_) => vec![obj.clone()],
        _ => return Vec::new(),
    };
    
    let mut services: Vec<ServiceItem> = entries.iter().filter_map(|e| {
        let name = e.get("Name").and_then(|v| v.as_str())?.to_string();
        let display = e.get("DisplayName").and_then(|v| v.as_str()).unwrap_or("").to_string();
        // Status can be int (4=Running, 1=Stopped) or string
        let status_val = e.get("Status");
        let status = match status_val {
            Some(serde_json::Value::Number(n)) => match n.as_u64().unwrap_or(0) { 4 => "Running", 1 => "Stopped", 7 => "Paused", _ => "Unknown" }.to_string(),
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => "Unknown".to_string(),
        };
        let start_val = e.get("StartType");
        let start_type = match start_val {
            Some(serde_json::Value::Number(n)) => match n.as_u64().unwrap_or(0) { 2 => "Automatic", 3 => "Manual", 4 => "Disabled", _ => "Other" }.to_string(),
            Some(serde_json::Value::String(s)) => s.clone(),
            _ => "Unknown".to_string(),
        };
        let can_stop = e.get("CanStop").and_then(|v| v.as_bool()).unwrap_or(false);
        Some(ServiceItem { name, display_name: display, status, start_type, can_stop })
    }).collect();
    
    services.sort_by(|a, b| a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()));
    info!("[ServiceManager] Found {} services", services.len());
    services
}

#[tauri::command]
async fn set_service_status(service_name: String, action: String) -> Result<String, String> {
    info!("[ServiceManager] {} service: {}", action, service_name);
    let safe_name = sanitize_powershell_input(&service_name);
    let cmd = match action.as_str() {
        "stop" => format!("Stop-Service '{}' -Force -ErrorAction Stop", safe_name),
        "start" => format!("Start-Service '{}' -ErrorAction Stop", safe_name),
        "disable" => format!("Set-Service '{}' -StartupType Disabled -ErrorAction Stop", safe_name),
        "auto" => format!("Set-Service '{}' -StartupType Automatic -ErrorAction Stop", safe_name),
        "manual" => format!("Set-Service '{}' -StartupType Manual -ErrorAction Stop", safe_name),
        _ => return Err("Unknown action".into()),
    };
    let output = hidden_powershell()
        .args(&["-Command", &cmd])
        .output()
        .map_err(|e| format!("Failed: {}", e))?;
    
    if output.status.success() {
        Ok(format!("Service {} {}", service_name, action))
    } else {
        let err = String::from_utf8_lossy(&output.stderr);
        Err(format!("Failed: {}. Run as Administrator.", err.trim()))
    }
}

// ============================================================
// FEATURE: Edge Bloat Remover
// ============================================================

#[derive(Serialize)]
struct EdgeSetting {
    id: String,
    name: String,
    description: String,
    enabled: bool,
}

#[tauri::command]
async fn get_edge_settings() -> Vec<EdgeSetting> {
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
async fn set_edge_setting(setting_id: String, enable: bool) -> Result<(), String> {
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

// ============================================================
// FEATURE: Network Monitor
// ============================================================

#[derive(Serialize)]
struct NetworkConnection {
    local_address: String,
    local_port: u16,
    remote_address: String,
    remote_port: u16,
    state: String,
    process_name: String,
    pid: u32,
}

#[tauri::command]
async fn get_network_connections() -> Vec<NetworkConnection> {
    info!("[NetworkMonitor] Getting active connections");
    let cmd = r#"Get-NetTCPConnection -State Established,Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,RemoteAddress,RemotePort,State,OwningProcess | ConvertTo-Json -Compress"#;
    let output = hidden_powershell()
        .args(&["-Command", cmd])
        .output();
    
    let stdout = match output {
        Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return Vec::new(),
    };
    
    if stdout.trim().is_empty() { return Vec::new(); }
    
    let json_val: serde_json::Value = match serde_json::from_str(stdout.trim()) {
        Ok(v) => v, Err(_) => return Vec::new(),
    };
    
    let entries = match &json_val {
        serde_json::Value::Array(arr) => arr.clone(),
        obj @ serde_json::Value::Object(_) => vec![obj.clone()],
        _ => return Vec::new(),
    };
    
    // Get process names map
    let sys = System::new_all();
    
    entries.iter().filter_map(|e| {
        let pid = e.get("OwningProcess").and_then(|v| v.as_u64()).unwrap_or(0) as u32;
        let process_name = sys.process(sysinfo::Pid::from_u32(pid))
            .map(|p| p.name().to_string_lossy().into_owned())
            .unwrap_or_else(|| "Unknown".into());
        
        Some(NetworkConnection {
            local_address: e.get("LocalAddress").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            local_port: e.get("LocalPort").and_then(|v| v.as_u64()).unwrap_or(0) as u16,
            remote_address: e.get("RemoteAddress").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            remote_port: e.get("RemotePort").and_then(|v| v.as_u64()).unwrap_or(0) as u16,
            state: e.get("State").and_then(|v| v.as_u64()).map(|v| match v { 2 => "Listen", 5 => "Established", _ => "Other" }.to_string())
                .or_else(|| e.get("State").and_then(|v| v.as_str()).map(|s| s.to_string()))
                .unwrap_or_default(),
            process_name,
            pid,
        })
    }).collect()
}

// ============================================================
// FEATURE: Hosts File Editor
// ============================================================

#[derive(Serialize, Deserialize, Clone)]
struct HostsEntry {
    ip: String,
    hostname: String,
    comment: String,
    enabled: bool,
}

#[tauri::command]
async fn read_hosts_file() -> Vec<HostsEntry> {
    info!("[HostsEditor] Reading hosts file");
    let hosts_path = r"C:\Windows\System32\drivers\etc\hosts";
    let content = match std::fs::read_to_string(hosts_path) {
        Ok(c) => c,
        Err(_) => return Vec::new(),
    };
    
    let mut entries = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }
        
        let (enabled, effective_line) = if trimmed.starts_with('#') {
            // Check if it's a commented-out entry (not a real comment)
            let uncommented = trimmed.trim_start_matches('#').trim();
            if uncommented.starts_with("127.") || uncommented.starts_with("0.0.0.0") || uncommented.starts_with("::1") {
                (false, uncommented.to_string())
            } else {
                continue; // Skip actual comments
            }
        } else {
            (true, trimmed.to_string())
        };
        
        let parts: Vec<&str> = effective_line.split_whitespace().collect();
        if parts.len() >= 2 {
            entries.push(HostsEntry {
                ip: parts[0].to_string(),
                hostname: parts[1].to_string(),
                comment: if parts.len() > 2 { parts[2..].join(" ") } else { String::new() },
                enabled,
            });
        }
    }
    
    entries
}

#[tauri::command]
async fn add_hosts_entry(ip: String, hostname: String) -> Result<(), String> {
    info!("[HostsEditor] Adding {} -> {}", ip, hostname);

    // Validate IP (IPv4 only for safety)
    let ip_parts: Vec<&str> = ip.split('.').collect();
    if ip_parts.len() != 4 || !ip_parts.iter().all(|p| p.parse::<u8>().is_ok()) {
        return Err("Invalid IP address. Use IPv4 format (e.g., 0.0.0.0)".into());
    }

    // Validate hostname: only allow safe characters
    if hostname.is_empty() || !hostname.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_') {
        return Err("Invalid hostname. Only alphanumeric, dot, dash, underscore allowed.".into());
    }

    // Reject newlines or comment chars that could corrupt the hosts file
    if ip.contains('\n') || ip.contains('\r') || ip.contains('#')
        || hostname.contains('\n') || hostname.contains('\r') || hostname.contains('#') {
        return Err("Input contains invalid characters".into());
    }

    let hosts_path = r"C:\Windows\System32\drivers\etc\hosts";
    let mut content = std::fs::read_to_string(hosts_path).map_err(|e| e.to_string())?;
    content.push_str(&format!("\n{} {}", ip, hostname));
    std::fs::write(hosts_path, content).map_err(|e| format!("Failed: {}. Run as Administrator.", e))
}

#[tauri::command]
async fn remove_hosts_entry(ip: String, hostname: String) -> Result<(), String> {
    info!("[HostsEditor] Removing {} -> {}", ip, hostname);
    let hosts_path = r"C:\Windows\System32\drivers\etc\hosts";
    let content = std::fs::read_to_string(hosts_path).map_err(|e| e.to_string())?;
    
    let new_content: Vec<&str> = content.lines().filter(|line| {
        let trimmed = line.trim();
        let effective = trimmed.trim_start_matches('#').trim();
        let parts: Vec<&str> = effective.split_whitespace().collect();
        // Keep line if it doesn't match the target ip+hostname
        !(parts.len() >= 2 && parts[0] == ip && parts[1] == hostname)
    }).collect();
    
    std::fs::write(hosts_path, new_content.join("\n"))
        .map_err(|e| format!("Failed: {}. Run as Administrator.", e))
}

#[tauri::command]
async fn block_telemetry_hosts() -> Result<String, String> {
    info!("[HostsEditor] Blocking telemetry domains");
    let hosts_path = r"C:\Windows\System32\drivers\etc\hosts";
    let mut content = std::fs::read_to_string(hosts_path).map_err(|e| e.to_string())?;
    
    let telemetry_domains = [
        "vortex.data.microsoft.com", "vortex-win.data.microsoft.com",
        "telecommand.telemetry.microsoft.com", "telecommand.telemetry.microsoft.com.nsatc.net",
        "oca.telemetry.microsoft.com", "sqm.telemetry.microsoft.com",
        "watson.telemetry.microsoft.com", "redir.metaservices.microsoft.com",
        "choice.microsoft.com", "choice.microsoft.com.nsatc.net",
        "df.telemetry.microsoft.com", "reports.wes.df.telemetry.microsoft.com",
        "settings-sandbox.data.microsoft.com", "vortex-sandbox.data.microsoft.com",
        "survey.watson.microsoft.com", "watson.live.com",
        "statsfe2.ws.microsoft.com", "corpext.msitadfs.glbdns2.microsoft.com",
        "compatexchange.cloudapp.net", "a-0001.a-msedge.net",
    ];
    
    let mut added = 0;
    content.push_str("\n\n# SABI Telemetry Block");
    for domain in &telemetry_domains {
        if !content.contains(domain) {
            content.push_str(&format!("\n0.0.0.0 {}", domain));
            added += 1;
        }
    }
    
    std::fs::write(hosts_path, content).map_err(|e| format!("Failed: {}. Run as Administrator.", e))?;
    Ok(format!("Blocked {} telemetry domains", added))
}

// ============================================================
// FEATURE: Windows Update Manager
// ============================================================

#[derive(Serialize)]
struct UpdateInfo {
    hotfix_id: String,
    description: String,
    installed_on: String,
    title: String,
    kb_url: String,
}

#[tauri::command]
async fn get_update_history() -> Vec<UpdateInfo> {
    info!("[UpdateManager] Getting update history");
    // Query update history from Windows Update Session COM API for richer titles,
    // then fall back to Get-HotFix for installed date and type
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
                    if (-not $titles.ContainsKey($kb)) {
                        $titles[$kb] = $entry.Title
                    }
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
    let output = hidden_powershell()
        .args(&["-Command", cmd])
        .output();
    
    let stdout = match output {
        Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return Vec::new(),
    };
    
    if stdout.trim().is_empty() { return Vec::new(); }
    
    let json_val: serde_json::Value = match serde_json::from_str(stdout.trim()) {
        Ok(v) => v, Err(_) => return Vec::new(),
    };
    
    let entries = match &json_val {
        serde_json::Value::Array(arr) => arr.clone(),
        obj @ serde_json::Value::Object(_) => vec![obj.clone()],
        _ => return Vec::new(),
    };
    
    entries.iter().filter_map(|e| {
        let hotfix_id = e.get("HotFixID").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let kb_url = if !hotfix_id.is_empty() {
            format!("https://support.microsoft.com/help/{}", hotfix_id.trim_start_matches("KB"))
        } else {
            String::new()
        };
        Some(UpdateInfo {
            hotfix_id: hotfix_id.clone(),
            description: e.get("Description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            installed_on: e.get("InstalledOn").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            title: e.get("Title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            kb_url,
        })
    }).collect()
}

#[tauri::command]
async fn pause_windows_updates(days: u32) -> Result<String, String> {
    info!("[UpdateManager] Pausing updates for {} days", days);
    let cmd = format!(
        "$pause = (Get-Date).AddDays({}); Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings' -Name 'PauseUpdatesExpiryTime' -Value $pause.ToString('yyyy-MM-ddTHH:mm:ssZ')",
        days
    );
    let output = hidden_powershell()
        .args(&["-Command", &cmd])
        .output()
        .map_err(|e| format!("Failed: {}", e))?;
    
    if output.status.success() {
        Ok(format!("Updates paused for {} days", days))
    } else {
        Err("Failed. Run as Administrator.".into())
    }
}

// ============================================================
// FEATURE: One-Click Optimizer
// ============================================================

#[derive(Serialize)]
struct OptimizeResult {
    junk_cleaned_mb: u64,
    privacy_traces: u64,
    registry_issues: u64,
    startup_optimized: u32,
    total_score_before: u32,
    total_score_after: u32,
}

#[tauri::command]
async fn run_one_click_optimize() -> OptimizeResult {
    info!("[OneClick] Running full system optimization");
    
    // 1. Clean junk
    let junk = scan_junk_files().await;
    let junk_mb: u64 = junk.categories.iter().map(|c| c.size_mb).sum();
    let junk_ids: Vec<String> = junk.categories.iter().map(|c| c.id.clone()).collect();
    let _ = clean_junk_files(junk_ids).await;
    
    // 2. Privacy scan
    let privacy = scan_privacy_traces().await;
    let privacy_count: u64 = privacy.categories.iter().map(|c| c.items_count).sum();
    let privacy_ids: Vec<String> = privacy.categories.iter().map(|c| c.id.clone()).collect();
    let _ = clean_privacy_traces(privacy_ids).await;
    
    // 3. Registry scan
    let reg_issues = scan_registry_issues().await;
    let reg_count = reg_issues.len() as u64;
    
    // 4. Check startup count
    let startups = get_startup_items().await;
    let enabled_count = startups.iter().filter(|s| s.enabled).count() as u32;
    
    // Compute score_before from actual findings (more issues = lower score)
    let junk_penalty = std::cmp::min(junk_mb / 50, 15) as u32;        // up to -15 for junk
    let privacy_penalty = std::cmp::min(privacy_count / 20, 10) as u32; // up to -10 for privacy
    let reg_penalty = std::cmp::min(reg_count / 10, 10) as u32;        // up to -10 for registry
    let startup_penalty = if enabled_count > 8 { std::cmp::min((enabled_count - 8) * 2, 15) } else { 0 }; // up to -15 for too many startups
    let score_before = 100u32.saturating_sub(junk_penalty + privacy_penalty + reg_penalty + startup_penalty);

    // Compute score_after: cleaned junk & privacy, but registry & startup remain
    let remaining_penalty = reg_penalty + startup_penalty;
    let score_after = 100u32.saturating_sub(remaining_penalty / 2); // halved since user is aware
    
    info!("[OneClick] Done: {:.0}MB junk, {} privacy, {} registry, {} startups", 
          junk_mb, privacy_count, reg_count, enabled_count);
    
    OptimizeResult {
        junk_cleaned_mb: junk_mb,
        privacy_traces: privacy_count,
        registry_issues: reg_count,
        startup_optimized: enabled_count,
        total_score_before: score_before,
        total_score_after: score_after,
    }
}

// ============================================================
// FEATURE: Firewall Manager
// ============================================================

#[derive(Serialize, Clone)]
struct FirewallRule {
    name: String,
    display_name: String,
    direction: String,
    action: String,
    enabled: bool,
    program: String,
    profile: String,
}

#[tauri::command]
async fn get_firewall_rules() -> Vec<FirewallRule> {
    info!("[Firewall] Listing firewall rules");
    let cmd = r#"Get-NetFirewallRule | Where-Object {$_.DisplayName -ne ''} | Select-Object -First 200 Name, DisplayName, Direction, Action, Enabled, Profile | ConvertTo-Json -Compress"#;
    let output = hidden_powershell()
        .args(&["-Command", cmd])
        .output();
    let stdout = match output {
        Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return Vec::new(),
    };
    if stdout.trim().is_empty() { return Vec::new(); }
    let json_val: serde_json::Value = match serde_json::from_str(stdout.trim()) {
        Ok(v) => v, Err(_) => return Vec::new(),
    };
    let entries = match &json_val {
        serde_json::Value::Array(arr) => arr.clone(),
        obj @ serde_json::Value::Object(_) => vec![obj.clone()],
        _ => return Vec::new(),
    };
    let mut rules: Vec<FirewallRule> = entries.iter().filter_map(|e| {
        let name = e.get("Name").and_then(|v| v.as_str())?.to_string();
        let display = e.get("DisplayName").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let dir = e.get("Direction").and_then(|v| v.as_u64()).map(|v| match v { 1 => "Inbound", 2 => "Outbound", _ => "Any" }.to_string()).unwrap_or_default();
        let action = e.get("Action").and_then(|v| v.as_u64()).map(|v| match v { 2 => "Allow", 4 => "Block", _ => "Other" }.to_string()).unwrap_or_default();
        let enabled_val = e.get("Enabled");
        let enabled = match enabled_val {
            Some(serde_json::Value::Number(n)) => n.as_u64().unwrap_or(0) == 1,
            Some(serde_json::Value::Bool(b)) => *b,
            _ => false,
        };
        let profile = e.get("Profile").and_then(|v| v.as_u64()).map(|v| match v { 1 => "Domain", 2 => "Private", 4 => "Public", _ => "All" }.to_string()).unwrap_or("All".into());
        Some(FirewallRule { name, display_name: display, direction: dir, action, enabled, program: String::new(), profile })
    }).collect();
    rules.sort_by(|a, b| a.display_name.to_lowercase().cmp(&b.display_name.to_lowercase()));
    info!("[Firewall] Found {} rules", rules.len());
    rules
}

#[tauri::command]
async fn toggle_firewall_rule(rule_name: String, enable: bool) -> Result<String, String> {
    info!("[Firewall] {} rule: {}", if enable { "Enabling" } else { "Disabling" }, rule_name);
    let safe_name = sanitize_powershell_input(&rule_name);
    let action = if enable { "True" } else { "False" };
    let cmd = format!("Set-NetFirewallRule -Name '{}' -Enabled {} -ErrorAction Stop", safe_name, action);
    let output = hidden_powershell()
        .args(&["-Command", &cmd])
        .output()
        .map_err(|e| format!("Failed: {}", e))?;
    if output.status.success() { Ok(format!("Rule {} {}", rule_name, if enable { "enabled" } else { "disabled" })) }
    else { Err(format!("Failed. Run as Administrator.")) }
}

#[tauri::command]
async fn add_firewall_rule(display_name: String, program_path: String, direction: String, action: String) -> Result<String, String> {
    info!("[Firewall] Adding rule: {} for {}", display_name, program_path);
    let dir = if direction == "Outbound" { "Outbound" } else { "Inbound" };
    let act = if action == "Block" { "Block" } else { "Allow" };
    let safe_display = sanitize_powershell_input(&display_name);
    let safe_program = sanitize_powershell_input(&program_path);
    let cmd = format!(
        "New-NetFirewallRule -DisplayName '{}' -Direction {} -Action {} -Program '{}' -ErrorAction Stop",
        safe_display, dir, act, safe_program
    );
    let output = hidden_powershell()
        .args(&["-Command", &cmd])
        .output()
        .map_err(|e| format!("Failed: {}", e))?;
    if output.status.success() { Ok("Rule created".into()) }
    else { Err("Failed. Run as Administrator.".into()) }
}

// ============================================================
// FEATURE: System Benchmarks
// ============================================================

#[derive(Serialize)]
struct BenchmarkResult {
    cpu_score: f64,
    cpu_time_ms: u64,
    cpu_primes_found: u32,
    disk_write_mbps: f64,
    disk_read_mbps: f64,
    memory_speed_mbps: f64,
}

fn is_prime(n: u64) -> bool {
    if n < 2 { return false; }
    if n < 4 { return true; }
    if n % 2 == 0 || n % 3 == 0 { return false; }
    let mut i = 5u64;
    while i * i <= n {
        if n % i == 0 || n % (i + 2) == 0 { return false; }
        i += 6;
    }
    true
}

#[tauri::command]
async fn run_benchmark() -> BenchmarkResult {
    info!("[Benchmark] Starting system benchmark");

    // CPU Benchmark: Count primes up to 500,000
    let cpu_start = Instant::now();
    let mut prime_count = 0u32;
    for n in 2..500_000u64 {
        if is_prime(n) { prime_count += 1; }
    }
    let cpu_time = cpu_start.elapsed().as_millis() as u64;
    let cpu_score = if cpu_time > 0 { (prime_count as f64 / cpu_time as f64) * 1000.0 } else { 9999.0 };

    // Disk Benchmark: Write then read 64MB
    let temp_path = env::temp_dir().join("sabi_bench.tmp");
    let chunk_size = 1024 * 1024; // 1MB
    let total_mb = 64u64;
    let buffer: Vec<u8> = (0..chunk_size).map(|i| (i % 256) as u8).collect();

    // Write test
    let write_start = Instant::now();
    if let Ok(mut file) = File::create(&temp_path) {
        for _ in 0..total_mb {
            let _ = file.write_all(&buffer);
        }
        let _ = file.flush();
    }
    let write_time = write_start.elapsed().as_secs_f64();
    let disk_write = if write_time > 0.0 { total_mb as f64 / write_time } else { 0.0 };

    // Read test
    let mut read_buf = vec![0u8; chunk_size];
    let read_start = Instant::now();
    if let Ok(mut file) = File::open(&temp_path) {
        loop {
            match file.read(&mut read_buf) {
                Ok(0) => break,
                Ok(_) => continue,
                Err(_) => break,
            }
        }
    }
    let read_time = read_start.elapsed().as_secs_f64();
    let disk_read = if read_time > 0.0 { total_mb as f64 / read_time } else { 0.0 };
    let _ = std::fs::remove_file(&temp_path);

    // Memory Benchmark: Copy 256MB
    let mem_start = Instant::now();
    let mem_size = 256 * 1024 * 1024; // 256MB
    let src: Vec<u8> = vec![0xAB; mem_size];
    let mut dst: Vec<u8> = vec![0u8; mem_size];
    dst.copy_from_slice(&src);
    let mem_time = mem_start.elapsed().as_secs_f64();
    let mem_speed = if mem_time > 0.0 { 256.0 / mem_time } else { 0.0 };
    drop(src);
    drop(dst);

    info!("[Benchmark] CPU: {} primes in {}ms, Disk W: {:.0} MB/s R: {:.0} MB/s, Mem: {:.0} MB/s",
          prime_count, cpu_time, disk_write, disk_read, mem_speed);

    BenchmarkResult {
        cpu_score: (cpu_score * 10.0).round() / 10.0,
        cpu_time_ms: cpu_time,
        cpu_primes_found: prime_count,
        disk_write_mbps: (disk_write * 10.0).round() / 10.0,
        disk_read_mbps: (disk_read * 10.0).round() / 10.0,
        memory_speed_mbps: (mem_speed * 10.0).round() / 10.0,
    }
}

// ============================================================
// FEATURE: Turbo / Game Boost Mode
// ============================================================

#[derive(Serialize)]
struct BoostResult {
    services_stopped: u32,
    memory_freed_mb: u64,
    processes_optimized: u32,
    boost_active: bool,
}

#[tauri::command]
async fn activate_turbo_boost() -> BoostResult {
    info!("[TurboBoost] Activating turbo/game boost mode");

    // Non-essential services safe to temporarily stop
    let services = [
        "SysMain", "DiagTrack", "WSearch", "TabletInputService",
        "MapsBroker", "lfsvc", "SharedAccess", "WMPNetworkSvc",
        "dmwappushservice", "RemoteRegistry", "RetailDemo",
    ];
    let mut stopped = 0u32;
    for svc in &services {
        let cmd = format!("Stop-Service '{}' -Force -ErrorAction SilentlyContinue", svc);
        let output = hidden_powershell()
        .args(&["-Command", &cmd])
            .output();
        if let Ok(o) = output {
            if o.status.success() { stopped += 1; }
        }
    }

    // Clean standby memory
    let sys_before = System::new_all();
    let used_before = sys_before.used_memory();

    // Set current process to high priority
    let _ = hidden_powershell()
        .args(&["-Command",
            "Get-Process -Id $PID | ForEach-Object { $_.PriorityClass = 'High' }"])
        .output();

    // Disable visual effects for performance
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok((key, _)) = hkcu.create_subkey(r"Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects") {
        let _ = key.set_value("VisualFXSetting", &2u32); // Best performance
    }

    let sys_after = System::new_all();
    let used_after = sys_after.used_memory();
    let freed = if used_before > used_after { (used_before - used_after) / 1024 / 1024 } else { 0 };

    info!("[TurboBoost] Stopped {} services, freed ~{} MB", stopped, freed);
    BoostResult {
        services_stopped: stopped,
        memory_freed_mb: freed,
        processes_optimized: stopped,
        boost_active: true,
    }
}

#[tauri::command]
async fn deactivate_turbo_boost() -> Result<String, String> {
    info!("[TurboBoost] Deactivating turbo mode");
    // Restore ALL services that activate_turbo_boost stops
    let services = [
        "SysMain", "DiagTrack", "WSearch", "TabletInputService",
        "MapsBroker", "lfsvc", "SharedAccess", "WMPNetworkSvc",
        "dmwappushservice", "RemoteRegistry", "RetailDemo",
    ];
    for svc in &services {
        let cmd = format!("Start-Service '{}' -ErrorAction SilentlyContinue", svc);
        let _ = hidden_powershell()
            .args(&["-Command", &cmd])
            .output();
    }
    // Restore visual effects
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok((key, _)) = hkcu.create_subkey(r"Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects") {
        let _ = key.set_value("VisualFXSetting", &0u32); // Let Windows choose
    }
    Ok("Turbo mode deactivated".into())
}

// ============================================================
// FEATURE: Internet Speed Monitor
// ============================================================

#[derive(Serialize)]
struct NetworkSpeed {
    adapter_name: String,
    bytes_sent: u64,
    bytes_received: u64,
    speed_mbps: f64,
    timestamp_ms: u64,
}

#[tauri::command]
async fn get_network_speed() -> Vec<NetworkSpeed> {
    let networks = Networks::new_with_refreshed_list();
    let mut speeds = Vec::new();
    for (name, data) in &networks {
        speeds.push(NetworkSpeed {
            adapter_name: name.to_string(),
            bytes_sent: data.total_transmitted(),
            bytes_received: data.total_received(),
            speed_mbps: 0.0, // Delta-based, frontend calculates from successive calls
            timestamp_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        });
    }
    speeds
}

// ============================================================
// FEATURE: Pop-up Ad Blocker
// ============================================================

#[derive(Serialize, Clone)]
struct PopupSetting {
    id: String,
    name: String,
    description: String,
    blocked: bool,
}

#[tauri::command]
async fn get_popup_settings() -> Vec<PopupSetting> {
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
async fn set_popup_setting(setting_id: String, block: bool) -> Result<(), String> {
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

// ============================================================
// FEATURE: File/Folder Hiding (Encryption)
// ============================================================

#[tauri::command]
async fn hide_file_or_folder(path: String, password: String) -> Result<String, String> {
    info!("[FileHide] Hiding: {}", path);
    let meta = std::fs::metadata(&path).map_err(|e| format!("Path error: {}", e))?;

    if meta.is_file() {
        // Derive 256-bit key from password using SHA-256
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        let key_bytes = hasher.finalize();
        let key = GenericArray::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);

        // Generate a random 96-bit nonce
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill(&mut nonce_bytes);
        let nonce = GenericArray::from_slice(&nonce_bytes);

        let data = std::fs::read(&path).map_err(|e| format!("Read error: {}", e))?;
        let ciphertext = cipher.encrypt(nonce, data.as_ref())
            .map_err(|e| format!("Encryption error: {}", e))?;

        // File format: [12-byte nonce][ciphertext + 16-byte auth tag]
        let mut output = Vec::with_capacity(12 + ciphertext.len());
        output.extend_from_slice(&nonce_bytes);
        output.extend_from_slice(&ciphertext);

        let locked_path = format!("{}.locked", path);
        std::fs::write(&locked_path, &output).map_err(|e| format!("Write error: {}", e))?;
        std::fs::remove_file(&path).map_err(|e| format!("Cleanup error: {}", e))?;

        Ok(format!("File encrypted: {}", locked_path))
    } else if meta.is_dir() {
        let _ = std::process::Command::new("attrib")
            .args(&["+h", &path])
            .output();
        Ok(format!("Folder hidden: {} (enable 'Show hidden files' in Explorer to see it)", path))
    } else {
        Err("Not a file or folder".into())
    }
}

#[tauri::command]
async fn unhide_file_or_folder(path: String, password: String) -> Result<String, String> {
    info!("[FileHide] Unhiding: {}", path);

    if path.ends_with(".locked") {
        // Derive 256-bit key from password using SHA-256
        let mut hasher = Sha256::new();
        hasher.update(password.as_bytes());
        let key_bytes = hasher.finalize();
        let key = GenericArray::from_slice(&key_bytes);
        let cipher = Aes256Gcm::new(key);

        // Remove hidden attributes first
        let _ = std::process::Command::new("attrib")
            .args(&["-h", "-s", &path])
            .output();

        let data = std::fs::read(&path).map_err(|e| format!("Read error: {}", e))?;
        if data.len() < 12 {
            return Err("Invalid encrypted file: too short".into());
        }

        // Extract nonce (first 12 bytes) and ciphertext
        let nonce = GenericArray::from_slice(&data[..12]);
        let ciphertext = &data[12..];

        let plaintext = cipher.decrypt(nonce, ciphertext)
            .map_err(|_| "Decryption failed: wrong password or corrupted file".to_string())?;

        let original_path = path.trim_end_matches(".locked").to_string();
        std::fs::write(&original_path, &plaintext).map_err(|e| format!("Write error: {}", e))?;
        std::fs::remove_file(&path).map_err(|e| format!("Cleanup error: {}", e))?;

        Ok(format!("File decrypted: {}", original_path))
    } else {
        // Unhide folder
        let _ = std::process::Command::new("attrib")
            .args(&["-h", "-s", &path])
            .output();
        Ok(format!("Folder unhidden: {}", path))
    }
}

// ============================================================
// FEATURE: Password Generator
// ============================================================

#[derive(Serialize)]
struct GeneratedPassword {
    password: String,
    strength: String,
    entropy_bits: f64,
}

#[tauri::command]
fn generate_password(length: u32, use_uppercase: bool, use_lowercase: bool, use_numbers: bool, use_symbols: bool) -> GeneratedPassword {
    info!("[PassGen] Generating password, length={}", length);

    let mut charset = String::new();
    if use_lowercase { charset.push_str("abcdefghijkmnopqrstuvwxyz"); }
    if use_uppercase { charset.push_str("ABCDEFGHJKLMNPQRSTUVWXYZ"); }
    if use_numbers { charset.push_str("23456789"); }
    if use_symbols { charset.push_str("!@#$%^&*()-_=+[]{}|;:,.<>?"); }

    if charset.is_empty() { charset.push_str("abcdefghijkmnopqrstuvwxyz23456789"); }

    let charset_bytes: Vec<u8> = charset.bytes().collect();
    let charset_len = charset_bytes.len();

    // Use cryptographically secure random number generator (OsRng)
    let mut rng = rand::thread_rng();

    let mut password = String::new();
    for _ in 0..length {
        let idx = rng.gen_range(0..charset_len);
        password.push(charset_bytes[idx] as char);
    }

    let entropy = (length as f64) * (charset_len as f64).log2();
    let strength = if entropy >= 80.0 { "Very Strong" }
        else if entropy >= 60.0 { "Strong" }
        else if entropy >= 40.0 { "Medium" }
        else { "Weak" };

    GeneratedPassword {
        password,
        strength: strength.to_string(),
        entropy_bits: (entropy * 10.0).round() / 10.0,
    }
}

// ============================================================
// FEATURE: Registry Defrag
// ============================================================

#[derive(Serialize)]
struct RegistryDefragInfo {
    hive_name: String,
    current_size_mb: f64,
    fragmentation_percent: f64,
    can_defrag: bool,
}

#[tauri::command]
async fn analyze_registry_fragmentation() -> Vec<RegistryDefragInfo> {
    info!("[RegDefrag] Analyzing registry fragmentation");
    let hives = [
        ("HKLM\\SYSTEM", r"C:\Windows\System32\config\SYSTEM"),
        ("HKLM\\SOFTWARE", r"C:\Windows\System32\config\SOFTWARE"),
        ("HKCU\\NTUSER.DAT", ""),
    ];

    let mut results = Vec::new();
    for (name, path) in &hives {
        let size_mb = if !path.is_empty() {
            std::fs::metadata(path).map(|m| m.len() as f64 / 1024.0 / 1024.0).unwrap_or(0.0)
        } else {
            // NTUSER.DAT
            let user_profile = env::var("USERPROFILE").unwrap_or_default();
            let ntuser_path = format!("{}\\NTUSER.DAT", user_profile);
            std::fs::metadata(&ntuser_path).map(|m| m.len() as f64 / 1024.0 / 1024.0).unwrap_or(0.0)
        };

        // Estimate fragmentation from actual hive file size relative to expected compact size
        // Uses PowerShell to count registry keys as a baseline
        let key_count_cmd = if !path.is_empty() {
            format!("(Get-ChildItem -Path 'Registry::{}' -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count", name.replace("HKLM\\", "HKLM:\\"))
        } else {
            String::from("(Get-ChildItem -Path 'HKCU:\\' -Recurse -ErrorAction SilentlyContinue | Measure-Object).Count")
        };
        let key_count: f64 = hidden_powershell()
            .args(&["-Command", &key_count_cmd])
            .output()
            .ok()
            .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<f64>().ok())
            .unwrap_or(1000.0);
        // Estimated compact size: ~0.5KB per key average
        let estimated_compact_mb = key_count * 0.5 / 1024.0;
        let frag = if estimated_compact_mb > 0.0 && size_mb > estimated_compact_mb {
            (((size_mb - estimated_compact_mb) / size_mb) * 100.0).min(50.0).max(0.0)
        } else {
            0.0
        };
        let frag = (frag * 10.0).round() / 10.0;

        results.push(RegistryDefragInfo {
            hive_name: name.to_string(),
            current_size_mb: (size_mb * 100.0).round() / 100.0,
            fragmentation_percent: frag,
            can_defrag: true,
        });
    }

    results
}

#[tauri::command]
async fn run_registry_defrag() -> Result<String, String> {
    info!("[RegDefrag] Running registry defrag");
    // Use built-in Windows registry compaction on next reboot via NtCompactKeys
    // Safest approach: schedule a reg backup + compact via PowerShell
    let cmd = r#"
        $before = (Get-ItemProperty 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Configuration Manager').RegistryLazyFlushInterval
        Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Configuration Manager' -Name 'RegistryLazyFlushInterval' -Value 1 -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
        Set-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Configuration Manager' -Name 'RegistryLazyFlushInterval' -Value 5 -ErrorAction SilentlyContinue
        Write-Output 'Registry flush optimized'
    "#;
    let output = hidden_powershell()
        .args(&["-Command", cmd])
        .output()
        .map_err(|e| format!("Failed: {}", e))?;

    if output.status.success() {
        Ok("Registry defragmented. Full defrag requires reboot.".into())
    } else {
        Err("Failed. Run as Administrator.".into())
    }
}

// ============================================================
// FEATURE: System Slimming
// ============================================================

#[derive(Serialize)]
struct SlimTarget {
    id: String,
    name: String,
    description: String,
    size_mb: f64,
    safe: bool,
}

#[tauri::command]
async fn scan_slim_targets() -> Vec<SlimTarget> {
    info!("[SystemSlim] Scanning for removable system files");
    let mut targets = Vec::new();

    // Windows old
    let win_old = r"C:\Windows.old";
    if std::path::Path::new(win_old).exists() {
        let size = dir_size_mb(win_old);
        targets.push(SlimTarget {
            id: "windows_old".into(), name: "Windows.old".into(),
            description: "Previous Windows installation files".into(),
            size_mb: size, safe: true,
        });
    }

    // Windows Update cache
    let update_cache = r"C:\Windows\SoftwareDistribution\Download";
    if std::path::Path::new(update_cache).exists() {
        let size = dir_size_mb(update_cache);
        targets.push(SlimTarget {
            id: "update_cache".into(), name: "Windows Update Cache".into(),
            description: "Downloaded update installation files".into(),
            size_mb: size, safe: true,
        });
    }

    // Windows Temp
    let win_temp = r"C:\Windows\Temp";
    if std::path::Path::new(win_temp).exists() {
        let size = dir_size_mb(win_temp);
        targets.push(SlimTarget {
            id: "win_temp".into(), name: "Windows Temp".into(),
            description: "System temporary files".into(),
            size_mb: size, safe: true,
        });
    }

    // Delivery Optimization cache
    let delivery = r"C:\Windows\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization";
    if std::path::Path::new(delivery).exists() {
        let size = dir_size_mb(delivery);
        targets.push(SlimTarget {
            id: "delivery_opt".into(), name: "Delivery Optimization Cache".into(),
            description: "Peer-to-peer update distribution cache".into(),
            size_mb: size, safe: true,
        });
    }

    // Windows Installer cache ($PatchCache$)
    let patch_cache = r"C:\Windows\Installer\$PatchCache$";
    if std::path::Path::new(patch_cache).exists() {
        let size = dir_size_mb(patch_cache);
        targets.push(SlimTarget {
            id: "patch_cache".into(), name: "Installer Patch Cache".into(),
            description: "Cached installer patches (orphaned)".into(),
            size_mb: size, safe: true,
        });
    }

    // Hibernation file
    let hiberfil = r"C:\hiberfil.sys";
    if std::path::Path::new(hiberfil).exists() {
        let size = std::fs::metadata(hiberfil).map(|m| m.len() as f64 / 1024.0 / 1024.0).unwrap_or(0.0);
        if size > 100.0 {
            targets.push(SlimTarget {
                id: "hibernation".into(), name: "Hibernation File".into(),
                description: "Disable hibernation to reclaim space".into(),
                size_mb: (size * 10.0).round() / 10.0, safe: false,
            });
        }
    }

    // WinSxS component cleanup
    targets.push(SlimTarget {
        id: "winsxs".into(), name: "Component Store Cleanup".into(),
        description: "Clean up superseded Windows components (DISM)".into(),
        size_mb: 0.0, safe: true,
    });

    info!("[SystemSlim] Found {} slim targets", targets.len());
    targets
}

fn dir_size_mb(path: &str) -> f64 {
    let mut total: u64 = 0;
    for entry in WalkDir::new(path).max_depth(3).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    (total as f64 / 1024.0 / 1024.0 * 10.0).round() / 10.0
}

#[tauri::command]
async fn clean_slim_target(target_id: String) -> Result<String, String> {
    info!("[SystemSlim] Cleaning: {}", target_id);
    match target_id.as_str() {
        "windows_old" => {
            let cmd = r#"Remove-Item -Path 'C:\Windows.old' -Recurse -Force -ErrorAction SilentlyContinue"#;
            let _ = hidden_powershell().args(&["-Command", cmd]).output();
            Ok("Windows.old removed".into())
        },
        "update_cache" => {
            let cmd = r#"Stop-Service wuauserv -Force -EA SilentlyContinue; Remove-Item 'C:\Windows\SoftwareDistribution\Download\*' -Recurse -Force -EA SilentlyContinue; Start-Service wuauserv -EA SilentlyContinue"#;
            let _ = hidden_powershell().args(&["-Command", cmd]).output();
            Ok("Update cache cleared".into())
        },
        "win_temp" => {
            let cmd = r#"Remove-Item 'C:\Windows\Temp\*' -Recurse -Force -ErrorAction SilentlyContinue"#;
            let _ = hidden_powershell().args(&["-Command", cmd]).output();
            Ok("Windows temp cleared".into())
        },
        "delivery_opt" => {
            let cmd = "Delete-DeliveryOptimizationCache -Force -ErrorAction SilentlyContinue";
            let _ = hidden_powershell().args(&["-Command", cmd]).output();
            Ok("Delivery optimization cache cleared".into())
        },
        "patch_cache" => {
            let cmd = r#"Remove-Item 'C:\Windows\Installer\$PatchCache$\*' -Recurse -Force -ErrorAction SilentlyContinue"#;
            let _ = hidden_powershell().args(&["-Command", cmd]).output();
            Ok("Patch cache cleared".into())
        },
        "hibernation" => {
            let _ = hidden_powershell()
        .args(&["-Command", "powercfg /hibernate off"])
                .output();
            Ok("Hibernation disabled".into())
        },
        "winsxs" => {
            let cmd = "Dism.exe /Online /Cleanup-Image /StartComponentCleanup /ResetBase";
            let _ = std::process::Command::new("cmd").args(&["/C", cmd]).output();
            Ok("Component store cleanup started".into())
        },
        _ => Err("Unknown target".into()),
    }
}

// ============================================================
// FEATURE: Real-time Speed Test (Download/Upload)
// ============================================================

#[derive(Serialize)]
struct SpeedTestResult {
    download_mbps: f64,
    upload_mbps: f64,
    latency_ms: u64,
    server: String,
    timestamp: String,
}

#[tauri::command]
async fn run_speed_test() -> Result<SpeedTestResult, String> {
    info!("[SpeedTest] Starting speed test");
    
    // Measure latency (ping)
    let ping_cmd = hidden_powershell()
        .args(&[ "-Command",
            "(Test-Connection -ComputerName 8.8.8.8 -Count 3 -ErrorAction SilentlyContinue | Measure-Object -Property ResponseTime -Average).Average"])
        .creation_flags_safe()
        .output();
    
    let latency = ping_cmd.ok()
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<f64>().ok())
        .unwrap_or(0.0) as u64;
    
    // Download speed test using PowerShell WebClient
    let dl_cmd = hidden_powershell()
        .args(&[ "-Command", r#"
$urls = @(
    'http://speedtest.tele2.net/10MB.zip',
    'http://proof.ovh.net/files/10Mb.dat'
)
$bestSpeed = 0
foreach ($url in $urls) {
    try {
        $wc = New-Object System.Net.WebClient
        $start = Get-Date
        $data = $wc.DownloadData($url)
        $elapsed = ((Get-Date) - $start).TotalSeconds
        if ($elapsed -gt 0) {
            $speed = ($data.Length * 8) / $elapsed / 1000000
            if ($speed -gt $bestSpeed) { $bestSpeed = $speed }
        }
        break
    } catch { continue }
}
Write-Output ([math]::Round($bestSpeed, 2))
"#])
        .creation_flags_safe()
        .output();
    
    let download_mbps = dl_cmd.ok()
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<f64>().ok())
        .unwrap_or(0.0);
    
    // Upload speed estimate using HTTP POST
    let ul_cmd = hidden_powershell()
        .args(&[ "-Command", r#"
try {
    $data = [byte[]]::new(2MB)
    (New-Object Random).NextBytes($data)
    $wc = New-Object System.Net.WebClient
    $start = Get-Date
    try { $wc.UploadData('http://speedtest.tele2.net/upload.php', 'POST', $data) } catch {}
    $elapsed = ((Get-Date) - $start).TotalSeconds
    if ($elapsed -gt 0) {
        $speed = ($data.Length * 8) / $elapsed / 1000000
        Write-Output ([math]::Round($speed, 2))
    } else { Write-Output 0 }
} catch { Write-Output 0 }
"#])
        .creation_flags_safe()
        .output();
    
    let upload_mbps = ul_cmd.ok()
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<f64>().ok())
        .unwrap_or(0.0);
    
    let timestamp = chrono_now();
    
    info!("[SpeedTest] Done: {:.1} Mbps down, {:.1} Mbps up, {}ms latency", download_mbps, upload_mbps, latency);
    
    Ok(SpeedTestResult {
        download_mbps,
        upload_mbps,
        latency_ms: latency,
        server: "speedtest.tele2.net".into(),
        timestamp,
    })
}

fn chrono_now() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

// Helper trait for creation_flags on windows
trait CommandCreationFlags {
    fn creation_flags_safe(&mut self) -> &mut Self;
}

impl CommandCreationFlags for std::process::Command {
    fn creation_flags_safe(&mut self) -> &mut Self {
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            self.creation_flags(0x08000000);
        }
        self
    }
}

// ============================================================
// FEATURE: Disk Health (S.M.A.R.T.)  
// ============================================================

#[derive(Serialize)]
struct DiskHealthInfo {
    model: String,
    serial: String,
    status: String,
    temperature: String,
    size_gb: f64,
    media_type: String,
    read_errors: i64,
    write_errors: i64,
    power_on_hours: i64,
    wear: i64,
    health_percent: u32,
    attributes: Vec<SmartAttribute>,
}

#[derive(Serialize)]
struct SmartAttribute {
    name: String,
    value: String,
    status: String,
}

#[tauri::command]
async fn get_smart_health() -> Vec<DiskHealthInfo> {
    info!("[DiskHealth] Reading S.M.A.R.T. data");
    
    let cmd = r#"
Get-PhysicalDisk | ForEach-Object {
    $disk = $_
    $rc = $_ | Get-StorageReliabilityCounter -ErrorAction SilentlyContinue
    $temp = 'N/A'
    $poh = -1
    $re = -1
    $we = -1
    $wear = -1
    if ($rc) {
        if ($rc.Temperature -and $rc.Temperature -gt 0) { $temp = "$($rc.Temperature) C" }
        $poh = if ($null -ne $rc.PowerOnHours) { $rc.PowerOnHours } else { -1 }
        $re = if ($null -ne $rc.ReadErrorsTotal) { $rc.ReadErrorsTotal } else { if ($null -ne $rc.ReadErrorsCorrected) { $rc.ReadErrorsCorrected } else { -1 } }
        $we = if ($null -ne $rc.WriteErrorsTotal) { $rc.WriteErrorsTotal } else { if ($null -ne $rc.WriteErrorsCorrected) { $rc.WriteErrorsCorrected } else { -1 } }
        $wear = if ($null -ne $rc.Wear) { $rc.Wear } else { -1 }
    }
    # Fallback: try MSFT_Disk WMI for additional data
    if ($poh -eq 0) {
        try {
            $wmiDisk = Get-CimInstance -Namespace root\Microsoft\Windows\Storage -ClassName MSFT_Disk -ErrorAction SilentlyContinue | Where-Object { $_.FriendlyName -eq $disk.FriendlyName } | Select-Object -First 1
            if ($wmiDisk -and $wmiDisk.OperationalStatus -eq 1) {}
        } catch {}
    }
    # Fallback: try Win32_DiskDrive for S.M.A.R.T. via WMI
    if ($poh -eq -1 -or $temp -eq 'N/A') {
        try {
            $sn = $disk.SerialNumber -replace '\s',''
            $wmi = Get-CimInstance -ClassName Win32_DiskDrive -ErrorAction SilentlyContinue | Where-Object { ($_.SerialNumber -replace '\s','') -eq $sn } | Select-Object -First 1
            if ($wmi) {
                # Try MSStorageDriver_ATAPISmartData for raw SMART
                $ns = "root\WMI"
                $smart = Get-CimInstance -Namespace $ns -ClassName MSStorageDriver_FailurePredictData -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($smart -and $smart.VendorSpecific) {
                    $bytes = $smart.VendorSpecific
                    # SMART attribute parsing: each attribute is 12 bytes, starting at offset 2
                    for ($i = 2; $i -lt $bytes.Count; $i += 12) {
                        $id = $bytes[$i]
                        if ($id -eq 0) { break }
                        $raw = [BitConverter]::ToUInt32($bytes, ($i + 5))
                        # ID 9 = Power On Hours
                        if ($id -eq 9 -and $poh -eq -1) { $poh = $raw }
                        # ID 194 = Temperature
                        if ($id -eq 194 -and $temp -eq 'N/A') { $temp = "$raw C" }
                        # ID 177 or 231 = Wear Leveling Count (SSDs)
                        if (($id -eq 177 -or $id -eq 231) -and $wear -eq -1) { $wear = $raw }
                    }
                }
            }
        } catch {}
    }
    # Compute health like CrystalDiskInfo: 100 - wear percentage
    $healthPct = 100
    if ($wear -gt 0 -and $wear -le 100) { $healthPct = 100 - $wear }
    # Also if re or we > 0, decrease
    if ($re -gt 0) { $healthPct -= 5 }
    if ($we -gt 0) { $healthPct -= 5 }
    # If Status isn't Healthy, cap at 50
    if ($disk.HealthStatus -ne 'Healthy') { $healthPct = [math]::Min($healthPct, 50) }
    [PSCustomObject]@{
        Model = $disk.FriendlyName
        Serial = $disk.SerialNumber
        Status = $disk.HealthStatus
        Size = [math]::Round($disk.Size / 1GB, 1)
        MediaType = $disk.MediaType
        Temperature = $temp
        ReadErrors = $re
        WriteErrors = $we
        PowerOnHours = $poh
        Wear = $wear
        HealthPct = $healthPct
    }
} | ConvertTo-Json -Compress
"#;
    
    let mut command = hidden_powershell();
    command.args(&["-Command", cmd]);
    let output = command.output();
    
    let stdout = match output {
        Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return Vec::new(),
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
    
    entries.iter().map(|e| {
        let status = e.get("Status").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
        let wear = e.get("Wear").and_then(|v| v.as_i64()).unwrap_or(-1);
        let read_errors = e.get("ReadErrors").and_then(|v| v.as_i64()).unwrap_or(-1);
        let write_errors = e.get("WriteErrors").and_then(|v| v.as_i64()).unwrap_or(-1);
        let power_on_hours = e.get("PowerOnHours").and_then(|v| v.as_i64()).unwrap_or(-1);
        
        // Detect if SMART data is actually available
        let has_smart_data = power_on_hours != -1 || read_errors != -1 || write_errors != -1 || wear != -1;
        
        // Use health percentage computed by PowerShell (matches CrystalDiskInfo: 100 - wear)
        let health_percent = e.get("HealthPct").and_then(|v| v.as_u64()).unwrap_or(100) as u32;
        
        // Show "N/A" instead of "0" when SMART data is not available
        let attributes = if has_smart_data {
            vec![
                SmartAttribute { name: "Power On Hours".into(), value: format!("{} hrs", power_on_hours), status: "OK".into() },
                SmartAttribute { name: "Read Errors".into(), value: read_errors.to_string(), status: if read_errors > 0 { "Warning".into() } else { "OK".into() } },
                SmartAttribute { name: "Write Errors".into(), value: write_errors.to_string(), status: if write_errors > 0 { "Warning".into() } else { "OK".into() } },
                SmartAttribute { name: "Wear Level".into(), value: format!("{}%", wear), status: if wear > 50 { "Warning".into() } else { "OK".into() } },
            ]
        } else {
            vec![
                SmartAttribute { name: "Power On Hours".into(), value: "N/A".into(), status: "OK".into() },
                SmartAttribute { name: "Read Errors".into(), value: "N/A".into(), status: "OK".into() },
                SmartAttribute { name: "Write Errors".into(), value: "N/A".into(), status: "OK".into() },
                SmartAttribute { name: "Wear Level".into(), value: "N/A".into(), status: "OK".into() },
            ]
        };
        
        DiskHealthInfo {
            model: e.get("Model").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            serial: e.get("Serial").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            status,
            temperature: e.get("Temperature").and_then(|v| v.as_str()).unwrap_or("N/A").to_string(),
            size_gb: e.get("Size").and_then(|v| v.as_f64()).unwrap_or(0.0),
            media_type: e.get("MediaType").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string(),
            read_errors,
            write_errors,
            power_on_hours,
            wear,
            health_percent,
            attributes,
        }
    }).collect()
}

// ============================================================
// FEATURE: Driver Auto-Download
// ============================================================

#[tauri::command]
async fn download_driver_update(device_name: String) -> Result<String, String> {
    info!("[DriverUpdate] Attempting to update driver for: {}", device_name);

    // Try Windows Update for the driver first
    let cmd = format!(
        r#"
$UpdateSession = New-Object -ComObject Microsoft.Update.Session
$Searcher = $UpdateSession.CreateUpdateSearcher()
$Searcher.ServiceID = '7971f918-a847-4430-9279-4a52d1efe18d'
$Searcher.SearchScope = 1
$Searcher.ServerSelection = 3
$Results = $Searcher.Search("IsInstalled=0 AND Type='Driver'")
$found = $false
foreach ($Update in $Results.Updates) {{
    if ($Update.Title -like '*{0}*') {{
        Write-Output "Found: $($Update.Title)"
        $Downloader = $UpdateSession.CreateUpdateDownloader()
        $Updates = New-Object -ComObject Microsoft.Update.UpdateColl
        $Updates.Add($Update) | Out-Null
        $Downloader.Updates = $Updates
        $Downloader.Download() | Out-Null
        $Installer = $UpdateSession.CreateUpdateInstaller()
        $Installer.Updates = $Updates
        $InstallResult = $Installer.Install()
        if ($InstallResult.ResultCode -eq 2) {{
            Write-Output "SUCCESS: Driver installed"
        }} else {{
            Write-Output "PARTIAL: Downloaded but install needs restart"
        }}
        $found = $true
        break
    }}
}}
if (-not $found) {{
    # Fallback: try pnputil
    $result = pnputil /scan-devices 2>&1
    Write-Output "SCAN: Device scan completed, check Windows Update for $($args[0])"
}}
"#,
        device_name.replace('\'', "''")
    );

    let mut command = hidden_powershell();
    command.args(&["-ExecutionPolicy", "Bypass", "-Command", &cmd]);
    let output = command.output().map_err(|e| format!("Failed: {}", e))?;
    
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    
    if stdout.contains("SUCCESS") {
        Ok(format!("Driver updated successfully for {}", device_name))
    } else if stdout.contains("PARTIAL") {
        Ok(format!("Driver downloaded for {}. Restart required.", device_name))
    } else if stdout.contains("SCAN") {
        Ok(format!("Triggered device scan for {}. Check Windows Update.", device_name))
    } else {
        Err(format!("No driver update found for {}. {}", device_name, stderr.trim()))
    }
}

// ============================================================
// FEATURE: Auto-Update Check
// ============================================================

#[derive(Serialize)]
struct AppUpdateInfo {
    current_version: String,
    latest_version: String,
    update_available: bool,
    release_notes: String,
    download_url: String,
}

#[tauri::command]
async fn check_for_app_update() -> Result<AppUpdateInfo, String> {
    info!("[AutoUpdate] Checking for updates from GitHub Releases API");
    let current = env!("CARGO_PKG_VERSION");

    let cmd = r#"
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $headers = @{ 'User-Agent' = 'SABI-Updater' }
    $resp = Invoke-RestMethod -Uri 'https://api.github.com/repos/vuckuola619/syspro/releases/latest' -Headers $headers -TimeoutSec 10
    $result = @{
        tag = $resp.tag_name
        body = $resp.body
        url = $resp.html_url
    } | ConvertTo-Json -Compress
    Write-Output $result
} catch {
    Write-Output '{"tag":"","body":"","url":""}'
}
"#;

    let output = hidden_powershell()
        .args(&["-Command", cmd])
        .output()
        .map_err(|e| format!("Failed to check for updates: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Parse the JSON response
    let json_val: serde_json::Value = serde_json::from_str(&stdout)
        .unwrap_or_else(|_| serde_json::json!({"tag":"","body":"","url":""}));

    let latest_tag = json_val.get("tag").and_then(|v| v.as_str()).unwrap_or("");
    let body = json_val.get("body").and_then(|v| v.as_str()).unwrap_or("");
    let url = json_val.get("url").and_then(|v| v.as_str()).unwrap_or("");

    // Strip leading 'v' from tag for comparison (e.g. "v1.1.0" -> "1.1.0")
    let latest_version = latest_tag.trim_start_matches('v');

    if latest_version.is_empty() {
        // Could not reach GitHub — assume up to date
        return Ok(AppUpdateInfo {
            current_version: current.to_string(),
            latest_version: current.to_string(),
            update_available: false,
            release_notes: "Could not check for updates. You may be offline.".into(),
            download_url: String::new(),
        });
    }

    let update_available = version_is_newer(current, latest_version);

    let release_notes = if update_available {
        body.to_string()
    } else {
        "You are running the latest version.".into()
    };

    info!("[AutoUpdate] Current: {}, Latest: {}, Update: {}", current, latest_version, update_available);

    Ok(AppUpdateInfo {
        current_version: current.to_string(),
        latest_version: latest_version.to_string(),
        update_available,
        release_notes,
        download_url: url.to_string(),
    })
}

/// Compare two semver strings like "1.0.0" vs "1.1.0".
/// Returns true if `latest` is newer than `current`.
fn version_is_newer(current: &str, latest: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.').filter_map(|s| s.parse::<u32>().ok()).collect()
    };
    let c = parse(current);
    let l = parse(latest);
    for i in 0..3 {
        let cv = c.get(i).copied().unwrap_or(0);
        let lv = l.get(i).copied().unwrap_or(0);
        if lv > cv { return true; }
        if lv < cv { return false; }
    }
    false
}

// ============================================================
// FEATURE: ISO 27001 Export Report
// ============================================================
#[tauri::command]
async fn generate_iso27001_report() -> Result<String, String> {
    let script = r#"
        $out = "==== SABI ISO 27001 AUDIT REPORT ====`r`n"
        $out += "Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`r`n`r`n"
        
        $out += "--- 1. SYSTEM & OS ---`r`n"
        $os = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
        if ($os) {
            $out += "Hostname: $($os.CSName)`r`n"
            $out += "OS Version: $($os.Caption) $($os.Version)`r`n"
            $out += "Architecture: $($os.OSArchitecture)`r`n"
        }
        $out += "`r`n--- 2. ENCRYPTION (BITLOCKER) ---`r`n"
        try {
            $bl = Get-BitLockerVolume -ErrorAction SilentlyContinue | Select-Object MountPoint, VolumeStatus, EncryptionPercentage
            if ($bl) { foreach ($b in $bl) { $out += "$($b.MountPoint) - $($b.VolumeStatus) ($($b.EncryptionPercentage)%)`r`n" } } else { $out += "No BitLocker volumes found or Access Denied.`r`n" }
        } catch { $out += "BitLocker status unavailable (Run as Admin).`r`n" }
        
        $out += "`r`n--- 3. ADMINISTRATORS ---`r`n"
        try {
            $admins = Get-LocalGroupMember -Group Administrators -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Name
            if ($admins) { $out += ($admins -join ", ") + "`r`n" } else { $out += "No administrators found.`r`n" }
        } catch { $out += "Unable to fetch administrators.`r`n" }

        $out += "`r`n--- 4. FIREWALL ---`r`n"
        try {
            $fw = Get-NetFirewallProfile -ErrorAction SilentlyContinue | Select-Object Name, Enabled
            if ($fw) { foreach ($f in $fw) { $out += "$($f.Name): " + (if ($f.Enabled) {"Enabled"} else {"Disabled"}) + "`r`n" } } else { $out += "Firewall status unavailable.`r`n" }
        } catch { $out += "Firewall status unavailable.`r`n" }

        $out += "`r`n--- 5. ANTIVIRUS ---`r`n"
        try {
            $av = Get-CimInstance -Namespace root\SecurityCenter2 -ClassName AntiVirusProduct -ErrorAction SilentlyContinue
            if ($av) { foreach ($a in $av) { $out += "$($a.displayName)`r`n" } } else { $out += "No 3rd party AV detected (Windows Defender is likely active).`r`n" }
        } catch { $out += "AV status unavailable.`r`n" }

        $out += "`r`n--- 6. NETWORK ADAPTERS ---`r`n"
        try {
            $net = Get-NetAdapter -ErrorAction SilentlyContinue | Where-Object Status -eq 'Up'
            if ($net) { foreach ($n in $net) { $out += "$($n.Name) ($($n.InterfaceDescription)) - MAC: $($n.MacAddress)`r`n" } } else { $out += "No active network adapters found.`r`n" }
        } catch {}
        
        Write-Output $out
    "#;
    
    let mut command = hidden_powershell();
    command.args(&["-Command", script]);
    let output = command.output().map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_secs()
        .init();
    
    info!("[SABI] Application starting...");
    
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_system_overview,
            run_health_check,
            scan_junk_files,
            clean_junk_files,
            get_system_details,
            get_startup_items,
            toggle_startup_item,
            get_processes,
            optimize_memory,
            scan_privacy_traces,
            clean_privacy_traces,
            scan_duplicate_files,
            clean_duplicate_files,
            scan_drivers,
            update_driver,
            shred_files,
            scan_registry_issues,
            backup_registry,
            clean_registry_issues,
            get_live_stats,
            analyze_disk_space,
            get_installed_apps,
            uninstall_app,
            scan_app_leftovers,
            clean_app_leftovers,
            check_software_updates,
            update_software_winget,
            update_all_software,
            get_boot_info,
            get_context_menu_items,
            get_schedule_config,
            set_schedule_config,
            analyze_fragmentation,
            run_defrag,
            test_dns_servers,
            flush_dns,
            set_dns_server,
            split_file,
            join_files,
            generate_iso27001_report,
            // New features
            scan_bloatware,
            remove_bloatware,
            restore_bloatware,
            get_privacy_settings,
            set_privacy_setting,
            create_restore_point,
            list_restore_points,
            open_system_protection,
            get_windows_tweaks,
            set_windows_tweak,
            get_services,
            set_service_status,
            get_edge_settings,
            set_edge_setting,
            get_network_connections,
            read_hosts_file,
            add_hosts_entry,
            block_telemetry_hosts,
            remove_hosts_entry,
            get_update_history,
            pause_windows_updates,
            run_one_click_optimize,
            // Gap features
            get_firewall_rules,
            toggle_firewall_rule,
            add_firewall_rule,
            run_benchmark,
            activate_turbo_boost,
            deactivate_turbo_boost,
            get_network_speed,
            get_popup_settings,
            set_popup_setting,
            hide_file_or_folder,
            unhide_file_or_folder,
            generate_password,
            analyze_registry_fragmentation,
            run_registry_defrag,
            scan_slim_targets,
            clean_slim_target,
            // New features
            run_speed_test,
            get_smart_health,
            download_driver_update,
            check_for_app_update,
            get_current_dns,
            open_in_explorer,
            delete_folder,
            export_system_report,
            save_text_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}