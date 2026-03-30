use serde::{Serialize, Deserialize};
use std::path::Path;
use tracing::info;
use walkdir::WalkDir;

use crate::util::hidden_powershell;

// ── Helper trait for creation_flags on Windows ──

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

// ── Structs ──

#[derive(Serialize)]
pub struct DiskAnalysis {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub is_directory: bool,
    pub children: Vec<DiskAnalysis>,
    pub percentage: f64,
}

#[derive(Serialize)]
pub struct FragInfo {
    pub volume: String,
    pub fragmented_percent: f64,
    pub total_fragments: u64,
    pub status: String,
}

#[derive(Serialize)]
pub struct LargeFileItem {
    pub name: String,
    pub path: String,
    pub size_mb: f64,
    pub size_bytes: u64,
    pub extension: String,
    pub category: String,
    pub modified: String,
}

#[derive(Serialize)]
pub struct EmptyFolderItem {
    pub path: String,
    pub name: String,
    pub parent: String,
}

#[derive(Serialize, Deserialize)]
pub struct SmartAttribute {
    pub name: String,
    pub value: String,
    pub status: String,
}

#[derive(Serialize, Deserialize)]
pub struct DiskHealthInfo {
    pub model: String,
    pub serial: String,
    pub status: String,
    pub temperature: i64,
    pub size_gb: f64,
    pub media_type: String,
    pub read_errors: i64,
    pub write_errors: i64,
    pub power_on_hours: i64,
    pub wear: i64,
    pub health_percent: u32,
    pub attributes: Vec<SmartAttribute>,
}

#[derive(Serialize)]
pub struct RecycleBinItem {
    pub name: String,
    pub original_path: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub deleted_date: String,
    pub item_type: String,
}

// ── Helpers ──

fn format_size(bytes: u64) -> String {
    if bytes >= 1_073_741_824 { format!("{:.1} GB", bytes as f64 / 1_073_741_824.0) }
    else if bytes >= 1_048_576 { format!("{:.1} MB", bytes as f64 / 1_048_576.0) }
    else if bytes >= 1024 { format!("{:.1} KB", bytes as f64 / 1024.0) }
    else { format!("{} B", bytes) }
}

fn categorize_file(ext: &str) -> String {
    match ext.to_lowercase().as_str() {
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "webm" => "Video".into(),
        "iso" | "img" | "vhd" | "vhdx" | "vmdk" => "Disk Image".into(),
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" => "Archive".into(),
        "log" | "txt" | "csv" | "bak" | "old" | "tmp" => "Log / Temp".into(),
        "exe" | "msi" | "msix" | "appx" => "Installer".into(),
        "dll" | "sys" | "ocx" => "System".into(),
        "psd" | "ai" | "indd" | "raw" | "cr2" | "nef" => "Design / RAW".into(),
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" => "Audio".into(),
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" => "Document".into(),
        _ => "Other".into(),
    }
}

fn is_protected_folder(path: &Path) -> bool {
    let s = path.to_string_lossy().to_lowercase();
    let protected = [
        "\\windows", "\\program files", "\\program files (x86)",
        "\\programdata", "\\$recycle.bin", "\\system volume information",
        "\\recovery", "\\boot", "\\.git", "\\node_modules",
        "\\appdata\\local\\packages",
    ];
    protected.iter().any(|p| s.contains(p))
}

fn is_truly_empty(path: &Path) -> bool {
    match std::fs::read_dir(path) {
        Ok(mut entries) => entries.next().is_none(),
        Err(_) => false,
    }
}

// ── Commands: Disk Analyzer ──

