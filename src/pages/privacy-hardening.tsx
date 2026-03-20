import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShieldCheck, RefreshCw, Lock } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface PrivacyToggle {
  id: string; name: string; description: string; category: string
  enabled: boolean; registry_path: string; registry_value: string
}

export default function PrivacyHardeningPage() {
  const [settings, setSettings] = useState<PrivacyToggle[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)

  async function load() {
    setIsLoading(true)
    try { setSettings(await invoke<PrivacyToggle[]>("get_privacy_settings")) }
    catch (e) { toast.error(String(e)) }
    finally { setIsLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function toggle(id: string, enable: boolean) {
    setApplying(id)
    try {
      await invoke("set_privacy_setting", { settingId: id, enable })
      setSettings(prev => prev.map(s => s.id === id ? { ...s, enabled: enable } : s))
    } catch (e) { toast.error(String(e)) }
    finally { setApplying(null) }
  }

  async function applyAll() {
    setIsLoading(true)
    for (const s of settings) {
      if (!s.enabled) {
        try { await invoke("set_privacy_setting", { settingId: s.id, enable: true }) }
        catch (e) { toast.error(String(e)) }
      }
    }
    await load()
  }

  const applied = settings.filter(s => s.enabled).length
  const categories = [...new Set(settings.map(s => s.category))]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Privacy Hardening</h1>
          <p className="text-sm text-muted-foreground mt-1">Control Windows telemetry, tracking & data collection at the registry level</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="text-sm gap-1">
            <ShieldCheck className="h-3.5 w-3.5" /> {applied}/{settings.length} Applied
          </Badge>
          <Button onClick={applyAll} disabled={isLoading || applied === settings.length} size="sm" className="gap-1.5">
            <Lock className="h-3.5 w-3.5" /> Apply All
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={isLoading} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {categories.map(cat => (
        <div key={cat}>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">{cat}</h3>
          <div className="space-y-1.5">
            {settings.filter(s => s.category === cat).map(s => (
              <Card key={s.id}>
                <CardContent className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.description}</p>
                  </div>
                  <Switch checked={s.enabled} onCheckedChange={(v) => toggle(s.id, v)} disabled={applying === s.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
