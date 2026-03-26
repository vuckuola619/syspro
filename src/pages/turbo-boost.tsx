import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Zap, RefreshCw, Power, Server, MemoryStick, Gauge, Cpu, Shield, AlertTriangle } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

/* ── Types ── */
interface BoostResult {
  services_stopped: number
  memory_freed_mb: number
  processes_optimized: number
  boost_active: boolean
}

interface ProcessPriorityInfo {
  pid: number
  name: string
  cpu_usage: number
  memory_mb: number
  priority: string
}

const PRIORITY_LEVELS = [
  { label: "Idle", value: "idle", color: "#64748b", description: "Lowest priority — runs only when CPU is idle" },
  { label: "Below Normal", value: "below normal", color: "#06b6d4", description: "Lower than normal — for background tasks" },
  { label: "Normal", value: "normal", color: "#22c55e", description: "Default priority for all processes" },
  { label: "Above Normal", value: "above normal", color: "#f59e0b", description: "Higher than normal — for priority tasks" },
  { label: "High", value: "high", color: "#ef4444", description: "High priority — use carefully" },
]

const PROTECTED_PROCESSES = [
  "system", "csrss", "lsass", "services", "svchost", "winlogon",
  "smss", "wininit", "dwm", "explorer", "taskmgr", "registry",
  "ntoskrnl", "audiodg", "fontdrvhost", "searchindexer",
]