#[tauri::command]
pub async fn analyze_disk_space(path: String) -> Result<DiskAnalysis, String> {
    info!("[DiskAnalyzer] Analyzing: {}", path);

    let root = Path::new(&path);
    if !root.exists() {
        return Err("Path does not exist".into());
    }

    fn scan_dir(dir: &Path, depth: u32) -> DiskAnalysis {
        let mut total_size: u64 = 0;
        let mut children = Vec::new();

        if depth > 3 { // Limit recursion depth for performance
            // Just calculate total size without children
            for entry in WalkDir::new(dir).max_depth(5).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    total_size += entry.metadata().map(|m| m.len()).unwrap_or(0);
                }
            }
        } else if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if let Ok(meta) = std::fs::metadata(&path) {
                    if meta.is_file() {
                        let size = meta.len();
                        total_size += size;
                    } else if meta.is_dir() {
                        let child = scan_dir(&path, depth + 1);
                        total_size += child.size_bytes;
                        children.push(child);
                    }
                }
            }
        }

        // Sort children by size descending
        children.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
        children.truncate(20); // Keep top 20

        // Calculate percentages
        if total_size > 0 {
            for child in &mut children {
                child.percentage = child.size_bytes as f64 / total_size as f64 * 100.0;
            }
        }

        DiskAnalysis {
            name: dir.file_name().unwrap_or_default().to_string_lossy().to_string(),
            path: dir.to_string_lossy().to_string(),
            size_bytes: total_size,
            size_display: format_size_inline(total_size),
            is_directory: true,
            percentage: 100.0,
            children,
        }
    }

    fn format_size_inline(bytes: u64) -> String {
        if bytes >= 1_073_741_824 { format!("{:.1} GB", bytes as f64 / 1_073_741_824.0) }
        else if bytes >= 1_048_576 { format!("{:.1} MB", bytes as f64 / 1_048_576.0) }
        else { format!("{:.1} KB", bytes as f64 / 1024.0) }
    }

    Ok(scan_dir(root, 0))
}

// ── Commands: Defragmentation ──

