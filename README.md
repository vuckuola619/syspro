<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows_10%2F11-0078D6?style=for-the-badge&logo=windows&logoColor=white" />
  <img src="https://img.shields.io/badge/Built_with-Tauri_v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-React_19-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-Rust-000000?style=for-the-badge&logo=rust&logoColor=white" />
  <img src="https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/github/v/release/vuckuola619/syspro?style=for-the-badge&color=brightgreen&label=Release" />
  <img src="https://img.shields.io/github/license/vuckuola619/syspro?style=for-the-badge" />
</p>

<h1 align="center">⚡ SABI</h1>

<h3 align="center">System Analytics & Boost Infrastructure</h3>

<p align="center">
  A lightweight, high-performance <strong>PC Optimizer & System Toolkit</strong> for Windows.<br/>
  Built with Rust and React to deliver native speed, modern UI, and 44+ system tools<br/>
  in a single ~3 MB application — no Electron, no bloat, no telemetry.
</p>

<p align="center">
  <a href="https://github.com/vuckuola619/syspro/releases/latest"><strong>📦 Download Latest Release</strong></a>
  &nbsp;·&nbsp;
  <a href="#-features"><strong>Features</strong></a>
  &nbsp;·&nbsp;
  <a href="#-tech-stack"><strong>Tech Stack</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/USER_GUIDE.md"><strong>User Guide</strong></a>
  &nbsp;·&nbsp;
  <a href="docs/PRODUCT_DOCS.md"><strong>Product Docs</strong></a>
  &nbsp;·&nbsp;
  <a href="#-building-from-source"><strong>Build</strong></a>
</p>

---

## 🚀 Why SABI?

| | |
|:---|:---|
| **🪶 Lightweight** | ~3 MB installer, minimal resource usage — no Electron bloat |
| **⚡ Native Speed** | Rust-powered backend with direct Windows API and WMI calls |
| **🎨 Modern UI** | Light/dark mode, glassmorphism, smooth animations via shadcn/ui |
| **🔒 Privacy-first** | Zero telemetry, zero cloud, zero tracking — everything runs locally |
| **🛡 Secure** | AES-256-GCM encryption, CSPRNG password generation, sanitized system calls |
| **🛠 All-in-one** | 44 tools across 8 categories that replace multiple utility apps |
| **🤖 AI Analysis** | Opt-in AI remediation (Gemini/OpenAI) with severity-coded suggestions |
| **📊 ISO 27001 Ready** | Built-in audit report generator for compliance documentation |
| **🤖 Smart Scoring** | AI-powered system health scoring with grade-based recommendations |

---

## 📦 Download

