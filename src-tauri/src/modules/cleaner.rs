use serde::{Serialize, Deserialize};
use walkdir::WalkDir;
use tracing::info;

use crate::util::{hidden_powershell, scan_directory_size, scan_directory_recursive, dir_size_mb};

// ── Structs ──

#[derive(Serialize, Deserialize)]
pub struct JunkCategory {
    pub id: String,
    pub name: String,
    pub files_count: u64,
    pub size_mb: u64,
}

#[derive(Serialize, Deserialize)]
pub struct JunkScanResult {
    pub categories: Vec<JunkCategory>,
}

#[derive(Serialize)]
pub struct SlimTarget {
    pub id: String,
    pub name: String,
    pub description: String,
    pub size_mb: f64,
    pub safe: bool,
}

#[derive(Serialize)]
pub struct EmptyFolderItem {
    pub path: String,
    pub name: String,
    pub parent: String,
}

#[derive(Serialize)]
pub struct UwpJunkItem {
    pub app_name: String,
    pub package_name: String,
    pub path: String,
    pub size_mb: f64,
    pub junk_type: String,
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

#[derive(Serialize, Deserialize)]
pub struct SmartCleanConfig {
    pub enabled: bool,
    pub threshold_mb: u64,
    pub interval_minutes: u32,
    pub auto_clean: bool,
    pub last_scan: String,
    pub last_junk_mb: f64,
}

#[derive(Serialize)]
pub struct DuplicateGroup {
    pub hash: String,
    pub files: Vec<DuplicateFile>,
    pub size_bytes: u64,
    pub wasted_bytes: u64,
}

#[derive(Serialize)]
pub struct DuplicateFile {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub modified: String,
}

// ── Helpers ──

fn is_protected_folder(path: &std::path::Path) -> bool {
    let s = path.to_string_lossy().to_lowercase();
    let protected = [
        "\\windows", "\\program files", "\\program files (x86)",
        "\\programdata", "\\$recycle.bin", "\\system volume information",
        "\\recovery", "\\boot", "\\.git", "\\node_modules",
        "\\appdata\\local\\packages",
    ];
    protected.iter().any(|p| s.contains(p))
}

fn is_truly_empty(path: &std::path::Path) -> bool {
    match std::fs::read_dir(path) {
        Ok(mut entries) => entries.next().is_none(),
        Err(_) => false,
    }
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

// ── Tauri Commands ──

#[tauri::command]
pub async fn scan_junk_files() -> JunkScanResult {
    info!(module = "cleaner", "Scanning junk files");
    let temp_dir = std::env::var("TEMP").unwrap_or_else(|_| "C:\\Windows\\Temp".to_string());
    let (temp_count, temp_mb) = scan_directory_size(&temp_dir);
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    let chrome_cache = format!("{}\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache", user_profile);
    let (chrome_count, chrome_mb) = scan_directory_recursive(&chrome_cache, &[]);
    let edge_cache = format!("{}\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache", user_profile);
    let (edge_count, edge_mb) = scan_directory_recursive(&edge_cache, &[]);
    let (log_count, log_mb) = scan_directory_recursive(&format!("{}\\AppData\\Local", user_profile), &["log", "tmp"]);
    let thumb_path = format!("{}\\AppData\\Local\\Microsoft\\Windows\\Explorer", user_profile);
    let (thumb_count, thumb_mb) = scan_directory_recursive(&thumb_path, &["db"]);
    JunkScanResult {
        categories: vec![
            JunkCategory { id: "temp_files".into(), name: "Temporary Files".into(), files_count: temp_count, size_mb: temp_mb },
            JunkCategory { id: "browser_cache".into(), name: "Browser Cache".into(), files_count: chrome_count + edge_count, size_mb: chrome_mb + edge_mb },
            JunkCategory { id: "logs".into(), name: "Log Files".into(), files_count: log_count, size_mb: log_mb },
            JunkCategory { id: "thumbnails".into(), name: "Thumbnails".into(), files_count: thumb_count, size_mb: thumb_mb },
        ],
    }
}

#[tauri::command]
pub async fn clean_junk_files(category_ids: Vec<String>) -> Result<(), String> {
    info!(module = "cleaner", categories = ?category_ids, "Cleaning junk files");
    let temp_dir = std::env::var("TEMP").unwrap_or_else(|_| "C:\\Windows\\Temp".to_string());
    let user_profile = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\Default".to_string());
    let chrome_cache = format!("{}\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache", user_profile);
    let edge_cache = format!("{}\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache", user_profile);
    let local_appdata = format!("{}\\AppData\\Local", user_profile);
    let thumb_path = format!("{}\\AppData\\Local\\Microsoft\\Windows\\Explorer", user_profile);

    let mut manifest = crate::modules::rollback::begin_operation("clean_junk_files", "Cleaned junk files");
    let mut files_removed = 0u64;

    // Helper: collect rollback items from a directory without borrowing outer state
    fn collect_dir_items(path: &str, exts: &[&str]) -> Vec<(crate::modules::rollback::RollbackItem, u64)> {
        let mut collected = Vec::new();
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.flatten() {
                if let Ok(metadata) = entry.metadata() {
                    let matches = if exts.is_empty() { true }
                    else { entry.path().extension().and_then(|e| e.to_str())
                        .map(|e| exts.iter().any(|ext| e.eq_ignore_ascii_case(ext))).unwrap_or(false) };
                    if matches {
                        if metadata.is_file() {
                            let src = entry.path().to_string_lossy().into_owned();
                            let size = metadata.len();
                            if let Ok(backup_path) = crate::modules::rollback::quarantine_file(&src) {
                                collected.push((crate::modules::rollback::RollbackItem {
                                    item_type: "file".into(),
                                    path: src,
                                    backup_path,
                                    original_hash: "untracked_junk".into(),
                                    size_bytes: size,
                                }, size));
                            }
                        } else if metadata.is_dir() && exts.is_empty() {
                            let _ = std::fs::remove_dir_all(entry.path());
                        }
                    }
                }
            }
        }
        collected
    }

    let mut merge_items = |items: Vec<(crate::modules::rollback::RollbackItem, u64)>| {
        for (item, size) in items {
            manifest.total_bytes += size;
            manifest.items.push(item);
            files_removed += 1;
        }
    };

    for id in &category_ids {
        match id.as_str() {
            "temp_files" => {
                merge_items(collect_dir_items(&temp_dir, &[]));
                merge_items(collect_dir_items("C:\\Windows\\Temp", &[]));
            },
            "browser_cache" => {
                merge_items(collect_dir_items(&chrome_cache, &[]));
                merge_items(collect_dir_items(&edge_cache, &[]));
            },
            "logs" => {
                let mut log_items = Vec::new();
                for entry in WalkDir::new(&local_appdata).max_depth(3).into_iter().filter_map(|e| e.ok()) {
                    if entry.file_type().is_file() {
                        let matches = entry.path().extension().and_then(|e| e.to_str())
                            .map(|e| e.eq_ignore_ascii_case("log") || e.eq_ignore_ascii_case("tmp")).unwrap_or(false);
                        if matches {
                            let src = entry.path().to_string_lossy().into_owned();
                            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
                            if let Ok(backup_path) = crate::modules::rollback::quarantine_file(&src) {
                                log_items.push((crate::modules::rollback::RollbackItem {
                                    item_type: "file".into(),
                                    path: src,
                                    backup_path,
                                    original_hash: "untracked_junk".into(),
                                    size_bytes: size,
                                }, size));
                            }
                        }
                    }
                }
                merge_items(log_items);
            },
            "thumbnails" => {
                merge_items(collect_dir_items(&thumb_path, &["db"]));
            },
            _ => continue,
        }
    }

    if files_removed > 0 {
        let _ = crate::modules::rollback::create_snapshot(&manifest);
        crate::modules::audit::log_operation(
            "clean_junk_files",
            &format!("{:?}", category_ids),
            "success",
            &format!("Removed {} temporary files", files_removed),
            files_removed as u64,
            manifest.total_bytes,
        );
        tauri::async_runtime::spawn(async move {
            crate::modules::webhook::send_webhook_event(
                "clean_junk_files",
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
pub async fn scan_slim_targets() -> Vec<SlimTarget> {
    info!(module = "cleaner", "Scanning slim targets");
    let mut targets = Vec::new();
    let checks: Vec<(&str, &str, &str, &str, bool)> = vec![
        ("windows_old", "Windows.old", "Previous Windows installation files", r"C:\Windows.old", true),
        ("update_cache", "Windows Update Cache", "Downloaded update installation files", r"C:\Windows\SoftwareDistribution\Download", true),
        ("win_temp", "Windows Temp", "System temporary files", r"C:\Windows\Temp", true),
        ("delivery_opt", "Delivery Optimization Cache", "Peer-to-peer update distribution cache",
         r"C:\Windows\ServiceProfiles\NetworkService\AppData\Local\Microsoft\Windows\DeliveryOptimization", true),
        ("patch_cache", "Installer Patch Cache", "Cached installer patches (orphaned)", r"C:\Windows\Installer\$PatchCache$", true),
    ];
    for (id, name, desc, path, safe) in &checks {
        if std::path::Path::new(path).exists() {
            let size = dir_size_mb(path);
            targets.push(SlimTarget { id: id.to_string(), name: name.to_string(), description: desc.to_string(), size_mb: size, safe: *safe });
        }
    }
    let hiberfil = r"C:\hiberfil.sys";
    if std::path::Path::new(hiberfil).exists() {
        let size = std::fs::metadata(hiberfil).map(|m| m.len() as f64 / 1024.0 / 1024.0).unwrap_or(0.0);
        if size > 100.0 {
            targets.push(SlimTarget { id: "hibernation".into(), name: "Hibernation File".into(), description: "Disable hibernation to reclaim space".into(), size_mb: (size * 10.0).round() / 10.0, safe: false });
        }
    }
    targets.push(SlimTarget { id: "winsxs".into(), name: "Component Store Cleanup".into(), description: "Clean up superseded Windows components (DISM)".into(), size_mb: 0.0, safe: true });
    targets
}

#[tauri::command]
pub async fn clean_slim_target(target_id: String) -> Result<String, String> {
    info!(module = "cleaner", target = %target_id, "Cleaning slim target");
    match target_id.as_str() {
        "windows_old" => { let _ = hidden_powershell().args(&["-Command", r#"Remove-Item -Path 'C:\Windows.old' -Recurse -Force -ErrorAction SilentlyContinue"#]).output(); Ok("Windows.old removed".into()) },
        "update_cache" => { let _ = hidden_powershell().args(&["-Command", r#"Stop-Service wuauserv -Force -EA SilentlyContinue; Remove-Item 'C:\Windows\SoftwareDistribution\Download\*' -Recurse -Force -EA SilentlyContinue; Start-Service wuauserv -EA SilentlyContinue"#]).output(); Ok("Update cache cleared".into()) },
        "win_temp" => { let _ = hidden_powershell().args(&["-Command", r#"Remove-Item 'C:\Windows\Temp\*' -Recurse -Force -ErrorAction SilentlyContinue"#]).output(); Ok("Windows temp cleared".into()) },
        "delivery_opt" => { let _ = hidden_powershell().args(&["-Command", "Delete-DeliveryOptimizationCache -Force -ErrorAction SilentlyContinue"]).output(); Ok("Delivery optimization cache cleared".into()) },
        "patch_cache" => { let _ = hidden_powershell().args(&["-Command", r#"Remove-Item 'C:\Windows\Installer\$PatchCache$\*' -Recurse -Force -ErrorAction SilentlyContinue"#]).output(); Ok("Patch cache cleared".into()) },
        "hibernation" => { let _ = hidden_powershell().args(&["-Command", "powercfg /hibernate off"]).output(); Ok("Hibernation disabled".into()) },
        "winsxs" => { let _ = std::process::Command::new("cmd").args(&["/C", "Dism.exe /Online /Cleanup-Image /StartComponentCleanup /ResetBase"]).output(); Ok("Component store cleanup started".into()) },
        _ => Err("Unknown target".into()),
    }
}
// scan_empty_folders, clean_empty_folders, scan_large_files, delete_file → moved to disk.rs



#[tauri::command]
pub async fn scan_uwp_junk() -> Result<Vec<UwpJunkItem>, String> {
    info!(module = "cleaner", "Scanning UWP junk");
    let local_appdata = std::env::var("LOCALAPPDATA").unwrap_or_default();
    let packages_dir = format!("{}\\Packages", local_appdata);
    let mut items = Vec::new();
    let pkg_path = std::path::Path::new(&packages_dir);
    if !pkg_path.exists() { return Ok(items); }
    if let Ok(entries) = std::fs::read_dir(pkg_path) {
        for entry in entries.filter_map(|e| e.ok()) {
            let pkg_name = entry.file_name().to_string_lossy().to_string();
            for (subdir, junk_type) in &[("TempState", "Temp State"), ("AC\\Temp", "App Cache"), ("LocalCache\\Local", "Local Cache")] {
                let junk_path = format!("{}\\{}\\{}", packages_dir, pkg_name, subdir);
                let jp = std::path::Path::new(&junk_path);
                if !jp.exists() { continue; }
                let mut total_bytes: u64 = 0;
                for file_entry in WalkDir::new(jp).max_depth(5).into_iter().filter_map(|e| e.ok()) {
                    if file_entry.file_type().is_file() { total_bytes += file_entry.metadata().map(|m| m.len()).unwrap_or(0); }
                }
                if total_bytes > 0 {
                    items.push(UwpJunkItem {
                        app_name: pkg_name.split('_').next().unwrap_or(&pkg_name).to_string(),
                        package_name: pkg_name.clone(), path: junk_path,
                        size_mb: total_bytes as f64 / 1_048_576.0, junk_type: junk_type.to_string(),
                    });
                }
            }
        }
    }
    let wu_path = "C:\\Windows\\SoftwareDistribution\\Download";
    if std::path::Path::new(wu_path).exists() {
        let mut wu_bytes: u64 = 0;
        for entry in WalkDir::new(wu_path).max_depth(3).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() { wu_bytes += entry.metadata().map(|m| m.len()).unwrap_or(0); }
        }
        if wu_bytes > 0 {
            items.push(UwpJunkItem { app_name: "Windows Update".into(), package_name: "SoftwareDistribution".into(), path: wu_path.into(), size_mb: wu_bytes as f64 / 1_048_576.0, junk_type: "Update Cache".into() });
        }
    }
    items.sort_by(|a, b| b.size_mb.partial_cmp(&a.size_mb).unwrap_or(std::cmp::Ordering::Equal));
    Ok(items)
}

#[tauri::command]
pub async fn clean_uwp_junk(paths: Vec<String>) -> Result<String, String> {
    info!(module = "cleaner", count = paths.len(), "Cleaning UWP junk");
    let mut freed_bytes: u64 = 0;
    let mut cleaned = 0;
    for junk_path in &paths {
        let path = std::path::Path::new(junk_path);
        if !path.exists() { continue; }
        let path_lower = junk_path.to_lowercase();
        let is_safe = path_lower.contains("\\tempstate") || path_lower.contains("\\ac\\temp")
            || path_lower.contains("\\localcache\\local") || path_lower.contains("\\softwaredistribution\\download");
        if !is_safe { continue; }
        if let Ok(entries) = std::fs::read_dir(path) {
            for entry in entries.filter_map(|e| e.ok()) {
                let ep = entry.path();
                let size = if ep.is_file() {
                    let s = std::fs::metadata(&ep).map(|m| m.len()).unwrap_or(0);
                    let _ = std::fs::remove_file(&ep); s
                } else if ep.is_dir() {
                    let s = WalkDir::new(&ep).into_iter().filter_map(|e| e.ok()).filter(|e| e.file_type().is_file())
                        .map(|e| e.metadata().map(|m| m.len()).unwrap_or(0)).sum::<u64>();
                    let _ = std::fs::remove_dir_all(&ep); s
                } else { 0 };
                freed_bytes += size;
            }
            cleaned += 1;
        }
    }
    Ok(format!("Cleaned {} locations. Freed {:.1} MB", cleaned, freed_bytes as f64 / 1_048_576.0))
}



#[tauri::command]
pub async fn quick_junk_scan() -> Result<f64, String> {
    info!(module = "cleaner", "Running quick junk scan");
    let mut total_bytes: u64 = 0;
    let temp_dirs = vec![
        std::env::var("TEMP").unwrap_or_default(), std::env::var("TMP").unwrap_or_default(),
        format!("{}\\AppData\\Local\\Temp", std::env::var("USERPROFILE").unwrap_or_default()),
    ];
    for dir in temp_dirs {
        if dir.is_empty() { continue; }
        let path = std::path::Path::new(&dir);
        if !path.exists() { continue; }
        for entry in WalkDir::new(path).max_depth(3).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() { total_bytes += entry.metadata().map(|m| m.len()).unwrap_or(0); }
        }
    }
    let user = std::env::var("USERPROFILE").unwrap_or_default();
    for dir in &[
        format!("{}\\AppData\\Local\\Google\\Chrome\\User Data\\Default\\Cache", user),
        format!("{}\\AppData\\Local\\Microsoft\\Edge\\User Data\\Default\\Cache", user),
        format!("{}\\AppData\\Local\\Mozilla\\Firefox\\Profiles", user),
    ] {
        let path = std::path::Path::new(dir);
        if !path.exists() { continue; }
        for entry in WalkDir::new(path).max_depth(2).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() { total_bytes += entry.metadata().map(|m| m.len()).unwrap_or(0); }
        }
    }
    Ok(total_bytes as f64 / 1_048_576.0)
}

#[tauri::command]
pub async fn get_smart_clean_config() -> SmartCleanConfig {
    SmartCleanConfig { enabled: false, threshold_mb: 500, interval_minutes: 30, auto_clean: false, last_scan: "Never".into(), last_junk_mb: 0.0 }
}

#[tauri::command]
pub async fn find_duplicate_files(target_dir: String, min_size_kb: u64) -> Result<Vec<DuplicateGroup>, String> {
    info!(module = "cleaner", dir = %target_dir, "Finding duplicate files");
    use sha2::{Sha256, Digest};
    use std::collections::HashMap;
    use std::io::Read;

    let canonical = std::fs::canonicalize(&target_dir).map_err(|e| format!("Invalid path: {}", e))?;
    let min_bytes = min_size_kb * 1024;

    // Phase 1: Group files by size
    let mut size_groups: HashMap<u64, Vec<std::path::PathBuf>> = HashMap::new();
    for entry in WalkDir::new(&canonical).max_depth(10).follow_links(false).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() { continue; }
        if let Ok(meta) = entry.metadata() {
            let size = meta.len();
            if size >= min_bytes { size_groups.entry(size).or_default().push(entry.into_path()); }
        }
    }

    // Phase 2: Hash files with same size
    let mut hash_groups: HashMap<String, Vec<(std::path::PathBuf, u64)>> = HashMap::new();
    for (size, paths) in &size_groups {
        if paths.len() < 2 { continue; }
        for path in paths {
            if let Ok(mut file) = std::fs::File::open(path) {
                let mut hasher = Sha256::new();
                let mut buffer = [0u8; 8192];
                loop {
                    match file.read(&mut buffer) {
                        Ok(0) => break,
                        Ok(n) => hasher.update(&buffer[..n]),
                        Err(_) => break,
                    }
                }
                let hash = format!("{:x}", hasher.finalize());
                hash_groups.entry(hash).or_default().push((path.clone(), *size));
            }
        }
    }

    // Phase 3: Build result
    let mut groups: Vec<DuplicateGroup> = hash_groups.into_iter()
        .filter(|(_, files)| files.len() >= 2)
        .map(|(hash, files)| {
            let size = files[0].1;
            let wasted = size * (files.len() as u64 - 1);
            let dup_files: Vec<DuplicateFile> = files.into_iter().map(|(path, size_bytes)| {
                let modified = std::fs::metadata(&path).ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| { let secs = t.duration_since(std::time::UNIX_EPOCH).ok()?.as_secs(); Some(format!("{}", 1970 + secs / 86400 / 365)) })
                    .unwrap_or_else(|| "Unknown".into());
                DuplicateFile {
                    name: path.file_name().unwrap_or_default().to_string_lossy().to_string(),
                    path: path.to_string_lossy().to_string(), size_bytes, modified,
                }
            }).collect();
            DuplicateGroup { hash, files: dup_files, size_bytes: size, wasted_bytes: wasted }
        }).collect();
    groups.sort_by(|a, b| b.wasted_bytes.cmp(&a.wasted_bytes));
    groups.truncate(100);
    Ok(groups)
}

// ── Legacy Duplicate Scanner (frontend API) ──

use sha2::{Sha256, Digest};
use std::collections::HashMap;
use std::io::Read;

#[derive(Serialize)]
pub struct LegacyDuplicateGroup {
    pub hash: String,
    pub size_mb: f64,
    pub files: Vec<String>,
    pub keep_index: usize,
}

#[tauri::command]
pub async fn scan_duplicate_files(target_dir: String) -> Result<Vec<LegacyDuplicateGroup>, String> {
    info!("[DuplicateFinder] Scanning: {}", target_dir);
    let mut size_map: HashMap<u64, Vec<String>> = HashMap::new();

    const MAX_FILES: usize = 50_000;
    const MAX_FILE_SIZE: u64 = 500_000_000;
    const MIN_FILE_SIZE: u64 = 1024;
    const PARTIAL_HASH_THRESHOLD: u64 = 131_072;

    let mut file_count: usize = 0;

    for entry in WalkDir::new(&target_dir).into_iter().filter_map(|e| e.ok()) {
        if file_count >= MAX_FILES { break; }
        if entry.file_type().is_file() {
            if let Ok(metadata) = entry.metadata() {
                let size = metadata.len();
                if size >= MIN_FILE_SIZE && size <= MAX_FILE_SIZE {
                    let path = entry.path().to_string_lossy().into_owned();
                    size_map.entry(size).or_default().push(path);
                    file_count += 1;
                }
            }
        }
    }

    info!("[DuplicateFinder] Phase 1 done: {} files in {} size groups", file_count, size_map.len());

    let mut hash_map: HashMap<String, Vec<String>> = HashMap::new();
    let mut sizes_by_hash: HashMap<String, u64> = HashMap::new();

    for (size, paths) in &size_map {
        if paths.len() <= 1 { continue; }
        for path in paths {
            if let Ok(mut file) = std::fs::File::open(path) {
                let mut hasher = Sha256::new();
                if *size > PARTIAL_HASH_THRESHOLD {
                    let mut buf = [0u8; 65536];
                    if let Ok(n) = file.read(&mut buf) { hasher.update(&buf[..n]); }
                    use std::io::Seek;
                    if file.seek(std::io::SeekFrom::End(-65536)).is_ok() {
                        if let Ok(n) = file.read(&mut buf) { hasher.update(&buf[..n]); }
                    }
                    hasher.update(size.to_le_bytes());
                } else {
                    let mut buffer = [0u8; 8192];
                    loop {
                        match file.read(&mut buffer) {
                            Ok(0) => break,
                            Ok(n) => hasher.update(&buffer[..n]),
                            Err(_) => break,
                        }
                    }
                }
                let hash_str = format!("{:x}", hasher.finalize());
                hash_map.entry(hash_str.clone()).or_default().push(path.clone());
                sizes_by_hash.insert(hash_str, *size);
            }
        }
    }

    drop(size_map);
    info!("[DuplicateFinder] Phase 2 done: {} hash groups", hash_map.len());

    let mut groups = Vec::new();
    for (hash, paths) in hash_map {
        if paths.len() > 1 {
            let size = *sizes_by_hash.get(&hash).unwrap_or(&0) as f64 / 1_048_576.0;
            groups.push(LegacyDuplicateGroup {
                hash,
                size_mb: (size * 100.0).round() / 100.0,
                files: paths,
                keep_index: 0,
            });
        }
    }

    info!("[DuplicateFinder] Found {} duplicate groups", groups.len());
    Ok(groups)
}

#[tauri::command]
pub async fn clean_duplicate_files(files_to_delete: Vec<String>) -> Result<(), String> {
    for path in files_to_delete {
        let _ = std::fs::remove_file(path);
    }
    Ok(())
}

// ── Cloud Cache Cleaner ──

#[derive(Serialize)]
pub struct CloudCacheEntry {
    pub service: String,
    pub path: String,
    pub size_bytes: u64,
    pub size_display: String,
    pub file_count: u32,
}

#[tauri::command]
pub async fn scan_cloud_caches() -> Result<Vec<CloudCacheEntry>, String> {
    info!("[CloudCleaner] Scanning cloud service caches");
    let user = std::env::var("USERPROFILE").unwrap_or_default();
    let local = std::env::var("LOCALAPPDATA").unwrap_or_default();

    let cache_paths: Vec<(&str, String)> = vec![
        ("OneDrive", format!("{}\\AppData\\Local\\Microsoft\\OneDrive\\logs", user)),
        ("OneDrive", format!("{}\\Microsoft\\OneDrive\\logs", local)),
        ("Dropbox", format!("{}\\Dropbox\\.dropbox.cache", user)),
        ("Google Drive", format!("{}\\Google\\DriveFS\\Logs", local)),
        ("Google Drive", format!("{}\\Google\\DriveFS\\cef_cache", local)),
        ("iCloud", format!("{}\\Apple\\CloudKit\\Logs", local)),
    ];

    let mut entries = Vec::new();
    let format_size = |bytes: u64| -> String {
        if bytes >= 1_073_741_824 { format!("{:.1} GB", bytes as f64 / 1_073_741_824.0) }
        else if bytes >= 1_048_576 { format!("{:.1} MB", bytes as f64 / 1_048_576.0) }
        else if bytes >= 1024 { format!("{:.1} KB", bytes as f64 / 1024.0) }
        else { format!("{} B", bytes) }
    };

    for (service, path) in &cache_paths {
        let p = std::path::Path::new(path);
        if !p.exists() { continue; }

        fn dir_size(path: &std::path::Path) -> (u64, u32) {
            let mut size = 0u64;
            let mut count = 0u32;
            if let Ok(entries) = std::fs::read_dir(path) {
                for entry in entries.flatten() {
                    if let Ok(meta) = entry.metadata() {
                        if meta.is_file() { size += meta.len(); count += 1; }
                        else if meta.is_dir() {
                            let (s, c) = dir_size(&entry.path());
                            size += s; count += c;
                        }
                    }
                }
            }
            (size, count)
        }

        let (total_size, file_count) = dir_size(p);
        if total_size > 0 {
            entries.push(CloudCacheEntry {
                service: service.to_string(),
                path: path.clone(),
                size_bytes: total_size,
                size_display: format_size(total_size),
                file_count,
            });
        }
    }

    info!("[CloudCleaner] Found {} cache locations", entries.len());
    Ok(entries)
}

#[tauri::command]
pub async fn clean_cloud_cache(path: String) -> Result<String, String> {
    info!("[CloudCleaner] Cleaning cache: {}", path);
    let allowed_patterns = ["OneDrive\\logs", "OneDrive\\Logs", ".dropbox.cache", "DriveFS\\Logs", "DriveFS\\cef_cache", "CloudKit\\Logs"];
    let is_allowed = allowed_patterns.iter().any(|p| path.contains(p));
    if !is_allowed { return Err("Path is not a recognized cloud cache directory".into()); }

    let p = std::path::Path::new(&path);
    if !p.exists() { return Err("Path does not exist".into()); }

    let mut deleted = 0u32;
    if let Ok(entries) = std::fs::read_dir(p) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    if std::fs::remove_file(entry.path()).is_ok() { deleted += 1; }
                }
            }
        }
    }

    info!("[CloudCleaner] Deleted {} files from {}", deleted, path);
    Ok(format!("Cleaned {} files", deleted))
}
