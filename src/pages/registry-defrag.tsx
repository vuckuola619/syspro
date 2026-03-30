import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Database, RefreshCw, Wrench, HardDrive } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface RegistryDefragInfo {
  hive_name: string
  current_size_mb: number
  fragmentation_percent: number
  can_defrag: boolean
}

export default function RegistryDefragPage() {
  const [hives, setHives] = useState<RegistryDefragInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [defragging, setDefragging] = useState(false)
  const [defragResult, setDefragResult] = useState("")

  async function analyze() {
    setLoading(true)
    setDefragResult("")
    try {
      const result = await invoke<RegistryDefragInfo[]>("analyze_registry_fragmentation")
      setHives(Array.isArray(result) ? result : [])
    } catch (e) { toast.error(String(e)) }
    finally { setLoading(false) }
  }

  async function defrag() {
    setDefragging(true)
    setDefragResult("")
    try {
      const result = await invoke<string>("run_registry_defrag")
      setDefragResult(result)
    } catch (e: any) { setDefragResult(`Error: ${e}`) }
    finally { setDefragging(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Registry Defrag</h1>
        <p className="text-sm text-muted-foreground mt-1">Analyze and optimize Windows registry hive fragmentation</p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={analyze} disabled={loading} className="gap-2">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
          {hives.length === 0 ? "Analyze Registry" : "Re-Analyze"}
        </Button>
        {hives.length > 0 && (
          <Button onClick={defrag} disabled={defragging} variant="outline" className="gap-2">
            {defragging ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
            Defrag Registry
          </Button>
        )}
      </div>

      {hives.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {hives.map(h => (
            <Card key={h.hive_name}>
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <HardDrive className="h-5 w-5 text-primary" />
                  <p className="text-sm font-medium">{h.hive_name}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Size</span>
                    <span className="font-medium">{(h.current_size_mb ?? 0).toFixed(1)} MB</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Fragmentation</span>
                    <span className={`font-medium ${h.fragmentation_percent > 10 ? "text-red-600" : h.fragmentation_percent > 5 ? "text-amber-600" : "text-emerald-600"}`}>
                      {h.fragmentation_percent}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mt-1">
                    <div className={`h-2 rounded-full transition-all ${h.fragmentation_percent > 10 ? "bg-red-50 dark:bg-red-500/100" : h.fragmentation_percent > 5 ? "bg-amber-50 dark:bg-amber-500/100" : "bg-emerald-50 dark:bg-emerald-500/100"}`}
                      style={{ width: `${Math.min(h.fragmentation_percent * 5, 100)}%` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {defragResult && (
        <Card className={defragResult.startsWith("Error") ? "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10/50" : "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10/50"}>
          <CardContent className="p-4 text-center">
            <p className={`text-sm font-medium ${defragResult.startsWith("Error") ? "text-red-800 dark:text-red-200" : "text-emerald-800 dark:text-emerald-200"}`}>{defragResult}</p>
          </CardContent>
        </Card>
      )}

      {hives.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Database className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mt-3">Click "Analyze Registry" to check hive sizes and fragmentation levels</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
