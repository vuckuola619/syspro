# SABI

### System Analytics & Boost Infrastructure

SABI is a lightweight, high-performance PC Optimizer & System Toolkit for Windows. It is designed to bridge the gap between deep system analysis and instant performance enhancement.

Built with **Tauri v2** (Rust backend) and **React 19** for a fast, native-feeling experience with a tiny footprint.

---

## ✨ Features

### 🧹 Cleaning
- **Junk Cleaner** — Remove temp files, browser cache, logs
- **Registry Cleaner** — Detect and fix broken registry entries with backup
- **Registry Defrag** — Analyze and optimize registry fragmentation
- **Duplicate Finder** — Find and remove duplicate files
- **System Slimming** — Remove Windows bloat components

### ⚡ Performance
- **Startup Manager** — Control boot programs + boot time optimization
- **Performance Monitor** — Real-time CPU, RAM, disk, network stats
- **Live Monitor** — Continuous system metrics dashboard
- **Turbo Boost** — One-click performance mode (services/process optimization)
- **Benchmarks** — CPU/disk/memory benchmark suite

### 🔒 Privacy & Security
- **Privacy Eraser** — Clear browser data, cookies, tracking files
- **Privacy Hardening** — Windows privacy settings management
- **Pop-up Blocker** — Block intrusive Windows notifications
- **Firewall Manager** — View, toggle, and add firewall rules
- **File Hider** — Hide/unhide files and folders
- **Password Generator** — Secure password generation

### 🛠 System Tools
- **Software Updater** — Scan & update via winget with real update detection
- **Driver Updater** — Check hardware drivers for updates
- **App Uninstaller** — Uninstall apps + scan leftover files/registry
- **Windows Debloater** — Remove pre-installed bloatware
- **Windows Tweaks** — System optimization toggles
- **Service Manager** — Start/stop/disable Windows services
- **Edge Manager** — Microsoft Edge settings control
- **Update Manager** — Windows Update management

### 💾 Disk & Files
- **Disk Analyzer** — Visualize disk usage (like WinDirStat/TreeSize)
- **Disk Defrag** — Analyze and defragment drives
- **File Shredder** — Secure file deletion
- **File Splitter** — Split/join large files
- **Disk Health** — S.M.A.R.T. diagnostics

### 🌐 Network
- **Internet Booster** — DNS optimization with current DNS indicator
- **Speed Monitor** — Real-time bandwidth monitoring
- **Network Monitor** — Active connections viewer
- **Hosts Editor** — Edit hosts file, block telemetry
- **Speed Test** — Internet speed testing

### 🔧 Utilities
- **System Info** — Detailed hardware/software information
- **Scheduled Clean** — Automated cleanup scheduling
- **Restore Points** — System restore point management
- **Export Report** — Generate comprehensive device report

---

## 📦 Download

Download the latest release from the [Releases](https://github.com/vuckuola619/syspro/releases) page:

| Format | Description |
|:---|:---|
| `.exe` | NSIS Installer (recommended) |
| `.msi` | MSI Installer |
| `.zip` | Portable version |

---

## 🛡 Auto-Update

SABI automatically checks for new versions on startup and displays a notification banner when updates are available.

---

## 🔧 Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Rust (Tauri v2)
- **UI Components**: shadcn/ui + Lucide Icons
- **Package Manager**: winget integration for software updates
- **System APIs**: WMI, Registry, PowerShell, netsh

---

## 📄 License

MIT
