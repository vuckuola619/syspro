# Changelog

All notable changes to **SABI** (System Analytics & Boost Infrastructure) are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] — 2026-03-30 (Stability Patch)

### 🛡 Stability Hardening

Comprehensive audit and hardening of **all 44 pages** to eliminate runtime crashes from malformed or missing backend responses.

| Category | Pages Fixed | Pattern Applied |
|:---|:---|:---|
| **Array.isArray guards** | 15 pages | All `invoke<T[]>()` results guarded before `.map()` / `.filter()` / `.reduce()` |
| **Null-coalescing** | 12 pages | All `.toFixed()` calls protected with `?? 0` fallback |
| **charAt safety** | 2 pages | `username.charAt()` guarded with `?? "?"` fallback |
| **Nested array guards** | 3 pages | `categories.map()`, `domains.map()`, `permissions.map()` — nested arrays guarded |

### 🐛 Bug Fixes

| Fix | Description |
|:---|:---|
| **Password Generator crash** | Frontend was sending `useUppercase`/`useLowercase` but Rust expects `uppercase`/`lowercase` — argument names corrected |
| **Multi-User "Cannot read charAt"** | `p.username` could be `undefined` — added `?? "?"` fallback before `.charAt(0)` |
| **Sidebar cleanup** | Removed redundant "One-Click Optimize" button (functionality merged into Dashboard) |
| **Dashboard context TypeScript** | Fixed `Record<string, unknown>` property access using bracket notation |

### ⚡ Performance

| Optimization | Description |
|:---|:---|
| **Batch timeout** | Added `tokio::time::timeout(30s)` to `batch_invoke` dispatcher to prevent long-running PowerShell from blocking UI |

### 📦 Release Assets

| File | Description |
|:---|:---|
| `SABI_1.3.0_x64-setup.exe` | NSIS installer (recommended) |
| `SABI_1.3.0_x64_en-US.msi` | MSI installer for enterprise/GPO |

---

## [1.3.0] — 2026-03-26

### 🔀 Module Merges

| Change | Description |
|:---|:---|
| **CPU Saver → Turbo Boost** | Merged into tabbed UI: Turbo Mode (services + memory) \| Process Priority (Gaming Mode) |
| **Smart Optimize → Dashboard** | Merged into Dashboard as "Smart Analyze" section (grade, category bars, recommendations) |
| **Smart Clean → Auto Clean** | Renamed and enhanced with file impact breakdown |
| **Sidebar** | Cleaned up redundant entries (46 → 44 tools) |

### 🤖 AI Analysis (Opt-in)

| Feature | Description |
|:---|:---|
| **Inline AIAnalysis** | Replaces floating chatbot — appears on scan result pages with severity-coded remediation steps |
| **Settings** | Provider (Gemini/OpenAI), model selection (2.0 Flash, 2.5 Pro, GPT-4o Mini, GPT-4o), API key input |
| **Privacy** | API keys stored in localStorage only — zero telemetry, user provides own key |

### ✨ Enhancements

| Feature | Description |
|:---|:---|
| **Dashboard Analysis Flow** | Unified 11-step sequential scan on dashboard load with progress bar, detailed status log using virtualized scroll, and global React context persistence (prevents redundant rescans on navigation) |
| **S.M.A.R.T. Integration** | `get_smart_health` backend command now prioritizes `smartctl -j` for comprehensive ATA/NVMe stats (temp, power-on hours, wear, error counts) before gracefully falling back to PowerShell WMI counters |
| **Auto Clean** | File impact breakdown after scan: Temp Files, Browser Cache, System Logs, Recycle Bin, Other — with distribution bars and file counts |
| **Disk Analyzer** | Subfolder icons, "Delete" button per subfolder, "Open in Explorer" shortcuts |
| **Turbo Boost** | New tabbed UI: Turbo Mode \| Process Priority with Gaming Mode |

