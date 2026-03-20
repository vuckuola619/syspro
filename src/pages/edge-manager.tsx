import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Globe, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface EdgeSetting {
  id: string; name: string; description: string; enabled: boolean
}

export default function EdgeManagerPage() {
  const [settings, setSettings] = useState<EdgeSetting[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    try { setSettings(await invoke<EdgeSetting[]>("get_edge_settings")) }
    catch (e) { toast.error(String(e)) }
    finally { setIsLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function toggle(id: string, enable: boolean) {
    setApplying(id)
    try {
      await invoke("set_edge_setting", { settingId: id, enable })
      setSettings(prev => prev.map(s => s.id === id ? { ...s, enabled: enable } : s))
    } catch (e) { toast.error(String(e)) }
    finally { setApplying(null) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edge Bloat Remover</h1>
          <p className="text-sm text-muted-foreground mt-1">Control Microsoft Edge behavior and disable unwanted features</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="space-y-2">
        {settings.map(s => (
          <Card key={s.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <Globe className="h-4.5 w-4.5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
              </div>
              <Switch checked={s.enabled} onCheckedChange={v => toggle(s.id, v)} disabled={applying === s.id} />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30">
        <CardContent className="p-3 text-xs text-blue-800 dark:text-blue-200">
          <strong>Note:</strong> Changes are applied via Group Policy registry keys. Restart Edge for changes to take effect.
        </CardContent>
      </Card>
    </div>
  )
}
