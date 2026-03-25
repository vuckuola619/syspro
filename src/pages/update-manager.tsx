import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, Pause, Shield, ExternalLink } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface UpdateInfo {
  hotfix_id: string; description: string; installed_on: string;
  title: string; kb_url: string
}

export default function UpdateManagerPage() {
  const [updates, setUpdates] = useState<UpdateInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState("")

  async function load() {
    setIsLoading(true)
    try { setUpdates(await invoke<UpdateInfo[]>("get_update_history")) }
    catch (e) { toast.error(String(e)) }
    finally { setIsLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function pause(days: number) {
    try {
      const msg = await invoke<string>("pause_windows_updates", { days })
      setResult(msg)
      toast.success(msg)
    } catch (e: unknown) {
      setResult(String(e))
      toast.error(String(e))
    }
  }

  async function openUrl(url: string) {
    try { await invoke("open_in_explorer", { path: url }) } catch {}
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
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${u.description === "Security Update" ? "bg-emerald-50 dark:bg-emerald-500/10" : "bg-blue-50 dark:bg-blue-500/10"}`}>
                <Shield className={`h-4 w-4 ${u.description === "Security Update" ? "text-emerald-600" : "text-blue-500"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm">{u.hotfix_id}</p>
                  <Badge variant={u.description === "Security Update" ? "default" : "secondary"} className="text-[10px]">
                    {u.description || "Update"}
                  </Badge>
                </div>
                {u.title ? (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{u.title}</p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">Windows {u.description || "Update"}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-muted-foreground">{u.installed_on}</span>
                {u.kb_url && (
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openUrl(u.kb_url)} title="View KB article">
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
