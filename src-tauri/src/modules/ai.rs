use serde::Serialize;
use tracing::info;

use crate::util::hidden_powershell;

// ── Structs ──

#[derive(Serialize)]
pub struct OptimizationScore {
    pub overall_score: u32,
    pub grade: String,
    pub categories: Vec<ScoreCategory>,
    pub recommendations: Vec<Recommendation>,
}

#[derive(Serialize)]
pub struct ScoreCategory { pub name: String, pub score: u32, pub max_score: u32, pub status: String }

#[derive(Serialize)]
pub struct Recommendation { pub title: String, pub description: String, pub impact: String, pub category: String, pub auto_fixable: bool }

#[derive(Serialize)]
pub struct Iso27001Report { pub txt: String, pub csv: String }

#[derive(Serialize)]
pub struct AppUpdateInfo {
    pub current_version: String, pub latest_version: String,
    pub update_available: bool, pub release_notes: String, pub download_url: String,
}

// ── Helpers ──

fn version_is_newer(current: &str, latest: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> { v.split('.').filter_map(|s| s.parse::<u32>().ok()).collect() };
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

// ── Commands: Optimization Score ──

#[tauri::command]
pub async fn get_optimization_score() -> Result<OptimizationScore, String> {
    info!("[SmartOptimize] Calculating system optimization score");
    let mut categories = Vec::new();
    let mut recommendations = Vec::new();

    // 1. Memory usage score (0-20)
    let sys = sysinfo::System::new_with_specifics(
        sysinfo::RefreshKind::nothing().with_memory(sysinfo::MemoryRefreshKind::everything())
    );
    let mem_pct = (sys.used_memory() as f64 / sys.total_memory() as f64 * 100.0) as u32;
    let mem_score = if mem_pct < 60 { 20 } else if mem_pct < 75 { 15 } else if mem_pct < 90 { 10 } else { 5 };
    categories.push(ScoreCategory { name: "Memory".into(), score: mem_score, max_score: 20, status: format!("{}% used", mem_pct) });
    if mem_pct > 75 {
        recommendations.push(Recommendation { title: "High Memory Usage".into(), description: format!("Memory is {}% used. Close unnecessary applications.", mem_pct), impact: "High".into(), category: "Performance".into(), auto_fixable: false });
    }

    // 2. Disk space score (0-20)
    let disks = sysinfo::Disks::new_with_refreshed_list();
    let mut disk_score = 20u32;
    for disk in disks.list() {
        let total = disk.total_space();
        let avail = disk.available_space();
        if total > 0 {
            let used = ((total - avail) as f64 / total as f64 * 100.0) as u32;
            if used > 90 { disk_score = 5; recommendations.push(Recommendation { title: format!("Drive {} Nearly Full", disk.mount_point().display()), description: format!("{}% used — run Junk Cleaner.", used), impact: "High".into(), category: "Disk".into(), auto_fixable: true }); }
            else if used > 75 { disk_score = disk_score.min(12); }
        }
    }
    categories.push(ScoreCategory { name: "Disk Space".into(), score: disk_score, max_score: 20, status: if disk_score >= 15 { "Healthy".into() } else { "Low space".into() } });

    // 3. Startup items score (0-20)
    let startup_out = hidden_powershell().args(&["-Command", "Get-CimInstance Win32_StartupCommand | Measure-Object | Select-Object -ExpandProperty Count"]).output().ok();
    let startup_count: u32 = startup_out.map(|o| String::from_utf8_lossy(&o.stdout).trim().parse().unwrap_or(0)).unwrap_or(0);
    let startup_score = if startup_count < 5 { 20 } else if startup_count < 10 { 15 } else if startup_count < 20 { 10 } else { 5 };
    categories.push(ScoreCategory { name: "Startup".into(), score: startup_score, max_score: 20, status: format!("{} items", startup_count) });
    if startup_count > 10 { recommendations.push(Recommendation { title: "Too Many Startup Items".into(), description: format!("{} startup items slow boot time.", startup_count), impact: "Medium".into(), category: "Performance".into(), auto_fixable: true }); }

    // 4. Security score (0-20)
    let defender_out = hidden_powershell().args(&["-Command", "try { (Get-MpComputerStatus).RealTimeProtectionEnabled } catch { 'false' }"]).output().ok();
    let defender_on = defender_out.map(|o| String::from_utf8_lossy(&o.stdout).trim().to_lowercase().contains("true")).unwrap_or(false);
    let fw_out = hidden_powershell().args(&["-Command", "try { (Get-NetFirewallProfile -Profile Domain,Public,Private | Where-Object {$_.Enabled -eq $true}).Count } catch { 0 }"]).output().ok();
    let fw_count: u32 = fw_out.map(|o| String::from_utf8_lossy(&o.stdout).trim().parse().unwrap_or(0)).unwrap_or(0);
    let sec_score = (if defender_on { 10 } else { 0 }) + (if fw_count >= 3 { 10 } else if fw_count >= 1 { 5 } else { 0 });
    categories.push(ScoreCategory { name: "Security".into(), score: sec_score, max_score: 20, status: format!("Defender: {}, Firewall: {}/3", if defender_on { "On" } else { "Off" }, fw_count) });
    if !defender_on { recommendations.push(Recommendation { title: "Windows Defender Disabled".into(), description: "Real-time protection is off.".into(), impact: "Critical".into(), category: "Security".into(), auto_fixable: false }); }

    // 5. System updates score (0-20)
    let upd_out = hidden_powershell().args(&["-Command", "try { $wu = New-Object -ComObject Microsoft.Update.Session; $s = $wu.CreateUpdateSearcher(); $r = $s.Search('IsInstalled=0'); $r.Updates.Count } catch { -1 }"]).output().ok();
    let pending: i32 = upd_out.map(|o| String::from_utf8_lossy(&o.stdout).trim().parse().unwrap_or(-1)).unwrap_or(-1);
    let upd_score = if pending == 0 { 20 } else if pending < 5 { 15 } else if pending < 10 { 10 } else { 5 };
    categories.push(ScoreCategory { name: "Updates".into(), score: upd_score, max_score: 20, status: if pending < 0 { "Unable to check".into() } else { format!("{} pending", pending) } });

    let overall = categories.iter().map(|c| c.score).sum::<u32>();
    let grade = match overall { 90..=100 => "A+", 80..=89 => "A", 70..=79 => "B", 60..=69 => "C", 50..=59 => "D", _ => "F" }.to_string();
    info!("[SmartOptimize] Score: {}/100 ({})", overall, grade);
    Ok(OptimizationScore { overall_score: overall, grade, categories, recommendations })
}

// ── Commands: ISO 27001 Report ──

#[tauri::command]
pub async fn generate_iso27001_report() -> Result<Iso27001Report, String> {
    info!("[ISO27001] Generating comprehensive audit report");
    // The ISO 27001 script is very large — executed via PowerShell
    let script = include_str!("../../scripts/iso27001_report.ps1");
    
    // Fallback: if the script file doesn't exist, use inline minimal version
    let ps_script = if script.trim().is_empty() {
        r#"
$ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
$out = "SABI ISO 27001 Audit Report - Generated: $ts`r`n"
$csv = "Section,Key,Value`r`n"
$os = Get-CimInstance Win32_OperatingSystem
$out += "OS: $($os.Caption) $($os.Version)`r`n"
$csv += "System,OS,$($os.Caption)`r`n"
Write-Output "===TXT_START==="
Write-Output $out
Write-Output "===TXT_END==="
Write-Output "===CSV_START==="
Write-Output $csv
Write-Output "===CSV_END==="
"#.to_string()
    } else {
        script.to_string()
    };

    let mut command = hidden_powershell();
    command.args(&["-Command", &ps_script]);
    let output = command.output().map_err(|e| e.to_string())?;
    let raw = String::from_utf8_lossy(&output.stdout).to_string();

    let txt = raw.split("===TXT_START===").nth(1).unwrap_or("").split("===TXT_END===").next().unwrap_or("").trim().to_string();
    let csv = raw.split("===CSV_START===").nth(1).unwrap_or("").split("===CSV_END===").next().unwrap_or("").trim().to_string();

    Ok(Iso27001Report { txt, csv })
}

// ── Commands: Auto-Update Check ──

#[tauri::command]
pub async fn check_for_app_update() -> Result<AppUpdateInfo, String> {
    info!("[AutoUpdate] Checking for updates");
    let current = env!("CARGO_PKG_VERSION");
    let cmd = r#"
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $headers = @{ 'User-Agent' = 'SABI-Updater' }
    $resp = Invoke-RestMethod -Uri 'https://api.github.com/repos/vuckuola619/syspro/releases/latest' -Headers $headers -TimeoutSec 10
    $result = @{ tag = $resp.tag_name; body = $resp.body; url = $resp.html_url } | ConvertTo-Json -Compress
    Write-Output $result
} catch { Write-Output '{"tag":"","body":"","url":""}' }
"#;
    let output = hidden_powershell().args(&["-Command", cmd]).output().map_err(|e| format!("Failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let json_val: serde_json::Value = serde_json::from_str(&stdout).unwrap_or_else(|_| serde_json::json!({"tag":"","body":"","url":""}));
    let latest_tag = json_val.get("tag").and_then(|v| v.as_str()).unwrap_or("");
    let body = json_val.get("body").and_then(|v| v.as_str()).unwrap_or("");
    let url = json_val.get("url").and_then(|v| v.as_str()).unwrap_or("");
    let latest_version = latest_tag.trim_start_matches('v');
    if latest_version.is_empty() {
        return Ok(AppUpdateInfo { current_version: current.into(), latest_version: current.into(), update_available: false, release_notes: "Could not check for updates.".into(), download_url: String::new() });
    }
    let update_available = version_is_newer(current, latest_version);
    Ok(AppUpdateInfo {
        current_version: current.into(), latest_version: latest_version.into(), update_available,
        release_notes: if update_available { body.into() } else { "You are running the latest version.".into() },
        download_url: url.into(),
    })
}

// ── Commands: Driver Auto-Download ──

#[tauri::command]
pub async fn download_driver_update(device_name: String) -> Result<String, String> {
    info!("[DriverUpdate] Attempting to update driver for: {}", device_name);
    let cmd = format!(r#"
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
        if ($InstallResult.ResultCode -eq 2) {{ Write-Output "SUCCESS: Driver installed" }}
        else {{ Write-Output "PARTIAL: Downloaded but needs restart" }}
        $found = $true
        break
    }}
}}
if (-not $found) {{ pnputil /scan-devices 2>&1 | Out-Null; Write-Output "SCAN: Device scan completed" }}
"#, device_name.replace('\'', "''"));
    let output = hidden_powershell().args(&["-ExecutionPolicy", "Bypass", "-Command", &cmd]).output().map_err(|e| format!("Failed: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    if stdout.contains("SUCCESS") { Ok(format!("Driver updated successfully for {}", device_name)) }
    else if stdout.contains("PARTIAL") { Ok(format!("Driver downloaded for {}. Restart required.", device_name)) }
    else if stdout.contains("SCAN") { Ok(format!("Triggered device scan for {}. Check Windows Update.", device_name)) }
    else { Err(format!("No driver update found for {}. {}", device_name, stderr.trim())) }
}
