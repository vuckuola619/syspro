import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Progress } from "@/components/ui/progress"
import { Cpu, MemoryStick, Zap, RefreshCw, ScrollText } from "lucide-react"
import { toast } from "sonner"

interface ProcessInfo {
  name: string
  pid: number
  cpu_percent: number
  memory_mb: number
}

interface PerformanceStats {
  cpu_usage: number
  ram_usage: number
  processes: ProcessInfo[]
}

interface OptimizeResult {
  before_mb: number
  after_mb: number
  freed_mb: number
  total_mb: number
  actions: string[]
}

export default function PerformancePage() {
  const [stats, setStats] = useState<PerformanceStats>({
    cpu_usage: 0,
    ram_usage: 0,
    processes: [],
  })
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResult | null>(null)

  async function optimizeRam() {
    setIsOptimizing(true)
    setOptimizeResult(null)
    try {
      const result = await invoke<OptimizeResult>("optimize_memory")
      const safeResult = {
        ...result,
        freed_mb: result?.freed_mb ?? 0,
        before_mb: result?.before_mb ?? 0,
        after_mb: result?.after_mb ?? 0,
        total_mb: result?.total_mb ?? 0,
        actions: Array.isArray(result?.actions) ? result.actions : []
      }
      setOptimizeResult(safeResult)
      toast.success(`Freed ${safeResult.freed_mb.toFixed(0)} MB of RAM`)
    } catch (e) {
      toast.error(`Optimization failed: ${e}`)
    } finally {
      setIsOptimizing(false)
    }
  }

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 2000)
    return () => clearInterval(interval)
  }, [])

  async function loadStats() {
    try {
      const data = await invoke<PerformanceStats>("get_processes")
      setStats({
        ...data,
        cpu_usage: data?.cpu_usage ?? 0,
        ram_usage: data?.ram_usage ?? 0,
        processes: Array.isArray(data?.processes) ? data.processes : [],
      })
    } catch (e) {
      console.error("Failed to fetch process stats:", e)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Performance</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor system performance and optimize memory usage
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                <Cpu className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CPU Usage</p>
                <p className="text-lg font-semibold">{(stats.cpu_usage ?? 0).toFixed(1)}%</p>
              </div>
            </div>
            <Progress value={stats.cpu_usage ?? 0} className="mt-3 h-1.5" indicatorClassName="bg-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-500/10">
                <MemoryStick className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Memory</p>
                <p className="text-lg font-semibold">{(stats.ram_usage ?? 0).toFixed(1)}%</p>
              </div>
            </div>
            <Progress value={stats.ram_usage ?? 0} className="mt-3 h-1.5" indicatorClassName="bg-violet-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                <Zap className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Optimization</p>
                <p className="text-lg font-semibold">{optimizeResult ? `${(optimizeResult.freed_mb ?? 0).toFixed(0)} MB freed` : "Ready"}</p>
              </div>
            </div>
            <Button
              size="sm"
              className="w-full mt-3 gap-1.5"
              onClick={optimizeRam}
              disabled={isOptimizing}
            >
              {isOptimizing ? (
                <><RefreshCw className="h-3 w-3 animate-spin" /> Optimizing...</>
              ) : (
                <><Zap className="h-3 w-3" /> Optimize RAM</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Optimization Action Log */}
      {optimizeResult && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <ScrollText className="h-4 w-4" /> Optimization Action Log
              </h3>
              <div className="flex gap-2">
                <Badge variant="secondary">{(optimizeResult.before_mb ?? 0).toFixed(0)} → {(optimizeResult.after_mb ?? 0).toFixed(0)} MB</Badge>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  {(optimizeResult.freed_mb ?? 0).toFixed(0)} MB freed
                </Badge>
              </div>
            </div>
            <div className="divide-y max-h-[300px] overflow-y-auto">
              {Array.isArray(optimizeResult.actions) && optimizeResult.actions.map((action, i) => (
                <div key={i} className="px-4 py-2 text-sm font-mono">
                  <span className="text-muted-foreground mr-2 text-xs">[{String(i + 1).padStart(2, "0")}]</span>
                  <span className={
                    action.startsWith("✓") ? "text-emerald-600" :
                    action.startsWith("⚠") ? "text-amber-600" :
                    action.startsWith("  →") ? "text-muted-foreground text-xs" :
                    ""
                  }>{action}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-medium">Running Processes</h3>
            <Badge variant="secondary">{(stats.processes ?? []).length} top processes</Badge>
          </div>
          <div className="divide-y">
            {Array.isArray(stats.processes) && stats.processes.map((proc: ProcessInfo) => (
              <div key={proc.pid} className="flex items-center px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{proc.name}</p>
                  <p className="text-xs text-muted-foreground">PID: {proc.pid}</p>
                </div>
                <div className="text-right w-20">
                  <p className="text-xs text-muted-foreground">CPU</p>
                  <p className={`text-sm font-medium ${(proc.cpu_percent ?? 0) > 10 ? "text-red-600" : ""}`}>
                    {(proc.cpu_percent ?? 0).toFixed(1)}%
                  </p>
                </div>
                <div className="text-right w-24">
                  <p className="text-xs text-muted-foreground">Memory</p>
                  <p className="text-sm font-medium">{(proc.memory_mb ?? 0) < 1 ? "< 1" : (proc.memory_mb ?? 0).toFixed(0)} MB</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
