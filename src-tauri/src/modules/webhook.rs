use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;
use std::collections::HashMap;
use tracing::info;

/// Webhook configuration stored in %APPDATA%\SABI\webhook.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    /// Webhook endpoint URL
    pub url: String,
    /// Payload format: "json" or "cef"
    pub format: String,
    /// Whether webhook is enabled
    pub enabled: bool,
    /// Custom HTTP headers (e.g. Authorization: Bearer xxx)
    pub headers: HashMap<String, String>,
}

impl Default for WebhookConfig {
    fn default() -> Self {
        Self {
            url: String::new(),
            format: "json".to_string(),
            enabled: false,
            headers: HashMap::new(),
        }
    }
}

/// Config file path
fn config_path() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("C:\\ProgramData"));
    let dir = base.join("SABI");
    fs::create_dir_all(&dir).ok();
    dir.join("webhook.json")
}

fn load_config() -> WebhookConfig {
    let path = config_path();
    if !path.exists() {
        return WebhookConfig::default();
    }
    fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_config_to_disk(config: &WebhookConfig) {
    let path = config_path();
    if let Ok(json) = serde_json::to_string_pretty(config) {
        fs::write(&path, json).ok();
    }
}

/// Format a payload as CEF string
fn to_cef(event_type: &str, payload: &serde_json::Value) -> String {
    let details = serde_json::to_string(payload).unwrap_or_default();
    format!(
        "CEF:0|SABI|SystemOptimizer|1.3.0|{}|SABI Event|5|msg={}\n",
        event_type,
        details.replace('|', "\\|")
    )
}

/// Send a webhook notification (called by other modules after operations)
pub async fn send_webhook_event(event_type: &str, payload: serde_json::Value) {
    let config = load_config();
    if !config.enabled || config.url.is_empty() {
        return;
    }

    let body = match config.format.as_str() {
        "cef" => to_cef(event_type, &payload),
        _ => serde_json::to_string_pretty(&serde_json::json!({
            "event": event_type,
            "timestamp": chrono::Utc::now().to_rfc3339(),
            "source": "SABI",
            "version": "1.3.0",
            "hostname": std::env::var("COMPUTERNAME").unwrap_or_default(),
            "data": payload
        })).unwrap_or_default(),
    };

    let client = reqwest::Client::new();
    let mut request = client.post(&config.url);

    // Set content type based on format
    request = match config.format.as_str() {
        "cef" => request.header("Content-Type", "text/plain"),
        _ => request.header("Content-Type", "application/json"),
    };

    // Add custom headers
    for (key, value) in &config.headers {
        request = request.header(key.as_str(), value.as_str());
    }

    match request.body(body).send().await {
        Ok(resp) => info!("[Webhook] POST {} → {}", config.url, resp.status()),
        Err(e) => info!("[Webhook] POST {} failed: {}", config.url, e),
    }
}

// ── Tauri Commands ──

#[tauri::command]
pub async fn get_webhook_config() -> WebhookConfig {
    load_config()
}

#[tauri::command]
pub async fn save_webhook_config(config: WebhookConfig) -> Result<(), String> {
    info!("[Webhook] Saving config: url={}, format={}, enabled={}",
        config.url, config.format, config.enabled);
    save_config_to_disk(&config);
    Ok(())
}

#[tauri::command]
pub async fn test_webhook() -> Result<String, String> {
    let config = load_config();
    if config.url.is_empty() {
        return Err("No webhook URL configured".to_string());
    }

    let test_payload = serde_json::json!({
        "event": "test",
        "timestamp": chrono::Utc::now().to_rfc3339(),
        "source": "SABI",
        "version": "1.3.0",
        "data": {
            "message": "This is a test webhook from SABI",
            "scan_results": {
                "junk_files_mb": 142.5,
                "registry_issues": 23,
                "privacy_traces": 87,
                "startup_items": 12,
                "health_score": 78
            }
        }
    });

    let body = match config.format.as_str() {
        "cef" => to_cef("test", &test_payload),
        _ => serde_json::to_string_pretty(&test_payload).unwrap_or_default(),
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())?;

    let mut request = client.post(&config.url);
    request = match config.format.as_str() {
        "cef" => request.header("Content-Type", "text/plain"),
        _ => request.header("Content-Type", "application/json"),
    };
    for (key, value) in &config.headers {
        request = request.header(key.as_str(), value.as_str());
    }

    match request.body(body).send().await {
        Ok(resp) => {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            if status.is_success() {
                Ok(format!("✓ Webhook responded with {} ({})", status, body.chars().take(200).collect::<String>()))
            } else {
                Err(format!("Webhook returned {}: {}", status, body.chars().take(200).collect::<String>()))
            }
        }
        Err(e) => Err(format!("Connection failed: {}", e)),
    }
}
