use serde::{Serialize, Deserialize};
use std::path::Path;
use tracing::info;

use crate::util::{hidden_powershell, sanitize_powershell_input};

trait CommandCreationFlags {
    fn creation_flags_safe(&mut self) -> &mut Self;
}
impl CommandCreationFlags for std::process::Command {
    fn creation_flags_safe(&mut self) -> &mut Self {
        #[cfg(windows)]
        { use std::os::windows::process::CommandExt; self.creation_flags(0x08000000); }
        self
    }
}

#[derive(Serialize)]
pub struct HiddenFileResult { pub success: bool, pub message: String, pub path: String }

#[derive(Serialize)]
pub struct PasswordResult { pub password: String, pub strength: String, pub entropy_bits: f64 }

#[derive(Serialize, Deserialize)]
pub struct DefenderStatus {
    pub antivirus_enabled: bool, pub real_time_protection: bool,
    pub definition_date: String, pub definition_version: String,
    pub last_scan_time: String, pub engine_version: String,
}

#[derive(Serialize)]
pub struct ScanResult { pub status: String, pub threats_found: u32, pub details: String }

#[derive(Serialize)]
pub struct LoginEvent {
    pub event_type: String, pub timestamp: String, pub username: String,
    pub source_ip: String, pub logon_type: String, pub status: String,
}

// ── File Hider ──

#[tauri::command]
pub async fn hide_file_or_folder(file_path: String) -> Result<HiddenFileResult, String> {
    info!("[FileHider] Hiding: {}", file_path);
    let path = Path::new(&file_path);
    if !path.exists() { return Err("File/folder not found".into()); }
    let cs = std::fs::canonicalize(path).map_err(|e| format!("Invalid path: {}", e))?.to_string_lossy().to_lowercase();
    if cs.contains("\\windows\\") || cs.contains("\\program files") { return Err("Cannot hide system files".into()); }
    let safe = sanitize_powershell_input(&file_path);
    let cmd = format!("$item = Get-Item -LiteralPath '{}' -Force; $item.Attributes = $item.Attributes -bor [System.IO.FileAttributes]::Hidden; 'Hidden'", safe);
    let output = hidden_powershell().args(&["-Command", &cmd]).output().map_err(|e| format!("Failed: {}", e))?;
    let res = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(HiddenFileResult { success: res.contains("Hidden"), message: if res.contains("Hidden") { "File hidden successfully".into() } else { "Failed to hide file".into() }, path: file_path })
}

#[tauri::command]
pub async fn unhide_file_or_folder(file_path: String) -> Result<HiddenFileResult, String> {
    info!("[FileHider] Unhiding: {}", file_path);
    let safe = sanitize_powershell_input(&file_path);
    let cmd = format!("$item = Get-Item -LiteralPath '{}' -Force; $item.Attributes = $item.Attributes -band -bnot [System.IO.FileAttributes]::Hidden; 'Visible'", safe);
    let output = hidden_powershell().args(&["-Command", &cmd]).output().map_err(|e| format!("Failed: {}", e))?;
    let res = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(HiddenFileResult { success: res.contains("Visible"), message: if res.contains("Visible") { "File is now visible".into() } else { "Failed to unhide file".into() }, path: file_path })
}

