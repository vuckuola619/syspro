import { useEffect, useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Rocket, RefreshCw, AlertTriangle } from "lucide-react"

interface StartupItem {
  name: string
  publisher: string
  command: string
  location: string
  enabled: boolean
  impact: "high" | "medium" | "low"
}

export default function StartupManagerPage() {
  const [items, setItems] = useState<StartupItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadStartupItems()
  }, [])

  async function loadStartupItems() {
    setIsLoading(true)
    try {
      const data = await invoke<StartupItem[]>("get_startup_items")
      setItems(data)
    } catch (e) {
      console.error("Failed to load startup items:", e)
      // Fallback demo data
      setItems([
        { name: "Microsoft Edge", publisher: "Microsoft Corporation", command: "msedge.exe", location: "Registry (HKCU)", enabled: true, impact: "high" },
        { name: "Discord", publisher: "Discord Inc.", command: "Update.exe --processStart Discord.exe", location: "Registry (HKCU)", enabled: true, impact: "high" },
        { name: "Spotify", publisher: "Spotify AB", command: "Spotify.exe /minimized", location: "Registry (HKCU)", enabled: true, impact: "medium" },
        { name: "Steam Client", publisher: "Valve Corporation", command: "steam.exe -silent", location: "Registry (HKCU)", enabled: true, impact: "high" },
        { name: "OneDrive", publisher: "Microsoft Corporation", command: "OneDrive.exe /background", location: "Registry (HKCU)", enabled: true, impact: "medium" },
        { name: "Realtek HD Audio", publisher: "Realtek Semiconductor", command: "RAVCpl64.exe", location: "Registry (HKLM)", enabled: true, impact: "low" },
        { name: "Windows Security", publisher: "Microsoft Corporation", command: "SecurityHealthSystray.exe", location: "Registry (HKLM)", enabled: true, impact: "low" },
        { name: "iTunes Helper", publisher: "Apple Inc.", command: "iTunesHelper.exe", location: "Registry (HKCU)", enabled: false, impact: "medium" },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  async function toggleItem(index: number) {
    const item = items[index]
    const updated = !item.enabled

    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, enabled: updated } : it))
    )

    try {
      await invoke("toggle_startup_item", { name: item.name, enabled: updated })
    } catch (e) {
      console.error("Failed to toggle startup item:", e)
      // Revert on failure
      setItems((prev) =>
        prev.map((it, i) => (i === index ? { ...it, enabled: !updated } : it))
      )
    }
  }

  const enabledCount = items.filter((i) => i.enabled).length
  const highImpactEnabled = items.filter((i) => i.enabled && i.impact === "high").length

  const impactColors = {
    high: "bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30",
    medium: "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30",
    low: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30",
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Startup Manager</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Control which programs run at system startup to improve boot time
        </p>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Rocket className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">
              {enabledCount} of {items.length} startup programs enabled
            </p>
            {highImpactEnabled > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                <AlertTriangle className="h-3 w-3" />
                {highImpactEnabled} high-impact programs may slow your startup
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={loadStartupItems} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </CardContent>
      </Card>

      {/* Items List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <Card key={index}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <Badge variant="outline" className={`text-[10px] ${impactColors[item.impact]}`}>
                      {item.impact}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {item.publisher}
                  </p>
                  <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                    {item.location}
                  </p>
                </div>
                <Switch
                  checked={item.enabled}
                  onCheckedChange={() => toggleItem(index)}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
