import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Pause, Shield } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"

interface UpdateInfo {
  hotfix_id: string; description: string; installed_on: string
}

export default function UpdateManagerPage() {
  const [updates, setUpdates] = useState<UpdateInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState("")

  async function load() {
    setIsLoading(true)
    try { setUpdates(await invoke<UpdateInfo[]>("get_update_history")) }
    catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function pause(days: number) {
    try {
      const msg = await invoke<string>("pause_windows_updates", { days })
      setResult(msg)
    } catch (e: unknown) { setResult(String(e)) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Windows Update Manager</h1>
          <p className="text-sm text-muted-foreground mt-1">View update history and control Windows Update behavior</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => pause(7)} className="gap-2" size="sm">
          <Pause className="h-3.5 w-3.5" /> Pause 7 days
        </Button>
        <Button variant="outline" onClick={() => pause(14)} className="gap-2" size="sm">
          <Pause className="h-3.5 w-3.5" /> Pause 14 days
        </Button>
        <Button variant="outline" onClick={() => pause(30)} className="gap-2" size="sm">
          <Pause className="h-3.5 w-3.5" /> Pause 30 days
        </Button>
      </div>

      {result && <Card><CardContent className="p-2 text-xs font-medium">{result}</CardContent></Card>}

      <h3 className="text-sm font-semibold text-muted-foreground">Installed Updates ({updates.length})</h3>
      <div className="space-y-1">
        {updates.map(u => (
          <Card key={u.hotfix_id}>
            <CardContent className="p-2.5 flex items-center gap-3">
              <Shield className="h-4 w-4 text-blue-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-xs">{u.hotfix_id}</p>
                <p className="text-[10px] text-muted-foreground">{u.description}</p>
              </div>
              <Badge variant="outline" className="text-[10px]">{u.installed_on}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
