import { Minus, Square, X, Copy, Settings } from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { NavLink } from "react-router-dom"

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)
  const [appWindow, setAppWindow] = useState<any>(null)

  useEffect(() => {
    import("@tauri-apps/api/window").then((mod) => {
      const win = mod.getCurrentWindow()
      setAppWindow(win)
      win.isMaximized().then(setIsMaximized).catch(() => {})
      win.onResized(() => {
        win.isMaximized().then(setIsMaximized).catch(() => {})
      })
    }).catch(() => {})
  }, [])

  const minimize = useCallback(() => { appWindow?.minimize() }, [appWindow])
  const toggleMaximize = useCallback(() => { appWindow?.toggleMaximize() }, [appWindow])
  const close = useCallback(() => { appWindow?.close() }, [appWindow])

  return (
    <div
      data-tauri-drag-region
      className="flex items-center h-9 bg-card border-b select-none shrink-0 z-50"
    >
      {/* Branding — inherits drag from parent */}
      <div className="flex items-center gap-2 pl-3 h-full pointer-events-none">
        <div className="flex h-5 w-5 items-center justify-center rounded bg-primary">
          <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <span className="text-xs font-semibold text-foreground/80 tracking-tight">SABI</span>
        <span className="text-[10px] text-muted-foreground/60 font-medium">v1.1.0</span>
      </div>

      <span className="text-border mx-1 pointer-events-none">|</span>

      {/* Settings link — clickable, breaks out of drag */}
      <NavLink
        to="/settings"
        className={({ isActive }) =>
          `inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors pointer-events-auto ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
        }
      >
        <Settings className="h-3 w-3" />
        <span>Settings</span>
      </NavLink>

      {/* Flexible drag spacer — inherits drag from parent */}
      <div className="flex-1 h-full" />

      {/* Window Controls — clickable, breaks out of drag */}
      <div className="flex h-full shrink-0 pointer-events-auto">
        <button
          onClick={minimize}
          className="inline-flex items-center justify-center w-12 h-full hover:bg-accent transition-colors"
          aria-label="Minimize"
        >
          <Minus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={toggleMaximize}
          className="inline-flex items-center justify-center w-12 h-full hover:bg-accent transition-colors"
          aria-label="Maximize"
        >
          {isMaximized ? (
            <Copy className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Square className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
        <button
          onClick={close}
          className="inline-flex items-center justify-center w-12 h-full hover:bg-red-500 hover:text-white transition-colors group"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground group-hover:text-white" />
        </button>
      </div>
    </div>
  )
}
