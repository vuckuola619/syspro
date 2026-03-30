use walkdir::WalkDir;
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use winreg::RegKey;
use winreg::enums::*;

/// Creates a PowerShell command that runs completely hidden (no visible window).
pub fn hidden_powershell() -> std::process::Command {
    let mut cmd = std::process::Command::new("powershell");
    cmd.args(&["-NoProfile", "-WindowStyle", "Hidden"]);
    #[cfg(windows)]
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    cmd
}

/// Sanitize user input before interpolating into PowerShell commands.
/// Strips characters that could cause command injection.
pub fn sanitize_powershell_input(input: &str) -> String {
    input
        .chars()
        .filter(|c| !matches!(c, '`' | '$' | ';' | '|' | '(' | ')' | '{' | '}' | '\n' | '\r'))
        .collect::<String>()
        .replace('\'', "''")
}

/// Count files and total size (MB) in a directory (non-recursive, top-level only).
pub fn scan_directory_size(path: &str) -> (u64, u64) {
    let dir = std::path::Path::new(path);
    if !dir.exists() {
        return (0, 0);
    }
    let mut count = 0u64;
    let mut size = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            if let Ok(meta) = entry.metadata() {
                if meta.is_file() {
                    count += 1;
                    size += meta.len();
                }
            }
        }
    }
    (count, size / (1024 * 1024))
}

/// Recursively scan directory, optionally filtering by extensions. Returns (count, size_mb).
pub fn scan_directory_recursive(path: &str, exts: &[&str]) -> (u64, u64) {
    let dir = std::path::Path::new(path);
    if !dir.exists() {
        return (0, 0);
    }
    let mut count = 0u64;
    let mut size = 0u64;
    for entry in WalkDir::new(dir)
        .max_depth(5)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if !exts.is_empty() {
                let matches = entry
                    .path()
                    .extension()
                    .and_then(|e| e.to_str())
                    .map(|e| exts.iter().any(|ext| e.eq_ignore_ascii_case(ext)))
                    .unwrap_or(false);
                if !matches {
                    continue;
                }
            }
            count += 1;
            size += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    (count, size / (1024 * 1024))
}

/// Calculate the size of a directory in MB (max depth 3).
pub fn dir_size_mb(path: &str) -> f64 {
    let mut total: u64 = 0;
    for entry in WalkDir::new(path)
        .max_depth(3)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    (total as f64 / 1024.0 / 1024.0 * 10.0).round() / 10.0
}

/// Read a DWORD value from a registry key, returning None on failure.
pub fn read_reg_dword(hkey: &RegKey, path: &str, value_name: &str) -> Option<u32> {
    hkey.open_subkey_with_flags(path, KEY_READ)
        .ok()
        .and_then(|key| key.get_value::<u32, _>(value_name).ok())
}

/// Compare two semver strings. Returns true if `latest` is newer than `current`.
pub fn version_is_newer(current: &str, latest: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.')
            .filter_map(|s| s.parse::<u32>().ok())
            .collect()
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

/// Get current timestamp as formatted string.
pub fn chrono_now() -> String {
    chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string()
}

/// Helper trait for creation_flags on Windows (no-window).
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
    fn test_sanitize_powershell_input() {
        assert_eq!(sanitize_powershell_input("hello"), "hello");
        assert_eq!(sanitize_powershell_input("test$var"), "testvar");
        assert_eq!(sanitize_powershell_input("name; rm -rf /"), "name rm -rf /");
        assert_eq!(sanitize_powershell_input("it's"), "it''s");
    }

    #[test]
    fn test_version_is_newer() {
        assert!(version_is_newer("1.0.0", "1.1.0"));
        assert!(version_is_newer("1.0.0", "2.0.0"));
        assert!(!version_is_newer("1.1.0", "1.0.0"));
        assert!(!version_is_newer("1.0.0", "1.0.0"));
        assert!(version_is_newer("1.3.0", "1.4.0"));
    }

    #[test]
    fn test_dir_size_mb_nonexistent() {
        assert_eq!(dir_size_mb("C:\\nonexistent_path_12345"), 0.0);
    }
}
