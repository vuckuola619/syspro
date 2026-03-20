import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Wrench, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"

interface Tweak {
  id: string; name: string; description: string; category: string; enabled: boolean
}

export default function WindowsTweaksPage() {
  const [tweaks, setTweaks] = useState<Tweak[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    try { setTweaks(await invoke<Tweak[]>("get_windows_tweaks")) }
    catch (e) { console.error(e) }
    finally { setIsLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function toggle(id: string, enable: boolean) {
    setApplying(id)
    try {
      await invoke("set_windows_tweak", { tweakId: id, enable })
      setTweaks(prev => prev.map(t => t.id === id ? { ...t, enabled: enable } : t))
    } catch (e) { console.error(e) }
    finally { setApplying(null) }
  }

  const categories = [...new Set(tweaks.map(t => t.category))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Windows Tweaks</h1>
          <p className="text-sm text-muted-foreground mt-1">Customize Windows UI, taskbar, Explorer & system behavior</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {categories.map(cat => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{cat}</h3>
          </div>
          <div className="space-y-1.5">
            {tweaks.filter(t => t.category === cat).map(t => (
              <Card key={t.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.enabled && <Badge variant="secondary" className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-[10px]">Active</Badge>}
                    <Switch checked={t.enabled} onCheckedChange={(v) => toggle(t.id, v)} disabled={applying === t.id} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      <Card className="bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30">
        <CardContent className="p-3 text-xs text-amber-800 dark:text-amber-200">
          <strong>Note:</strong> Some tweaks require restarting Explorer or signing out to take effect.
        </CardContent>
      </Card>
    </div>
  )
}
