import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Gauge, ArrowDown, ArrowUp, Clock, RefreshCw, Wifi, Globe } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface SpeedResult {
  download_mbps: number; upload_mbps: number; latency_ms: number
  server: string; timestamp: string
}

export default function SpeedTestPage() {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState<SpeedResult | null>(null)
  const [history, setHistory] = useState<SpeedResult[]>([])

  async function run() {
    setTesting(true)
    try {
      const res = await invoke<SpeedResult>("run_speed_test")
      setResult(res)
      setHistory(prev => [res, ...prev].slice(0, 10))
    } catch (e) { toast.error(String(e)) }
    finally { setTesting(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Internet Speed Test</h1>
        <p className="text-sm text-muted-foreground mt-1">Measure your real download and upload speed</p>
      </div>

      <div className="flex justify-center">
        <Button size="lg" onClick={run} disabled={testing} className="gap-3 text-lg px-12 py-7 rounded-xl">
          {testing ? <RefreshCw className="h-6 w-6 animate-spin" /> : <Gauge className="h-6 w-6" />}
          {testing ? "Testing..." : result ? "Test Again" : "Start Speed Test"}
        </Button>
      </div>

      {testing && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="relative mx-auto w-32 h-32 mb-4">
              <svg className="w-full h-full animate-spin-slow" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/30" />
                <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="4" className="text-primary" strokeDasharray="70 213" strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <Wifi className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Downloading test file and measuring throughput...</p>
            <p className="text-xs text-muted-foreground/60 mt-1">This may take 10-30 seconds</p>
          </CardContent>
        </Card>
      )}

      {result && !testing && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-emerald-50 dark:bg-emerald-500/10/50 border-emerald-200 dark:border-emerald-500/30">
            <CardContent className="p-6 text-center">
              <ArrowDown className="h-8 w-8 mx-auto text-emerald-600 mb-2" />
              <p className="text-3xl font-bold text-emerald-700 dark:text-emerald-300">{result.download_mbps}</p>
              <p className="text-sm text-emerald-600/80">Mbps Download</p>
            </CardContent>
          </Card>
          <Card className="bg-blue-50 dark:bg-blue-500/10/50 border-blue-200 dark:border-blue-500/30">
            <CardContent className="p-6 text-center">
              <ArrowUp className="h-8 w-8 mx-auto text-blue-600 mb-2" />
              <p className="text-3xl font-bold text-blue-700 dark:text-blue-300">{result.upload_mbps}</p>
              <p className="text-sm text-blue-600/80">Mbps Upload</p>
            </CardContent>
          </Card>
          <Card className="bg-purple-50 dark:bg-purple-500/10/50 border-purple-200 dark:border-purple-500/30">
            <CardContent className="p-6 text-center">
              <Clock className="h-8 w-8 mx-auto text-purple-600 mb-2" />
              <p className="text-3xl font-bold text-purple-700 dark:text-purple-300">{result.latency_ms}</p>
              <p className="text-sm text-purple-600/80">ms Latency</p>
            </CardContent>
          </Card>
        </div>
      )}

      {result && !testing && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Globe className="h-3.5 w-3.5" />
              <span>Server: {result.server}</span>
              <span>•</span>
              <span>Tested at: {result.timestamp}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {history.length > 1 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-3">Test History</p>
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center justify-between text-xs bg-muted/50 rounded-lg px-3 py-2">
                  <span className="text-muted-foreground">{h.timestamp}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-emerald-600 font-medium">↓ {h.download_mbps} Mbps</span>
                    <span className="text-blue-600 font-medium">↑ {h.upload_mbps} Mbps</span>
                    <span className="text-purple-600 font-medium">{h.latency_ms}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