| Format | File | Description |
|:---:|:---|:---|
| 💿 | [`SABI_1.3.0_x64-setup.exe`](https://github.com/vuckuola619/syspro/releases/latest) | **Recommended** — NSIS installer with auto-update support |
| 📦 | [`SABI_1.3.0_x64_en-US.msi`](https://github.com/vuckuola619/syspro/releases/latest) | MSI installer for enterprise / GPO deployment |

> **Requirements:** Windows 10/11 (64-bit) · WebView2 runtime (bundled)

---

## ✨ Features

<table>
<tr><td>

### 📊 Overview
- **Dashboard** — System health overview with key metrics + Smart Analyze (health grade, category breakdown, recommendations)
- **One-Click Optimize** — Run all cleaners + optimizers in a single click
- **AI Analysis** — Opt-in inline AI remediation on scan results (Gemini/OpenAI) with severity-coded suggestions

</td><td>

### 🧹 Cleaning
- **Junk Cleaner** — Temp files, browser cache, system logs, Windows Update cache
- **Registry Cleaner** — Orphaned COM/InProcServer entries, broken file associations, empty keys (auto-backup)
- **Registry Defrag** — Hive-level fragmentation analysis with real compaction metrics
- **Duplicate Finder** — SHA-256 hash-based duplicate detection with partial hashing for large files
- **System Slimming** — Remove Windows bloat components

</td></tr>
<tr><td>

### ⚡ Performance
- **Startup Manager** — Control boot programs, boot time analysis, context menu manager
- **Performance Monitor** — Real-time CPU, RAM with optimization action log
- **Live Monitor** — Continuous dashboard with history graphs
- **Turbo Boost** — Tabbed UI: Turbo Mode (services + memory) | Process Priority (Gaming Mode)
- **Benchmarks** — CPU, disk, and memory benchmark suite
- **Auto Clean** — Smart cleaning with file impact breakdown (Temp, Browser, Logs, Recycle Bin)

</td><td>

### 🔒 Privacy & Security
- **Privacy Eraser** — Chrome + Edge + Firefox data, tracking cookies, telemetry traces
- **Privacy Hardening** — Windows telemetry & privacy toggles
- **Browser Extensions** — Scan and manage browser extensions across Edge/Chrome/Firefox
- **Anti-Spyware** — Windows Defender integration (status, quick/full scan, definition update)
- **DNS Protector** — 8 secure DNS providers (Cloudflare, Quad9, AdGuard, etc.)
- **Ad Blocker** — System-level hosts-file blocking (ads, trackers, telemetry, malware)
- **Login Monitor** — Windows Security Event Log (success/failed logins, logon type)
- **Pop-up Blocker** — Suppress intrusive Windows notifications
- **Firewall Manager** — View, toggle, create firewall rules
- **File Hider** — AES-256-GCM authenticated encryption with password-based file locking
- **Password Generator** — Cryptographically secure passwords via OS-level CSPRNG

</td></tr>
<tr><td>

### 🛠 System Tools
- **Software Updater** — Real update detection via `winget upgrade` with silent install
- **Driver Updater** — Scan PnP hardware drivers via WMI with category classification
- **App Uninstaller** — Deep uninstall + registry leftover scanner
- **Windows Debloater** — Remove pre-installed bloatware (reversible)
- **Windows Tweaks** — Performance & UI optimization toggles
- **Service Manager** — Start/stop/disable Windows services
- **Edge Manager** — Microsoft Edge policy control
- **Update Manager** — Windows Update pause/history with KB descriptions
- **Multi-User** — Windows user profile scanner with disk usage and last login

</td><td>

### 💾 Disk & Files
- **Disk Analyzer** — Visual disk usage (WinDirStat-style) with open/delete actions
- **Disk Defrag** — Analyze and defragment drives
- **File Shredder** — Secure multi-pass file deletion (DoD 5220.22-M)
- **File Splitter** — Split/join large files
- **Disk Health** — S.M.A.R.T. diagnostics (PowerOnHours, Temperature, Wear)
- **Large File Finder** — Recursive scan with size/date/path display
- **Empty Folders** — Detect and clean empty directory trees
- **App Junk** — Application-specific leftover scanner
- **File Recovery** — Recycle Bin browser with individual restore and bulk empty
- **Cloud Cleaner** — OneDrive, Dropbox, Google Drive, iCloud cache cleaner

</td></tr>
<tr><td>

### 🌐 Network
- **Internet Booster** — DNS optimization with live active DNS indicator
- **Speed Monitor** — Real-time bandwidth graphs
- **Network Monitor** — Active connections viewer (TCP/UDP)
- **Hosts Editor** — Add, edit, and remove entries; block telemetry domains
- **Speed Test** — Ping, download, and upload testing

</td><td>

### 🔧 Utilities
- **System Info** — Detailed hardware & software inventory (OS, CPU, GPU, RAM, BIOS, NIC)
- **Export Report** — ISO 27001 compliance audit report generator
- **Scheduled Clean** — Automated cleanup at set intervals
- **Restore Points** — Create & manage system restore points

</td></tr>
</table>

---

## 📖 Documentation

| Document | Description |
|:---|:---|
| [**User Guide**](docs/USER_GUIDE.md) | Step-by-step usage instructions for every feature |
| [**Product Documentation**](docs/PRODUCT_DOCS.md) | Technical architecture, API reference, and security model |
| [**Changelog**](CHANGELOG.md) | Full version history |

---

## 🏗 Tech Stack

```
┌───────────────────────────────────────────────────────────┐
│  Runtime           Tauri v2 (Rust + WebView2)             │
│  Frontend          React 19 · TypeScript · Vite 6         │
│  UI Framework      shadcn/ui · Radix · Lucide Icons       │
│  Backend           Rust (sysinfo, sha2, aes-gcm, walkdir) │
│  System APIs       WMI · CIM · Registry · PowerShell      │
│  Package Manager   winget (software updates)              │
│  Installer         NSIS (.exe) + WiX (.msi)               │
│  CI / Release      GitHub Releases API · Auto-updater     │
└───────────────────────────────────────────────────────────┘
```

### Key Dependencies

| Crate | Purpose |
|:---|:---|
| `sysinfo` | Cross-platform system information (CPU, RAM, disk, processes) |
| `sha2` | SHA-256 hashing for duplicate file detection |
| `aes-gcm` | AES-256-GCM authenticated encryption (File Hider) |
| `rand` | Cryptographically secure random number generation |
| `walkdir` | Recursive directory traversal |
| `chrono` | Native datetime formatting |
| `serde` / `serde_json` | Serialization for IPC between Rust and React |

---

## 🔄 Auto-Update

SABI checks for new releases on startup via the GitHub Releases API. When a new version is detected, an in-app notification banner appears with the full changelog and a direct download link.

---

## 🏗 Building from Source

### Prerequisites

- **Node.js** 18+ (recommended: 20 LTS)
- **Rust** 1.70+ (install via [rustup.rs](https://rustup.rs/))
- **Windows 10/11 SDK** (Visual Studio Build Tools)
- **WebView2** runtime (pre-installed on Windows 11)

### Steps

```bash
# Clone the repository
git clone https://github.com/vuckuola619/syspro.git
cd syspro

# Install frontend dependencies
npm install

# Development mode (hot-reload)
npm run tauri dev

# Production build (generates .exe + .msi)
npm run tauri build
```

Build artifacts will be in `src-tauri/target/release/bundle/`:
- `nsis/SABI_x.x.x_x64-setup.exe` — NSIS installer
- `msi/SABI_x.x.x_x64_en-US.msi` — MSI installer

---

## 📁 Project Structure

```
AG-SysPro/
├── src/                          # React frontend
│   ├── components/
│   │   ├── layout/               # Sidebar, TitleBar, AppLayout
│   │   └── ui/                   # shadcn/ui primitives
│   ├── pages/                    # 44 feature pages
│   ├── lib/                      # Utilities
│   └── App.tsx                   # Router + lazy-loaded pages
├── src-tauri/
│   ├── src/
│   │   └── lib.rs                # 6780+ line Rust backend (all commands)
│   ├── capabilities/
│   │   └── default.json          # Tauri v2 permission grants
│   ├── icons/                    # App icons
│   └── tauri.conf.json           # Tauri configuration
├── docs/
│   ├── USER_GUIDE.md             # End-user documentation
│   └── PRODUCT_DOCS.md           # Technical documentation
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CHANGELOG.md
└── README.md
```

---

## 🔒 Security

SABI takes security seriously:

- **No telemetry** — zero data leaves your machine
- **AES-256-GCM** — military-grade authenticated encryption for File Hider
- **CSPRNG** — OS-level cryptographic randomness for password generation
- **Input sanitization** — all PowerShell commands are sanitized against injection
- **Path whitelisting** — cloud cache cleaner only operates on approved directories
- **DNS whitelist** — only pre-approved secure DNS providers can be set
- **Hosts backup** — automatic backup before any hosts-file modification
- **Tauri v2 Capabilities** — explicit permission grants for system access (least privilege)

> **Note:** Some features (disk health, registry cleaning, service management) require **administrator privileges** for full functionality.

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

## 🤝 Contributing

Contributions are welcome! To get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Make your changes and test with `npm run tauri dev`
4. Commit with conventional commits: `git commit -m "feat: add awesome feature"`
5. Push and open a Pull Request

---

<p align="center">
  <sub>Built with ❤️ using Tauri, React, and Rust</sub><br/>
  <sub>© 2026 SABI — System Analytics & Boost Infrastructure</sub>
</p>
