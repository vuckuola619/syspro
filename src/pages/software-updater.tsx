import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, RefreshCw, CheckCircle2, Package, Zap } from "lucide-react"
import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"

interface SoftwareItem {
  name: string
  current_version: string
  latest_version: string
  publisher: string
  needs_update: boolean
}

export default function SoftwareUpdaterPage() {
  const [isScanning, setIsScanning] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [apps, setApps] = useState<SoftwareItem[]>([])
  const [updating, setUpdating] = useState<string | null>(null)
  const [updatingAll, setUpdatingAll] = useState(false)
  const [updateResults, setUpdateResults] = useState<Record<string, string>>({})

  async function startScan() {
    setIsScanning(true)
    try {
      const data = await invoke<SoftwareItem[]>("check_software_updates")
      setApps(data)
      setHasScanned(true)
    } catch (e) { console.error(e) }
    finally { setIsScanning(false) }
  }

  async function updateApp(name: string) {
    setUpdating(name)
    try {
      const msg = await invoke<string>("update_software_winget", { appName: name })
      setUpdateResults(prev => ({ ...prev, [name]: msg }))
    } catch (e) {
      setUpdateResults(prev => ({ ...prev, [name]: String(e) }))
    }
    finally { setUpdating(null) }
  }

  async function updateAll() {
    setUpdatingAll(true)
    try {
      const msg = await invoke<string>("update_all_software")
      setUpdateResults(prev => ({ ...prev, _all: msg }))
    } catch (e) {
      setUpdateResults(prev => ({ ...prev, _all: String(e) }))
    }
    finally { setUpdatingAll(false) }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Software Updater</h1>
        <p className="text-sm text-muted-foreground mt-1">Scan installed software and update via winget (silent)</p>
      </div>

      {!hasScanned ? (
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              {isScanning ? <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" /> : <Download className="h-6 w-6 text-blue-600" />}
            </div>
            <div className="flex-1">
              <p className="font-medium">{isScanning ? "Scanning installed software..." : "Check installed software"}</p>
              <p className="text-sm text-muted-foreground">Reads real version info from Windows registry</p>
            </div>
            <Button onClick={startScan} disabled={isScanning} className="gap-2">
              <Download className="h-4 w-4" /> Scan Software
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Found {apps.length} installed applications</p>
                <p className="text-sm text-muted-foreground">Click Update to upgrade via winget (silent install)</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={startScan} disabled={isScanning} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${isScanning ? "animate-spin" : ""}`} /> Refresh
                </Button>
                <Button onClick={updateAll} disabled={updatingAll} className="gap-2">
                  {updatingAll ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Update All
                </Button>
              </div>
            </CardContent>
          </Card>

          {updateResults._all && (
            <Card className="border-blue-200 bg-blue-50/30">
              <CardContent className="p-3">
                <p className="text-xs font-mono text-blue-800 whitespace-pre-wrap max-h-32 overflow-auto">{updateResults._all}</p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-1">
            {apps.map((app) => (
              <Card key={app.name}>
                <CardContent className="flex items-center gap-4 p-3 px-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50">
                    <Package className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{app.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{app.publisher || "Unknown"}</p>
                  </div>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 shrink-0">{app.current_version}</Badge>
                  <Button
                    size="sm" variant="outline"
                    onClick={() => updateApp(app.name)}
                    disabled={updating === app.name}
                    className="gap-1.5 text-xs h-7 px-2"
                  >
                    {updating === app.name ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
                    Update
                  </Button>
                  {updateResults[app.name] && (
                    <span className="text-[10px] text-muted-foreground max-w-[150px] truncate">{updateResults[app.name]}</span>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