### 🐛 Bug Fixes

| Fix | Description |
|:---|:---|
| **Blank White Screen (Admin)** | Fixed WebView2 data directory access issue when running as administrator — sets `WEBVIEW2_USER_DATA_FOLDER` env var before init |
| **TypeScript Strict** | Removed unused imports (`CpuGauge`, `FileText`) that caused tsc build failures |

### 📦 Release Assets

| File | Description |
|:---|:---|
| `SABI_1.3.0_x64-setup.exe` | NSIS installer (recommended) |
| `SABI_1.3.0_x64_en-US.msi` | MSI installer for enterprise/GPO |

---

## [1.2.0] — 2026-03-26

### ✨ New Features (Tier 4 — Stretch)

| Feature | Description |
|:---|:---|
| **File Recovery** | Recycle Bin browser — list, restore individual files, or empty all via COM automation (`get_recycle_bin_items`, `restore_recycle_bin_item`, `empty_recycle_bin`) |
| **Cloud Cleaner** | OneDrive, Dropbox, Google Drive, iCloud cache scanner and cleaner with whitelisted paths (`scan_cloud_caches`, `clean_cloud_cache`) |
| **Multi-User Support** | Windows user profile scanner — disk usage, last login, account type (`get_user_profiles`) |
| **Smart Optimization** | AI-powered health score (0-100) across memory, disk, startup, security, and updates with actionable recommendations (`get_optimization_score`) |

### 📖 Documentation

| Document | Description |
|:---|:---|
| `docs/USER_GUIDE.md` | Comprehensive user guide for all 46 features |
| `docs/PRODUCT_DOCS.md` | Technical architecture, security model, 30+ command reference |
| `README.md` | Updated with full 46-feature set and documentation links |

### 🌐 Landing Page

- Professional landing page at `website/` for sabi.mybati.com
- Light mode design with Inter typography and Lucide SVG icons
- Real application screenshots (5 pages)
- All 46 features with category filter
- 28-row competitor gap analysis table (vs CCleaner, IObit, Glary, Wise Care)
- Direct download links to GitHub release assets

### 🏗 Backend Commands Added (7)

| Command | Description |
|:---|:---|
| `get_recycle_bin_items` | List Recycle Bin contents via PowerShell COM |
| `restore_recycle_bin_item` | Restore a specific file from Recycle Bin |
| `empty_recycle_bin` | Empty Recycle Bin via Shell.Application COM |
| `scan_cloud_caches` | Scan cloud service cache directories |
| `clean_cloud_cache` | Clean whitelisted cloud cache paths |
| `get_user_profiles` | List Windows user profiles with disk usage |
| `get_optimization_score` | Calculate system health score (0-100) |

### 📦 Release Assets

| File | Description |
|:---|:---|
| `SABI_1.2.0_x64-setup.exe` | NSIS installer (recommended) |
| `SABI_1.2.0_x64_en-US.msi` | MSI installer for enterprise/GPO |

---

## [1.1.1] — 2026-03-25

### ✨ New Features

| Feature | Description |
|:---|:---|
| **ISO 27001 Audit Report** | New `generate_iso27001_report` backend command aggregates OS info, BitLocker status, Local Admins, Firewall rules, Antivirus status, and Network Adapters. Accessible from the dedicated **Export Report** page with TXT download. |
| **RAM Optimizer Action Log** | `optimize_memory` now returns a structured `OptimizeMemoryResult` with `before_mb`, `after_mb`, `freed_mb`, `total_mb`, and a step-by-step `actions[]` log. Uses `EmptyWorkingSet` on top 30 processes and attempts standby cache clearing via `NtSetSystemInformation`. |
| **Hosts Editor — Edit Entry** | Inline "Edit" button on each host entry pre-populates the input fields for IP and hostname, then performs an atomic update (remove old + add new). |

### 🛠 Bug Fixes