/* ── Component ── */
export default function TurboBoostPage() {
  const [tab, setTab] = useState<"turbo" | "priority">("turbo")

  // Turbo Mode state
  const [result, setResult] = useState<BoostResult | null>(null)
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)

  // Process Priority state (from CPU Saver)
  const [processes, setProcesses] = useState<ProcessPriorityInfo[]>([])
  const [isLoadingProc, setIsLoadingProc] = useState(false)
  const [changingPid, setChangingPid] = useState<number | null>(null)
  const [filter, setFilter] = useState("")
  const [sortBy, setSortBy] = useState<"cpu" | "memory" | "name">("cpu")

  // Restore persisted turbo state on mount
  useEffect(() => {
    const saved = localStorage.getItem("turbo_boost_active")
    if (saved === "true") {
      setActive(true)
      const savedResult = localStorage.getItem("turbo_boost_result")
      if (savedResult) try { setResult(JSON.parse(savedResult)) } catch {}
    }
  }, [])

  /* ── Turbo Mode Actions ── */
  async function activate() {
    setLoading(true)
    try {
      const res = await invoke<BoostResult>("activate_turbo_boost")
      setResult(res)
      setActive(true)
      localStorage.setItem("turbo_boost_active", "true")
      localStorage.setItem("turbo_boost_result", JSON.stringify(res))
    } catch (e) { toast.error(String(e)) }
    finally { setLoading(false) }
  }

  async function deactivate() {
    setLoading(true)
    try {
      await invoke("deactivate_turbo_boost")
      setActive(false)
      setResult(null)
      localStorage.removeItem("turbo_boost_active")
      localStorage.removeItem("turbo_boost_result")
    } catch (e) { toast.error(String(e)) }
    finally { setLoading(false) }
  }

  /* ── Process Priority Actions ── */
  async function loadProcesses() {
    setIsLoadingProc(true)
    try {
      const data = await invoke<ProcessPriorityInfo[]>("get_process_priorities")
      setProcesses(data)
      toast.success(`Loaded ${data.length} processes`)
    } catch (e) { toast.error(String(e)) }
    finally { setIsLoadingProc(false) }
  }

  async function changePriority(pid: number, name: string, priority: string) {
    if (PROTECTED_PROCESSES.includes(name.toLowerCase().replace(".exe", ""))) {
      toast.error(`Cannot modify system-critical process: ${name}`)
      return
    }
    setChangingPid(pid)
    try {
      const result = await invoke<string>("set_process_priority", { pid, priority })
      toast.success(result)
      setProcesses(prev => prev.map(p =>
        p.pid === pid ? { ...p, priority: priority.charAt(0).toUpperCase() + priority.slice(1) } : p
      ))
    } catch (e) { toast.error(String(e)) }
    finally { setChangingPid(null) }
  }

  async function applyGamingMode() {
    if (!confirm("Gaming Mode will set high-CPU background processes to Below Normal priority.\n\nThis helps allocate more CPU to your foreground applications.\n\nContinue?")) return
    let changed = 0
    const bgProcesses = processes.filter(p =>
      p.cpu_usage > 2 &&
      !PROTECTED_PROCESSES.includes(p.name.toLowerCase().replace(".exe", "")) &&
      !p.name.toLowerCase().includes("sabi")
    )
    for (const proc of bgProcesses.slice(0, 10)) {
      try {
        await invoke<string>("set_process_priority", { pid: proc.pid, priority: "below normal" })
        changed++
      } catch { /* skip protected */ }
    }
    toast.success(`Gaming Mode: Lowered priority of ${changed} background processes`)
    loadProcesses()
  }

  const displayProcesses = processes
    .filter(p => !filter || p.name.toLowerCase().includes(filter.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "cpu") return b.cpu_usage - a.cpu_usage
      if (sortBy === "memory") return b.memory_mb - a.memory_mb
      return a.name.localeCompare(b.name)
    })

  const isProtected = (name: string) =>
    PROTECTED_PROCESSES.includes(name.toLowerCase().replace(".exe", ""))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Turbo / Game Boost</h1>
        <p className="text-sm text-muted-foreground mt-1">Boost performance by stopping services and managing process priorities</p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 p-1 rounded-lg bg-muted/50 w-fit">
        <button
          onClick={() => setTab("turbo")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all font-medium ${tab === "turbo" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Zap className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" /> Turbo Mode
        </button>
        <button
          onClick={() => setTab("priority")}
          className={`px-4 py-1.5 text-sm rounded-md transition-all font-medium ${tab === "priority" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Cpu className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" /> Process Priority
        </button>
      </div>

      {/* ─── Turbo Mode Tab ─── */}
      {tab === "turbo" && (
        <>
          <Card className={active ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50" : ""}>
            <CardContent className="p-8 text-center">
              <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center ${active ? "bg-amber-100 dark:bg-amber-500/15 ring-4 ring-amber-200" : "bg-muted"}`}>
                <Zap className={`h-10 w-10 ${active ? "text-amber-600" : "text-muted-foreground"}`} />
              </div>
              <h2 className="text-xl font-bold mt-4">{active ? "Turbo Mode Active" : "Turbo Mode Off"}</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                {active
                  ? "Non-essential services are stopped, visual effects reduced, and process priority elevated."
                  : "Activate to temporarily stop background services and optimize system resources for gaming or intensive tasks."}
              </p>
              <div className="mt-6">
                {active ? (
                  <Button onClick={deactivate} disabled={loading} variant="outline" className="gap-2">
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                    Deactivate Turbo Mode
                  </Button>
                ) : (
                  <Button onClick={activate} disabled={loading} className="gap-2 bg-amber-600 hover:bg-amber-700">
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Activate Turbo Mode
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {result && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/15"><Server className="h-5 w-5 text-blue-600" /></div>
                  <div>
                    <p className="text-2xl font-bold">{result.services_stopped}</p>
                    <p className="text-xs text-muted-foreground">Services Stopped</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/15"><MemoryStick className="h-5 w-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-2xl font-bold">{result.memory_freed_mb} MB</p>
                    <p className="text-xs text-muted-foreground">Memory Freed</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-500/15"><Gauge className="h-5 w-5 text-purple-600" /></div>
                  <div>
                    <p className="text-2xl font-bold">{result.processes_optimized}</p>
                    <p className="text-xs text-muted-foreground">Processes Optimized</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          <Card className="border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5">
            <CardContent className="p-4">
              <p className="text-xs text-amber-800 dark:text-amber-200"><span className="font-medium">Note:</span> Turbo Mode stops services like SysMain, Windows Search, DiagTrack, etc. These will be restored when you deactivate or restart your PC.</p>
            </CardContent>
          </Card>
        </>
      )}

      {/* ─── Process Priority Tab ─── */}
      {tab === "priority" && (
        <>
          {/* Quick Actions */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={loadProcesses}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
                  {isLoadingProc ? <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" /> : <Cpu className="h-5 w-5 text-blue-600" />}
                </div>
                <div>
                  <p className="text-sm font-medium">Scan Processes</p>
                  <p className="text-xs text-muted-foreground">{processes.length > 0 ? `${processes.length} loaded` : "Click to load"}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="cursor-pointer hover:border-green-500/30 transition-colors" onClick={applyGamingMode}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 dark:bg-green-500/10">
                  <Cpu className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Gaming Mode</p>
                  <p className="text-xs text-muted-foreground">Lower background priorities</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 dark:bg-purple-500/10">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Protected</p>
                  <p className="text-xs text-muted-foreground">{PROTECTED_PROCESSES.length} system processes</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          {processes.length > 0 && (
            <div className="flex items-center gap-3">
              <input
                className="flex-1 rounded-md border bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Filter processes..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
              />
              <div className="flex gap-1">
                {(["cpu", "memory", "name"] as const).map(s => (
                  <Button
                    key={s}
                    variant={sortBy === s ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy(s)}
                    className="text-xs"
                  >
                    {s === "cpu" ? "CPU %" : s === "memory" ? "RAM" : "Name"}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Process list */}
          {displayProcesses.length > 0 && (
            <div className="space-y-1">
              {displayProcesses.map(proc => {
                const protected_ = isProtected(proc.name)
                return (
                  <Card key={`${proc.pid}-${proc.name}`} className={protected_ ? "opacity-60" : ""}>
                    <CardContent className="flex items-center gap-3 px-4 py-2.5 p-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 shrink-0">
                        <Cpu className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{proc.name}</p>
                          {protected_ && (
                            <Badge variant="secondary" className="text-[9px] gap-1">
                              <Shield className="h-2.5 w-2.5" /> Protected
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">PID {proc.pid}</p>
                      </div>
                      <div className="text-right shrink-0 w-16">
                        <p className="text-xs font-semibold" style={{
                          color: proc.cpu_usage > 20 ? "#ef4444" : proc.cpu_usage > 5 ? "#f59e0b" : "#22c55e"
                        }}>
                          {proc.cpu_usage.toFixed(1)}%
                        </p>
                        <p className="text-[10px] text-muted-foreground">CPU</p>
                      </div>
                      <div className="text-right shrink-0 w-20">
                        <p className="text-xs font-semibold">{proc.memory_mb.toFixed(0)} MB</p>
                        <p className="text-[10px] text-muted-foreground">RAM</p>
                      </div>
                      <select
                        className="rounded-md border bg-muted/50 px-2 py-1 text-xs w-32 shrink-0"
                        value={proc.priority.toLowerCase()}
                        disabled={protected_ || changingPid === proc.pid}
                        onChange={e => changePriority(proc.pid, proc.name, e.target.value)}
                      >
                        {PRIORITY_LEVELS.map(level => (
                          <option key={level.value} value={level.value}>{level.label}</option>
                        ))}
                      </select>
                      {changingPid === proc.pid && (
                        <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin shrink-0" />
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {processes.length === 0 && !isLoadingProc && (
            <Card>
              <CardContent className="p-8 text-center">
                <Cpu className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Click "Scan Processes" to load running processes and manage their priorities.</p>
                <div className="mt-4 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-500/10 text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>Changing process priorities can affect system stability. System-critical processes are protected and cannot be modified.</span>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
