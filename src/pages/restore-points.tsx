import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { History, Plus, RefreshCw, Clock, Settings } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"

interface RestorePoint {
  sequence_number: string; description: string; creation_time: string; restore_type: string
}

export default function RestorePointsPage() {
  const [points, setPoints] = useState<RestorePoint[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [result, setResult] = useState("")
  const [customDesc, setCustomDesc] = useState("")
  const [showCustom, setShowCustom] = useState(false)

  async function load() {
    setIsLoading(true)
    try { setPoints(await invoke<RestorePoint[]>("list_restore_points")) }
    catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function create(desc?: string) {
    setIsCreating(true)
    setResult("")
    try {
      const description = desc || `SABI Backup ${new Date().toLocaleDateString()}`
      const msg = await invoke<string>("create_restore_point", { description })
      setResult(msg)
      setCustomDesc("")
      setShowCustom(false)
      await load()
    } catch (e: unknown) { setResult(String(e)) }
    finally { setIsCreating(false) }
  }


  function formatTime(timeStr: string) {
    try {
      // CreationTime from PowerShell comes as "/Date(1234567890000)/" format
      const match = timeStr.match(/\/Date\((\d+)\)\//)
      if (match) {
        const d = new Date(parseInt(match[1]))
        return d.toLocaleString()
      }
      return timeStr
    } catch { return timeStr }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">System Restore Points</h1>
          <p className="text-sm text-muted-foreground mt-1">Create and manage Windows system restore points</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => create()} disabled={isCreating} className="gap-2">
            {isCreating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Create Restore Point
          </Button>
          <Button variant="outline" onClick={load} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Custom description */}
      {!showCustom ? (
        <button onClick={() => setShowCustom(true)} className="text-xs text-primary hover:underline">
          + Create with custom description
        </button>
      ) : (
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <input
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
              placeholder="Enter restore point description..."
              value={customDesc}
              onChange={e => setCustomDesc(e.target.value)}
              onKeyDown={e => e.key === "Enter" && customDesc && create(customDesc)}
            />
            <Button size="sm" onClick={() => create(customDesc)} disabled={!customDesc || isCreating} className="gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Create
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCustom(false)}>Cancel</Button>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className={result.toLowerCase().includes("fail") || result.toLowerCase().includes("error") ? "border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10/50" : "border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10/50"}>
          <CardContent className="p-3">
            <p className={`text-sm font-medium ${result.toLowerCase().includes("fail") || result.toLowerCase().includes("error") ? "text-red-800 dark:text-red-200" : "text-emerald-800 dark:text-emerald-200"}`}>{result}</p>
          </CardContent>
        </Card>
      )}

      {points.length === 0 && !isLoading && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <History className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No restore points found. Create one before making system changes.</p>
        </CardContent></Card>
      )}

      <div className="space-y-2">
        {points.map(p => (
          <Card key={p.sequence_number} className="hover:bg-accent/30 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.description}</p>
                <p className="text-xs text-muted-foreground">{formatTime(p.creation_time)}</p>
              </div>
              <Badge variant="secondary" className="shrink-0">{p.restore_type}</Badge>
              <Badge variant="outline" className="shrink-0">#{p.sequence_number}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Protection settings link */}
      <Card className="border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-blue-500/10/50">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-blue-800 dark:text-blue-200">System Protection Settings</p>
            <p className="text-[11px] text-blue-600 mt-0.5">Configure restore point disk usage, enable/disable protection on drives</p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0" onClick={() => {
            setResult("Opening System Protection settings...")
            invoke("open_system_protection").catch(() => {
              // If command doesn't exist yet, user can open manually
              setResult("Open manually: Run → SABIpertiesProtection.exe")
            })
          }}>
            <Settings className="h-3.5 w-3.5" /> Open Settings
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
