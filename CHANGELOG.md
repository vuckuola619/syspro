# Changelog

All notable changes to **SABI** (System Analytics & Boost Infrastructure) are documented here.

---

## [1.1.1] — 2026-03-25

### 🛠 Bug Fixes
| # | Fix |
|:---|:---|
| BUG-1 | **App Uninstaller layout clipped** — reduced content padding (`p-8` → `p-6`) so Scan/Uninstall buttons are fully visible on smaller windows |
| BUG-2 | **Title bar not draggable** — moved `data-tauri-drag-region` to the root title bar div so the entire bar is draggable |
| BUG-3 | **Window controls (min/max/close) not clickable** — added `pointer-events-auto` to break out of the drag region; fixed close button hover color |
| BUG-4 | **Update Manager KB descriptions missing** — backend now queries the Windows Update Session COM API (`Microsoft.Update.Session`) for full update titles (e.g. "2025-01 Cumulative Update for Windows 11"). Added link button to open Microsoft KB article on each update. Color-coded icons: green = Security Update, blue = regular Update |
| BUG-5 | **Disk Health showing all zeros** — added WMI SMART raw data fallback (`MSStorageDriver_FailurePredictData`) when `Get-StorageReliabilityCounter` returns null. Parses SMART attribute IDs: 9 (Power On Hours), 194 (Temperature), 177/231 (Wear Level) |

### 🏷 Misc
- Title bar version display updated to v1.1.0 (was hardcoded v1.0.0)

---

## [1.1.0] — 2026-03-25

### 🔐 Security Audit & Hardening

This release addresses all findings from a comprehensive security audit of the full codebase (4400+ lines Rust backend, 41 React pages).

### ⛓️‍💥 Breaking Change
- **File Hider encryption format changed** — files encrypted with v1.0.0 (XOR) cannot be decrypted with v1.1.0 (AES-256-GCM). Decrypt any `.locked` files with v1.0.0 before upgrading.

