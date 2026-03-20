import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Cpu, MemoryStick, Wifi, HardDrive, Activity, TrendingUp } from "lucide-react"

interface LiveStats {
  cpu_usage: number
  ram_usage: number
  ram_used_gb: number
  ram_total_gb: number
  disk_read_bytes: number
  disk_write_bytes: number
  net_rx_bytes: number
  net_tx_bytes: number
  process_count: number
  top_cpu_process: string
  top_ram_process: string
  timestamp: number
}

const MAX_HISTORY = 60 // 60 data points = ~2 minutes at 2s intervals

function Sparkline({ data, color, height = 48, max }: { data: number[]; color: string; height?: number; max?: number }) {
  if (data.length < 2) return <div style={{ height }} className="w-full rounded bg-muted/30" />
  
  const effectiveMax = max ?? Math.max(...data, 1)
  const width = 100
  const points = data.map((val, i) => {
    const x = (i / (MAX_HISTORY - 1)) * width
    const y = height - (val / effectiveMax) * (height - 4)
    return `${x},${y}`
  }).join(" ")
  
  const areaPoints = `0,${height} ${points} ${(data.length - 1) / (MAX_HISTORY - 1) * width},${height}`
  
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace("#","")})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
}

export default function LiveMonitorPage() {
  const [stats, setStats] = useState<LiveStats | null>(null)
  const [cpuHistory, setCpuHistory] = useState<number[]>([])
  const [ramHistory, setRamHistory] = useState<number[]>([])
  const [netRxHistory, setNetRxHistory] = useState<number[]>([])
  const [netTxHistory, setNetTxHistory] = useState<number[]>([])
  const prevNetRef = useRef<{ rx: number; tx: number } | null>(null)

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 2000)
    return () => clearInterval(interval)
  }, [])

  async function fetchStats() {
    try {
      const data = await invoke<LiveStats>("get_live_stats")
      setStats(data)
      
      setCpuHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), data.cpu_usage])
      setRamHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), data.ram_usage])
      
      // Calculate network delta
      if (prevNetRef.current) {
        const rxDelta = Math.max(0, data.net_rx_bytes - prevNetRef.current.rx)
        const txDelta = Math.max(0, data.net_tx_bytes - prevNetRef.current.tx)
        setNetRxHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), rxDelta])
        setNetTxHistory(prev => [...prev.slice(-(MAX_HISTORY - 1)), txDelta])
      }
      prevNetRef.current = { rx: data.net_rx_bytes, tx: data.net_tx_bytes }
    } catch (e) {
      console.error("Failed to fetch live stats:", e)
    }
  }

  const latestRxRate = netRxHistory.length > 0 ? netRxHistory[netRxHistory.length - 1] : 0
  const latestTxRate = netTxHistory.length > 0 ? netTxHistory[netTxHistory.length - 1] : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Live System Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Real-time system metrics with 2-second refresh rate
        </p>
      </div>

      {/* Main Sparkline Charts */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                  <Cpu className="h-4 w-4 text-blue-600" />
                </div>
                <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
              </div>
              <span className="text-2xl font-bold tabular-nums" style={{color: (stats?.cpu_usage ?? 0) > 80 ? '#ef4444' : '#3b82f6'}}>
                {stats?.cpu_usage.toFixed(1) ?? "0.0"}%
              </span>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <Sparkline data={cpuHistory} color="#3b82f6" height={64} max={100} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-500/10">
                  <MemoryStick className="h-4 w-4 text-violet-600" />
                </div>
                <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold tabular-nums" style={{color: (stats?.ram_usage ?? 0) > 85 ? '#ef4444' : '#8b5cf6'}}>
                  {stats?.ram_usage.toFixed(1) ?? "0.0"}%
                </span>
                <p className="text-xs text-muted-foreground">{stats?.ram_used_gb ?? 0} / {stats?.ram_total_gb ?? 0} GB</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <Sparkline data={ramHistory} color="#8b5cf6" height={64} max={100} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                  <Wifi className="h-4 w-4 text-emerald-600" />
                </div>
                <CardTitle className="text-sm font-medium">Network ↓ Download</CardTitle>
              </div>
              <span className="text-lg font-semibold text-emerald-600 tabular-nums">{formatBytes(latestRxRate)}/s</span>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <Sparkline data={netRxHistory} color="#10b981" height={64} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                </div>
                <CardTitle className="text-sm font-medium">Network ↑ Upload</CardTitle>
              </div>
              <span className="text-lg font-semibold text-amber-600 tabular-nums">{formatBytes(latestTxRate)}/s</span>
            </div>
          </CardHeader>
          <CardContent className="pb-3">
            <Sparkline data={netTxHistory} color="#f59e0b" height={64} />
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
              <Activity className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Processes</p>
              <p className="text-lg font-bold tabular-nums">{stats?.process_count ?? 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
              <Wifi className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Received</p>
              <p className="text-lg font-bold tabular-nums">{formatBytes(stats?.net_rx_bytes ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
              <TrendingUp className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Sent</p>
              <p className="text-lg font-bold tabular-nums">{formatBytes(stats?.net_tx_bytes ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-500/10">
              <HardDrive className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">RAM Free</p>
              <p className="text-lg font-bold tabular-nums">{((stats?.ram_total_gb ?? 0) - (stats?.ram_used_gb ?? 0)).toFixed(1)} GB</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Processes */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300">Top CPU</Badge>
              <span className="text-sm font-medium">{stats?.top_cpu_process ?? "Scanning..."}</span>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary" className="bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300">Top RAM</Badge>
              <span className="text-sm font-medium">{stats?.top_ram_process ?? "Scanning..."}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
