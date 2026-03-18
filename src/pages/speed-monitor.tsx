import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wifi, RefreshCw, ArrowUp, ArrowDown } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { invoke } from "@tauri-apps/api/core"

interface NetworkSpeed {
  adapter_name: string
  bytes_sent: number
  bytes_received: number
  speed_mbps: number
  timestamp_ms: number
}

interface SpeedEntry {
  adapter_name: string
  upload_kbps: number
  download_kbps: number
  total_sent_mb: number
  total_received_mb: number
}

export default function SpeedMonitorPage() {
  const [speeds, setSpeeds] = useState<SpeedEntry[]>([])
  const [monitoring, setMonitoring] = useState(false)
  const prevRef = useRef<NetworkSpeed[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function pollSpeed() {
    try {
      const current = await invoke<NetworkSpeed[]>("get_network_speed")
      const prev = prevRef.current
      if (prev.length > 0) {
        const entries: SpeedEntry[] = current.map(c => {
          const p = prev.find(p => p.adapter_name === c.adapter_name)
          const dt = p ? (c.timestamp_ms - p.timestamp_ms) / 1000 : 1
          const dl = p ? (c.bytes_received - p.bytes_received) / 1024 / (dt || 1) : 0
          const ul = p ? (c.bytes_sent - p.bytes_sent) / 1024 / (dt || 1) : 0
          return {
            adapter_name: c.adapter_name,
            upload_kbps: Math.max(0, Math.round(ul)),
            download_kbps: Math.max(0, Math.round(dl)),
            total_sent_mb: Math.round(c.bytes_sent / 1024 / 1024 * 10) / 10,
            total_received_mb: Math.round(c.bytes_received / 1024 / 1024 * 10) / 10,
          }
        }).filter(e => e.total_sent_mb > 0 || e.total_received_mb > 0)
        setSpeeds(entries)
      }
      prevRef.current = current
    } catch (e) { console.error(e) }
  }

  function startMonitoring() {
    setMonitoring(true)
    pollSpeed()
    intervalRef.current = setInterval(pollSpeed, 2000)
  }

  function stopMonitoring() {
    setMonitoring(false)
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  useEffect(() => { return () => { if (intervalRef.current) clearInterval(intervalRef.current) } }, [])

  function formatSpeed(kbps: number) {
    if (kbps > 1024) return `${(kbps / 1024).toFixed(1)} MB/s`
    return `${kbps} KB/s`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Internet Speed Monitor</h1>
        <p className="text-sm text-muted-foreground mt-1">Real-time network upload/download speeds per adapter</p>
      </div>

      <Button onClick={monitoring ? stopMonitoring : startMonitoring} className="gap-2">
        {monitoring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
        {monitoring ? "Stop Monitoring" : "Start Monitoring"}
      </Button>

      {speeds.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {speeds.map(s => (
            <Card key={s.adapter_name}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <Wifi className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium truncate">{s.adapter_name}</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    <ArrowDown className="h-4 w-4 text-emerald-500" />
                    <div>
                      <p className="text-lg font-bold">{formatSpeed(s.download_kbps)}</p>
                      <p className="text-[10px] text-muted-foreground">Download</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ArrowUp className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-lg font-bold">{formatSpeed(s.upload_kbps)}</p>
                      <p className="text-[10px] text-muted-foreground">Upload</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{s.total_received_mb} MB</p>
                    <p className="text-[10px] text-muted-foreground">Total Received</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{s.total_sent_mb} MB</p>
                    <p className="text-[10px] text-muted-foreground">Total Sent</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Wifi className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mt-3">{monitoring ? "Gathering data..." : "Click \"Start Monitoring\" to view real-time network speeds"}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
