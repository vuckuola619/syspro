import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Eraser, RefreshCw, Trash2, HardDrive, AlertTriangle, CheckCircle } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface SlimTarget {
  id: string
  name: string
  description: string
  size_mb: number
  safe: boolean
}

export default function SystemSlimmingPage() {
  const [targets, setTargets] = useState<SlimTarget[]>([])
  const [loading, setLoading] = useState(false)
  const [cleaning, setCleaning] = useState<string | null>(null)
  const [cleaned, setCleaned] = useState<Set<string>>(new Set())

  async function scan() {
    setLoading(true)
    setCleaned(new Set())
    try {
      const result = await invoke<SlimTarget[]>("scan_slim_targets")
      setTargets(Array.isArray(result) ? result : [])
    } catch (e) { toast.error(String(e)) }
    finally { setLoading(false) }
  }

  async function cleanTarget(id: string) {
    setCleaning(id)
    try {
      await invoke<string>("clean_slim_target", { targetId: id })
      setCleaned(prev => new Set([...prev, id]))
    } catch (e) { toast.error(String(e)) }
    finally { setCleaning(null) }
  }

  const totalMb = targets.reduce((sum, t) => sum + t.size_mb, 0)
  const cleanedMb = targets.filter(t => cleaned.has(t.id)).reduce((sum, t) => sum + t.size_mb, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">System Slimming</h1>
        <p className="text-sm text-muted-foreground mt-1">Remove old Windows installations, update caches, and reclaim disk space</p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={scan} disabled={loading} className="gap-2">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Eraser className="h-4 w-4" />}
          {targets.length === 0 ? "Scan for Reclaimable Space" : "Re-Scan"}
        </Button>
        {targets.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Found <span className="font-medium text-foreground">{totalMb.toFixed(1)} MB</span> reclaimable
            {cleanedMb > 0 && <> — <span className="text-emerald-600 font-medium">{cleanedMb.toFixed(1)} MB cleaned</span></>}
          </p>
        )}
      </div>

      {targets.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-medium">Slim Targets ({targets.length})</h3>
            </div>
            <div className="divide-y">
              {targets.map(t => (
                <div key={t.id} className={`flex items-center px-4 py-3.5 hover:bg-accent/50 transition-colors ${cleaned.has(t.id) ? "opacity-50" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{t.name}</p>
                      {!t.safe && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Caution
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-sm font-medium">{(t.size_mb ?? 0) > 0 ? `${(t.size_mb ?? 0).toFixed(1)} MB` : "Variable"}</span>
                    {cleaned.has(t.id) ? (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <Button variant="outline" size="sm" disabled={cleaning === t.id} onClick={() => cleanTarget(t.id)} className="gap-1.5 text-xs">
                        {cleaning === t.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        Clean
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {targets.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <HardDrive className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mt-3">Click "Scan for Reclaimable Space" to find Windows.old, update caches, and more</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
