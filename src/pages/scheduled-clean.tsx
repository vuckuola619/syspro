import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Calendar, RefreshCw, CheckCircle2, Trash2, Shield, Database, Clock } from "lucide-react"
import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"

interface ScheduleConfig {
  enabled: boolean
  frequency: string
  time: string
  junk: boolean
  privacy: boolean
  registry: boolean
}

export default function ScheduledCleanPage() {
  const [config, setConfig] = useState<ScheduleConfig>({
    enabled: false, frequency: "weekly", time: "03:00", junk: true, privacy: true, registry: false
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [result, setResult] = useState("")

  useEffect(() => {
    invoke<ScheduleConfig>("get_schedule_config").then(setConfig).catch(console.error)
  }, [])

  async function save() {
    setIsSaving(true)
    setSaved(false)
    try {
      const msg = await invoke<string>("set_schedule_config", { config })
      setResult(msg)
      setSaved(true)
    } catch (e) { toast.error(String(e)) }
    finally { setIsSaving(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scheduled Cleaning</h1>
        <p className="text-sm text-muted-foreground mt-1">Automate junk cleanup via Windows Task Scheduler</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">Automatic Cleaning</p>
                <p className="text-xs text-muted-foreground">Registers a Windows Scheduled Task</p>
              </div>
            </div>
            <button
              onClick={() => setConfig({ ...config, enabled: !config.enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.enabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white dark:bg-zinc-900 transition-transform ${config.enabled ? "translate-x-6" : "translate-x-1"}`} />
            </button>
          </div>

          {config.enabled && (
            <>
              {/* Frequency */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Frequency</p>
                <div className="flex gap-2">
                  {["daily", "weekly", "monthly"].map(f => (
                    <button
                      key={f}
                      onClick={() => setConfig({ ...config, frequency: f })}
                      className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${config.frequency === f ? "bg-primary text-white" : "bg-muted hover:bg-muted/80"}`}
                    >
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time */}
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-2"><Clock className="h-4 w-4" /> Time</p>
                <input
                  type="time"
                  value={config.time}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfig({ ...config, time: e.target.value })}
                  className="rounded-md border px-3 py-1.5 text-sm"
                />
              </div>

              {/* What to clean */}
              <div className="space-y-2">
                <p className="text-sm font-medium">What to clean</p>
                <div className="flex gap-3">
                  {([
                    { key: "junk" as const, label: "Junk Files", icon: <Trash2 className="h-3.5 w-3.5" /> },
                    { key: "privacy" as const, label: "Privacy Traces", icon: <Shield className="h-3.5 w-3.5" /> },
                    { key: "registry" as const, label: "Registry", icon: <Database className="h-3.5 w-3.5" /> },
                  ]).map(item => (
                    <button
                      key={item.key}
                      onClick={() => setConfig({ ...config, [item.key]: !config[item.key] })}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${config[item.key] ? "bg-primary/10 text-primary border border-primary/30" : "bg-muted text-muted-foreground"}`}
                    >
                      {item.icon} {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={save} disabled={isSaving} className="gap-2">
              {isSaving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {config.enabled ? "Save & Register Task" : "Save & Disable"}
            </Button>
            {saved && <Badge variant="secondary" className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">{result}</Badge>}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