#[tauri::command]
pub async fn analyze_fragmentation() -> Result<Vec<FragInfo>, String> {
    info!("[Defrag] Analyzing fragmentation");

    let cmd = r#"
Get-Volume | Where-Object {$_.DriveLetter -and $_.DriveType -eq 'Fixed'} | ForEach-Object {
    $vol = $_.DriveLetter + ':'
    try {
        $result = Optimize-Volume -DriveLetter $_.DriveLetter -Analyze -Verbose 4>&1 2>&1
        $pct = 0
        foreach ($line in $result) {
            if ($line -match '(\d+)%') { $pct = [int]$Matches[1] }
        }
        [PSCustomObject]@{ Volume=$vol; Fragmented=$pct; Status='Analyzed' }
    } catch {
        [PSCustomObject]@{ Volume=$vol; Fragmented=0; Status='Error' }
    }
} | ConvertTo-Json
"#;
    let output = hidden_powershell()
        .args(&["-Command", cmd])
        .output()
        .map_err(|e| format!("Failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    let mut results = Vec::new();

    let parse_item = |item: &serde_json::Value| -> Option<FragInfo> {
        Some(FragInfo {
            volume: item["Volume"].as_str()?.to_string(),
            fragmented_percent: item["Fragmented"].as_f64().unwrap_or(0.0),
            total_fragments: 0,
            status: item["Status"].as_str().unwrap_or("Unknown").to_string(),
        })
    };

    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&stdout) {
        if let Some(arr) = data.as_array() {
            for item in arr { if let Some(f) = parse_item(item) { results.push(f); } }
        } else {
            if let Some(f) = parse_item(&data) { results.push(f); }
        }
    }

    Ok(results)
}

#[tauri::command]
pub async fn run_defrag(drive_letter: String) -> Result<String, String> {
    info!("[Defrag] Defragmenting drive: {}", drive_letter);

    let safe_letter = drive_letter.chars().next().unwrap_or('C');
    if !safe_letter.is_ascii_alphabetic() {
        return Err("Invalid drive letter".into());
    }

    let cmd = format!("Optimize-Volume -DriveLetter {} -Defrag -Verbose 4>&1 | Out-String", safe_letter);
    let output = hidden_powershell()
        .args(&["-Command", &cmd])
        .output()
        .map_err(|e| format!("Failed: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if output.status.success() {
        Ok(format!("Defragmentation completed for {}:\n{}", safe_letter, stdout.trim()))
    } else {
        Err("Failed. Run as Administrator.".into())
    }
}

// ── Commands: Large File Finder ──

#[tauri::command]
pub async fn scan_large_files(target_dir: String, min_size_mb: u64) -> Result<Vec<LargeFileItem>, String> {
    info!("[LargeFileFinder] Scanning for files >= {} MB in {}", min_size_mb, target_dir);

    let canonical = std::fs::canonicalize(&target_dir)
        .map_err(|e| format!("Invalid path: {}", e))?;

    let min_bytes = min_size_mb * 1_048_576;
    let mut files = Vec::new();

    for entry in WalkDir::new(&canonical)
        .max_depth(10)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_file() { continue; }

        if let Ok(metadata) = entry.metadata() {
            let size = metadata.len();
            if size >= min_bytes {
                let path = entry.path();
                let ext = path.extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_string();

                let modified = metadata.modified()
                    .ok()
                    .and_then(|t| {
                        let duration = t.duration_since(std::time::UNIX_EPOCH).ok()?;
                        let secs = duration.as_secs();
                        let days = secs / 86400;
                        let years = 1970 + days / 365;
                        Some(format!("{}", years))
                    })
                    .unwrap_or_else(|| "Unknown".into());

                files.push(LargeFileItem {
                    name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                    path: path.to_string_lossy().to_string(),
                    size_mb: size as f64 / 1_048_576.0,
                    size_bytes: size,
                    extension: ext.clone(),
                    category: categorize_file(&ext),
                    modified,
                });
            }
        }
    }

    files.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    files.truncate(200);

    info!("[LargeFileFinder] Found {} large files", files.len());
    Ok(files)
}

#[tauri::command]
pub async fn delete_file(file_path: String) -> Result<String, String> {
    info!("[LargeFileFinder] Deleting file: {}", file_path);

    let path = Path::new(&file_path);
    if !path.exists() { return Err("File not found".into()); }
    if !path.is_file() { return Err("Path is not a file".into()); }

    let canonical = std::fs::canonicalize(path)
        .map_err(|e| format!("Invalid path: {}", e))?;
    let canonical_str = canonical.to_string_lossy().to_lowercase();
    if canonical_str.contains("\\windows\\") || canonical_str.contains("\\program files") {
        return Err("Cannot delete system files".into());
    }

    let size = std::fs::metadata(&canonical).map(|m| m.len()).unwrap_or(0);
    std::fs::remove_file(&canonical).map_err(|e| format!("Failed to delete: {}", e))?;

    let freed_mb = size as f64 / 1_048_576.0;
    Ok(format!("Deleted. Freed {:.1} MB", freed_mb))
}

// ── Commands: Empty Folder Scanner ──

#[tauri::command]
pub async fn scan_empty_folders(target_dir: String) -> Result<Vec<EmptyFolderItem>, String> {
    info!("[EmptyFolderScanner] Scanning for empty folders in {}", target_dir);

    let canonical = std::fs::canonicalize(&target_dir)
        .map_err(|e| format!("Invalid path: {}", e))?;

    let mut empties = Vec::new();

    for entry in WalkDir::new(&canonical)
        .max_depth(10)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_dir() { continue; }
        if path == canonical { continue; }
        if is_protected_folder(path) { continue; }

        #[cfg(windows)]
        {
            if let Ok(meta) = std::fs::metadata(path) {
                use std::os::windows::fs::MetadataExt;
                let attrs = meta.file_attributes();
                if attrs & 0x2 != 0 || attrs & 0x4 != 0 { continue; }
            }
        }

        if is_truly_empty(path) {
            empties.push(EmptyFolderItem {
                path: path.to_string_lossy().to_string(),
                name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                parent: path.parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default(),
            });
        }
    }

    info!("[EmptyFolderScanner] Found {} empty folders", empties.len());
    Ok(empties)
}

#[tauri::command]
pub async fn clean_empty_folders(paths: Vec<String>) -> Result<u32, String> {
    info!("[EmptyFolderScanner] Cleaning {} empty folders", paths.len());
    let mut deleted = 0u32;

    for folder_path in &paths {
        let path = Path::new(folder_path);
        if !path.exists() || !path.is_dir() { continue; }
        if is_protected_folder(path) { continue; }
        if !is_truly_empty(path) { continue; }
        if std::fs::remove_dir(path).is_ok() { deleted += 1; }
    }

    info!("[EmptyFolderScanner] Deleted {} empty folders", deleted);
    Ok(deleted)
}

