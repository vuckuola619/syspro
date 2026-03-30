use serde::{Serialize, Deserialize};
use std::env;
use std::collections::HashMap;
use tracing::info;
use sysinfo::{Networks, System};

use crate::util::{hidden_powershell, sanitize_powershell_input};

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
pub struct NetworkConnection {
    pub local_address: String,
    pub local_port: u16,
    pub remote_address: String,
    pub remote_port: u16,
    pub state: String,
    pub process_name: String,
    pub pid: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct HostsEntry {
    pub ip: String,
    pub hostname: String,
    pub comment: String,
    pub enabled: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FirewallRule {
    pub name: String,
    pub display_name: String,
    pub direction: String,
    pub action: String,
    pub enabled: bool,
    pub program: String,
    pub profile: String,
}

#[derive(Serialize, Deserialize)]
pub struct NetworkSpeed {
    pub adapter_name: String,
    pub bytes_sent: u64,
    pub bytes_received: u64,
    pub speed_mbps: f64,
    pub timestamp_ms: u64,
}

#[derive(Serialize)]
pub struct SpeedTestResult {
    pub download_mbps: f64,
    pub upload_mbps: f64,
    pub latency_ms: u64,
    pub server: String,
    pub timestamp: String,
}

#[derive(Serialize)]
pub struct DnsConfig {
    pub interface_name: String,
    pub current_dns: Vec<String>,
    pub is_secure: bool,
}

#[derive(Serialize)]
pub struct DnsProvider {
    pub name: String,
    pub primary: String,
    pub secondary: String,
    pub category: String,
    pub description: String,
}

#[derive(Serialize)]
pub struct HostsBlockStatus {
    pub total_blocked: u32,
    pub is_active: bool,
    pub backup_exists: bool,
    pub categories: Vec<BlockCategory>,
}

#[derive(Serialize)]
pub struct BlockCategory {
    pub name: String,
    pub count: u32,
    pub domains: Vec<String>,
}

#[derive(Serialize)]
pub struct UpdateInfo {
    pub hotfix_id: String,
    pub description: String,
    pub installed_on: String,
    pub title: String,
    pub kb_url: String,
}

// ── Helpers ──

fn chrono_now() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

fn get_dns_providers_list_internal() -> Vec<DnsProvider> {
    vec![
        DnsProvider { name: "Cloudflare".into(), primary: "1.1.1.1".into(), secondary: "1.0.0.1".into(), category: "Privacy".into(), description: "Fast, privacy-focused DNS".into() },
        DnsProvider { name: "Cloudflare Family".into(), primary: "1.1.1.3".into(), secondary: "1.0.0.3".into(), category: "Family Safe".into(), description: "Blocks malware + adult content".into() },
        DnsProvider { name: "Google".into(), primary: "8.8.8.8".into(), secondary: "8.8.4.4".into(), category: "General".into(), description: "Google Public DNS".into() },
        DnsProvider { name: "Quad9".into(), primary: "9.9.9.9".into(), secondary: "149.112.112.112".into(), category: "Security".into(), description: "Blocks malicious domains".into() },
        DnsProvider { name: "OpenDNS".into(), primary: "208.67.222.222".into(), secondary: "208.67.220.220".into(), category: "Security".into(), description: "Cisco OpenDNS with threat protection".into() },
        DnsProvider { name: "OpenDNS Family".into(), primary: "208.67.222.123".into(), secondary: "208.67.220.123".into(), category: "Family Safe".into(), description: "OpenDNS FamilyShield".into() },
        DnsProvider { name: "AdGuard".into(), primary: "94.140.14.14".into(), secondary: "94.140.15.15".into(), category: "Ad Blocking".into(), description: "Blocks ads and trackers at DNS level".into() },
        DnsProvider { name: "AdGuard Family".into(), primary: "94.140.14.15".into(), secondary: "94.140.15.16".into(), category: "Family Safe".into(), description: "AdGuard with family protection".into() },
    ]
}

fn get_blocked_domains() -> Vec<(&'static str, &'static str)> {
    vec![
        ("ads.google.com", "Ads"), ("pagead2.googlesyndication.com", "Ads"),
        ("adservice.google.com", "Ads"), ("ad.doubleclick.net", "Ads"),
        ("googleads.g.doubleclick.net", "Ads"), ("static.ads-twitter.com", "Ads"),
        ("ads.yahoo.com", "Ads"),
        ("tracking.google.com", "Trackers"), ("bat.bing.com", "Trackers"),
        ("pixel.facebook.com", "Trackers"), ("analytics.twitter.com", "Trackers"),
        ("t.co", "Trackers"), ("connect.facebook.net", "Trackers"),
        ("pixel.quantserve.com", "Trackers"), ("sb.scorecardresearch.com", "Trackers"),
        ("telemetry.microsoft.com", "Telemetry"), ("vortex.data.microsoft.com", "Telemetry"),
        ("settings-win.data.microsoft.com", "Telemetry"), ("watson.telemetry.microsoft.com", "Telemetry"),
        ("activity.windows.com", "Telemetry"), ("diagnostics.office.com", "Telemetry"),
        ("malware.wicar.org", "Malware"), ("eicar.org", "Malware"),
    ]
}

// ── Commands: Network Monitor ──

#[tauri::command]
pub async fn get_network_connections() -> Vec<NetworkConnection> {
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

// ── Commands: Hosts File Editor ──

#[tauri::command]
pub async fn read_hosts_file() -> Vec<HostsEntry> {
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
            let uncommented = trimmed.trim_start_matches('#').trim();
            if uncommented.starts_with("127.") || uncommented.starts_with("0.0.0.0") || uncommented.starts_with("::1") {
                (false, uncommented.to_string())
            } else {
                continue;
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
pub async fn add_hosts_entry(ip: String, hostname: String) -> Result<(), String> {
    info!("[HostsEditor] Adding {} -> {}", ip, hostname);

    let ip_parts: Vec<&str> = ip.split('.').collect();
    if ip_parts.len() != 4 || !ip_parts.iter().all(|p| p.parse::<u8>().is_ok()) {
        return Err("Invalid IP address. Use IPv4 format (e.g., 0.0.0.0)".into());
    }

    if hostname.is_empty() || !hostname.chars().all(|c| c.is_ascii_alphanumeric() || c == '.' || c == '-' || c == '_') {
        return Err("Invalid hostname. Only alphanumeric, dot, dash, underscore allowed.".into());
    }

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
pub async fn remove_hosts_entry(ip: String, hostname: String) -> Result<(), String> {
    info!("[HostsEditor] Removing {} -> {}", ip, hostname);
    let hosts_path = r"C:\Windows\System32\drivers\etc\hosts";
    let content = std::fs::read_to_string(hosts_path).map_err(|e| e.to_string())?;

    let new_content: Vec<&str> = content.lines().filter(|line| {
        let trimmed = line.trim();
        let effective = trimmed.trim_start_matches('#').trim();
        let parts: Vec<&str> = effective.split_whitespace().collect();
        !(parts.len() >= 2 && parts[0] == ip && parts[1] == hostname)
    }).collect();

    std::fs::write(hosts_path, new_content.join("\n"))
        .map_err(|e| format!("Failed: {}. Run as Administrator.", e))
}

#[tauri::command]
pub async fn block_telemetry_hosts() -> Result<String, String> {
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

// ── Commands: Firewall Manager ──

#[tauri::command]
pub async fn get_firewall_rules() -> Vec<FirewallRule> {
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
pub async fn toggle_firewall_rule(rule_name: String, enable: bool) -> Result<String, String> {
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
pub async fn add_firewall_rule(display_name: String, program_path: String, direction: String, action: String) -> Result<String, String> {
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

// ── Commands: Network Speed ──

#[tauri::command]
pub async fn get_network_speed() -> Vec<NetworkSpeed> {
    let networks = Networks::new_with_refreshed_list();
    let mut speeds = Vec::new();
    for (name, data) in &networks {
        speeds.push(NetworkSpeed {
            adapter_name: name.to_string(),
            bytes_sent: data.total_transmitted(),
            bytes_received: data.total_received(),
            speed_mbps: 0.0,
            timestamp_ms: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as u64,
        });
    }
    speeds
}

// ── Commands: Speed Test ──

#[tauri::command]
pub async fn run_speed_test() -> Result<SpeedTestResult, String> {
    info!("[SpeedTest] Starting speed test");

    let ping_cmd = hidden_powershell()
        .args(&["-Command",
            "(Test-Connection -ComputerName 8.8.8.8 -Count 3 -ErrorAction SilentlyContinue | Measure-Object -Property ResponseTime -Average).Average"])
        .creation_flags_safe()
        .output();

    let latency = ping_cmd.ok()
        .and_then(|o| String::from_utf8_lossy(&o.stdout).trim().parse::<f64>().ok())
        .unwrap_or(0.0) as u64;

    let dl_cmd = hidden_powershell()
        .args(&["-Command", r#"
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

    let ul_cmd = hidden_powershell()
        .args(&["-Command", r#"
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

// ── Commands: DNS Protector ──

#[tauri::command]
pub async fn get_dns_config() -> Result<Vec<DnsConfig>, String> {
    info!("[DnsProtector] Getting DNS configuration");

    let ps_cmd = "Get-NetAdapter | Where-Object {$_.Status -eq 'Up'} | ForEach-Object { $dns = (Get-DnsClientServerAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4).ServerAddresses; [PSCustomObject]@{ Name=$_.Name; DNS=($dns -join ',') } } | ConvertTo-Json";
    let output = hidden_powershell()
        .args(&["-Command", ps_cmd])
        .output()
        .map_err(|e| format!("Failed to get DNS config: {}", e))?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();

    let secure_dns: Vec<&str> = vec![
        "1.1.1.1", "1.0.0.1", "1.1.1.3", "1.0.0.3",
        "8.8.8.8", "8.8.4.4",
        "9.9.9.9", "149.112.112.112",
        "208.67.222.222", "208.67.220.220", "208.67.222.123", "208.67.220.123",
        "94.140.14.14", "94.140.15.15", "94.140.14.15", "94.140.15.16",
    ];

    let mut configs = Vec::new();

    let parse_item = |item: &serde_json::Value| -> Option<DnsConfig> {
        let name = item["Name"].as_str()?.to_string();
        let dns_str = item["DNS"].as_str().unwrap_or("");
        let dns_list: Vec<String> = dns_str.split(',').filter(|s| !s.is_empty()).map(|s| s.trim().to_string()).collect();
        let is_secure = !dns_list.is_empty() && dns_list.iter().all(|d| secure_dns.contains(&d.as_str()));
        Some(DnsConfig { interface_name: name, current_dns: dns_list, is_secure })
    };

    if let Ok(data) = serde_json::from_str::<serde_json::Value>(&stdout) {
        if let Some(arr) = data.as_array() {
            for item in arr { if let Some(c) = parse_item(item) { configs.push(c); } }
        } else {
            if let Some(c) = parse_item(&data) { configs.push(c); }
        }
    }

    info!("[DnsProtector] Found {} active interfaces", configs.len());
    Ok(configs)
}

#[tauri::command]
pub async fn get_dns_providers_list() -> Vec<DnsProvider> {
    get_dns_providers_list_internal()
}

#[tauri::command]
pub async fn set_dns_provider(interface_name: String, primary: String, secondary: String) -> Result<String, String> {
    info!("[DnsProtector] Setting DNS for {} to {}, {}", interface_name, primary, secondary);

    let providers = get_dns_providers_list_internal();
    let is_valid = providers.iter().any(|p| p.primary == primary && p.secondary == secondary);
    if !is_valid {
        return Err("DNS servers must be from the approved provider list".into());
    }

    let iface = sanitize_powershell_input(&interface_name);
    let ps_cmd = format!(
        "Set-DnsClientServerAddress -InterfaceAlias '{}' -ServerAddresses ('{}','{}')",
        iface, primary, secondary
    );
    let output = hidden_powershell()
        .args(&["-Command", &ps_cmd])
        .output()
        .map_err(|e| format!("Failed to set DNS: {}", e))?;

    if output.status.success() {
        info!("[DnsProtector] DNS updated successfully");
        Ok(format!("DNS set to {} / {}", primary, secondary))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("Failed: {}. Try running as Administrator.", stderr))
    }
}

#[tauri::command]
pub async fn reset_dns_to_auto(interface_name: String) -> Result<String, String> {
    info!("[DnsProtector] Resetting DNS to automatic for {}", interface_name);
    let iface = sanitize_powershell_input(&interface_name);
    let ps_cmd = format!("Set-DnsClientServerAddress -InterfaceAlias '{}' -ResetServerAddresses", iface);
    let output = hidden_powershell()
        .args(&["-Command", &ps_cmd])
        .output()
        .map_err(|e| format!("Failed to reset DNS: {}", e))?;

    if output.status.success() {
        Ok("DNS reset to automatic (DHCP)".into())
    } else {
        Err("Failed to reset DNS. Try running as Administrator.".into())
    }
}

// ── Commands: Ad Blocker (hosts-file based) ──

#[tauri::command]
pub async fn get_hosts_block_status() -> Result<HostsBlockStatus, String> {
    info!("[AdBlocker] Checking hosts file block status");

    let hosts_path = "C:\\Windows\\System32\\drivers\\etc\\hosts";
    let backup_path = "C:\\Windows\\System32\\drivers\\etc\\hosts.sabi.bak";

    let hosts_content = std::fs::read_to_string(hosts_path).unwrap_or_default();

    let blocked_domains = get_blocked_domains();
    let mut categories_map: HashMap<String, Vec<String>> = HashMap::new();
    let mut total = 0u32;

    for (domain, category) in &blocked_domains {
        let block_line = format!("0.0.0.0 {}", domain);
        if hosts_content.contains(&block_line) {
            total += 1;
            categories_map.entry(category.to_string()).or_default().push(domain.to_string());
        }
    }

    let categories: Vec<BlockCategory> = categories_map.into_iter().map(|(name, domains)| {
        BlockCategory { count: domains.len() as u32, name, domains }
    }).collect();

    Ok(HostsBlockStatus {
        total_blocked: total,
        is_active: total > 0,
        backup_exists: std::path::Path::new(backup_path).exists(),
        categories,
    })
}

#[tauri::command]
pub async fn enable_hosts_blocking() -> Result<String, String> {
    info!("[AdBlocker] Enabling hosts-file ad blocking");

    let hosts_path = "C:\\Windows\\System32\\drivers\\etc\\hosts";
    let backup_path = "C:\\Windows\\System32\\drivers\\etc\\hosts.sabi.bak";

    let content = std::fs::read_to_string(hosts_path)
        .map_err(|e| format!("Cannot read hosts: {}", e))?;

    if !std::path::Path::new(backup_path).exists() {
        std::fs::write(backup_path, &content)
            .map_err(|e| format!("Cannot create backup: {}", e))?;
        info!("[AdBlocker] Backup created at {}", backup_path);
    }

    let blocked = get_blocked_domains();
    let mut new_content = content.clone();

    if !new_content.contains("# SABI Ad Blocker") {
        new_content.push_str("\n\n# SABI Ad Blocker - START\n");
        for (domain, _) in &blocked {
            let line = format!("0.0.0.0 {}\n", domain);
            if !new_content.contains(&line) {
                new_content.push_str(&line);
            }
        }
        new_content.push_str("# SABI Ad Blocker - END\n");
    }

    std::fs::write(hosts_path, new_content)
        .map_err(|e| format!("Cannot write hosts: {}. Run SABI as Administrator.", e))?;

    let _ = hidden_powershell().args(&["-Command", "Clear-DnsClientCache"]).output();

    info!("[AdBlocker] Hosts blocking enabled ({} domains)", blocked.len());
    Ok(format!("Blocked {} domains. DNS cache flushed.", blocked.len()))
}

#[tauri::command]
pub async fn disable_hosts_blocking() -> Result<String, String> {
    info!("[AdBlocker] Disabling hosts-file ad blocking");

    let hosts_path = "C:\\Windows\\System32\\drivers\\etc\\hosts";
    let backup_path = "C:\\Windows\\System32\\drivers\\etc\\hosts.sabi.bak";

    if std::path::Path::new(backup_path).exists() {
        let backup = std::fs::read_to_string(backup_path)
            .map_err(|e| format!("Cannot read backup: {}", e))?;
        std::fs::write(hosts_path, backup)
            .map_err(|e| format!("Cannot restore hosts: {}. Run as Admin.", e))?;
        info!("[AdBlocker] Restored from backup");
        let _ = hidden_powershell().args(&["-Command", "Clear-DnsClientCache"]).output();
        Ok("Hosts restored from backup. DNS cache flushed.".into())
    } else {
        let content = std::fs::read_to_string(hosts_path)
            .map_err(|e| format!("Cannot read hosts: {}", e))?;

        let mut cleaned = String::new();
        let mut in_block = false;
        for line in content.lines() {
            if line.contains("# SABI Ad Blocker - START") { in_block = true; continue; }
            if line.contains("# SABI Ad Blocker - END") { in_block = false; continue; }
            if !in_block {
                cleaned.push_str(line);
                cleaned.push('\n');
            }
        }

        std::fs::write(hosts_path, cleaned)
            .map_err(|e| format!("Cannot write hosts: {}. Run as Admin.", e))?;
        let _ = hidden_powershell().args(&["-Command", "Clear-DnsClientCache"]).output();
        Ok("SABI block entries removed. DNS cache flushed.".into())
    }
}

// get_update_history → kept in system.rs

#[tauri::command]
pub async fn pause_windows_updates(days: u32) -> Result<String, String> {
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

// ── DNS Testing & Management ──

use std::net::TcpStream;
use std::time::Instant;

#[derive(Serialize, Clone)]
pub struct DnsResult {
    pub name: String,
    pub primary: String,
    pub secondary: String,
    pub latency_ms: f64,
    pub is_current: bool,
}

#[tauri::command]
pub async fn test_dns_servers() -> Vec<DnsResult> {
    info!("[InternetBooster] Testing DNS server latencies");

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
pub async fn flush_dns() -> Result<String, String> {
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
pub async fn set_dns_server(primary: String, secondary: String) -> Result<String, String> {
    info!("[InternetBooster] Setting DNS to {} / {}", primary, secondary);

    let output = std::process::Command::new("netsh")
        .args(&["interface", "show", "interface"])
        .output()
        .map_err(|e| format!("Failed to get interfaces: {}", e))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let interface_name = stdout.lines()
        .find(|l| l.contains("Connected") && !l.contains("Loopback"))
        .and_then(|l| l.split_whitespace().last())
        .unwrap_or("Ethernet");

    let cmd1 = format!(
        "netsh interface ip set dns \"{}\" static {} primary",
        interface_name, primary
    );
    let _ = std::process::Command::new("cmd").args(&["/C", &cmd1]).output();

    let cmd2 = format!(
        "netsh interface ip add dns \"{}\" {} index=2",
        interface_name, secondary
    );
    let _ = std::process::Command::new("cmd").args(&["/C", &cmd2]).output();

    info!("[InternetBooster] DNS set to {} / {} on {}", primary, secondary, interface_name);
    Ok(format!("DNS set to {} / {} on {}", primary, secondary, interface_name))
}
