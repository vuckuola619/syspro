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
  Built with Rust and React to deliver native speed, modern UI, and 40+ system tools<br/>
  in a single ~3 MB application — no Electron, no bloat, no telemetry.
</p>

<p align="center">
  <a href="https://github.com/vuckuola619/syspro/releases/latest"><strong>📦 Download Latest Release</strong></a>
  &nbsp;·&nbsp;
  <a href="#-features"><strong>Features</strong></a>
  &nbsp;·&nbsp;
  <a href="#-tech-stack"><strong>Tech Stack</strong></a>
  &nbsp;·&nbsp;
  <a href="#-changelog"><strong>Changelog</strong></a>
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
| **🛠 All-in-one** | 41 tools across 6 categories that replace multiple utility apps |
| **📊 ISO 27001 Ready** | Built-in audit report generator for compliance documentation |

---

## 📦 Download

| Format | File | Description |
|:---:|:---|:---|
| 💿 | [`SABI_1.1.1_x64-setup.exe`](https://github.com/vuckuola619/syspro/releases/latest) | **Recommended** — NSIS installer with auto-update support |
| 📦 | [`SABI_1.1.1_x64_en-US.msi`](https://github.com/vuckuola619/syspro/releases/latest) | MSI installer for enterprise / GPO deployment |

> **Requirements:** Windows 10/11 (64-bit) · WebView2 runtime (bundled)

---

## ✨ Features

<table>
<tr><td>

### 🧹 Cleaning & Optimization
- **Junk Cleaner** — Temp files, browser cache, system logs, Windows Update cache
- **Registry Cleaner** — Orphaned COM/InProcServer entries, broken file associations, empty keys (auto-backup)
- **Registry Defrag** — Hive-level fragmentation analysis with real compaction metrics
- **Duplicate Finder** — SHA-256 hash-based duplicate detection with partial hashing for large files (memory-optimized)
- **System Slimming** — Remove Windows bloat components

</td><td>

### ⚡ Performance
- **Startup Manager** — Control boot programs, boot time analysis, context menu manager
- **Performance Monitor** — Real-time CPU, RAM with detailed optimization action log
- **RAM Optimizer** — `EmptyWorkingSet` + standby cache clearing with step-by-step result reporting
- **Live Monitor** — Continuous dashboard with history graphs
- **Turbo Boost** — One-click mode (services + process optimization) with full restore
- **Benchmarks** — CPU, disk, and memory benchmark suite

</td></tr>
<tr><td>

### 🔒 Privacy & Security
- **Privacy Eraser** — Chrome + Edge + Firefox data, tracking cookies, telemetry traces
- **Privacy Hardening** — Windows telemetry & privacy toggles
- **Pop-up Blocker** — Suppress intrusive Windows notifications
- **Firewall Manager** — View, toggle, create firewall rules
- **File Hider** — AES-256-GCM authenticated encryption with password-based file locking
- **Password Generator** — Cryptographically secure passwords via OS-level CSPRNG (`OsRng`)

</td><td>

### 🛠 System Tools
- **Software Updater** — Real update detection via `winget upgrade` with silent install
- **Driver Updater** — Scan PnP hardware drivers via WMI with category classification
- **App Uninstaller** — Deep uninstall + registry leftover scanner
- **Windows Debloater** — Remove pre-installed bloatware (reversible)
- **Windows Tweaks** — Performance & UI optimization toggles
- **Service Manager** — Start/stop/disable Windows services
- **Edge Manager** — Microsoft Edge policy control
- **Update Manager** — Windows Update pause/history with KB descriptions

</td></tr>
<tr><td>

### 💾 Disk & Files
- **Disk Analyzer** — Visual disk usage (WinDirStat-style) with open/delete actions
- **Disk Defrag** — Analyze and defragment drives
- **Disk Health** — S.M.A.R.T. diagnostics (PowerOnHours, Temperature, Wear) with WMI fallback
- **File Shredder** — Secure multi-pass file deletion (DoD 5220.22-M)
- **File Splitter** — Split/join large files

</td><td>

### 🌐 Network
- **Internet Booster** — DNS optimization with live active DNS indicator
- **Speed Monitor** — Real-time bandwidth graphs
- **Network Monitor** — Active connections viewer (TCP/UDP)
- **Hosts Editor** — Add, edit, and remove entries; block telemetry domains
- **Speed Test** — Ping, download, and upload testing

</td></tr>
<tr><td colspan="2">

### 🔧 Utilities
- **System Info** — Detailed hardware & software inventory (OS, CPU, GPU, RAM, BIOS, NIC)
- **Export Report** — ISO 27001 compliance audit report generator (OS, BitLocker, Admins, Firewall, Antivirus, Network) with TXT download
- **Scheduled Clean** — Automated cleanup at set intervals
- **Restore Points** — Create & manage system restore points
- **One-Click Optimize** — Run all cleaners + optimizers in a single click
- **Settings** — Theme selection, auto-start, notification preferences

</td></tr>
</table>

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
│   ├── pages/                    # 41 feature pages
│   ├── lib/                      # Utilities
│   └── App.tsx                   # Router + lazy-loaded pages
├── src-tauri/
│   ├── src/
│   │   └── lib.rs                # 4700+ line Rust backend (all commands)
│   ├── capabilities/
│   │   └── default.json          # Tauri v2 permission grants
│   ├── icons/                    # App icons
│   └── tauri.conf.json           # Tauri configuration
├── package.json
├── tsconfig.json
├── vite.config.ts
├── CHANGELOG.md
└── README.md
```

---

## 📋 Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

### Latest: v1.1.1 (2026-03-25)

- **ISO 27001 Audit Report** — Dedicated export page generating system security report
- **RAM Optimizer Action Log** — Step-by-step report of optimization actions
- **Disk Health S.M.A.R.T. Fixes** — Correct display of `0` vs `N/A` for healthy drives
- **Duplicate Finder Memory Fix** — 50K file cap + partial hashing prevents memory bloat
- **Host Editor Edit Function** — Inline editing of existing host file entries
- **Window Control Fixes** — Drag, minimize, maximize, close all fully functional

---

## 🔒 Security

SABI takes security seriously:

- **No telemetry** — zero data leaves your machine
- **AES-256-GCM** — military-grade authenticated encryption for File Hider
- **CSPRNG** — OS-level cryptographic randomness for password generation
- **Input sanitization** — all PowerShell commands are sanitized against injection
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
