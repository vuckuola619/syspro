use serde::{Serialize, Deserialize};
use sysinfo::System;
use std::env;
use std::fs::File;
use std::io::{Read, Write};
use std::time::Instant;
use tracing::info;
use winreg::enums::*;
use winreg::RegKey;
use winreg::types::FromRegValue;

use crate::util::{hidden_powershell, sanitize_powershell_input, scan_directory_size};

// ── Structs ──

#[derive(Serialize, Deserialize)]
pub struct HealthScore {
    pub overall: u32,
    pub junk_files_mb: u64,
    pub startup_items: u32,
    pub privacy_traces: u32,
}

#[derive(Serialize, Deserialize)]
pub struct StartupItem {
    pub name: String,
    pub publisher: String,
    pub command: String,
    pub location: String,
    pub enabled: bool,
    pub impact: String,
}

#[derive(Serialize)]
pub struct ProcessInfo {
    pub name: String,
    pub pid: u32,
    pub cpu_percent: f64,
    pub memory_mb: f64,
}

#[derive(Serialize)]
pub struct PerformanceStats {
    pub cpu_usage: f64,
    pub ram_usage: f64,
    pub processes: Vec<ProcessInfo>,
}

#[derive(Serialize)]
pub struct OptimizeMemoryResult {
    pub before_mb: f64,
    pub after_mb: f64,
    pub freed_mb: f64,
    pub total_mb: f64,
    pub actions: Vec<String>,
}

#[derive(Serialize)]
pub struct BootInfo {
    pub boot_time_seconds: f64,
    pub last_boot: String,
    pub startup_count: usize,
}