// ── Commands: Disk Health (SMART) ──

#[tauri::command]
pub async fn get_smart_health() -> Vec<DiskHealthInfo> {
    info!("[DiskHealth] Getting SMART data");

    // Try smartctl first
    let smartctl_paths = ["smartctl", "C:\\Program Files\\smartmontools\\bin\\smartctl.exe"];
    let mut smartctl_cmd = None;
    for path in &smartctl_paths {
        let test = std::process::Command::new(path)
            .args(&["--version"])
            .creation_flags_safe()
            .output();
        if test.is_ok() {
            smartctl_cmd = Some(path.to_string());
            break;
        }
    }

    if let Some(cmd_path) = smartctl_cmd {
        return get_smart_via_smartctl(&cmd_path);
    }

    // Fallback: PowerShell / WMI
    get_smart_via_wmi()
}

fn get_smart_via_smartctl(cmd_path: &str) -> Vec<DiskHealthInfo> {
    let scan_output = std::process::Command::new(cmd_path)
        .args(&["--scan", "-j"])
        .creation_flags_safe()
        .output();

    let scan_stdout = match scan_output {
        Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => return Vec::new(),
    };

    let scan_json: serde_json::Value = match serde_json::from_str(&scan_stdout) {
        Ok(v) => v, Err(_) => return Vec::new(),
    };

    let devices = match scan_json.get("devices").and_then(|d| d.as_array()) {
        Some(d) => d, None => return Vec::new(),
    };

    let mut results = Vec::new();

    for device in devices {
        let dev_name = match device.get("name").and_then(|n| n.as_str()) {
            Some(n) => n, None => continue,
        };

        let info_output = std::process::Command::new(cmd_path)
            .args(&["-a", "-j", dev_name])
            .creation_flags_safe()
            .output();

        let info_stdout = match info_output {
            Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
            Err(_) => continue,
        };

        let d: serde_json::Value = match serde_json::from_str(&info_stdout) {
            Ok(v) => v, Err(_) => continue,
        };

        let model = d.get("model_name").and_then(|v| v.as_str()).unwrap_or("Unknown").to_string();
        let serial = d.get("serial_number").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let size_bytes = d.get("user_capacity").and_then(|c| c.get("bytes")).and_then(|b| b.as_u64()).unwrap_or(0);
        let size_gb = size_bytes as f64 / 1_073_741_824.0;
        let media_type = d.get("rotation_rate").and_then(|r| r.as_u64())
            .map(|r| if r == 0 { "SSD" } else { "HDD" }.to_string())
            .unwrap_or("Unknown".into());

        let passed = d.get("smart_status").and_then(|s| s.get("passed")).and_then(|p| p.as_bool()).unwrap_or(true);
        let status = if passed { "Healthy" } else { "Warning" }.to_string();

        let temperature = d.get("temperature").and_then(|t| t.get("current")).and_then(|c| c.as_i64()).unwrap_or(0);
        let power_on_hours = d.get("power_on_time").and_then(|t| t.get("hours")).and_then(|h| h.as_i64()).unwrap_or(-1);

        let mut smart_attrs = Vec::new();
        let mut wear: i64 = 0;
        let mut read_errors: i64 = 0;
        let mut write_errors: i64 = 0;

        // ATA SMART attributes
        if let Some(table) = d.get("ata_smart_attributes").and_then(|a| a.get("table")).and_then(|t| t.as_array()) {
            for attr in table {
                let id = attr.get("id").and_then(|v| v.as_u64()).unwrap_or(0);
                let name = attr.get("name").and_then(|v| v.as_str()).unwrap_or("Unknown");
                let value_str = attr.get("value").and_then(|v| v.as_i64()).map(|v| v.to_string()).unwrap_or("?".into());
                let raw_val = attr.get("raw").and_then(|r| r.get("value")).and_then(|v| v.as_i64()).unwrap_or(0);
                let current = attr.get("value").and_then(|v| v.as_i64()).unwrap_or(100);
                let worst = attr.get("worst").and_then(|v| v.as_i64()).unwrap_or(100);
                let thresh = attr.get("thresh").and_then(|v| v.as_i64()).unwrap_or(0);

                let attr_status = if current <= thresh { "Critical" }
                    else if current <= thresh + 10 { "Warning" }
                    else { "OK" };

                if id == 1 { read_errors = raw_val; }
                if id == 196 || id == 197 { write_errors += raw_val; }
                if id == 177 || id == 231 || id == 233 {
                    wear = 100_i64.saturating_sub(current);
                }

                smart_attrs.push(SmartAttribute {
                    name: name.to_string(),
                    value: format!("{} (raw: {})", value_str, raw_val),
                    status: attr_status.to_string(),
                });
            }
        }

        // NVMe attributes fallback
        if smart_attrs.is_empty() {
            if let Some(nvme) = d.get("nvme_smart_health_information_log") {
                let pct_used = nvme.get("percentage_used").and_then(|v| v.as_i64()).unwrap_or(0);
                wear = pct_used;
                let media_errs = nvme.get("media_errors").and_then(|v| v.as_i64()).unwrap_or(0);
                read_errors = media_errs;
                smart_attrs.push(SmartAttribute { name: "Percentage Used".into(), value: format!("{}%", pct_used), status: if pct_used > 80 { "Warning".into() } else { "OK".into() } });
                smart_attrs.push(SmartAttribute { name: "Media Errors".into(), value: media_errs.to_string(), status: if media_errs > 0 { "Warning".into() } else { "OK".into() } });
                if let Some(avail) = nvme.get("available_spare").and_then(|v| v.as_i64()) {
                    smart_attrs.push(SmartAttribute { name: "Available Spare".into(), value: format!("{}%", avail), status: if avail < 20 { "Warning".into() } else { "OK".into() } });
                }
            }
        }

        if power_on_hours >= 0 {
            smart_attrs.insert(0, SmartAttribute { name: "Power On Hours".into(), value: format!("{} hrs", power_on_hours), status: "OK".into() });
        }

        let mut health_percent: u32 = 100;
        if wear > 0 && wear <= 100 { health_percent = (100 - wear as u32).max(0); }
        if read_errors > 0 { health_percent = health_percent.saturating_sub(5); }
        if write_errors > 0 { health_percent = health_percent.saturating_sub(5); }
        if !passed { health_percent = health_percent.min(50); }

        results.push(DiskHealthInfo {
            model, serial, status, temperature,
            size_gb: (size_gb * 10.0).round() / 10.0,
            media_type, read_errors, write_errors, power_on_hours, wear,
            health_percent, attributes: smart_attrs,
        });
    }

    results
}

