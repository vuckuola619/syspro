import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Cpu, RefreshCw, Shield, AlertTriangle } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

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

export default function CpuSaverPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [processes, setProcesses] = useState<ProcessPriorityInfo[]>([])
  const [changingPid, setChangingPid] = useState<number | null>(null)
  const [filter, setFilter] = useState("")
  const [sortBy, setSortBy] = useState<"cpu" | "memory" | "name">("cpu")

  async function loadProcesses() {
    setIsLoading(true)
    try {
      const data = await invoke<ProcessPriorityInfo[]>("get_process_priorities")
      const safeData = Array.isArray(data) ? data : []
      setProcesses(safeData)
      toast.success(`Loaded ${safeData.length} processes`)
    } catch (e) {
      toast.error(String(e))
    } finally {
      setIsLoading(false)
    }
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
      // Update local state
      setProcesses(prev => prev.map(p =>
        p.pid === pid ? { ...p, priority: priority.charAt(0).toUpperCase() + priority.slice(1) } : p
      ))
    } catch (e) {
      toast.error(String(e))
    } finally {
      setChangingPid(null)
    }
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
      } catch { /* skip protected processes */ }
    }

    toast.success(`Gaming Mode: Lowered priority of ${changed} background processes`)
    loadProcesses() // Refresh
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
        <h1 className="text-2xl font-semibold tracking-tight">CPU Saver</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage process priorities to optimize CPU allocation</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="cursor-pointer hover:border-primary/30 transition-colors" onClick={loadProcesses}>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-500/10">
              {isLoading ? <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" /> : <Cpu className="h-5 w-5 text-blue-600" />}
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
                      {(proc.cpu_usage ?? 0).toFixed(1)}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">CPU</p>
                  </div>
                  <div className="text-right shrink-0 w-20">
                    <p className="text-xs font-semibold">{(proc.memory_mb ?? 0).toFixed(0)} MB</p>
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

      {processes.length === 0 && !isLoading && (
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
    </div>
  )
}