### 🔒 Security Fixes (Medium)
| ID | Fix |
|:---|:---|
| SEC-M1 | **File Hider: XOR → AES-256-GCM** — Files now use authenticated encryption with random 12-byte nonce. Wrong password returns a clear error instead of silently producing corrupt output. Added `aes-gcm` crate. |
| SEC-M2 | **Password Generator: xorshift64 → OsRng CSPRNG** — Passwords are now generated using OS-level cryptographic randomness via `rand::thread_rng()`. Added `rand` crate. |
| SEC-M3 | **Command Injection Prevention** — Added `sanitize_powershell_input()` helper that strips injection characters (`` ` ``, `$`, `;`, `|`, `()`, `{}`). Applied to 5 commands: `remove_bloatware`, `restore_bloatware`, `set_service_status`, `toggle_firewall_rule`, `add_firewall_rule`. |
| SEC-M4 | **Hosts File Input Validation** — `add_hosts_entry` now validates IPv4 format, hostname charset (`[a-zA-Z0-9._-]`), and rejects newlines/comment injection. |

### 🛠 Bug Fixes (Low)
| ID | Fix |
|:---|:---|
| SEC-L1 | **Turbo Boost Full Restore** — `deactivate_turbo_boost` now restarts all 11 services it stopped, not just 2 (SysMain, WSearch). |
| SEC-L2 | **Registry Defrag Real Measurement** — Fragmentation percentage now based on actual hive file size vs estimated compact size (via key count), not static thresholds. |
| SEC-L3 | Benchmark temp file renamed `systempro_bench.tmp` → `sabi_bench.tmp`. |

### 🏷 Branding & Quality
- Startup log: `[SystemPro]` → `[SABI]`
- App version: hardcoded `"1.0.0"` → dynamic `env!("CARGO_PKG_VERSION")`
- GitHub Update User-Agent: `SystemPro-Updater` → `SABI-Updater`
- `chrono_now()`: replaced PowerShell spawn with native `chrono::Local::now()`
- File Hider UI text updated to describe AES-256-GCM

### 📦 Dependencies Added
| Crate | Version | Purpose |
|:---|:---|:---|
| `aes-gcm` | 0.10 | AES-256-GCM authenticated encryption |
| `rand` | 0.8 | Cryptographic random number generation |
| `chrono` | 0.4 | Native date/time formatting |

### 📦 Release Assets
| File | Description |
|:---|:---|
| `SABI_1.1.0_x64-setup.exe` | NSIS installer (recommended) |
| `SABI_1.1.0_x64_en-US.msi` | MSI installer |
| `SABI_1.1.0_x64_portable.zip` | Portable (no install) |

---

## [1.0.0] — 2026-03-20

### 🎨 Rebrand
- **Renamed from SystemPro to SABI** — updated across all config files (`tauri.conf.json`, `Cargo.toml`, `package.json`), window title, sidebar, title bar, export report header, telemetry block identifier, and binary output names
- New tagline: *System Analytics & Boost Infrastructure*

### ✨ New Features
- **Export System Report** — new page under Utilities to generate comprehensive device report (OS, CPU, RAM, GPU, storage, network, BIOS, startup programs, installed software). Export as `.txt` or copy to clipboard
- **Hosts Editor — Remove Entry** — trash icon button on each hosts entry to delete individual entries from the hosts file
- **Internet Booster — Current DNS Indicator** — shows which DNS server is currently applied on page load with a blue "Active" badge; updates immediately after applying a new DNS
- **Disk Analyzer — Open & Delete Actions** — "Open in Explorer" (folder icon) and "Delete folder" (trash icon with confirmation) buttons on each scanned folder and subfolder, similar to WinDirStat/TreeSize
- **Auto-Update Checker** — checks GitHub Releases API on startup and shows in-app notification banner with changelog when a new version is available

### 🛠 Fixes & Improvements
- **UI Freeze / "Not Responding" Fix** — converted all 80 heavy Tauri commands from synchronous (`fn`) to asynchronous (`async fn`). Operations now run on tokio's background thread pool instead of the main thread, preventing the window from freezing during scans, PowerShell calls, file walks, and network operations
- **Software Updater — Real Update Detection** — backend now runs `winget upgrade` to detect which apps actually have newer versions available. Outdated apps shown with amber highlight (`current → latest`), up-to-date apps show green checkmark badge
- **Software Updater — Filter Tabs** — added All / Outdated / Up-to-date filter tabs plus search bar for quick filtering
- **DNS Server Detection** — `test_dns_servers` now correctly detects and marks the currently active DNS server using `Get-DnsClientServerAddress`, instead of always showing `is_current: false`
- **Title Bar** — fixed window controls (minimize, maximize, close) not being clickable and title bar not being draggable due to `data-tauri-drag-region` conflict
- **Turbo Boost State Persistence** — turbo boost active state now persists across page navigations using `localStorage`
- **Right-Click Disabled** — browser context menu disabled globally for native desktop feel

### 🎨 UI / UX
- **Default Dark Mode** — new installations now default to dark theme (existing users keep their preference via `localStorage`)
- **Professional README** — added badges (Windows, Tauri, React, Rust, Release), feature tables, tech stack diagram, download table, and build instructions

### 🏗 Backend Commands Added
| Command | Description |
|:---|:---|
| `remove_hosts_entry` | Remove a specific IP + hostname pair from the hosts file |
| `get_current_dns` | Retrieve the currently active DNS configuration |
| `open_in_explorer` | Open a folder path in Windows Explorer |
| `delete_folder` | Delete a folder or file at a given path |
| `export_system_report` | Generate comprehensive system report via PowerShell |
| `save_text_file` | Write text content to a user-chosen file path |

### 📦 Release Assets
| File | Size |
|:---|:---|
| `SABI_1.0.0_x64-setup.exe` | ~2.8 MB |
| `SABI_1.0.0_x64_en-US.msi` | ~4.3 MB |
| `SABI_1.0.0_x64_portable.zip` | ~3.9 MB |