fn get_smart_via_wmi() -> Vec<DiskHealthInfo> {
    let cmd = r#"Get-CimInstance -Namespace root\wmi -ClassName MSStorageDriver_FailurePredictStatus -ErrorAction SilentlyContinue | Select-Object InstanceName,PredictFailure,Active | ConvertTo-Json"#;
    let output = hidden_powershell()
        .args(&["-Command", cmd])
        .output();
    let stdout = match output {
        Ok(ref o) => String::from_utf8_lossy(&o.stdout).to_string(),
        Err(_) => String::new(),
    };

    let disks = sysinfo::Disks::new_with_refreshed_list();
    let mut results = Vec::new();

    for disk in disks.list() {
        let name = disk.name().to_string_lossy().to_string();
        let total = disk.total_space();
        let avail = disk.available_space();
        let used_pct = if total > 0 { ((total - avail) as f64 / total as f64 * 100.0) as u32 } else { 0 };

        let health = if used_pct > 95 { 40 } else if used_pct > 90 { 60 } else if used_pct > 80 { 80 } else { 95 };

        results.push(DiskHealthInfo {
            model: name,
            serial: String::new(),
            status: if health > 60 { "Healthy" } else { "Warning" }.into(),
            temperature: 0,
            size_gb: (total as f64 / 1_073_741_824.0 * 10.0).round() / 10.0,
            media_type: match disk.kind() {
                sysinfo::DiskKind::SSD => "SSD".into(),
                sysinfo::DiskKind::HDD => "HDD".into(),
                _ => "Unknown".into(),
            },
            read_errors: 0, write_errors: 0, power_on_hours: -1, wear: 0,
            health_percent: health,
            attributes: vec![
                SmartAttribute { name: "Used Space".into(), value: format!("{}%", used_pct), status: if used_pct > 90 { "Warning" } else { "OK" }.into() },
                SmartAttribute { name: "Available".into(), value: format_size(avail), status: "OK".into() },
            ],
        });
    }

    results
}

