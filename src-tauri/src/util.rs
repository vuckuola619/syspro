use std::path::PathBuf;
use walkdir::WalkDir;
use winreg::enums::KEY_READ;
use winreg::RegKey;

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Creates a PowerShell command that runs completely hidden (no visible window).
/// All Tauri commands should use this instead of Command::new("powershell") directly.
pub fn hidden_powershell() -> std::process::Command {
    let mut cmd = std::process::Command::new("powershell");
    cmd.args(&["-NoProfile", "-WindowStyle", "Hidden"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    cmd
}

/// Sanitize user input before interpolating into PowerShell commands.
/// Strips characters that could cause command injection: backtick, $, ;, |, (, ), newlines.
pub fn sanitize_powershell_input(input: &str) -> String {
    input
        .chars()
        .filter(|c| !matches!(c, '`' | '$' | ';' | '|' | '(' | ')' | '{' | '}' | '\n' | '\r'))
        .collect::<String>()
        .replace('\'', "''")
}

/// Convert bytes to GB with 1 decimal precision.
pub fn bytes_to_gb(bytes: u64) -> f64 {
    (bytes as f64 / 1_073_741_824.0 * 10.0).round() / 10.0
}

/// Recursively scan a directory for total size (bytes) and file count.
pub fn scan_directory_size(path: &str) -> (u64, u64) {
    let mut total_bytes: u64 = 0;
    let mut file_count: u64 = 0;
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            total_bytes += entry.metadata().map(|m| m.len()).unwrap_or(0);
            file_count += 1;
        }
    }
    (total_bytes, file_count)
}

/// Scan a directory for files matching given extensions. Returns (total_bytes, file_count).
pub fn scan_directory_recursive(path: &str, extensions: &[&str]) -> (u64, u64) {
    let mut total_bytes: u64 = 0;
    let mut file_count: u64 = 0;
    for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if extensions.is_empty() {
                total_bytes += entry.metadata().map(|m| m.len()).unwrap_or(0);
                file_count += 1;
            } else if let Some(ext) = entry.path().extension().and_then(|e| e.to_str()) {
                if extensions.iter().any(|wanted| ext.eq_ignore_ascii_case(wanted)) {
                    total_bytes += entry.metadata().map(|m| m.len()).unwrap_or(0);
                    file_count += 1;
                }
            }
        }
    }
    (total_bytes, file_count)
}

/// Calculate directory size in MB (up to 3 levels deep).
pub fn dir_size_mb(path: &str) -> f64 {
    let mut total: u64 = 0;
    for entry in WalkDir::new(path).max_depth(3).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    (total as f64 / 1024.0 / 1024.0 * 10.0).round() / 10.0
}

/// Get the SABI configuration directory (%APPDATA%\SABI\).
pub fn get_config_dir() -> PathBuf {
    dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("C:\\Users\\Default\\AppData\\Roaming"))
        .join("SABI")
}

/// Read a DWORD value from the Windows registry.
pub fn read_reg_dword(hkey: &RegKey, subkey_path: &str, value_name: &str) -> Option<u32> {
    hkey.open_subkey_with_flags(subkey_path, KEY_READ)
        .ok()
        .and_then(|key| key.get_value::<u32, _>(value_name).ok())
}

/// Get the current local time as ISO 8601 string.
pub fn chrono_now() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

/// Compare two semver strings like "1.0.0" vs "1.1.0".
/// Returns true if `latest` is newer than `current`.
pub fn version_is_newer(current: &str, latest: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.').filter_map(|s| s.parse::<u32>().ok()).collect()
    };
    let c = parse(current);
    let l = parse(latest);
    for i in 0..3 {
        let cv = c.get(i).copied().unwrap_or(0);
        let lv = l.get(i).copied().unwrap_or(0);
        if lv > cv {
            return true;
        }
        if lv < cv {
            return false;
        }
    }
    false
}

/// Helper trait for setting CREATE_NO_WINDOW on Windows process Commands.
pub trait CommandCreationFlags {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bytes_to_gb() {
        assert_eq!(bytes_to_gb(1_073_741_824), 1.0);
        assert_eq!(bytes_to_gb(0), 0.0);
        assert_eq!(bytes_to_gb(536_870_912), 0.5);
    }

    #[test]
    fn test_sanitize_powershell_input() {
        assert_eq!(sanitize_powershell_input("hello"), "hello");
        assert_eq!(sanitize_powershell_input("$test;rm -rf"), "testrm -rf");
        assert_eq!(sanitize_powershell_input("it's"), "it''s");
        assert_eq!(sanitize_powershell_input("a|b`c$(d)"), "abcd");
    }

    #[test]
    fn test_version_is_newer() {
        assert!(version_is_newer("1.0.0", "1.0.1"));
        assert!(version_is_newer("1.0.0", "1.1.0"));
        assert!(version_is_newer("1.0.0", "2.0.0"));
        assert!(!version_is_newer("1.0.0", "1.0.0"));
        assert!(!version_is_newer("1.1.0", "1.0.0"));
        assert!(!version_is_newer("2.0.0", "1.9.9"));
    }

    #[test]
    fn test_chrono_now_format() {
        let now = chrono_now();
        // Should be "YYYY-MM-DD HH:MM:SS" format
        assert_eq!(now.len(), 19);
        assert_eq!(&now[4..5], "-");
        assert_eq!(&now[7..8], "-");
        assert_eq!(&now[10..11], " ");
    }

    #[test]
    fn test_get_config_dir() {
        let dir = get_config_dir();
        let dir_str = dir.to_string_lossy();
        assert!(dir_str.ends_with("SABI"));
    }
}