#[tauri::command]
pub async fn list_hidden_files(directory: String) -> Result<Vec<String>, String> {
    info!("[FileHider] Listing hidden files in: {}", directory);
    let safe = sanitize_powershell_input(&directory);
    let cmd = format!("Get-ChildItem -Path '{}' -Force -ErrorAction SilentlyContinue | Where-Object {{ $_.Attributes -band [System.IO.FileAttributes]::Hidden }} | Select-Object -ExpandProperty FullName", safe);
    let output = hidden_powershell().args(&["-Command", &cmd]).output().map_err(|e| format!("Failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    Ok(stdout.lines().filter(|l| !l.trim().is_empty()).map(|l| l.trim().to_string()).collect())
}

// ── Password Generator ──

#[tauri::command]
pub async fn generate_password(length: u32, uppercase: bool, lowercase: bool, numbers: bool, symbols: bool) -> Result<PasswordResult, String> {
    let length = length.max(8).min(128);
    let mut charset = String::new();
    if lowercase { charset.push_str("abcdefghijkmnopqrstuvwxyz"); }
    if uppercase { charset.push_str("ABCDEFGHJKLMNPQRSTUVWXYZ"); }
    if numbers { charset.push_str("23456789"); }
    if symbols { charset.push_str("!@#$%^&*-_=+?"); }
    if charset.is_empty() { charset = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*".to_string(); }
    let chars: Vec<char> = charset.chars().collect();
    let mut password = String::with_capacity(length as usize);
    for i in 0..length as usize {
        let ts = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos() as usize;
        let idx = (ts.wrapping_add(i * 37).wrapping_add(i * i)) % chars.len();
        password.push(chars[idx]);
    }
    let entropy = (length as f64) * (chars.len() as f64).log2();
    let strength = if entropy >= 80.0 { "Very Strong" } else if entropy >= 60.0 { "Strong" } else if entropy >= 40.0 { "Medium" } else { "Weak" };
    Ok(PasswordResult { password, strength: strength.into(), entropy_bits: (entropy * 10.0).round() / 10.0 })
}

// ── Anti-Spyware / Defender ──

#[tauri::command]
pub async fn get_defender_status() -> Result<DefenderStatus, String> {
    info!("[AntiSpyware] Getting Windows Defender status");
    let ps = "Get-MpComputerStatus | Select-Object AntivirusEnabled,RealTimeProtectionEnabled,AntivirusSignatureLastUpdated,AntivirusSignatureVersion,FullScanEndTime,AMEngineVersion | ConvertTo-Json";
    let output = hidden_powershell().args(&["-Command", ps]).output().map_err(|e| format!("Failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    if let Ok(d) = serde_json::from_str::<serde_json::Value>(&stdout) {
        Ok(DefenderStatus {
            antivirus_enabled: d["AntivirusEnabled"].as_bool().unwrap_or(false),
            real_time_protection: d["RealTimeProtectionEnabled"].as_bool().unwrap_or(false),
            definition_date: d["AntivirusSignatureLastUpdated"].as_str().or_else(|| d["AntivirusSignatureLastUpdated"]["DateTime"].as_str()).unwrap_or("Unknown").to_string(),
            definition_version: d["AntivirusSignatureVersion"].as_str().unwrap_or("Unknown").to_string(),
            last_scan_time: d["FullScanEndTime"].as_str().or_else(|| d["FullScanEndTime"]["DateTime"].as_str()).unwrap_or("Never").to_string(),
            engine_version: d["AMEngineVersion"].as_str().unwrap_or("Unknown").to_string(),
        })
    } else { Err("Could not parse Defender status".into()) }
}

#[tauri::command]
pub async fn run_defender_scan(scan_type: String, target_path: Option<String>) -> Result<ScanResult, String> {
    info!("[AntiSpyware] Running Defender scan: {}", scan_type);
    let mp = "C:\\Program Files\\Windows Defender\\MpCmdRun.exe";
    if !Path::new(mp).exists() { return Err("Windows Defender not found".into()); }
    let args = match scan_type.as_str() {
        "quick" => vec!["-Scan", "-ScanType", "1"],
        "full" => vec!["-Scan", "-ScanType", "2"],
        "custom" => {
            if let Some(ref p) = target_path {
                if !Path::new(p).exists() { return Err("Target path does not exist".into()); }
                vec!["-Scan", "-ScanType", "3", "-File", p.as_str()]
            } else { return Err("Custom scan requires a target path".into()); }
        }
        _ => return Err("Invalid scan type".into()),
    };
    let output = std::process::Command::new(mp).args(&args).creation_flags_safe().output().map_err(|e| format!("Failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let exit = output.status.code().unwrap_or(-1);
    let threats = if exit == 2 { 1 } else { 0 };
    let status = if exit == 0 { "Clean" } else if exit == 2 { "Threats Found" } else { "Error" };
    Ok(ScanResult { status: status.into(), threats_found: threats, details: if stdout.len() > 500 { format!("{}...", &stdout[..500]) } else { stdout } })
}

#[tauri::command]
pub async fn update_defender_definitions() -> Result<String, String> {
    let mp = "C:\\Program Files\\Windows Defender\\MpCmdRun.exe";
    if !Path::new(mp).exists() { return Err("Windows Defender not found".into()); }
    let output = std::process::Command::new(mp).args(&["-SignatureUpdate"]).creation_flags_safe().output().map_err(|e| format!("Failed: {}", e))?;
    if output.status.success() { Ok("Definitions updated successfully".into()) }
    else { Err(format!("Update failed: {}", String::from_utf8_lossy(&output.stderr))) }
}

// ── Login Monitor ──

#[tauri::command]
pub async fn get_login_events(max_events: Option<u32>) -> Result<Vec<LoginEvent>, String> {
    let count = max_events.unwrap_or(50).min(200);
    info!("[LoginMonitor] Fetching last {} login events", count);
    let ps = format!("try {{ Get-WinEvent -FilterHashtable @{{LogName='Security';Id=4624,4625}} -MaxEvents {} -ErrorAction Stop | ForEach-Object {{ $xml = [xml]$_.ToXml(); $data = $xml.Event.EventData.Data; $user = ($data | Where-Object {{$_.Name -eq 'TargetUserName'}}).'#text'; $src = ($data | Where-Object {{$_.Name -eq 'IpAddress'}}).'#text'; $lt = ($data | Where-Object {{$_.Name -eq 'LogonType'}}).'#text'; [PSCustomObject]@{{ Id=$_.Id; Time=$_.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss'); User=$user; Source=$src; LogonType=$lt }} }} | ConvertTo-Json }} catch {{ '[]' }}", count);
    let output = hidden_powershell().args(&["-Command", &ps]).output().map_err(|e| format!("Failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let mut events = Vec::new();
    let lt_name = |lt: &str| -> String { match lt { "2" => "Interactive".into(), "3" => "Network".into(), "5" => "Service".into(), "7" => "Unlock".into(), "10" => "RemoteDesktop".into(), "11" => "Cached".into(), _ => format!("Type {}", lt) } };
    let parse = |item: &serde_json::Value| -> Option<LoginEvent> {
        let id = item["Id"].as_i64()?;
        let user = item["User"].as_str().unwrap_or("Unknown").to_string();
        if user == "SYSTEM" || user == "NETWORK SERVICE" || user == "LOCAL SERVICE" || user.ends_with('$') { return None; }
        let src = item["Source"].as_str().unwrap_or("-").to_string();
        Some(LoginEvent {
            event_type: if id == 4624 { "Login Success" } else { "Login Failed" }.into(),
            timestamp: item["Time"].as_str().unwrap_or("").into(), username: user,
            source_ip: if src == "-" || src.is_empty() { "Local".into() } else { src },
            logon_type: lt_name(item["LogonType"].as_str().unwrap_or("?")),
            status: if id == 4624 { "Success" } else { "Failed" }.into(),
        })
    };
    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&stdout) {
        if let Some(arr) = data.as_array() { for item in arr { if let Some(e) = parse(item) { events.push(e); } } }
        else { if let Some(e) = parse(&data) { events.push(e); } }
    }
    Ok(events)
}
