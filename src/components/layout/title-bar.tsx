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

  // Use Tauri startDragging API instead of data-tauri-drag-region
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    // Don't drag if clicking on interactive elements
    const target = e.target as HTMLElement
    if (target.closest('button, a, input, [data-no-drag]')) return
    appWindow?.startDragging()
  }, [appWindow])

  return (
    <div
      onMouseDown={handleDragStart}
      className="flex items-center h-8 bg-card border-b select-none shrink-0 z-50"
    >
      {/* Branding — only icon + name, no duplicate version */}
      <div className="flex items-center gap-1.5 pl-3 h-full pointer-events-none">
        <div className="flex h-4 w-4 items-center justify-center rounded bg-primary">
          <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
        </div>
        <span className="text-[11px] font-semibold text-foreground/80 tracking-tight">SABI</span>
      </div>

      <span className="text-border mx-1 pointer-events-none text-[10px]">|</span>

      {/* Settings link */}
      <NavLink
        to="/settings"
        data-no-drag
        className={({ isActive }) =>
          `inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"}`
        }
      >
        <Settings className="h-3 w-3" />
        <span>Settings</span>
      </NavLink>

      {/* Flexible drag spacer */}
      <div className="flex-1 h-full" />

      {/* Window Controls */}
      <div className="flex h-full shrink-0">
        <button
          data-no-drag
          onClick={minimize}
          className="inline-flex items-center justify-center w-11 h-full hover:bg-accent transition-colors"
          aria-label="Minimize"
        >
          <Minus className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        <button
          data-no-drag
          onClick={toggleMaximize}
          className="inline-flex items-center justify-center w-11 h-full hover:bg-accent transition-colors"
          aria-label="Maximize"
        >
          {isMaximized ? (
            <Copy className="h-3 w-3 text-muted-foreground" />
          ) : (
            <Square className="h-3 w-3 text-muted-foreground" />
          )}
        </button>
        <button
          data-no-drag
          onClick={close}
          className="inline-flex items-center justify-center w-11 h-full hover:bg-red-500 hover:text-white transition-colors group"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5 text-muted-foreground group-hover:text-white" />
        </button>
      </div>
    </div>
  )
}