// ── Commands: File Shredder ──

#[tauri::command]
pub async fn shred_files(file_paths: Vec<String>, passes: u32) -> Result<String, String> {
    info!("[Shredder] Shredding {} files with {} passes", file_paths.len(), passes);

    let passes = passes.max(1).min(7);
    let mut shredded = 0u32;

    for file_path in &file_paths {
        let path = Path::new(file_path);
        if !path.exists() || !path.is_file() { continue; }

        let canonical = match std::fs::canonicalize(path) {
            Ok(c) => c, Err(_) => continue,
        };
        let canonical_str = canonical.to_string_lossy().to_lowercase();
        if canonical_str.contains("\\windows\\") || canonical_str.contains("\\program files") {
            continue;
        }

        let file_size = std::fs::metadata(&canonical).map(|m| m.len()).unwrap_or(0);

        // Overwrite with patterns
        for pass in 0..passes {
            if let Ok(mut file) = std::fs::OpenOptions::new().write(true).open(&canonical) {
                use std::io::Write;
                let pattern: u8 = match pass % 3 {
                    0 => 0x00,
                    1 => 0xFF,
                    _ => 0xAA,
                };
                let chunk = vec![pattern; 4096];
                let mut remaining = file_size;
                while remaining > 0 {
                    let to_write = remaining.min(4096);
                    let _ = file.write(&chunk[..to_write as usize]);
                    remaining = remaining.saturating_sub(to_write);
                }
                let _ = file.flush();
            }
        }

        if std::fs::remove_file(&canonical).is_ok() {
            shredded += 1;
        }
    }

    info!("[Shredder] Shredded {} files", shredded);
    Ok(format!("Securely shredded {} files ({} pass{})", shredded, passes, if passes > 1 { "es" } else { "" }))
}

// ── Commands: File Split / Join ──

#[tauri::command]
pub async fn split_file(file_path: String, chunk_size_mb: u64) -> Result<String, String> {
    info!("[FileSplitter] Splitting {} into {} MB chunks", file_path, chunk_size_mb);

    let path = Path::new(&file_path);
    if !path.exists() || !path.is_file() {
        return Err("File not found".into());
    }

    let chunk_bytes = chunk_size_mb * 1_048_576;
    let file_size = std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);

    if file_size == 0 { return Err("File is empty".into()); }
    if chunk_bytes >= file_size { return Err("Chunk size is larger than file".into()); }

    use std::io::{Read, Write};
    let mut reader = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut part = 1u32;
    let mut remaining = file_size;

    while remaining > 0 {
        let chunk = remaining.min(chunk_bytes);
        let out_path = format!("{}.part{:03}", file_path, part);
        let mut writer = std::fs::File::create(&out_path).map_err(|e| e.to_string())?;
        let mut buf = vec![0u8; 8192];
        let mut written = 0u64;
        while written < chunk {
            let to_read = (chunk - written).min(8192) as usize;
            let n = reader.read(&mut buf[..to_read]).map_err(|e| e.to_string())?;
            if n == 0 { break; }
            writer.write_all(&buf[..n]).map_err(|e| e.to_string())?;
            written += n as u64;
        }
        remaining = remaining.saturating_sub(chunk);
        part += 1;
    }

    Ok(format!("Split into {} parts", part - 1))
}

