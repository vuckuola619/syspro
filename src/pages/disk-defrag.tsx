import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { HardDrive, RefreshCw, Zap, CheckCircle2 } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

interface DefragAnalysis {
  drive: string
  fragmented_percent: number
  status: string
  details: string
}

const DRIVES = ["C:", "D:", "E:", "F:"]

export default function DiskDefragPage() {
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null)
  const [isOptimizing, setIsOptimizing] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, DefragAnalysis>>({})
  const [optimizeResult, setOptimizeResult] = useState("")

  async function analyze(drive: string) {
    setIsAnalyzing(drive)
    try {
      const data = await invoke<DefragAnalysis>("analyze_fragmentation", { drive })
      setResults(prev => ({ ...prev, [drive]: data }))
    } catch (e) { console.error(e) }
    finally { setIsAnalyzing(null) }
  }

  async function optimize(drive: string) {
    setIsOptimizing(drive)
    setOptimizeResult("")
    try {
      const msg = await invoke<string>("run_defrag", { drive })
      setOptimizeResult(msg)
      // Re-analyze after optimization
      await analyze(drive)
    } catch (e) { console.error(e) }
    finally { setIsOptimizing(null) }
  }

  function statusColor(status: string) {
    if (status === "Optimal") return "text-emerald-600"
    if (status === "Moderate") return "text-amber-600"
    return "text-red-600"
  }

  function barColor(pct: number) {
    if (pct <= 5) return "bg-emerald-50 dark:bg-emerald-500/100"
    if (pct <= 15) return "bg-amber-50 dark:bg-amber-500/100"
    return "bg-red-50 dark:bg-red-500/100"
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Disk Defragmenter</h1>
        <p className="text-sm text-muted-foreground mt-1">Analyze and optimize disk fragmentation using Windows defrag</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {DRIVES.map(drive => {
          const result = results[drive]
          return (
            <Card key={drive}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-lg">{drive}</span>
                  </div>
                  {result && (
                    <Badge variant="secondary" className={`${result.status === "Optimal" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : result.status === "Moderate" ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300"}`}>
                      {result.status}
                    </Badge>
                  )}
                </div>

                {result && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Fragmentation</span>
                      <span className={`font-semibold ${statusColor(result.status)}`}>{result.fragmented_percent}%</span>
                    </div>
                    <Progress value={result.fragmented_percent} indicatorClassName={barColor(result.fragmented_percent)} />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => analyze(drive)} disabled={isAnalyzing === drive} className="gap-1.5 flex-1">
                    {isAnalyzing === drive ? <RefreshCw className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Analyze
                  </Button>
                  {result && result.fragmented_percent > 5 && (
                    <Button size="sm" onClick={() => optimize(drive)} disabled={isOptimizing === drive} className="gap-1.5 flex-1">
                      {isOptimizing === drive ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                      Optimize
                    </Button>
                  )}
                  {result && result.fragmented_percent <= 5 && (
                    <Badge variant="secondary" className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 gap-1 flex items-center">
                      <CheckCircle2 className="h-3 w-3" /> OK
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {optimizeResult && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-mono text-muted-foreground whitespace-pre-wrap">{optimizeResult}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
