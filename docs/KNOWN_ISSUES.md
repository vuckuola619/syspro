# SABI — Known Issues & Solutions

## 1. Invisible Window on Launch (CRITICAL)

**Date:** 2026-03-26  
**Versions Affected:** v1.3.0 (first build with `visible: false`)  
**Status:** RESOLVED

### Problem
Setting `"visible": false` in `tauri.conf.json` combined with a JS-side `getCurrentWindow().show()` call caused the app window to **never appear** in production builds. The process ran in background but the window stayed invisible.

### Root Cause
The JavaScript `getCurrentWindow().show()` from `@tauri-apps/api/window` fails **silently** in production Tauri builds when:
- Called via `requestAnimationFrame` (fires before WebView is ready)
- Called via `window.addEventListener("load")` (WebView load event timing differs from browser)
- The error is swallowed by `catch {}`, making debugging impossible

### Failed Approaches
1. ❌ `requestAnimationFrame` + dynamic import → fires too early
2. ❌ `window.addEventListener("load")` + static import → also unreliable
3. ❌ Both approaches worked in `tauri dev` mode but NOT in `tauri build`

### Solution
Set `"visible": true` in `tauri.conf.json` and remove all JS-side window show/hide logic. Accept a brief white flash on cold start rather than risk an invisible window.

### Key Files
- `src-tauri/tauri.conf.json` → `app.windows[0].visible`
- `src/main.tsx` → splash screen logic only

### Prevention Rules
> **NEVER set `visible: false` in Tauri window config unless you have a proven Rust-side `setup()` hook to show it.**  
> **NEVER use empty `catch {}` blocks for critical initialization code.**  
> **ALWAYS test production builds (`tauri build`) — `tauri dev` behavior is NOT identical.**

---

## 2. Strict TypeScript Build Failures (TS6133)

**Date:** 2026-03-26  
**Status:** RESOLVED

### Problem
Unused imports cause `tsc` to fail with `TS6133: is declared but its value is never read`, blocking the entire `tauri build` pipeline.

### Examples Fixed
- `Bot` imported but not used in `settings.tsx` (replaced with `Sparkles` which IS used)

### Prevention Rules
> **ALWAYS verify that imported symbols are actually used in the component JSX/logic.**  
> **When removing a feature that uses an imported icon/component, also remove the import.**  
> **Run `npm run build` after every code change to catch these immediately.**

---

## 3. Cargo PATH Not Available in Terminal

**Date:** 2026-03-26  
**Status:** WORKAROUND

### Problem
`npm run tauri build` fails if `cargo` is not in the system PATH for the current terminal session.

### Workaround
Prefix build commands with:
```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;" + $env:PATH
```

### Prevention
Add `%USERPROFILE%\.cargo\bin` to the system PATH permanently via Windows Environment Variables.

---

## General Rules for SABI Development

1. **Always test with `tauri build`**, not just `tauri dev` — they have different runtime behaviors
2. **Never use empty `catch {}` blocks** for initialization or window management code — at minimum log the error
3. **Run `npm run build` before committing** to catch TypeScript strict mode errors
4. **Keep imports clean** — remove unused imports immediately when refactoring
5. **Tauri window config changes** require a full rebuild to take effect
6. **WebView2 behavior differs** between dev and production — never assume JS APIs work the same way