#[tauri::command]
pub async fn join_files(first_part_path: String) -> Result<String, String> {
    info!("[FileSplitter] Joining files from {}", first_part_path);

    // Extract base name by removing .partNNN suffix
    let base_path = if first_part_path.contains(".part") {
        first_part_path.rsplitn(2, ".part").last().unwrap_or(&first_part_path).to_string()
    } else {
        return Err("Not a split file".into());
    };

    let output_path = format!("{}.joined", base_path);
    use std::io::{Read, Write};
    let mut writer = std::fs::File::create(&output_path).map_err(|e| e.to_string())?;

    let mut part = 1u32;
    loop {
        let part_path = format!("{}.part{:03}", base_path, part);
        if !Path::new(&part_path).exists() { break; }
        let mut reader = std::fs::File::open(&part_path).map_err(|e| e.to_string())?;
        let mut buf = vec![0u8; 8192];
        loop {
            let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
            if n == 0 { break; }
            writer.write_all(&buf[..n]).map_err(|e| e.to_string())?;
        }
        part += 1;
    }

    if part == 1 { return Err("No parts found".into()); }

    Ok(format!("Joined {} parts into {}", part - 1, output_path))
}

// ── Commands: Recycle Bin ──

#[tauri::command]
pub async fn get_recycle_bin_items() -> Result<Vec<RecycleBinItem>, String> {
    info!("[FileRecovery] Listing Recycle Bin items");

    let ps_cmd = "$shell = New-Object -ComObject Shell.Application; $rb = $shell.NameSpace(0x0a); $items = @(); foreach($item in $rb.Items()) { $items += [PSCustomObject]@{ Name=$item.Name; Path=$item.Path; Size=$item.Size; Type=$item.Type; ModifyDate=$item.ModifyDate.ToString('yyyy-MM-dd HH:mm:ss') } }; $items | ConvertTo-Json";
    let output = hidden_powershell()
        .args(&["-Command", ps_cmd])
        .output()
        .map_err(|e| format!("Failed to read Recycle Bin: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    let mut items = Vec::new();

    let parse_item = |item: &serde_json::Value| -> Option<RecycleBinItem> {
        let name = item["Name"].as_str()?.to_string();
        let path = item["Path"].as_str().unwrap_or("").to_string();
        let size = item["Size"].as_u64().unwrap_or(0);
        let item_type = item["Type"].as_str().unwrap_or("File").to_string();
        let date = item["ModifyDate"].as_str().unwrap_or("Unknown").to_string();
        Some(RecycleBinItem {
            name, original_path: path,
            size_bytes: size, size_display: format_size(size),
            deleted_date: date, item_type,
        })
    };

    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&stdout) {
        if let Some(arr) = data.as_array() {
            for item in arr { if let Some(r) = parse_item(item) { items.push(r); } }
        } else {
            if let Some(r) = parse_item(&data) { items.push(r); }
        }
    }

    info!("[FileRecovery] Found {} items in Recycle Bin", items.len());
    Ok(items)
}

#[tauri::command]
pub async fn restore_recycle_bin_item(item_name: String) -> Result<String, String> {
    info!("[FileRecovery] Restoring: {}", item_name);
    let safe_name = crate::util::sanitize_powershell_input(&item_name);
    let ps_cmd = format!(
        "$shell = New-Object -ComObject Shell.Application; $rb = $shell.NameSpace(0x0a); $item = $rb.Items() | Where-Object {{ $_.Name -eq '{}' }} | Select-Object -First 1; if($item) {{ $dest = $shell.NameSpace((Split-Path $item.Path -Parent)); $dest.MoveHere($item); 'Restored' }} else {{ 'Not found' }}",
        safe_name
    );
    let output = hidden_powershell()
        .args(&["-Command", &ps_cmd])
        .output()
        .map_err(|e| format!("Failed to restore: {}", e))?;
    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if result.contains("Restored") { Ok(format!("Restored: {}", item_name)) }
    else { Err(format!("Could not restore '{}': {}", item_name, result)) }
}

#[tauri::command]
pub async fn empty_recycle_bin() -> Result<String, String> {
    info!("[FileRecovery] Emptying Recycle Bin");
    let ps_cmd = "Clear-RecycleBin -Force -ErrorAction SilentlyContinue; 'Done'";
    let output = hidden_powershell()
        .args(&["-Command", ps_cmd])
        .output()
        .map_err(|e| format!("Failed to empty: {}", e))?;
    if output.status.success() { Ok("Recycle Bin emptied".into()) }
    else { Err("Failed to empty Recycle Bin".into()) }
}
