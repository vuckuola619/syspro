<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" />
  <img src="https://img.shields.io/badge/Built_with-Tauri_v2-FFC131?style=for-the-badge&logo=tauri&logoColor=white" />
  <img src="https://img.shields.io/badge/Frontend-React_19-61DAFB?style=for-the-badge&logo=react&logoColor=white" />
  <img src="https://img.shields.io/badge/Backend-Rust-000000?style=for-the-badge&logo=rust&logoColor=white" />
  <img src="https://img.shields.io/github/v/release/vuckuola619/syspro?style=for-the-badge&color=brightgreen&label=Release" />
</p>

<h1 align="center">⚡ SABI</h1>

<h3 align="center">System Analytics & Boost Infrastructure</h3>

<p align="center">
  A lightweight, high-performance <strong>PC Optimizer & System Toolkit</strong> for Windows.<br/>
  Designed to bridge the gap between deep system analysis and instant performance enhancement.
</p>

<p align="center">
  <a href="https://github.com/vuckuola619/syspro/releases/latest"><strong>📦 Download Latest Release</strong></a>
  &nbsp;·&nbsp;
  <a href="#-features"><strong>Features</strong></a>
  &nbsp;·&nbsp;
  <a href="#-tech-stack"><strong>Tech Stack</strong></a>
</p>

---

## 🚀 Why SABI?

| | |
|:---|:---|
| **🪶 Lightweight** | ~3 MB installer, minimal resource usage — no Electron bloat |
| **⚡ Fast** | Rust-powered backend with native Windows API calls |
| **🎨 Modern UI** | Dark mode default, glassmorphism, smooth animations |
| **🔒 Privacy-first** | No telemetry, no cloud — everything runs locally |
| **🛠 All-in-one** | 40+ tools that replace multiple utility apps |

---

## 📦 Download

| Format | File | Description |
|:---:|:---|:---|
| 💿 | [`SABI_1.1.1_x64-setup.exe`](https://github.com/vuckuola619/syspro/releases/latest) | **Recommended** — NSIS installer with auto-update support |
| 📦 | [`SABI_1.1.1_x64_en-US.msi`](https://github.com/vuckuola619/syspro/releases/latest) | MSI installer for enterprise/GPO deployment |
| 📂 | [`SABI_1.1.1_x64_portable.zip`](https://github.com/vuckuola619/syspro/releases/latest) | Portable — no installation required |

> **Requirements:** Windows 10/11 (64-bit)

---

## ✨ Features

<table>
<tr><td>

### 🧹 Cleaning & Optimization
- **Junk Cleaner** — Temp files, browser cache, system logs
- **Registry Cleaner** — Broken entries, orphaned COM objects, with auto-backup
- **Registry Defrag** — Analyze and compact the Windows registry
- **Duplicate Finder** — SHA-256 hash-based duplicate detection
- **System Slimming** — Remove Windows bloat components

</td><td>

### ⚡ Performance
- **Startup Manager** — Control boot programs + boot time analysis
- **Performance Monitor** — Real-time CPU, RAM, disk, network
- **Live Monitor** — Continuous dashboard with history graphs
- **Turbo Boost** — One-click mode (services + process optimization)
- **Benchmarks** — CPU, disk, and memory benchmark suite

</td></tr>
<tr><td>

### 🔒 Privacy & Security
- **Privacy Eraser** — Clear browser data, tracking cookies
- **Privacy Hardening** — Windows telemetry & privacy toggles
- **Pop-up Blocker** — Suppress intrusive Windows notifications
- **Firewall Manager** — View, toggle, create firewall rules
- **File Hider** — AES-256-GCM encrypted file locking
- **Password Generator** — Cryptographically secure passwords (OsRng)

</td><td>

### 🛠 System Tools
- **Software Updater** — Real update detection via `winget upgrade`
- **Driver Updater** — Scan hardware drivers via Windows Update
- **App Uninstaller** — Deep uninstall + leftover scanner
- **Windows Debloater** — Remove pre-installed bloatware
- **Windows Tweaks** — Performance & UI optimization toggles
- **Service Manager** — Start/stop/disable Windows services
- **Edge Manager** — Microsoft Edge policy control
- **Update Manager** — Windows Update pause/history

</td></tr>
<tr><td>

### 💾 Disk & Files
- **Disk Analyzer** — Visual disk usage (WinDirStat-style)
- **Disk Defrag** — Analyze and defragment drives
- **File Shredder** — Secure multi-pass file deletion
- **File Splitter** — Split/join large files
- **Disk Health** — S.M.A.R.T. diagnostics & monitoring

</td><td>

### 🌐 Network
- **Internet Booster** — DNS optimization with live DNS indicator
- **Speed Monitor** — Real-time bandwidth graphs
- **Network Monitor** — Active connections viewer
- **Hosts Editor** — Edit hosts file, block telemetry domains
- **Speed Test** — Ping, download, and upload testing

</td></tr>
<tr><td colspan="2">

### 🔧 Utilities
- **System Info** — Detailed hardware & software report
- **Scheduled Clean** — Automated cleanup at set intervals
- **Restore Points** — Create & manage system restore points
- **Export Report** — Generate full system report (TXT export)
- **One-Click Optimize** — Run all cleaners in a single click

</td></tr>
</table>

---

## 🏗 Tech Stack

```
┌──────────────────────────────────────────────────────┐
│  Frontend          React 19 · TypeScript · Vite      │
│  UI Framework      shadcn/ui · Lucide Icons          │
│  Backend           Rust (Tauri v2)                   │
│  System APIs       WMI · Registry · PowerShell       │
│  Package Manager   winget (software updates)         │
│  Installer         NSIS + MSI (WiX)                  │
└──────────────────────────────────────────────────────┘
```

---

## 🔄 Auto-Update

SABI checks for new releases on startup via the GitHub Releases API and displays an in-app notification banner when a new version is available, complete with changelog.

---

## 🏗 Building from Source

```bash
# Prerequisites: Node.js 18+, Rust 1.70+, Windows 10/11 SDK

# Clone
git clone https://github.com/vuckuola619/syspro.git
cd syspro

# Install dependencies
npm install

# Development
npm run tauri dev

# Production build
npm run tauri build
```

Build artifacts will be in `src-tauri/target/release/bundle/`.

---

## 📄 License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with ❤️ using Tauri, React, and Rust</sub>
</p>
