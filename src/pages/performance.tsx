import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Progress } from "@/components/ui/progress"
import { Cpu, MemoryStick, Zap, RefreshCw } from "lucide-react"

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

export default function PerformancePage() {
  const [stats, setStats] = useState<PerformanceStats>({
    cpu_usage: 0,
    ram_usage: 0,
    processes: [],
  })
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optimized, setOptimized] = useState(false)

  async function optimizeRam() {
    setIsOptimizing(true)
    try {
      await invoke("optimize_memory")
    } catch (_e) {
      // continues regardless
    }
    setTimeout(() => {
      setIsOptimizing(false)
      setOptimized(true)
    }, 2000)
  }

  useEffect(() => {
    loadStats()
    const interval = setInterval(loadStats, 2000)
    return () => clearInterval(interval)
  }, [])

  async function loadStats() {
    try {
      const data = await invoke<PerformanceStats>("get_processes")
      setStats(data)
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
                <p className="text-lg font-semibold">{stats.cpu_usage.toFixed(1)}%</p>
              </div>
            </div>
            <Progress value={stats.cpu_usage} className="mt-3 h-1.5" indicatorClassName="bg-blue-50 dark:bg-blue-500/100" />
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
                <p className="text-lg font-semibold">{stats.ram_usage.toFixed(1)}%</p>
              </div>
            </div>
            <Progress value={stats.ram_usage} className="mt-3 h-1.5" indicatorClassName="bg-violet-50 dark:bg-violet-500/100" />
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
                <p className="text-lg font-semibold">{optimized ? "Done" : "Ready"}</p>
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

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h3 className="text-sm font-medium">Running Processes</h3>
            <Badge variant="secondary">{stats.processes.length} top processes</Badge>
          </div>
          <div className="divide-y">
            {stats.processes.map((proc: ProcessInfo) => (
              <div key={proc.pid} className="flex items-center px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{proc.name}</p>
                  <p className="text-xs text-muted-foreground">PID: {proc.pid}</p>
                </div>
                <div className="text-right w-20">
                  <p className="text-xs text-muted-foreground">CPU</p>
                  <p className={`text-sm font-medium ${proc.cpu_percent > 10 ? "text-red-600" : ""}`}>
                    {proc.cpu_percent.toFixed(1)}%
                  </p>
                </div>
                <div className="text-right w-24">
                  <p className="text-xs text-muted-foreground">Memory</p>
                  <p className="text-sm font-medium">{proc.memory_mb < 1 ? "< 1" : proc.memory_mb.toFixed(0)} MB</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
