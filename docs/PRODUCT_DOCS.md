# SABI — Product Documentation

> **Version:** 1.1.1 · **Architecture:** Tauri v2 (Rust + React 19)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Backend (Rust)](#backend-rust)
- [Frontend (React)](#frontend-react)
- [Security Model](#security-model)
- [Command Reference](#command-reference)
- [Data Flow](#data-flow)
- [Build & Distribution](#build--distribution)
- [Performance Characteristics](#performance-characteristics)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    SABI Application                  │
├──────────────────┬──────────────────────────────────┤
│   React 19       │        Rust (Tauri v2)           │
│   TypeScript     │        sysinfo · sha2            │
│   shadcn/ui      │        aes-gcm · walkdir         │
│   Vite 6         │        serde · serde_json        │
├──────────────────┤                                  │
│   WebView2       │  ← IPC (invoke/command) →        │
│   (Chromium)     │                                  │
├──────────────────┴──────────────────────────────────┤
│                    Windows OS APIs                   │
│   WMI · CIM · Registry · PowerShell · Event Log     │
│   Defender · Firewall · Hosts · Services · winget   │
└─────────────────────────────────────────────────────┘
```

### Design Principles

1. **Privacy-first** — No telemetry, no cloud connections, no data exfiltration
2. **Least privilege** — Only requests permissions actually needed (Tauri v2 capabilities)
3. **Defense in depth** — Input sanitization, path whitelists, command injection prevention
4. **Graceful degradation** — Features work without admin rights where possible, with clear error messages when elevation is needed
5. **Zero dependencies at runtime** — Self-contained binary with WebView2

---

## Backend (Rust)

### File: `src-tauri/src/lib.rs`

The entire Rust backend resides in a single file (~6,700 lines) organized into clearly-labeled sections:

```
lib.rs Structure:
├── Imports & Dependencies
├── Helper Functions
│   ├── hidden_powershell()      → Create hidden PowerShell process
│   ├── sanitize_powershell_input()  → Prevent command injection
│   └── format_size() variants    → Human-readable byte formatting
├── Feature Sections (organized by tier)
│   ├── P1: System Info, Junk Cleaner, Registry, etc.
│   ├── P2: Startup Manager, Performance, etc.
│   ├── P3: Privacy Eraser, Network, etc.
│   ├── P4: Disk, Benchmarks, Utilities, etc.
│   ├── Gap Tier 1: Large File Finder, Empty Folders, CPU Saver
│   ├── Gap Tier 2: Smart Clean, App Junk, Browser Extensions
│   ├── Gap Tier 3: Anti-Spyware, DNS, Ad Blocker, Login Monitor
│   └── Gap Tier 4: File Recovery, Cloud Cleaner, Multi-User, Smart Optimize
├── run() function — App entrypoint
│   └── invoke_handler registration (all commands)
```

### Key Patterns

#### Hidden PowerShell Execution

All PowerShell commands run via a hidden window (`CREATE_NO_WINDOW`):

```rust
fn hidden_powershell() -> std::process::Command {
    let mut cmd = std::process::Command::new("powershell");
    cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW
    cmd
}

// Usage:
let output = hidden_powershell()
    .args(&["-Command", &ps_script])
    .output()
    .map_err(|e| format!("Error: {}", e))?;
```

#### Input Sanitization

```rust
fn sanitize_powershell_input(input: &str) -> String {
    input.chars().filter(|c| c.is_alphanumeric() || *c == ' '
        || *c == '-' || *c == '_' || *c == '.').collect()
}
```

Applied to all user-provided strings before passing to PowerShell commands.

#### JSON Response Pattern

All commands return `Result<T, String>` where `T` is a `#[derive(Serialize)]` struct:

```rust
#[derive(Serialize)]
struct FeatureResult {
    field: String,
    count: u32,
}

#[tauri::command]
async fn my_command() -> Result<FeatureResult, String> {
    // ...
}
```

---

## Frontend (React)

### File Structure

```
src/
├── App.tsx                    # Router with lazy-loaded pages
├── components/
│   ├── layout/
│   │   ├── app-layout.tsx     # Main layout wrapper
│   │   ├── sidebar.tsx        # Navigation sidebar (46 items, 8 categories)
│   │   └── title-bar.tsx      # Custom window title bar
│   └── ui/                    # shadcn/ui components (Button, Card, Badge, etc.)
├── pages/                     # 46 feature pages
│   ├── dashboard.tsx
│   ├── junk-cleaner.tsx
│   ├── smart-optimize.tsx
│   └── ... (43 more)
└── lib/
    └── utils.ts               # cn() utility for className merging
```

### Routing Pattern

All pages are lazy-loaded with React.lazy and Suspense:

```tsx
const SmartOptimizePage = lazy(() => import("@/pages/smart-optimize"))

// In Routes:
<Route path="/smart-optimize" element={
  <Suspense fallback={<PageSkeleton />}>
    <SmartOptimizePage />
  </Suspense>
} />
```

### Frontend-Backend Communication

Uses Tauri's `invoke()` for IPC:

```tsx
import { invoke } from "@tauri-apps/api/core"

const result = await invoke<ResponseType>("command_name", { arg1: value1 })
```

### UI Components

- **shadcn/ui** — Card, Badge, Button, ScrollArea, Select
- **Lucide Icons** — 50+ icons used throughout
- **sonner** — Toast notifications for user feedback
- **recharts** — Charts for Live Monitor and benchmarks

---

## Security Model

### Threat Mitigation

| Threat | Mitigation |
|---|---|
| **Command Injection** | `sanitize_powershell_input()` strips special characters from all user inputs |
| **Path Traversal** | Cloud Cleaner uses path whitelist — only approved cache directories |
| **DNS Hijacking** | DNS Protector uses provider whitelist — only 8 verified secure DNS providers |
| **Data Loss** | Registry Cleaner creates `.reg` backup; Ad Blocker backs up hosts file |
| **Privilege Escalation** | Tauri v2 capabilities model (explicit permission grants) |
| **Information Disclosure** | All data stays local; no network calls except user-initiated (speed test, updates) |

### Tauri v2 Capabilities

Permissions are defined in `src-tauri/capabilities/default.json`:

```json
{
  "permissions": [
    "core:default",
    "shell:allow-open",
    "dialog:allow-save",
    "fs:default"
  ]
}
```

### Encryption

- **File Hider** — AES-256-GCM with 12-byte nonces, PBKDF2-derived keys
- **Password Generator** — `OsRng` (OS-level CSPRNG) via the `rand` crate

---

## Command Reference

### Overview (3 commands)

| Command | Arguments | Returns | Description |
|---|---|---|---|
| `get_optimization_score` | none | `OptimizationScore` | System health score (0–100) with categories and recommendations |

### Cleaning (10+ commands)

| Command | Arguments | Returns | Description |
|---|---|---|---|
| `scan_junk` | none | `Vec<JunkItem>` | Scan temp/cache/log files |
| `clean_junk` | `paths: Vec<String>` | `CleanResult` | Delete selected junk |
| `scan_registry` | none | `Vec<RegistryIssue>` | Find broken registry entries |
| `clean_registry` | `keys: Vec<String>` | `String` | Clean with auto-backup |
| `scan_duplicates` | `path: String` | `Vec<DuplicateGroup>` | SHA-256 duplicate detection |

### Performance (8+ commands)

| Command | Arguments | Returns | Description |
|---|---|---|---|
| `get_startup_items` | none | `Vec<StartupItem>` | List startup programs |
| `toggle_startup_item` | `name, enabled` | `String` | Enable/disable startup item |
| `optimize_ram` | none | `RamResult` | Empty working sets + standby cache |
| `scan_cpu_hogs` | none | `Vec<ProcessInfo>` | Find CPU-heavy processes |
| `run_smart_clean` | none | `SmartCleanResult` | Category-based junk analysis |

### Privacy & Security (15+ commands)

| Command | Arguments | Returns | Description |
|---|---|---|---|
| `get_defender_status` | none | `DefenderStatus` | Defender protection state |
| `run_quick_scan` | none | `String` | Trigger quick antivirus scan |
| `run_full_scan` | none | `String` | Trigger full antivirus scan |
| `update_defender_definitions` | none | `String` | Update virus definitions |
| `get_dns_config` | none | `DnsConfig` | Current DNS settings |
| `set_dns_provider` | `provider: String` | `String` | Switch to secure DNS |
| `reset_dns_to_auto` | none | `String` | DHCP auto DNS |
| `get_hosts_block_status` | none | `HostsBlockStatus` | Current blocking rules |
| `enable_hosts_blocking` | `categories: Vec` | `String` | Enable ad/tracker blocking |
| `disable_hosts_blocking` | none | `String` | Disable and restore hosts |
| `get_login_events` | none | `Vec<LoginEvent>` | Windows security event log |

### Disk & Files (10+ commands)

| Command | Arguments | Returns | Description |
|---|---|---|---|
| `scan_large_files` | `path, min_size` | `Vec<LargeFile>` | Find files above threshold |
| `scan_empty_folders` | `path` | `Vec<EmptyFolder>` | Find empty directories |
| `scan_app_junk` | none | `Vec<AppJunkEntry>` | Leftover application files |
| `get_recycle_bin_items` | none | `Vec<RecycleBinItem>` | List Recycle Bin contents |
| `restore_recycle_bin_item` | `item_name: String` | `String` | Restore deleted file |
| `empty_recycle_bin` | none | `String` | Permanently empty bin |
| `scan_cloud_caches` | none | `Vec<CloudCacheEntry>` | Cloud storage cache sizes |
| `clean_cloud_cache` | `path: String` | `String` | Clean specific cache |

### System Tools (5+ commands)

| Command | Arguments | Returns | Description |
|---|---|---|---|
| `get_user_profiles` | none | `Vec<UserProfile>` | Windows user profiles |
| `scan_browser_extensions` | none | `Vec<BrowserExtension>` | Installed extensions |

---

## Data Flow

### Typical Feature Flow

```
User Action (React)
    ↓
invoke("command_name", { args })
    ↓
Tauri IPC Bridge
    ↓
#[tauri::command] async fn (Rust)
    ↓
┌─── PowerShell (hidden) ────┐    ┌─── Native Rust ───────────┐
│  WMI/CIM queries           │ or │  sysinfo crate            │
│  Registry operations       │    │  File I/O (walkdir)       │
│  Service management        │    │  SHA-256 hashing          │
│  Event Log reading         │    │  AES-256-GCM encryption   │
└────────────────────────────┘    └───────────────────────────┘
    ↓
Result<T, String> serialized as JSON
    ↓
React state update → UI re-render
    ↓
Toast notification (success/error)
```

### Smart Optimize Flow

```
get_optimization_score()
    ├── sysinfo::System (Memory) → mem_score /20
    ├── sysinfo::Disks (Disk)    → disk_score /20
    ├── Win32_StartupCommand     → startup_score /20
    ├── Get-MpComputerStatus     → security_score /20
    │   Get-NetFirewallProfile
    └── Microsoft.Update.Session → update_score /20
                                    ─────────────
                                    Total: /100 → Grade
```

---

## Build & Distribution

### Build Pipeline

```bash
npm install          # Install React dependencies
npx tauri build      # Compile Rust + bundle frontend + create installers
```

### Output Artifacts

| File | Format | Size | Use Case |
|---|---|---|---|
| `SABI_x.x.x_x64-setup.exe` | NSIS | ~3 MB | End-user installation |
| `SABI_x.x.x_x64_en-US.msi` | WiX | ~3 MB | Enterprise / GPO deployment |

### Configuration

Key config file: `src-tauri/tauri.conf.json`

```json
{
  "productName": "SABI",
  "version": "1.1.1",
  "identifier": "com.sabi.app",
  "build": { "frontendDist": "../dist" },
  "bundle": {
    "targets": ["nsis", "msi"]
  }
}
```

---

## Performance Characteristics

| Metric | Value |
|---|---|
| Cold start | < 2 seconds |
| Hot navigation | < 50ms (lazy-loaded pages) |
| Memory footprint | ~40–80 MB (WebView2) |
| Installer size | ~3 MB |
| Backend binary | ~8 MB (statically linked Rust) |
| PowerShell overhead | ~200–500ms per command |
| SHA-256 hashing | ~500 MB/s (native Rust) |
| AES-256-GCM | ~1 GB/s (hardware-accelerated) |

### Resource Usage

- **Idle** — < 1% CPU, ~40 MB RAM
- **Scanning** — 5–15% CPU (single-threaded PowerShell), ~60 MB RAM
- **Benchmarks** — 100% CPU (intentional), ~80 MB RAM

---

<p align="center">
  <sub>SABI v1.1.1 — Product Documentation</sub><br/>
  <sub>© 2026 SABI · MIT License</sub>
</p>
