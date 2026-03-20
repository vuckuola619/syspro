import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Cpu, HardDrive, MemoryStick, RefreshCw, Zap, Timer, Award } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

interface BenchmarkResult {
  cpu_score: number
  cpu_time_ms: number
  cpu_primes_found: number
  disk_write_mbps: number
  disk_read_mbps: number
  memory_speed_mbps: number
}

export default function BenchmarksPage() {
  const [result, setResult] = useState<BenchmarkResult | null>(null)
  const [running, setRunning] = useState(false)

  async function runBenchmark() {
    setRunning(true)
    try {
      const res = await invoke<BenchmarkResult>("run_benchmark")
      setResult(res)
    } catch (e) { console.error(e) }
    finally { setRunning(false) }
  }

  const overallScore = result ? Math.round((result.cpu_score + result.disk_write_mbps + result.disk_read_mbps + result.memory_speed_mbps) / 4) : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System Benchmarks</h1>
        <p className="text-sm text-muted-foreground mt-1">Test your CPU, disk, and memory performance</p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={runBenchmark} disabled={running} className="gap-2">
          {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {running ? "Running Benchmark..." : result ? "Run Again" : "Start Benchmark"}
        </Button>
        {running && <p className="text-xs text-muted-foreground">This may take 10–30 seconds...</p>}
      </div>

      {result && (
        <>
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-6 text-center">
              <Award className="h-8 w-8 mx-auto text-primary" />
              <p className="text-4xl font-bold text-primary mt-2">{overallScore}</p>
              <p className="text-sm text-muted-foreground mt-1">Overall Score</p>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-500/15"><Cpu className="h-5 w-5 text-blue-600" /></div>
                  <div>
                    <p className="text-sm font-medium">CPU</p>
                    <p className="text-xs text-muted-foreground">Prime Number Test</p>
                  </div>
                </div>
                <p className="text-2xl font-bold">{result.cpu_score.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-1">Score (primes/sec)</p>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Time</span><span>{result.cpu_time_ms} ms</span></div>
                  <div className="flex justify-between text-xs"><span className="text-muted-foreground">Primes found</span><span>{result.cpu_primes_found.toLocaleString()}</span></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/15"><HardDrive className="h-5 w-5 text-amber-600" /></div>
                  <div>
                    <p className="text-sm font-medium">Disk</p>
                    <p className="text-xs text-muted-foreground">64 MB Sequential I/O</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-2xl font-bold">{result.disk_write_mbps.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Write MB/s</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{result.disk_read_mbps.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">Read MB/s</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-500/15"><MemoryStick className="h-5 w-5 text-emerald-600" /></div>
                  <div>
                    <p className="text-sm font-medium">Memory</p>
                    <p className="text-xs text-muted-foreground">256 MB Copy Test</p>
                  </div>
                </div>
                <p className="text-2xl font-bold">{result.memory_speed_mbps.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-1">Speed MB/s</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {!result && !running && (
        <Card>
          <CardContent className="py-12 text-center">
            <Timer className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mt-3">Click "Start Benchmark" to test your system performance</p>
            <p className="text-xs text-muted-foreground mt-1">Tests CPU (prime computation), Disk (read/write), and Memory (copy speed)</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
