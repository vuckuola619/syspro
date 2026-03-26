# SABI — User Guide

> **Version:** 1.1.1 · **Platform:** Windows 10/11 (64-bit)

---

## Table of Contents

- [Installation](#installation)
- [Getting Started](#getting-started)
- [Overview](#1-overview)
- [Cleaning](#2-cleaning)
- [Performance](#3-performance)
- [Privacy & Security](#4-privacy--security)
- [System Tools](#5-system-tools)
- [Disk & Files](#6-disk--files)
- [Network](#7-network)
- [Utilities](#8-utilities)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

---

## Installation

### Option A: NSIS Installer (Recommended)

1. Download `SABI_1.1.1_x64-setup.exe` from [Releases](https://github.com/vuckuola619/syspro/releases/latest)
2. Run the installer and follow the wizard
3. SABI will launch automatically after installation

### Option B: MSI Installer (Enterprise)

1. Download `SABI_1.1.1_x64_en-US.msi`
2. Double-click to install, or deploy via GPO: `msiexec /i SABI_1.1.1_x64_en-US.msi /quiet`

### System Requirements

| Requirement | Minimum |
|---|---|
| OS | Windows 10 version 1803+ or Windows 11 |
| Architecture | x64 (64-bit) |
| RAM | 4 GB |
| Disk | 50 MB free space |
| Runtime | WebView2 (bundled with installer) |

---

## Getting Started

When you first launch SABI, you'll see the **Dashboard** — a centralized overview of your system health.

### Navigation

- **Sidebar** — All 46 tools organized into 8 categories
- **Category Dropdown** — Filter tools by category (top of sidebar)
- **Search** — Type to find any tool instantly
- **Title Bar** — Settings gear icon, minimize/maximize/close controls

### Quick Actions

1. **One-Click Optimize** — Runs all cleaners and optimizers in sequence
2. **Smart Optimize** — Get a health score (0–100) with targeted recommendations
3. **Dashboard** — View real-time system metrics at a glance

---

## 1. Overview

### Dashboard

The home screen showing real-time system metrics:
- CPU usage, RAM usage, disk space
- System information summary
- Quick-access cards to frequently used tools

### One-Click Optimize

Runs a comprehensive optimization in one step:
1. Click "Run Optimization"
2. SABI will clean junk, optimize RAM, and clear temporary caches
3. A summary report shows what was cleaned and how much space was recovered

### Smart Optimize

AI-powered system health analysis that scores your system across 5 categories:

| Category | What It Checks | Max Score |
|---|---|---|
| Memory | RAM usage percentage | 20 |
| Disk Space | Free space on all drives | 20 |
| Startup | Number of startup programs | 20 |
| Security | Defender & Firewall status | 20 |
| Updates | Pending Windows updates | 20 |

**How to use:**
1. Click "Analyze System"
2. Wait for the analysis (may take 10–30 seconds for update check)
3. Review your score, grade (A+ to F), and category breakdown
4. Follow the color-coded recommendations (Critical → High → Medium → Low)

---

## 2. Cleaning

### Junk Cleaner

Removes temporary files, browser caches, and system logs.

1. Click "Scan" to find junk files
2. Review the categories and sizes found
3. Click "Clean" to delete selected items

**What gets cleaned:** Windows temp files, browser cache (Edge/Chrome/Firefox), system logs, Windows Update cache, thumbnail cache, crash dumps.

### Registry Cleaner

Scans for broken, orphaned, and invalid Windows registry entries.

1. Click "Scan Registry" to find issues
2. Review the list of found entries (each with a severity indicator)
3. Click "Clean" — a backup is **automatically created** before any changes

> ⚠️ **Safety:** SABI always creates a `.reg` backup file before cleaning. You can restore it by double-clicking the backup file.

### Registry Defrag

Analyzes registry hive fragmentation and compacts them for faster access.

1. Click "Analyze" to scan hive sizes
2. View fragmentation percentages
3. Click "Defrag" to compact (requires restart to complete)

### Duplicate Finder

Finds duplicate files using SHA-256 hashing.

1. Select the folder to scan
2. Click "Scan" — files are compared by hash, not just name
3. Review duplicates grouped by content
4. Select which copies to delete

> **Note:** Uses partial hashing (first 64KB) for files >10MB to save memory. Limited to 50,000 files per scan.

### System Slimming

Remove unnecessary Windows components to free disk space.

---

## 3. Performance

### Startup Manager

Control which programs run at boot.

- **Boot Time Analysis** — See how long each startup item adds to boot
- **Enable/Disable** — Toggle programs without deleting them
- **Context Menu Manager** — Manage right-click context menu entries

### Performance Monitor

Real-time CPU and RAM usage with optimization tools.

- Click "Optimize" for a detailed step-by-step RAM optimization report
- Uses `EmptyWorkingSet` and standby cache clearing

### Live Monitor

Continuous real-time performance dashboard with history graphs for CPU, RAM, and disk I/O.

### Turbo Boost

One-click performance mode:
1. Click "Enable Turbo Boost"
2. SABI stops non-essential services and optimizes process priorities
3. Click "Restore" to return everything to normal

### Benchmarks

Run CPU, memory, and disk performance tests with scores you can compare.

### CPU Saver

Detects CPU-hungry background processes:
1. Click "Scan" to find processes using excessive CPU
2. View each process with its CPU usage percentage
3. Manage or kill resource-heavy processes

### Smart Clean

Intelligent cleaning that categorizes junk by type (temp files, logs, caches) and shows exactly what will be cleaned before taking action.

---

## 4. Privacy & Security

### Privacy Eraser

Deep clean browser data and Windows tracking:
- **Chrome/Edge/Firefox** — History, cookies, cache, autofill, download history
- **Tracking Cookies** — Detects and removes known tracking cookies
- **Windows Telemetry** — Clear telemetry traces

### Privacy Hardening

Windows privacy toggles:
- Disable telemetry collection
- Disable advertising ID
- Disable location/camera/microphone tracking
- Control activity history

### Browser Extensions

Scan browser extensions across installed browsers:
1. Click "Scan" to find extensions in Chrome, Edge, and Firefox
2. View each extension's name, description, and version
3. Identify potentially unwanted extensions

### Anti-Spyware

Windows Defender integration:
- **Status** — Check if real-time protection is enabled
- **Quick Scan** — Fast targeted scan
- **Full Scan** — Comprehensive system scan
- **Update Definitions** — Download latest virus definitions

> Requires Windows Defender (built-in on Windows 10/11).

### DNS Protector

Switch to secure, encrypted DNS providers:

| Provider | Primary DNS | Feature |
|---|---|---|
| Cloudflare | 1.1.1.1 | Privacy-focused, fastest |
| Google | 8.8.8.8 | Reliable |
| Quad9 | 9.9.9.9 | Malware blocking |
| OpenDNS | 208.67.222.222 | Family shield |
| AdGuard DNS | 94.140.14.14 | Ad blocking |
| CleanBrowsing | 185.228.168.9 | Security filter |
| Comodo | 8.26.56.26 | Malware protection |
| NextDNS | 45.90.28.0 | Customizable |

**How to use:**
1. View your current DNS configuration
2. Click a provider to switch
3. Click "Reset to DHCP" to restore automatic DNS

### Ad Blocker

System-level ad and tracker blocking via the Windows hosts file:
1. Toggle categories: Ads, Trackers, Telemetry, Malware
2. Click "Enable" — SABI adds blocking entries to your hosts file
3. Click "Disable" to restore the original hosts file from backup

> **Safety:** Always backs up your hosts file before modification.

### Login Monitor

View Windows login history from the Security Event Log:
- **Event 4624** — Successful logins
- **Event 4625** — Failed login attempts
- Filter by success/failure
- Logon type decoding (Interactive, Network, Remote Desktop, etc.)

### Pop-up Blocker / Firewall Manager / File Hider / Password Generator

See the application for in-tool instructions.

---

## 5. System Tools

### Software Updater

Detect and install software updates via `winget`:
1. Click "Check for Updates"
2. Review available updates with current and latest versions
3. Click "Update" to install silently, or "Update All" for batch update

### Driver Updater

Scan hardware drivers:
1. Click "Scan Drivers"
2. View all PnP drivers with version, manufacturer, and category
3. Drivers needing updates are flagged

### App Uninstaller

Cleanly remove installed applications:
1. Browse or search the list of installed programs
2. Click "Uninstall" to remove
3. SABI scans for leftover registry entries and files after removal

### Windows Debloater

Remove pre-installed Windows apps (Photos, Xbox, Cortana, etc.):
- Toggle individual apps on/off
- Removals are logged and can be reversed via `winget install`

### Windows Tweaks / Service Manager / Edge Manager / Update Manager

In-app instructions provided for each tool.

### Multi-User

View all Windows user profiles on the system:
1. Click "Scan Profiles"
2. View each user's profile path, disk usage, last login time, and active status
3. Active sessions are highlighted with a green badge

---

## 6. Disk & Files

### Disk Analyzer

Visualize what's using disk space (similar to WinDirStat):
- Tree view of folders with size bars
- Right-click to open or delete folders
- Sort by size to find space hogs

### Disk Health

S.M.A.R.T. diagnostics for all drives:
- Temperature, power-on hours, wear level
- Health percentage with color-coded status

### Large File Finder

Find the biggest files on your system:
1. Select drive/folder to scan
2. Set minimum file size threshold
3. View results sorted by size with path, date, and type

### Empty Folders

Detect empty directory trees:
1. Click "Scan" to find empty folders
2. Review the list
3. Click "Delete" to clean selected folders

### App Junk

Scan for leftover files from uninstalled applications.

### File Recovery

Browse and restore files from the Windows Recycle Bin:
1. Click "Scan Recycle Bin" to list deleted files
2. Select files to restore (checkbox or individual "Restore" button)
3. Click "Restore Selected" to recover files to original location
4. Click "Empty Bin" to permanently delete all items

### Cloud Cleaner

Clean cache files from cloud storage services:
1. Click "Scan Cloud Caches"
2. View detected caches: OneDrive, Dropbox, Google Drive, iCloud
3. Click "Clean" on individual services to remove cache files

> **Safety:** Only deletes log and cache files — never touches synced data.

### File Shredder / File Splitter

In-app instructions provided.

---

## 7. Network

### Internet Booster

Optimize DNS settings for faster browsing.

### Speed Monitor

Real-time bandwidth usage graph showing upload and download rates.

### Network Monitor

View active TCP and UDP connections with process names, ports, and remote addresses.

### Hosts Editor

Edit the Windows hosts file:
1. View current entries
2. Add new entries (IP → hostname mapping)
3. Edit or delete existing entries

### Speed Test

Test internet speed (ping, download, upload) with visual results.

---

## 8. Utilities

### System Info

Comprehensive hardware and software inventory:
- OS version, build number, architecture
- CPU model, cores, clock speed
- GPU model and driver version
- RAM total and type
- BIOS version and serial number
- Network adapter details

### Export Report

Generate ISO 27001 compliance audit reports:
- Covers: OS, BitLocker, admins, firewall, antivirus, network, and more
- Export as TXT or CSV
- Suitable for compliance documentation

### Scheduled Clean / Restore Points

In-app instructions provided.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+F` | Search features in sidebar |
| `F5` | Refresh current page |
| `Ctrl+,` | Open Settings |

---

## Troubleshooting

### "Access Denied" errors

Some features require administrator privileges. Right-click SABI and select "Run as administrator".

### Features show empty data

- Ensure the feature has been started (click "Scan" or "Analyze")
- Some features require specific Windows components (e.g., Anti-Spyware needs Windows Defender)
- Check that required services are running

### DNS Protector not applying

- The feature requires admin privileges to modify network adapter settings
- If using a VPN, DNS may be overridden by the VPN client

### Build errors (from source)

- Ensure Rust, Node.js, and Windows SDK are installed
- Run `$env:Path = "$env:USERPROFILE\.cargo\bin;$env:Path"` if Cargo isn't found

---

## FAQ

**Q: Does SABI collect any data?**
A: No. Zero telemetry, zero cloud connections, zero tracking. Everything runs locally.

**Q: Is SABI free?**
A: Yes. SABI is open-source under the MIT license.

**Q: Will SABI damage my system?**
A: SABI creates backups before making changes (registry, hosts file). All operations can be reversed.

**Q: Why does my antivirus flag SABI?**
A: Some antivirus engines flag Tauri/Rust applications due to heuristic detection of system API calls. SABI is open-source — you can audit the code yourself.

**Q: Does SABI auto-update?**
A: SABI checks GitHub Releases on startup and shows a notification when updates are available.

---

<p align="center">
  <sub>SABI v1.1.1 — System Analytics & Boost Infrastructure</sub><br/>
  <sub>© 2026 SABI · MIT License</sub>
</p>