| # | Fix |
|:---|:---|
| BUG-1 | **Disk Health showing N/A for healthy drives** — `DiskHealthInfo` struct fields changed from `u64` to `i64` so the backend can return `-1` (missing/unsupported → "N/A" in UI) while correctly displaying `0` for healthy drives with zero error counts. |
| BUG-2 | **Window controls not functional** — added explicit `core:window:allow-start-dragging`, `allow-minimize`, `allow-maximize`, `allow-close`, `allow-toggle-maximize` permissions to `capabilities/default.json`. |
| BUG-3 | **Version hardcoded as 1.0.0** — replaced with dynamic `getVersion()` API call from `@tauri-apps/api/app`. |
| BUG-4 | **Dashboard usage bars invisible in Light Mode** — changed progress bar indicator from `bg-blue-50` to `bg-blue-500` for consistent visibility. |

### ⚡ Performance

| # | Optimization |
|:---|:---|
| PERF-1 | **Duplicate Finder memory bloat** — added 50,000 file cap, 500 MB max file size, and partial hashing (first 64KB + last 64KB for files >128KB) to prevent 1+ GB memory consumption on large drives. Intermediate `size_map` is dropped early after Phase 2. |

### 📦 Release Assets

| File | Description |
|:---|:---|
| `SABI_1.1.1_x64-setup.exe` | NSIS installer (recommended) |
| `SABI_1.1.1_x64_en-US.msi` | MSI installer for enterprise/GPO |

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

---

## [1.0.0] — 2026-03-20

### 🎨 Rebrand
- **Renamed from SystemPro to SABI** — updated across all config files (`tauri.conf.json`, `Cargo.toml`, `package.json`), window title, sidebar, title bar, export report header, telemetry block identifier, and binary output names
- New tagline: *System Analytics & Boost Infrastructure*

### ✨ New Features
- **Export System Report** — comprehensive device report (OS, CPU, RAM, GPU, storage, network, BIOS, startup programs, installed software) with `.txt` export or clipboard copy
- **Hosts Editor — Remove Entry** — trash icon button on each hosts entry to delete individual entries from the hosts file
- **Internet Booster — Current DNS Indicator** — shows which DNS server is currently applied on page load with a blue "Active" badge; updates immediately after applying a new DNS
- **Disk Analyzer — Open & Delete Actions** — "Open in Explorer" (folder icon) and "Delete folder" (trash icon with confirmation) buttons on each scanned folder and subfolder, similar to WinDirStat/TreeSize
- **Auto-Update Checker** — checks GitHub Releases API on startup and shows in-app notification banner with changelog when a new version is available
- **Lazy Loading** — All 41 pages use `React.lazy()` + `Suspense` for code-splitting, reducing initial bundle size
- **Toast Notifications** — `sonner` integration for user feedback on all actions

### 🛠 Fixes & Improvements
- **UI Freeze / "Not Responding" Fix** — converted all 80 heavy Tauri commands from synchronous (`fn`) to asynchronous (`async fn`). Operations now run on tokio's background thread pool instead of the main thread
- **Software Updater — Real Update Detection** — backend runs `winget upgrade` to detect apps with newer versions. Outdated apps shown with amber highlight (`current → latest`), up-to-date apps show green checkmark badge
- **Software Updater — Filter Tabs** — All / Outdated / Up-to-date filter tabs plus search bar
- **DNS Server Detection** — `test_dns_servers` correctly detects the currently active DNS server using `Get-DnsClientServerAddress`
- **Title Bar** — fixed window controls (minimize, maximize, close) and drag region conflicts
- **Turbo Boost State Persistence** — active state persists across page navigations using `localStorage`
- **Right-Click Disabled** — browser context menu disabled globally for native desktop feel

### 🎨 UI / UX
- **Default Light Mode** — clean, professional appearance out of the box
- **Professional README** — badges, feature tables, tech stack diagram, download table, and build instructions

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
