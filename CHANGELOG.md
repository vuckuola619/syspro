# Changelog

All notable changes to **SABI** (System Analytics & Boost Infrastructure) are documented here.

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