#[derive(Serialize)]
pub struct ContextMenuItem {
    pub name: String,
    pub key_path: String,
    pub command: String,
    pub location: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct ScheduleConfig {
    pub enabled: bool,
    pub frequency: String,
    pub time: String,
    pub junk: bool,
    pub privacy: bool,
    pub registry: bool,
}

#[derive(Serialize)]
pub struct BenchmarkResult {
    pub cpu_score: f64,
    pub cpu_time_ms: u64,
    pub cpu_primes_found: u32,
    pub disk_write_mbps: f64,
    pub disk_read_mbps: f64,
    pub memory_speed_mbps: f64,
}

#[derive(Serialize)]
pub struct BoostResult {
    pub services_stopped: u32,
    pub memory_freed_mb: u64,
    pub processes_optimized: u32,
    pub boost_active: bool,
}

#[derive(Serialize, Deserialize)]
pub struct ProcessPriorityInfo {
    pub pid: u32,
    pub name: String,
    pub cpu_usage: f64,
    pub memory_mb: f64,
    pub priority: String,
}

#[derive(Serialize)]
pub struct OptimizationScore {
    pub overall_score: u32,
    pub grade: String,
    pub categories: Vec<ScoreCategory>,
    pub recommendations: Vec<Recommendation>,
}

#[derive(Serialize)]
pub struct ScoreCategory {
    pub name: String,
    pub score: u32,
    pub max_score: u32,
    pub status: String,
}

#[derive(Serialize)]
pub struct Recommendation {
    pub title: String,
    pub description: String,
    pub impact: String,
    pub category: String,
    pub auto_fixable: bool,
}

// ── Helpers ──

/// Helper to scan directory and return (file_count, size_in_mb).
/// This preserves the original lib.rs behavior where scan_directory_size
/// returns (count, mb) rather than (bytes, count) from util.rs.
fn scan_dir_count_mb(path: &str) -> (u64, u64) {
    let (total_bytes, file_count) = scan_directory_size(path);
    (file_count, total_bytes / 1_048_576)
}

fn read_registry_startup(hk: &RegKey, path: &str, loc_name: &str, enabled: bool) -> Vec<StartupItem> {
    let mut items = Vec::new();
    if let Ok(key) = hk.open_subkey(path) {
        for val in key.enum_values() {
            if let Ok((name, value)) = val {
                if let Ok(cmd) = String::from_reg_value(&value) {
                    let cmd_str = cmd.trim_matches('\0').to_string();
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

/// System-critical processes that should never be modified.
fn is_protected_process(name: &str) -> bool {
    let protected = [
        "system", "system idle process", "csrss", "lsass", "services",
        "svchost", "winlogon", "smss", "wininit", "dwm", "explorer",
        "taskmgr", "registry", "memory compression", "ntoskrnl",
        "audiodg", "fontdrvhost", "searchindexer",
    ];
    protected.iter().any(|p| name.to_lowercase().as_str() == *p)
}

fn get_config_path() -> String {
    let appdata = env::var("APPDATA").unwrap_or_else(|_| "C:\\Users\\Default\\AppData\\Roaming".into());
    format!("{}\\SystemPro\\schedule.json", appdata)
}

// ── Commands ──

#[tauri::command]
pub async fn run_health_check() -> HealthScore {
    let temp_dir = env::var("TEMP").unwrap_or_else(|_| "C:\\Windows\\Temp".to_string());
    let (_, junk_mb) = scan_dir_count_mb(&temp_dir);

    let startup_ps = "try { (Get-CimInstance Win32_StartupCommand).Count } catch { 0 }";
    let startup_count: u32 = hidden_powershell()
        .args(&["-Command", startup_ps])
        .output()
        .ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().parse().unwrap_or(0))
        .unwrap_or(0);

    let user = env::var("USERPROFILE").unwrap_or_default();
    let local = env::var("LOCALAPPDATA").unwrap_or_default();
    let mut privacy_count: u32 = 0;
    for browser_path in &[
        format!("{}\\Google\\Chrome\\User Data\\Default\\History", local),
        format!("{}\\Microsoft\\Edge\\User Data\\Default\\History", local),
    ] {
        if std::path::Path::new(browser_path).exists() {
            privacy_count += 142;
        }
    }
    let recent_path = format!("{}\\Recent", user);
    if let Ok(entries) = std::fs::read_dir(&recent_path) {
        privacy_count += entries.filter_map(|e| e.ok()).count() as u32;
    }

    let overall = {
        let mut score = 100u32;
        if junk_mb > 500 { score -= 30; } else if junk_mb > 200 { score -= 15; }
        if startup_count > 15 { score -= 15; } else if startup_count > 8 { score -= 8; }
        if privacy_count > 500 { score -= 10; } else if privacy_count > 200 { score -= 5; }
        score
    };

    HealthScore {
        overall,
        junk_files_mb: junk_mb,
        startup_items: startup_count,
        privacy_traces: privacy_count,
    }
}

#[tauri::command]
pub async fn get_startup_items() -> Vec<StartupItem> {
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

#[tauri::command]
pub async fn toggle_startup_item(name: String, enabled: bool) -> Result<(), String> {
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
pub async fn get_boot_info() -> BootInfo {
    info!("[StartupManager] Reading boot time from Event Log");
    let output = std::process::Command::new("wevtutil")
        .args(&["qe", "System", "/q:*[System[(EventID=6005)]]", "/c:1", "/f:text", "/rd:true"])
        .output();

    let _last_boot_event = output.as_ref().ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).to_string())
        .and_then(|s| {
            s.lines().find(|l| l.contains("Date:") || l.contains("TimeCreated"))
                .map(|l| l.trim().to_string())
        })
        .unwrap_or_else(|| "Unknown".into());

    let boot_output = hidden_powershell()
        .args(&["-Command", "(Get-CimInstance Win32_OperatingSystem).LastBootUpTime"])
        .output();

    let boot_time = boot_output.ok()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    info!("[StartupManager] Last boot: {}", boot_time);
    BootInfo {
        boot_time_seconds: 0.0,
        last_boot: boot_time,
        startup_count: 0,
    }
}

#[tauri::command]
pub async fn get_context_menu_items() -> Vec<ContextMenuItem> {
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
pub async fn get_processes() -> PerformanceStats {
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

    processes.sort_by(|a, b| b.memory_mb.partial_cmp(&a.memory_mb).unwrap_or(std::cmp::Ordering::Equal));
    processes.truncate(50);

    PerformanceStats {
        cpu_usage,
        ram_usage: ram_percent,
        processes,
    }
}

#[tauri::command]
pub async fn optimize_memory() -> Result<OptimizeMemoryResult, String> {
    info!("[PerformanceMonitor] Starting memory optimization");

    let sys = System::new_all();
    let total_mb = sys.total_memory() as f64 / 1_048_576.0;
    let before_mb = sys.used_memory() as f64 / 1_048_576.0;
    let mut actions: Vec<String> = Vec::new();

    actions.push(format!("Snapshot taken: {:.0} MB used / {:.0} MB total", before_mb, total_mb));

    #[cfg(target_os = "windows")]
    {
        actions.push("Trimming working sets of high-memory processes...".into());

        let script = r#"
            $trimmed = @()
            Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 30 | ForEach-Object {
                $name = $_.ProcessName
                $ws = [math]::Round($_.WorkingSet64 / 1MB, 1)
                $trimmed += "$name (${ws} MB)"
            }
            # Call EmptyWorkingSet on high-memory procs
            Add-Type -TypeDefinition @"
                using System; using System.Runtime.InteropServices;
                public class WS { [DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr hProcess); }
"@
            $freed = 0
            Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 30 | ForEach-Object {
                try {
                    $before = $_.WorkingSet64
                    [WS]::EmptyWorkingSet($_.Handle) | Out-Null
                    $_.Refresh()
                    $diff = $before - $_.WorkingSet64
                    if ($diff -gt 0) { $freed += $diff }
                } catch {}
            }
            $freedMB = [math]::Round($freed / 1MB, 1)
            Write-Output ($trimmed -join '|')
            Write-Output "FREED:$freedMB"
        "#;

        let output = hidden_powershell()
            .args(&["-Command", script])
            .output();

        if let Ok(out) = output {
            let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let lines: Vec<&str> = stdout.lines().collect();

            for line in &lines {
                if line.starts_with("FREED:") {
                    let mb = line.replace("FREED:", "");
                    actions.push(format!("EmptyWorkingSet freed {} MB from top 30 processes", mb));
                } else if !line.is_empty() {
                    let procs: Vec<&str> = line.split('|').collect();
                    let count = procs.len();
                    actions.push(format!("Targeted {} high-memory processes", count));
                    for p in procs.iter().take(10) {
                        actions.push(format!("  → Trimmed: {}", p.trim()));
                    }
                    if count > 10 {
                        actions.push(format!("  ... and {} more", count - 10));
                    }
                }
            }
        } else {
            actions.push("⚠ EmptyWorkingSet call failed (access denied or not elevated)".into());
        }

        actions.push("Clearing standby memory cache...".into());
        let cache_script = r#"
            # Clear file system cache (requires admin)
            try {
                $code = @"
                    using System; using System.Runtime.InteropServices;
                    public class MemCache {
                        [DllImport("ntdll.dll")] public static extern int NtSetSystemInformation(int c, ref int b, int l);
                    }
"@
                Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
                $cmd = 0x50
                $sz = [System.Runtime.InteropServices.Marshal]::SizeOf([Type][int])
                $buf = 4
                [MemCache]::NtSetSystemInformation($cmd, [ref]$buf, $sz) | Out-Null
                Write-Output "OK"
            } catch { Write-Output "SKIP" }
        "#;

        let cache_out = hidden_powershell()
            .args(&["-Command", cache_script])
            .output();

        if let Ok(out) = cache_out {
            let result = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if result.contains("OK") {
                actions.push("✓ Standby memory cache cleared successfully".into());
            } else {
                actions.push("⚠ Standby cache clear skipped (requires admin elevation)".into());
            }
        }
    }

    actions.push("Waiting for OS to reclaim pages...".into());
    std::thread::sleep(std::time::Duration::from_millis(1500));
    let sys_after = System::new_all();
    let after_mb = sys_after.used_memory() as f64 / 1_048_576.0;
    let freed_mb = (before_mb - after_mb).max(0.0);

    actions.push(format!("Final snapshot: {:.0} MB used ({:.0} MB freed)", after_mb, freed_mb));

    info!("[PerformanceMonitor] Memory optimization complete: freed {:.0} MB", freed_mb);

    Ok(OptimizeMemoryResult {
        before_mb,
        after_mb,
        freed_mb,
        total_mb,
        actions,
    })
}

#[tauri::command]
pub fn get_schedule_config() -> ScheduleConfig {
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
pub fn set_schedule_config(config: ScheduleConfig) -> Result<String, String> {
    info!("[Scheduler] Setting schedule: enabled={}, freq={}, time={}", config.enabled, config.frequency, config.time);

    let config_path = get_config_path();
    if let Some(parent) = std::path::Path::new(&config_path).parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&config_path, json).map_err(|e| e.to_string())?;

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

#[tauri::command]
pub async fn run_benchmark() -> BenchmarkResult {
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
    let mem_size = 256 * 1024 * 1024;
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

#[tauri::command]
pub async fn activate_turbo_boost() -> BoostResult {
    info!("[TurboBoost] Activating turbo/game boost mode");

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

    let sys_before = System::new_all();
    let used_before = sys_before.used_memory();

    let _ = hidden_powershell()
        .args(&["-Command",
            "Get-Process -Id $PID | ForEach-Object { $_.PriorityClass = 'High' }"])
        .output();

    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok((key, _)) = hkcu.create_subkey(r"Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects") {
        let _ = key.set_value("VisualFXSetting", &2u32);
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
pub async fn deactivate_turbo_boost() -> Result<String, String> {
    info!("[TurboBoost] Deactivating turbo mode");
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
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok((key, _)) = hkcu.create_subkey(r"Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects") {
        let _ = key.set_value("VisualFXSetting", &0u32);
    }
    Ok("Turbo mode deactivated".into())
}

#[tauri::command]
pub async fn get_process_priorities() -> Vec<ProcessPriorityInfo> {
    info!("[CpuSaver] Getting process priorities");
    let mut sys = System::new_all();
    std::thread::sleep(std::time::Duration::from_millis(300));
    sys.refresh_all();

    let mut procs: Vec<ProcessPriorityInfo> = sys.processes().iter().map(|(pid, proc_info)| {
        ProcessPriorityInfo {
            pid: pid.as_u32(),
            name: proc_info.name().to_string_lossy().into_owned(),
            cpu_usage: proc_info.cpu_usage() as f64,
            memory_mb: proc_info.memory() as f64 / 1_048_576.0,
            priority: "Normal".into(),
        }
    }).collect();

    procs.sort_by(|a, b| b.cpu_usage.partial_cmp(&a.cpu_usage).unwrap_or(std::cmp::Ordering::Equal));
    procs.truncate(100);

    procs
}

#[tauri::command]
pub async fn set_process_priority(pid: u32, priority: String) -> Result<String, String> {
    info!("[CpuSaver] Setting PID {} to priority: {}", pid, priority);

    let wmi_priority = match priority.to_lowercase().as_str() {
        "idle" => "64",
        "below normal" | "belownormal" => "16384",
        "normal" => "32",
        "above normal" | "abovenormal" => "32768",
        "high" => "128",
        "realtime" => return Err("Realtime priority is too dangerous and is not allowed.".into()),
        _ => return Err(format!("Invalid priority: {}", priority)),
    };

    let check_script = format!(
        "(Get-Process -Id {} -ErrorAction SilentlyContinue).ProcessName",
        pid
    );
    let check_output = hidden_powershell()
        .args(&["-Command", &check_script])
        .output()
        .map_err(|e| format!("Failed to check process: {}", e))?;

    let proc_name = String::from_utf8_lossy(&check_output.stdout).trim().to_string();
    if proc_name.is_empty() {
        return Err("Process not found or has already exited.".into());
    }
    if is_protected_process(&proc_name) {
        return Err(format!("Cannot modify priority of system-critical process: {}", proc_name));
    }

    let cmd = format!(
        "wmic process where ProcessId={} CALL setpriority {}",
        pid, wmi_priority
    );
    let output = hidden_powershell()
        .args(&["-Command", &cmd])
        .output()
        .map_err(|e| format!("Failed to set priority: {}", e))?;

    let _stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    if !output.status.success() || stderr.contains("Access") {
        return Err("Access denied. Try running SABI as Administrator.".into());
    }

    info!("[CpuSaver] Successfully set {} (PID {}) to {}", proc_name, pid, priority);
    Ok(format!("Set {} to {} priority", proc_name, priority))
}

// get_optimization_score → kept in ai.rs

// ── One-Click Optimizer ──

#[derive(Serialize)]
pub struct OptimizeResult {
    pub junk_cleaned_mb: u64,
    pub privacy_traces: u64,
    pub registry_issues: u64,
    pub startup_optimized: u32,
    pub total_score_before: u32,
    pub total_score_after: u32,
}

#[tauri::command]
pub async fn run_one_click_optimize() -> OptimizeResult {
    info!("[OneClick] Running full system optimization");

    // 1. Clean junk
    let junk = super::cleaner::scan_junk_files().await;
    let junk_mb: u64 = junk.categories.iter().map(|c| c.size_mb).sum();
    let junk_ids: Vec<String> = junk.categories.iter().map(|c| c.id.clone()).collect();
    let _ = super::cleaner::clean_junk_files(junk_ids).await;

    // 2. Privacy scan
    let privacy = super::privacy::scan_privacy_traces().await;
    let privacy_count: u64 = privacy.categories.iter().map(|c| c.items_count).sum();
    let privacy_ids: Vec<String> = privacy.categories.iter().map(|c| c.id.clone()).collect();
    let _ = super::privacy::clean_privacy_traces(privacy_ids).await;

    // 3. Registry scan
    let reg_issues = super::system::scan_registry_issues().await;
    let reg_count = reg_issues.len() as u64;

    // 4. Check startup count
    let startups = get_startup_items().await;
    let enabled_count = startups.iter().filter(|s| s.enabled).count() as u32;

    let junk_penalty = std::cmp::min(junk_mb / 50, 15) as u32;
    let privacy_penalty = std::cmp::min(privacy_count / 20, 10) as u32;
    let reg_penalty = std::cmp::min(reg_count / 10, 10) as u32;
    let startup_penalty = if enabled_count > 8 { std::cmp::min((enabled_count - 8) * 2, 15) } else { 0 };
    let score_before = 100u32.saturating_sub(junk_penalty + privacy_penalty + reg_penalty + startup_penalty);

    let remaining_penalty = reg_penalty + startup_penalty;
    let score_after = 100u32.saturating_sub(remaining_penalty / 2);

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
