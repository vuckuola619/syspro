import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { BellOff, RefreshCw, ToggleLeft, ToggleRight, ShieldCheck } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface PopupSetting {
  id: string
  name: string
  description: string
  blocked: boolean
}

export default function PopupBlockerPage() {
  const [settings, setSettings] = useState<PopupSetting[]>([])
  const [loading, setLoading] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  async function loadSettings() {
    setLoading(true)
    try {
      const result = await invoke<PopupSetting[]>("get_popup_settings")
      setSettings(result)
    } catch (e) { toast.error(String(e)) }
    finally { setLoading(false) }
  }

  async function toggleSetting(id: string, block: boolean) {
    setToggling(id)
    try {
      await invoke("set_popup_setting", { settingId: id, block })
      setSettings(prev => prev.map(s => s.id === id ? { ...s, blocked: block } : s))
    } catch (e) { toast.error(String(e)) }
    finally { setToggling(null) }
  }

  async function blockAll() {
    for (const s of settings.filter(s => !s.blocked)) {
      await toggleSetting(s.id, true)
    }
  }

  const blockedCount = settings.filter(s => s.blocked).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pop-up & Ad Blocker</h1>
        <p className="text-sm text-muted-foreground mt-1">Block Windows tips, suggestions, and notification ads</p>
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={loadSettings} disabled={loading} className="gap-2">
          {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
          {settings.length === 0 ? "Scan Settings" : "Refresh"}
        </Button>
        {settings.length > 0 && (
          <Button onClick={blockAll} variant="outline" className="gap-2" disabled={blockedCount === settings.length}>
            <ShieldCheck className="h-4 w-4" />
            Block All ({settings.length - blockedCount} remaining)
          </Button>
        )}
      </div>

      {settings.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b">
              <h3 className="text-sm font-medium">Notification Settings ({blockedCount}/{settings.length} blocked)</h3>
            </div>
            <div className="divide-y">
              {settings.map(s => (
                <div key={s.id} className="flex items-center px-4 py-3.5 hover:bg-accent/50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={toggling === s.id}
                    onClick={() => toggleSetting(s.id, !s.blocked)}
                    className={`gap-1.5 text-xs ${s.blocked ? "text-emerald-600" : "text-muted-foreground"}`}
                  >
                    {toggling === s.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : s.blocked ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                    {s.blocked ? "Blocked" : "Allowed"}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {settings.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <BellOff className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground mt-3">Click "Scan Settings" to detect Windows notification and ad settings</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
